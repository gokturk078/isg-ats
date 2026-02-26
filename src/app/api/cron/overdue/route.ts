import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendOverdueWarning } from '@/lib/email/send';
import type { Task, Profile } from '@/types';

export async function GET(request: NextRequest) {
    // ZORUNLU DÜZELTME 4: Cron secret kontrolü
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
    }

    try {
        const supabase = await createServiceClient();

        // Gecikmiş ve hala aktif görevleri bul
        const { data: overdueTasks, error } = await supabase
            .from('tasks')
            .select(`
        *,
        responsible:profiles!tasks_responsible_id_fkey(*),
        inspector:profiles!tasks_inspector_id_fkey(*),
        location:locations!tasks_location_id_fkey(*),
        category:task_categories!tasks_category_id_fkey(*)
      `)
            .lt('due_date', new Date().toISOString())
            .not('status', 'in', '("closed","completed","rejected")')
            .not('responsible_id', 'is', null);

        if (error) {
            console.error('Gecikmiş görev sorgusu hatası:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let sentCount = 0;
        for (const task of (overdueTasks as unknown as Task[]) ?? []) {
            if (task.responsible) {
                await sendOverdueWarning(task, task.responsible as Profile);
                sentCount++;
            }
        }

        return NextResponse.json({
            success: true,
            overdue_count: overdueTasks?.length ?? 0,
            emails_sent: sentCount,
        });
    } catch (error) {
        console.error('Overdue cron hatası:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
