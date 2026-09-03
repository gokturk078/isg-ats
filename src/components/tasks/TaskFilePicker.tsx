'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Camera, FileSpreadsheet, ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    ATTACHMENT_ACCEPT,
    formatFileSize,
    PHOTO_ACCEPT,
    selectTaskFiles,
    type SelectedTaskFile,
    type TaskFileKind,
} from '@/lib/uploads/task-files';

export function TaskFilePicker({
    files,
    onChange,
    allowPhotos = true,
    allowAttachments = true,
    disabled = false,
}: {
    files: SelectedTaskFile[];
    onChange: (files: SelectedTaskFile[]) => void;
    allowPhotos?: boolean;
    allowAttachments?: boolean;
    disabled?: boolean;
}) {
    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);
    const attachmentRef = useRef<HTMLInputElement>(null);
    const filesRef = useRef(files);

    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    useEffect(() => () => {
        filesRef.current.forEach((file) => {
            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
        });
    }, []);

    const addFiles = (incoming: FileList | null, kind: TaskFileKind) => {
        if (!incoming) return;
        const { selected, errors } = selectTaskFiles(Array.from(incoming), kind);
        if (errors.length) {
            toast.error(errors.length === 1 ? errors[0] : `${errors.length} dosya kabul edilmedi.`, {
                description: errors.slice(0, 3).join('\n'),
            });
        }
        if (selected.length) onChange([...files, ...selected]);
    };

    const remove = (id: string) => {
        const target = files.find((file) => file.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        onChange(files.filter((file) => file.id !== id));
    };

    const retry = (id: string) => {
        onChange(files.map((file) => file.id === id
            ? { ...file, status: 'pending', progress: 0, error: undefined }
            : file));
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
                {allowPhotos && (
                    <>
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => cameraRef.current?.click()} disabled={disabled}>
                            <Camera className="mr-2 h-4 w-4" /> Kamerayı aç
                        </Button>
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => galleryRef.current?.click()} disabled={disabled}>
                            <ImagePlus className="mr-2 h-4 w-4" /> Galeriden seç
                        </Button>
                    </>
                )}
                {allowAttachments && (
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => attachmentRef.current?.click()} disabled={disabled}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Dosya seç
                    </Button>
                )}
            </div>

            <input ref={cameraRef} type="file" accept={PHOTO_ACCEPT} capture="environment" className="hidden" onChange={(event) => { addFiles(event.target.files, 'photo'); event.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept={PHOTO_ACCEPT} multiple className="hidden" onChange={(event) => { addFiles(event.target.files, 'photo'); event.target.value = ''; }} />
            <input ref={attachmentRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(event) => { addFiles(event.target.files, 'attachment'); event.target.value = ''; }} />

            {files.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {files.map((item) => (
                        <div key={item.id} className="flex min-w-0 gap-3 rounded-lg border p-3">
                            {item.previewUrl ? (
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                                    <Image src={item.previewUrl} alt="Seçilen fotoğraf" fill sizes="56px" className="object-cover" unoptimized />
                                </div>
                            ) : (
                                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-muted">
                                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
                                {(item.status === 'uploading' || item.status === 'success') && (
                                    <Progress value={item.progress} className="mt-2 h-1.5" />
                                )}
                                {item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
                            </div>
                            {item.status === 'uploading' ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                            ) : item.status === 'error' ? (
                                <Button type="button" variant="ghost" size="icon" onClick={() => retry(item.id)} aria-label="Yüklemeyi yeniden dene">
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(item.id)} disabled={disabled || item.status === 'success'} aria-label="Dosyayı kaldır">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                {allowPhotos && 'Fotoğraf: JPG, PNG, WebP, HEIC/HEIF, GIF (en fazla 10 MB).'}
                {allowPhotos && allowAttachments && ' '}
                {allowAttachments && 'Dosya: PDF, Word, Excel (en fazla 50 MB).'}
            </p>
        </div>
    );
}
