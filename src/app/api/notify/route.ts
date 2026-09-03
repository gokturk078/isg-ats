import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createTaskNotification } from '@/lib/notifications/notify';

const notifySchema = z.object({
    taskId: z.string().uuid(),
    type: z.enum(['task_assigned', 'task_completed', 'task_closed', 'task_created', 'task_rejected']),
    rejectionReason: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
        }

        const parsed = notifySchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: 'Bildirim isteği geçersiz.' }, { status: 400 });
        }

        const [{ data: profile }, { data: task, error: taskError }] = await Promise.all([
            supabase.from('profiles').select('full_name, role, is_active').eq('id', user.id).maybeSingle(),
            supabase.from('tasks').select('id, inspector_id, responsible_id').eq('id', parsed.data.taskId).maybeSingle(),
        ]);

        if (!profile?.is_active) {
            return NextResponse.json({ error: 'Aktif kullanıcı profili bulunamadı.' }, { status: 403 });
        }
        if (taskError || !task) {
            return NextResponse.json({ error: 'Görev bulunamadı veya erişim yetkiniz yok.' }, { status: 404 });
        }

        const isAdmin = profile.role === 'admin';
        const isTaskInspector = task.inspector_id === user.id;
        const isTaskResponsible = task.responsible_id === user.id;
        const authorized = {
            task_assigned: isAdmin || isTaskInspector,
            task_created: isAdmin || isTaskInspector,
            task_completed: isAdmin || isTaskResponsible,
            task_closed: isAdmin,
            task_rejected: isAdmin,
        }[parsed.data.type];

        if (!authorized) {
            return NextResponse.json({ error: 'Bu bildirimi gönderme yetkiniz yok.' }, { status: 403 });
        }

        const result = await createTaskNotification({
            taskId: parsed.data.taskId,
            type: parsed.data.type,
            actorName: profile.full_name,
            rejectionReason: parsed.data.rejectionReason,
        });

        return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[Notify API] Hata:', error);
        return NextResponse.json({ error: 'Bildirim gönderilemedi.' }, { status: 500 });
    }
}
