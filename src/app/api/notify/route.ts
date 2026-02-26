import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTaskNotification } from '@/lib/notifications/notify';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Yetkilendirme hatası' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        const body = await request.json();
        const { taskId, type, rejectionReason } = body as {
            taskId: string;
            type: 'task_assigned' | 'task_completed' | 'task_rejected' | 'task_closed';
            rejectionReason?: string;
        };

        if (!taskId || !type) {
            return NextResponse.json({ error: 'taskId ve type zorunludur' }, { status: 400 });
        }

        const validTypes = ['task_assigned', 'task_completed', 'task_rejected', 'task_closed'];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: 'Geçersiz bildirim tipi' }, { status: 400 });
        }

        await createTaskNotification({
            taskId,
            type,
            actorName: profile?.full_name ?? 'Kullanıcı',
            rejectionReason,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Bildirim API hatası:', error);
        return NextResponse.json({ error: 'Bildirim gönderilemedi' }, { status: 500 });
    }
}
