'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useTasks } from '@/hooks/useTasks';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { TaskTrendChart } from '@/components/dashboard/TaskTrendChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { SeverityBarChart } from '@/components/dashboard/SeverityBarChart';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/utils/export';
import { Download } from 'lucide-react';
import type { TaskStatistics, CategoryStatistic, MonthlyTrend, SeverityDistribution } from '@/types';

export default function ReportsPage() {
    const supabase = createClient();

    const { data: stats, isLoading } = useQuery<TaskStatistics>({
        queryKey: ['task-statistics'],
        queryFn: async () => {
            const { data, error } = await supabase.from('task_statistics').select('*').single();
            if (error) return { unassigned_count: 0, active_count: 0, completed_count: 0, closed_count: 0, rejected_count: 0, overdue_count: 0, this_month_count: 0, total_count: 0 };
            return data as unknown as TaskStatistics;
        },
    });

    const { data: catStats } = useQuery<CategoryStatistic[]>({
        queryKey: ['category-statistics'],
        queryFn: async () => {
            const { data } = await supabase.from('category_statistics').select('*');
            return (data as unknown as CategoryStatistic[]) ?? [];
        },
    });

    const { data: trendData } = useQuery<MonthlyTrend[]>({
        queryKey: ['monthly-trend'],
        queryFn: async () => {
            const { data } = await supabase.from('monthly_task_trend').select('*');
            return (data as unknown as MonthlyTrend[]) ?? [];
        },
    });

    const { data: severityData } = useQuery<SeverityDistribution[]>({
        queryKey: ['severity-distribution'],
        queryFn: async () => {
            const { data } = await supabase.from('severity_distribution').select('*');
            return (data as unknown as SeverityDistribution[]) ?? [];
        },
    });

    const { data: allTasks } = useTasks({ pageSize: 1000 });

    if (isLoading) return <LoadingSpinner text="Raporlar yükleniyor..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Raporlar"
                description="İSG görev istatistikleri ve raporlar"
                action={
                    <Button onClick={() => allTasks?.tasks && exportToExcel(allTasks.tasks, 'isg-rapor')}>
                        <Download className="mr-2 h-4 w-4" /> Excel İndir
                    </Button>
                }
            />

            {stats && <StatsCards stats={stats} />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {trendData && <TaskTrendChart data={trendData} />}
                {catStats && <CategoryPieChart data={catStats} />}
            </div>

            {severityData && <SeverityBarChart data={severityData} />}
        </div>
    );
}
