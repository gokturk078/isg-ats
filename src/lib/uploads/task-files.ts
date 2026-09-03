'use client';

import { Upload } from 'tus-js-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export type TaskFileKind = 'photo' | 'attachment';
export type TaskFileStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface SelectedTaskFile {
    id: string;
    file: File;
    kind: TaskFileKind;
    previewUrl?: string;
    status: TaskFileStatus;
    progress: number;
    error?: string;
}

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif';
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const PHOTO_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION).filter((mime) => mime.startsWith('image/')));
const ATTACHMENT_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION).filter((mime) => !mime.startsWith('image/')));

function fileExtension(file: File) {
    return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

function secureUuid() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizedMimeType(file: File) {
    const type = file.type.toLowerCase().split(';')[0];
    return MIME_BY_EXTENSION[fileExtension(file)] ?? type;
}

export function validateTaskFile(file: File, kind: TaskFileKind): string | null {
    if (file.size === 0) return `${file.name}: dosya boş.`;

    const mimeType = normalizedMimeType(file);
    const allowed = kind === 'photo' ? PHOTO_MIME_TYPES : ATTACHMENT_MIME_TYPES;
    if (!allowed.has(mimeType)) {
        return kind === 'photo'
            ? `${file.name}: yalnız JPG, PNG, WebP, HEIC/HEIF ve GIF fotoğrafları kabul edilir.`
            : `${file.name}: yalnız PDF, Word ve Excel dosyaları kabul edilir.`;
    }

    const limit = kind === 'photo' ? PHOTO_MAX_BYTES : ATTACHMENT_MAX_BYTES;
    if (file.size > limit) {
        return `${file.name}: ${Math.round(limit / 1024 / 1024)} MB sınırını aşıyor.`;
    }
    return null;
}

export function selectTaskFiles(files: File[], kind: TaskFileKind) {
    const selected: SelectedTaskFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
        const error = validateTaskFile(file, kind);
        if (error) {
            errors.push(error);
            continue;
        }

        selected.push({
            id: secureUuid(),
            file,
            kind,
            previewUrl: kind === 'photo' ? URL.createObjectURL(file) : undefined,
            status: 'pending',
            progress: 0,
        });
    }

    return { selected, errors };
}

function storagePath(taskId: string, file: File) {
    const extension = fileExtension(file);
    return `${taskId}/${secureUuid()}${extension ? `.${extension}` : ''}`;
}

async function uploadResumable(
    file: File,
    bucket: string,
    objectName: string,
    contentType: string,
    accessToken: string,
    onProgress: (progress: number) => void,
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error('Supabase storage yapılandırması eksik.');

    await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
            endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
            retryDelays: [0, 1000, 3000, 5000, 10000],
            headers: {
                authorization: `Bearer ${accessToken}`,
                apikey: anonKey,
                'x-upsert': 'false',
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: TUS_CHUNK_SIZE,
            metadata: {
                bucketName: bucket,
                objectName,
                contentType,
                cacheControl: '3600',
            },
            onError: reject,
            onProgress: (uploaded, total) => onProgress(total > 0 ? (uploaded / total) * 100 : 0),
            onSuccess: () => resolve(),
        });
        upload.start();
    });
}

export async function uploadTaskFile({
    supabase,
    item,
    taskId,
    userId,
    photoType = 'before',
    onProgress,
}: {
    supabase: SupabaseClient<Database>;
    item: SelectedTaskFile;
    taskId: string;
    userId: string;
    photoType?: 'before' | 'after';
    onProgress?: (progress: number) => void;
}) {
    const validationError = validateTaskFile(item.file, item.kind);
    if (validationError) throw new Error(validationError);

    const bucket = item.kind === 'photo' ? 'task-photos' : 'task-attachments';
    const path = storagePath(taskId, item.file);
    const contentType = normalizedMimeType(item.file);

    if (item.file.size > RESUMABLE_THRESHOLD_BYTES) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.access_token) {
            throw new Error('Yükleme oturumu alınamadı. Lütfen yeniden giriş yapın.');
        }
        await uploadResumable(
            item.file,
            bucket,
            path,
            contentType,
            sessionData.session.access_token,
            (progress) => onProgress?.(Math.min(progress, 99)),
        );
    } else {
        onProgress?.(5);
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, item.file, {
            contentType,
            cacheControl: '3600',
            upsert: false,
        });
        if (uploadError) throw new Error(`Dosya storage alanına yüklenemedi: ${uploadError.message}`);
        onProgress?.(90);
    }

    const metadataResult = item.kind === 'photo'
        ? await supabase.from('task_photos').insert({
            task_id: taskId,
            photo_url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
            storage_path: path,
            photo_type: photoType,
            uploaded_by: userId,
            file_size: item.file.size,
        })
        : await supabase.from('task_attachments').insert({
            task_id: taskId,
            file_url: null,
            storage_path: path,
            file_name: item.file.name,
            file_type: contentType,
            uploaded_by: userId,
            file_size: item.file.size,
        });

    if (metadataResult.error) {
        await supabase.storage.from(bucket).remove([path]);
        throw new Error(`Dosya kaydı oluşturulamadı: ${metadataResult.error.message}`);
    }

    onProgress?.(100);
    return { path, bucket };
}

export function formatFileSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
