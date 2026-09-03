import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PHOTO_TYPES = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
]);
const ATTACHMENT_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const taskId = String(formData.get('taskId') || '');
        const kind = String(formData.get('kind') || 'photo');
        const photoType = formData.get('photoType') === 'after' ? 'after' : 'before';

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Dosya gerekli.' }, { status: 400 });
        }
        if (!UUID_PATTERN.test(taskId)) {
            return NextResponse.json({ error: 'Geçerli bir görev kimliği gerekli.' }, { status: 400 });
        }
        if (kind !== 'photo' && kind !== 'attachment') {
            return NextResponse.json({ error: 'Geçersiz dosya türü.' }, { status: 400 });
        }

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('id, inspector_id, responsible_id, status')
            .eq('id', taskId)
            .maybeSingle();
        if (taskError || !task) {
            return NextResponse.json({ error: 'Görev bulunamadı veya erişim yetkiniz yok.' }, { status: 404 });
        }

        if (task.status === 'closed') {
            return NextResponse.json({ error: 'Kapatılmış göreve dosya eklenemez.' }, { status: 409 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle();
        const isAdmin = profile?.is_active && profile.role === 'admin';
        const isTaskInspector = profile?.is_active && task.inspector_id === user.id;
        const isTaskResponsible = profile?.is_active && task.responsible_id === user.id;
        const permitted = kind === 'photo'
            ? isAdmin || isTaskInspector
            : isAdmin || isTaskInspector || isTaskResponsible;
        if (!permitted) {
            return NextResponse.json({ error: 'Bu göreve seçilen dosya türünü ekleme yetkiniz yok.' }, { status: 403 });
        }

        const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const contentType = MIME_BY_EXTENSION[extension] ?? file.type.toLowerCase();
        const allowedTypes = kind === 'photo' ? PHOTO_TYPES : ATTACHMENT_TYPES;
        const maxBytes = kind === 'photo' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
        if (!allowedTypes.has(contentType)) {
            return NextResponse.json({ error: 'Desteklenmeyen dosya biçimi.' }, { status: 400 });
        }
        if (file.size === 0 || file.size > maxBytes) {
            return NextResponse.json({ error: `Dosya 0 bayttan büyük ve en fazla ${maxBytes / 1024 / 1024} MB olmalıdır.` }, { status: 400 });
        }

        const storagePath = `${taskId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
        const bucket = kind === 'photo' ? 'task-photos' : 'task-attachments';
        const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
            contentType,
            cacheControl: '3600',
            upsert: false,
        });
        if (uploadError) {
            return NextResponse.json({ error: `Dosya yüklenemedi: ${uploadError.message}` }, { status: 500 });
        }

        const metadataResult = kind === 'photo'
            ? await supabase.from('task_photos').insert({
                task_id: taskId,
                photo_url: supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl,
                storage_path: storagePath,
                photo_type: photoType,
                uploaded_by: user.id,
                file_size: file.size,
            })
            : await supabase.from('task_attachments').insert({
                task_id: taskId,
                file_url: null,
                storage_path: storagePath,
                file_name: file.name,
                file_type: contentType,
                uploaded_by: user.id,
                file_size: file.size,
            });

        if (metadataResult.error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            return NextResponse.json({ error: `Dosya kaydı oluşturulamadı: ${metadataResult.error.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            path: storagePath,
            publicUrl: kind === 'photo'
                ? supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
                : null,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Upload API hatası:', error);
        return NextResponse.json({ error: 'Dosya yükleme sırasında sunucu hatası oluştu.' }, { status: 500 });
    }
}
