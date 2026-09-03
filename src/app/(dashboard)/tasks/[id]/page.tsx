'use client';

import { use, useState } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { useTask } from '@/hooks/useTask';
import { useProfile } from '@/hooks/useProfile';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SeverityBadge } from '@/components/tasks/SeverityBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TaskFilePicker } from '@/components/tasks/TaskFilePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDateTimeLong, formatRelative, isOverdue } from '@/lib/utils/date';
import { toast } from 'sonner';
import {
    MapPin, User, Calendar, Clock, AlertTriangle, Send,
    CheckCircle, XCircle, Play, Lock, MessageSquare, ImageIcon,
    Loader2, FileDown, Paperclip, Download,
} from 'lucide-react';
import type { TaskAttachment, TaskStatus } from '@/types';
import { generateTaskPdf } from '@/lib/utils/generate-task-pdf';
import { formatFileSize, uploadTaskFile, type SelectedTaskFile } from '@/lib/uploads/task-files';

async function sendNotification(taskId: string, type: string, rejectionReason?: string) {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, type, rejectionReason }),
        });
    } catch (e) {
        console.error('Bildirim gönderilemedi:', e);
    }
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: task, isLoading } = useTask(id);
    const { data: profile } = useProfile();
    const [comment, setComment] = useState('');
    const [confirmAction, setConfirmAction] = useState<{ type: string; title: string; desc: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Completion dialog state
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
    const [completionNote, setCompletionNote] = useState('');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [completionFiles, setCompletionFiles] = useState<SelectedTaskFile[]>([]);
    const [isCompleting, setIsCompleting] = useState(false);
    const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
    const [mediaFiles, setMediaFiles] = useState<SelectedTaskFile[]>([]);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

    const closeCompletionDialog = () => {
        completionFiles.forEach((file) => file.previewUrl && URL.revokeObjectURL(file.previewUrl));
        setCompletionFiles([]);
        setCompletionNote('');
        setCompleteDialogOpen(false);
    };

    const closeMediaDialog = () => {
        mediaFiles.forEach((file) => file.previewUrl && URL.revokeObjectURL(file.previewUrl));
        setMediaFiles([]);
        setMediaDialogOpen(false);
    };

    const updateStatus = useMutation({
        mutationFn: async ({ status, extra }: { status: TaskStatus; extra?: Record<string, unknown> }) => {
            const updates: Record<string, unknown> = { status, ...extra };
            if (status === 'completed') updates.completed_at = new Date().toISOString();
            if (status === 'closed') updates.closed_at = new Date().toISOString();

            const { error } = await supabase.from('tasks').update(updates).eq('id', id);
            if (error) throw error;

            // Send notifications — must be awaited inside mutationFn
            if (status === 'closed') {
                await sendNotification(id, 'task_closed');
            } else if (status === 'rejected') {
                await sendNotification(id, 'task_rejected', rejectReason);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Görev durumu güncellendi');
            setConfirmAction(null);
        },
        onError: () => toast.error('Durum güncellenemedi'),
    });

    const addComment = useMutation({
        mutationFn: async () => {
            if (!comment.trim() || !profile) return;
            const { error } = await supabase.from('task_actions').insert({
                task_id: id,
                user_id: profile.id,
                comment: comment.trim(),
                is_system: false,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setComment('');
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            toast.success('Yorum eklendi');
        },
        onError: () => toast.error('Yorum eklenemedi'),
    });

    const handleComplete = async () => {
        if (!profile || !completionNote.trim()) {
            toast.error('Tamamlama notu zorunludur');
            return;
        }
        if (completionFiles.length === 0) {
            toast.error('En az bir tamamlama fotoğrafı yükleyin');
            return;
        }

        setIsCompleting(true);
        try {
            let uploadFailed = false;
            for (const item of completionFiles.filter((file) => file.status !== 'success')) {
                setCompletionFiles((current) => current.map((file) => file.id === item.id
                    ? { ...file, status: 'uploading', progress: 0, error: undefined }
                    : file));
                try {
                    await uploadTaskFile({
                        supabase,
                        item,
                        taskId: id,
                        userId: profile.id,
                        photoType: 'after',
                        onProgress: (progress) => setCompletionFiles((current) => current.map((file) => file.id === item.id
                            ? { ...file, progress }
                            : file)),
                    });
                    setCompletionFiles((current) => current.map((file) => file.id === item.id
                        ? { ...file, status: 'success', progress: 100 }
                        : file));
                } catch (uploadError) {
                    uploadFailed = true;
                    const message = uploadError instanceof Error ? uploadError.message : 'Yükleme başarısız.';
                    setCompletionFiles((current) => current.map((file) => file.id === item.id
                        ? { ...file, status: 'error', error: message }
                        : file));
                }
            }

            if (uploadFailed) {
                toast.error('Tamamlama fotoğraflarından bazıları yüklenemedi. Hatalı dosyaları yeniden deneyin.');
                return;
            }

            const { error } = await supabase.from('tasks').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            }).eq('id', id);

            if (error) throw error;

            const { error: noteError } = await supabase.from('task_actions').insert({
                task_id: id,
                user_id: profile.id,
                comment: `✅ Görev tamamlandı: ${completionNote.trim()}`,
                is_system: false,
            });
            if (noteError) {
                console.error('Tamamlama notu eklenemedi:', noteError);
                toast.warning('Görev tamamlandı ancak tamamlama notu kaydedilemedi.');
            }

            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Görev tamamlandı!');
            closeCompletionDialog();

            // Notify admin/inspector
            await sendNotification(id, 'task_completed');
        } catch (error) {
            console.error('Tamamlama hatası:', error);
            toast.error('Görev tamamlanırken hata oluştu');
        } finally {
            setIsCompleting(false);
        }
    };

    const handleMediaUpload = async () => {
        if (!profile || !task || mediaFiles.length === 0) return;
        setIsUploadingMedia(true);
        let failed = 0;

        try {
            for (const item of mediaFiles.filter((file) => file.status !== 'success')) {
                setMediaFiles((current) => current.map((file) => file.id === item.id
                    ? { ...file, status: 'uploading', progress: 0, error: undefined }
                    : file));
                try {
                    await uploadTaskFile({
                        supabase,
                        item,
                        taskId: id,
                        userId: profile.id,
                        photoType: 'before',
                        onProgress: (progress) => setMediaFiles((current) => current.map((file) => file.id === item.id
                            ? { ...file, progress }
                            : file)),
                    });
                    setMediaFiles((current) => current.map((file) => file.id === item.id
                        ? { ...file, status: 'success', progress: 100 }
                        : file));
                } catch (uploadError) {
                    failed += 1;
                    const message = uploadError instanceof Error ? uploadError.message : 'Yükleme başarısız.';
                    setMediaFiles((current) => current.map((file) => file.id === item.id
                        ? { ...file, status: 'error', error: message }
                        : file));
                }
            }

            await queryClient.invalidateQueries({ queryKey: ['task', id] });
            if (failed > 0) {
                toast.error(`${failed} dosya yüklenemedi. Hatalı dosyaları yeniden deneyin.`);
            } else {
                closeMediaDialog();
                toast.success('Fotoğraf ve dosyalar eklendi.');
            }
        } finally {
            setIsUploadingMedia(false);
        }
    };

    const downloadAttachment = async (attachment: TaskAttachment) => {
        setDownloadingAttachmentId(attachment.id);
        try {
            const { data, error } = await supabase.storage
                .from('task-attachments')
                .createSignedUrl(attachment.storage_path, 60, { download: attachment.file_name });
            if (error || !data.signedUrl) throw error ?? new Error('İndirme bağlantısı oluşturulamadı.');

            const anchor = document.createElement('a');
            anchor.href = data.signedUrl;
            anchor.rel = 'noopener';
            anchor.download = attachment.file_name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } catch (downloadError) {
            console.error('Ek dosya indirilemedi:', downloadError);
            toast.error('Güvenli indirme bağlantısı oluşturulamadı.');
        } finally {
            setDownloadingAttachmentId(null);
        }
    };

    if (isLoading) return <LoadingSpinner text="Görev yükleniyor..." />;
    if (!task) return <div className="text-center py-12 text-muted-foreground">Görev bulunamadı</div>;

    const isAdmin = profile?.role === 'admin';
    const isInspector = profile?.role === 'inspector' && task.inspector_id === profile?.id;
    const isResponsible = profile?.role === 'responsible' && task.responsible_id === profile?.id;
    const canAct = isAdmin || isInspector || isResponsible;
    const overdue = task.due_date && isOverdue(task.due_date) && !['closed', 'completed', 'rejected'].includes(task.status);

    // Group photos
    const beforePhotos = task.photos?.filter((p) => p.photo_type === 'before') ?? [];
    const afterPhotos = task.photos?.filter((p) => p.photo_type === 'after') ?? [];

    return (
        <div className="space-y-6">
            <PageHeader
                title={task.title || `Görev #${task.serial_number}`}
                breadcrumbs={[
                    { label: 'Görevler', href: '/tasks' },
                    { label: task.title ? `#${task.serial_number}` : '' },
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol: Detay */}
                <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
                    {/* Ana Bilgiler */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-lg">Görev Bilgileri</CardTitle>
                                <div className="flex items-center gap-2">
                                    <SeverityBadge severity={task.severity} />
                                    <TaskStatusBadge status={task.status} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {overdue && (
                                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                    <span className="text-sm text-destructive font-medium">Bu görev gecikmiş durumda!</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Lokasyon" value={`${task.location?.name ?? '-'}${task.floor ? ' · Kat ' + task.floor : ''}`} />
                                <InfoRow icon={<User className="h-4 w-4" />} label="Denetçi" value={task.inspector?.full_name ?? '-'} />
                                <InfoRow icon={<User className="h-4 w-4" />} label="Görevli" value={task.responsible?.full_name ?? 'Atanmamış'} />
                                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Oluşturulma" value={task.created_at ? formatDateTimeLong(task.created_at) : '-'} />
                                <InfoRow icon={<Clock className="h-4 w-4" />} label="Son Tarih" value={task.due_date ? formatDateTimeLong(task.due_date) : '-'} highlight={!!overdue} />
                                {task.category && (
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.category.color }} />
                                        <span className="text-sm">{task.category.name}</span>
                                    </div>
                                )}
                            </div>

                            <Separator />
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Açıklama</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                            </div>
                            {task.action_required && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 rounded">
                                    <h4 className="text-sm font-semibold mb-1">Aksiyon Gerekliliği</h4>
                                    <p className="text-sm">{task.action_required}</p>
                                </div>
                            )}
                            {task.rejection_reason && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded">
                                    <h4 className="text-sm font-semibold mb-1 text-destructive">Red Nedeni</h4>
                                    <p className="text-sm">{task.rejection_reason}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Fotoğraflar */}
                    {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" /> Fotoğraflar ({(task.photos?.length ?? 0)})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {beforePhotos.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2 text-orange-600">📷 Tespit Fotoğrafları ({beforePhotos.length})</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {beforePhotos.map((photo) => (
                                                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity">
                                                    <NextImage src={photo.photo_url} alt={photo.caption || 'Tespit fotoğrafı'} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" />
                                                    <Badge className="absolute bottom-1 right-1 text-[10px]" variant="secondary">Önce</Badge>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {afterPhotos.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2 text-green-600">✅ Tamamlama Fotoğrafları ({afterPhotos.length})</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {afterPhotos.map((photo) => (
                                                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity">
                                                    <NextImage src={photo.photo_url} alt={photo.caption || 'Tamamlama fotoğrafı'} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" />
                                                    <Badge className="absolute bottom-1 right-1 text-[10px] bg-green-600">Sonra</Badge>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {(task.attachments?.length ?? 0) > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Paperclip className="h-4 w-4" /> Ek Dosyalar ({task.attachments?.length ?? 0})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {task.attachments?.map((attachment) => (
                                    <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
                                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium" title={attachment.file_name}>{attachment.file_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {attachment.file_size ? formatFileSize(attachment.file_size) : 'Boyut bilinmiyor'}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="min-h-10 shrink-0"
                                            disabled={downloadingAttachmentId === attachment.id}
                                            onClick={() => void downloadAttachment(attachment)}
                                        >
                                            {downloadingAttachmentId === attachment.id
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <Download className="h-4 w-4" />}
                                            <span className="sr-only">{attachment.file_name} dosyasını indir</span>
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Aksiyon Zaman Çizelgesi */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Aksiyon Notları
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {task.actions && task.actions.length > 0 ? (
                                <div className="space-y-3">
                                    {task.actions.map((action) => (
                                        <div key={action.id} className={`flex gap-3 ${action.is_system ? 'opacity-70' : ''}`}>
                                            <Avatar className="h-8 w-8 flex-shrink-0">
                                                <AvatarFallback className="text-xs">{action.user?.full_name?.charAt(0) ?? '?'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">{action.user?.full_name ?? 'Sistem'}</span>
                                                    <span className="text-xs text-muted-foreground">{formatRelative(action.created_at)}</span>
                                                </div>
                                                <p className="text-sm mt-0.5 whitespace-pre-wrap">{action.comment}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Henüz aksiyon notu bulunmuyor.</p>
                            )}

                            {canAct && task.status !== 'closed' && (
                                <>
                                    <Separator />
                                    <div className="flex gap-2">
                                        <Textarea
                                            placeholder="Yorum ekleyin..."
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            rows={2}
                                            className="flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={() => addComment.mutate()}
                                            disabled={!comment.trim() || addComment.isPending}
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sağ: Durum & Aksiyonlar */}
                <div className="order-1 space-y-4 lg:order-2">
                    <Card className="lg:sticky lg:top-20">
                        <CardHeader>
                            <CardTitle className="text-base">Aksiyonlar</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {/* Görevli Aksiyonları */}
                            {(isResponsible || isAdmin) && ['open', 'rejected'].includes(task.status) && (
                                <Button className="min-h-11 w-full" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ status: 'in_progress' })}>
                                    <Play className="mr-2 h-4 w-4" /> Devam Ediyorum
                                </Button>
                            )}
                            {(isResponsible || isAdmin) && ['open', 'in_progress', 'rejected'].includes(task.status) && (
                                <Button className="min-h-11 w-full" variant="outline" onClick={() => setCompleteDialogOpen(true)}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Tamamlandı
                                </Button>
                            )}

                            {/* Admin Aksiyonları */}
                            {isAdmin && task.status === 'completed' && (
                                <Button className="min-h-11 w-full" onClick={() => setConfirmAction({ type: 'close', title: 'Görevi Kapat', desc: 'Bu görev kapatılacak. Emin misiniz?' })}>
                                    <Lock className="mr-2 h-4 w-4" /> Görevi Kapat
                                </Button>
                            )}
                            {isAdmin && !['closed', 'rejected'].includes(task.status) && (
                                <Button className="min-h-11 w-full" variant="destructive" disabled={updateStatus.isPending} onClick={() => setConfirmAction({ type: 'reject', title: 'Görevi Reddet', desc: 'Bu görev reddedilecek. Red nedenini yazınız.' })}>
                                    <XCircle className="mr-2 h-4 w-4" /> Reddet
                                </Button>
                            )}

                            {/* Düzenle */}
                            {(isAdmin || isInspector) && task.status !== 'closed' && (
                                <Button className="min-h-11 w-full" variant="outline" onClick={() => router.push(`/tasks/${id}/edit`)}>
                                    Düzenle
                                </Button>
                            )}

                            {canAct && task.status !== 'closed' && (
                                <Button className="min-h-11 w-full" variant="outline" onClick={() => setMediaDialogOpen(true)}>
                                    <Paperclip className="mr-2 h-4 w-4" /> Fotoğraf / Dosya Ekle
                                </Button>
                            )}

                            {!canAct && (
                                <p className="text-sm text-muted-foreground text-center py-2">Bu görev üzerinde işlem yetkiniz bulunmuyor.</p>
                            )}

                            <Separator />
                            <Button
                                className="min-h-11 w-full"
                                variant="outline"
                                disabled={pdfLoading}
                                onClick={async () => {
                                    setPdfLoading(true);
                                    try {
                                        await generateTaskPdf(task);
                                        toast.success('PDF indirildi');
                                    } catch (e) {
                                        console.error('PDF hatası:', e);
                                        toast.error('PDF oluşturulamadı');
                                    } finally {
                                        setPdfLoading(false);
                                    }
                                }}
                            >
                                {pdfLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> PDF Hazirlaniyor...</>
                                ) : (
                                    <><FileDown className="mr-2 h-4 w-4" /> PDF Indir</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Completion Dialog */}
            <Dialog open={completeDialogOpen} onOpenChange={(open) => {
                if (open) setCompleteDialogOpen(true);
                else if (!isCompleting) closeCompletionDialog();
            }}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" /> Görevi Tamamla
                        </DialogTitle>
                        <DialogDescription>
                            Görevi tamamlamak için tamamlama fotoğrafı ve notunuzu ekleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tamamlama Fotoğrafı *</Label>
                            <TaskFilePicker
                                files={completionFiles}
                                onChange={setCompletionFiles}
                                allowAttachments={false}
                                disabled={isCompleting}
                            />
                        </div>

                        {/* Completion Note */}
                        <div className="space-y-2">
                            <Label>Tamamlama Notu *</Label>
                            <Textarea
                                placeholder="Yapılan işlemi açıklayınız..."
                                value={completionNote}
                                onChange={(e) => setCompletionNote(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeCompletionDialog} disabled={isCompleting}>İptal</Button>
                        <Button
                            onClick={handleComplete}
                            disabled={isCompleting || !completionNote.trim() || completionFiles.length === 0}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isCompleting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tamamlanıyor...</>
                            ) : (
                                <><CheckCircle className="mr-2 h-4 w-4" /> Tamamla</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={mediaDialogOpen} onOpenChange={(open) => {
                if (open) setMediaDialogOpen(true);
                else if (!isUploadingMedia) closeMediaDialog();
            }}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Fotoğraf veya dosya ekle</DialogTitle>
                        <DialogDescription>
                            Fotoğraflar görev kanıtlarında görünür; PDF, Word ve Excel dosyaları güvenli ek olarak saklanır.
                        </DialogDescription>
                    </DialogHeader>
                    <TaskFilePicker
                        files={mediaFiles}
                        onChange={setMediaFiles}
                        allowPhotos={isAdmin || isInspector}
                        allowAttachments={canAct}
                        disabled={isUploadingMedia}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={closeMediaDialog} disabled={isUploadingMedia}>İptal</Button>
                        <Button onClick={handleMediaUpload} disabled={isUploadingMedia || mediaFiles.length === 0}>
                            {isUploadingMedia && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Dosyaları yükle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Dialogs */}
            <ConfirmDialog
                open={confirmAction?.type === 'close'}
                onOpenChange={() => setConfirmAction(null)}
                title={confirmAction?.title ?? ''}
                description={confirmAction?.desc ?? ''}
                onConfirm={() => updateStatus.mutate({ status: 'closed' })}
                loading={updateStatus.isPending}
            />
            <Dialog open={confirmAction?.type === 'reject'} onOpenChange={(open) => { if (!open) { setConfirmAction(null); setRejectReason(''); } }}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Görevi Reddet</DialogTitle>
                        <DialogDescription>Bu görev reddedilecek. Lütfen red nedenini yazınız.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Red Nedeni *</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Red nedenini açıklayınız..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setConfirmAction(null); setRejectReason(''); }}>
                            İptal
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!rejectReason.trim() || updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ status: 'rejected', extra: { rejection_reason: rejectReason } })}
                        >
                            {updateStatus.isPending ? 'İşleniyor...' : 'Reddet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex min-w-0 items-start gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-sm text-muted-foreground">{label}:</span>
            <span className={`min-w-0 break-words text-sm font-medium ${highlight ? 'text-destructive' : ''}`}>{value}</span>
        </div>
    );
}
