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
            type: string;
            rejectionReason?: string;
        };

        if (!taskId || !type) {
            return NextResponse.json({ error: 'taskId ve type zorunludur' }, { status: 400 });
        }

        console.log('[Notify API] Bildirim gönderiliyor:', { taskId, type, user: profile?.full_name });

        const result = await createTaskNotification({
            taskId,
            type: type as 'task_assigned' | 'task_completed' | 'task_closed' | 'task_created',
            actorName: profile?.full_name ?? 'Kullanıcı',
            rejectionReason,
        });

        console.log('[Notify API] Sonuç:', result);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Notify API] Hata:', error);
        return NextResponse.json(
            { error: 'Bildirim gönderilemedi', details: String(error) },
            { status: 500 }
        );
    }
}
