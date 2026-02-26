import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/email/send';
import type { Task, Profile } from '@/types';

export async function GET(request: NextRequest) {
    // ZORUNLU DÜZELTME 4: Cron secret kontrolü
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
    }

    try {
        const supabase = await createServiceClient();

        // Yarın son tarihi olan görevleri bul
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString();
        const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59).toISOString();

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
        *,
        responsible:profiles!tasks_responsible_id_fkey(*),
        inspector:profiles!tasks_inspector_id_fkey(*),
        location:locations!tasks_location_id_fkey(*),
        category:task_categories!tasks_category_id_fkey(*)
      `)
            .gte('due_date', tomorrowStart)
            .lte('due_date', tomorrowEnd)
            .not('status', 'in', '("closed","completed","rejected")')
            .not('responsible_id', 'is', null);

        if (error) {
            console.error('Hatırlatma sorgusu hatası:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let sentCount = 0;
        for (const task of (tasks as unknown as Task[]) ?? []) {
            if (task.responsible) {
                await sendReminderEmail(task, task.responsible as Profile);
                sentCount++;
            }
        }

        return NextResponse.json({
            success: true,
            tasks_count: tasks?.length ?? 0,
            emails_sent: sentCount,
        });
    } catch (error) {
        console.error('Reminder cron hatası:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
