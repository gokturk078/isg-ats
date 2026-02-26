'use client';

import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useProfile } from '@/hooks/useProfile';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SeverityBadge } from '@/components/tasks/SeverityBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, isOverdue } from '@/lib/utils/date';
import { ClipboardCheck, AlertTriangle, Clock, CheckCircle, FolderOpen, PlayCircle } from 'lucide-react';
import Link from 'next/link';

type TabFilter = 'all' | 'new' | 'in_progress' | 'completed' | 'closed';

export default function MyTasksPage() {
    const { data: profile } = useProfile();
    const [activeTab, setActiveTab] = useState<TabFilter>('all');

    const { data: tasksData, isLoading } = useTasks({
        responsibleId: profile?.id,
        pageSize: 100,
        sortBy: 'severity',
        sortOrder: 'desc',
    });

    if (isLoading) return <LoadingSpinner text="Görevleriniz yükleniyor..." />;

    const tasks = tasksData?.tasks ?? [];
    const newTasks = tasks.filter((t) => t.status === 'open');
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const closedTasks = tasks.filter((t) => t.status === 'closed');
    const overdueTasks = tasks.filter((t) => t.due_date && isOverdue(t.due_date) && !['closed', 'completed', 'rejected'].includes(t.status));

    const filteredTasks = activeTab === 'all'
        ? tasks
        : activeTab === 'new'
            ? newTasks
            : activeTab === 'in_progress'
                ? inProgressTasks
                : activeTab === 'completed'
                    ? completedTasks
                    : closedTasks;

    const tabs: { key: TabFilter; label: string; count: number; icon: React.ReactNode; color: string }[] = [
        { key: 'all', label: 'Tümü', count: tasks.length, icon: <ClipboardCheck className="h-4 w-4" />, color: '' },
        { key: 'new', label: 'Yeni', count: newTasks.length, icon: <FolderOpen className="h-4 w-4" />, color: 'text-blue-600' },
        { key: 'in_progress', label: 'Devam Eden', count: inProgressTasks.length, icon: <PlayCircle className="h-4 w-4" />, color: 'text-orange-600' },
        { key: 'completed', label: 'Tamamlanan', count: completedTasks.length, icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
        { key: 'closed', label: 'Kapanan', count: closedTasks.length, icon: <Clock className="h-4 w-4" />, color: 'text-gray-600' },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Görevlerim"
                description={`${newTasks.length + inProgressTasks.length} aktif göreviniz bulunuyor`}
            />

            {/* Status Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatusCard
                    label="Yeni Görevler"
                    count={newTasks.length}
                    color="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                    textColor="text-blue-700 dark:text-blue-300"
                />
                <StatusCard
                    label="Devam Eden"
                    count={inProgressTasks.length}
                    color="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                    textColor="text-orange-700 dark:text-orange-300"
                />
                <StatusCard
                    label="Tamamlanan"
                    count={completedTasks.length}
                    color="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                    textColor="text-green-700 dark:text-green-300"
                />
                <StatusCard
                    label="Gecikmiş"
                    count={overdueTasks.length}
                    color="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    textColor="text-red-700 dark:text-red-300"
                />
            </div>

            {/* Overdue Warning */}
            {overdueTasks.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="font-semibold text-destructive">{overdueTasks.length} Gecikmiş Görev</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Bu görevlerin son tarihi geçmiştir. Acil aksiyon gereklidir.</p>
                </div>
            )}

            {/* Tab Filter */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {tabs.map((tab) => (
                    <Button
                        key={tab.key}
                        variant={activeTab === tab.key ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab(tab.key)}
                        className="gap-1.5 whitespace-nowrap"
                    >
                        {tab.icon}
                        {tab.label}
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{tab.count}</Badge>
                    </Button>
                ))}
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheck}
                    title="Görev bulunamadı"
                    description={activeTab === 'all' ? 'Size atanmış görev bulunmuyor.' : 'Bu kategoride görev yok.'}
                />
            ) : (
                <div className="space-y-2">
                    {filteredTasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatusCard({ label, count, color, textColor }: { label: string; count: number; color: string; textColor: string }) {
    return (
        <Card className={`${color} border`}>
            <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${textColor}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
        </Card>
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
                            <span className="text-sm font-bold">{task.title || task.description.substring(0, 50)}</span>
                            {overdue && <Badge variant="destructive" className="text-[10px]">Gecikmiş</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">#{task.serial_number}</p>
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
