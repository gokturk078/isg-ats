'use client';

import { useTasks } from '@/hooks/useTasks';
import { useProfile } from '@/hooks/useProfile';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SeverityBadge } from '@/components/tasks/SeverityBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, isOverdue, getDaysRemaining, getDaysOverdue } from '@/lib/utils/date';
import { ClipboardCheck, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function MyTasksPage() {
    const { data: profile } = useProfile();

    const { data: tasksData, isLoading } = useTasks({
        responsibleId: profile?.id,
        pageSize: 50,
        sortBy: 'severity',
        sortOrder: 'desc',
    });

    if (isLoading) return <LoadingSpinner text="Görevleriniz yükleniyor..." />;

    const tasks = tasksData?.tasks ?? [];
    const urgent = tasks.filter((t) => t.severity >= 4 && !['closed', 'completed', 'rejected'].includes(t.status));
    const overdueTasks = tasks.filter((t) => t.due_date && isOverdue(t.due_date) && !['closed', 'completed', 'rejected'].includes(t.status));
    const active = tasks.filter((t) => ['open', 'in_progress'].includes(t.status));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Görevlerim"
                description={`${active.length} aktif göreviniz bulunuyor`}
            />

            {overdueTasks.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="font-semibold text-destructive">{overdueTasks.length} Gecikmiş Görev</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Bu görevlerin son tarihi geçmiştir. Acil aksiyon gereklidir.</p>
                </div>
            )}

            {urgent.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Acil Görevler
                    </h3>
                    <div className="space-y-2">
                        {urgent.map((task) => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Tüm Görevlerim ({tasks.length})
                </h3>
                {tasks.length === 0 ? (
                    <EmptyState
                        icon={ClipboardCheck}
                        title="Görev bulunamadı"
                        description="Size atanmış görev bulunmuyor."
                    />
                ) : (
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TaskCard({ task }: { task: ReturnType<typeof useTasks>['data'] extends { tasks: (infer T)[] } | undefined ? T : never }) {
    const overdue = task.due_date && isOverdue(task.due_date) && !['closed', 'completed', 'rejected'].includes(task.status);

    return (
        <Link href={`/tasks/${task.id}`}>
            <Card className={`hover:bg-muted/50 transition-colors ${overdue ? 'border-destructive/50' : ''}`}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold">#{task.serial_number}</span>
                            {overdue && <Badge variant="destructive" className="text-[10px]">Gecikmiş</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <SeverityBadge severity={task.severity} showStars={false} />
                            <TaskStatusBadge status={task.status} />
                        </div>
                    </div>
                    <p className="text-sm line-clamp-2 mb-2">{task.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.location?.name ?? '-'} · {task.category?.name ?? '-'}</span>
                        {task.due_date && (
                            <span className={overdue ? 'text-destructive font-medium' : ''}>
                                Son: {formatDate(task.due_date)}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
