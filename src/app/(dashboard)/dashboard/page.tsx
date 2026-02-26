'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useTasks } from '@/hooks/useTasks';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { TaskTrendChart } from '@/components/dashboard/TaskTrendChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { SeverityBarChart } from '@/components/dashboard/SeverityBarChart';
import { OverdueAlert } from '@/components/dashboard/OverdueAlert';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SeverityBadge } from '@/components/tasks/SeverityBadge';
import { formatRelative } from '@/lib/utils/date';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TaskStatistics, CategoryStatistic, MonthlyTrend, SeverityDistribution } from '@/types';

export default function DashboardPage() {
    const supabase = createClient();
    const { data: profile, isLoading: profileLoading } = useProfile();

    const { data: stats, isLoading: statsLoading } = useQuery<TaskStatistics>({
        queryKey: ['task-statistics'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('task_statistics')
                .select('*')
                .single();
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

    const { data: recentTasks } = useTasks({
        pageSize: 5,
        sortBy: 'created_at',
        sortOrder: 'desc',
    });

    if (profileLoading || statsLoading) {
        return <LoadingSpinner text="Dashboard yükleniyor..." />;
    }

    const roleLabel = {
        admin: 'Yönetici Paneli',
        inspector: 'Denetçi Paneli',
        responsible: 'Görevli Paneli',
    }[profile?.role ?? 'responsible'];

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Hoş geldiniz, ${profile?.full_name ?? ''}`}
                description={roleLabel}
            />

            {stats && stats.overdue_count > 0 && (
                <OverdueAlert count={stats.overdue_count} />
            )}

            {stats && <StatsCards stats={stats} />}

            {profile?.role === 'admin' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {trendData && <TaskTrendChart data={trendData} />}
                    {catStats && <CategoryPieChart data={catStats} />}
                </div>
            )}

            {profile?.role === 'admin' && severityData && (
                <SeverityBarChart data={severityData} />
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Son Görevler</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/tasks">Tümünü Gör</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentTasks?.tasks && recentTasks.tasks.length > 0 ? (
                        <div className="space-y-3">
                            {recentTasks.tasks.map((task) => (
                                <Link
                                    key={task.id}
                                    href={`/tasks/${task.id}`}
                                    className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">
                                                #{task.serial_number} — {task.description.slice(0, 60)}
                                                {task.description.length > 60 ? '...' : ''}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {task.location?.name ?? '-'} · {formatRelative(task.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <SeverityBadge severity={task.severity} showStars={false} />
                                        <TaskStatusBadge status={task.status} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">Henüz görev bulunamadı.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
