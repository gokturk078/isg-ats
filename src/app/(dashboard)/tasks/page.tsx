'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/hooks/useTasks';
import { useProfile } from '@/hooks/useProfile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SeverityBadge } from '@/components/tasks/SeverityBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatDate, isOverdue } from '@/lib/utils/date';
import { exportToExcel, exportToCsv } from '@/lib/utils/export';
import { Plus, Search, Download, Eye, ClipboardList, AlertTriangle, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import Link from 'next/link';
import type { TaskStatus, Location, TaskCategory, Task } from '@/types';

export default function TasksPage() {
    const supabase = createClient();
    const router = useRouter();
    const { data: profile } = useProfile();
    const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const { data: locations } = useQuery<Location[]>({
        queryKey: ['locations'],
        queryFn: async () => {
            const { data } = await supabase.from('locations').select('*').eq('is_active', true).order('sort_order');
            return (data as Location[]) ?? [];
        },
    });

    const { data: categories } = useQuery<TaskCategory[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data } = await supabase.from('task_categories').select('*').eq('is_active', true).order('sort_order');
            return (data as TaskCategory[]) ?? [];
        },
    });

    const { data: tasksData, isLoading } = useTasks({
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as TaskStatus) : undefined,
        severity: severityFilter !== 'all' ? Number(severityFilter) : undefined,
        locationId: locationFilter !== 'all' ? locationFilter : undefined,
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        page,
        pageSize,
    });

    const canCreate = profile?.role === 'admin' || profile?.role === 'inspector';
    const totalPages = Math.ceil((tasksData?.count ?? 0) / pageSize);

    // Stats query for counters
    const { data: allTasksData } = useTasks({ pageSize: 1000 });
    const allTasks = allTasksData?.tasks ?? [];
    const statusCounts = {
        unassigned: allTasks.filter((t) => t.status === 'unassigned').length,
        open: allTasks.filter((t) => t.status === 'open').length,
        in_progress: allTasks.filter((t) => t.status === 'in_progress').length,
        completed: allTasks.filter((t) => t.status === 'completed').length,
        closed: allTasks.filter((t) => t.status === 'closed').length,
    };
    const overdueCount = allTasks.filter((t) => t.due_date && isOverdue(t.due_date) && !['closed', 'completed', 'rejected'].includes(t.status)).length;

    const roleLabel = {
        admin: 'Yönetici',
        inspector: 'Denetçi',
        responsible: 'Görevli',
    }[profile?.role ?? 'responsible'];

    const queryClient = useQueryClient();
    const deleteTask = useMutation({
        mutationFn: async (taskId: string) => {
            // Cascade: photos, actions, notifications, then task
            await supabase.from('task_photos').delete().eq('task_id', taskId);
            await supabase.from('task_actions').delete().eq('task_id', taskId);
            await supabase.from('notifications').delete().eq('task_id', taskId);
            const { error } = await supabase.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: async () => {
            await queryClient.refetchQueries({
                predicate: (query) => (query.queryKey[0] as string) === 'tasks',
            });
            toast.success('Görev silindi');
            setDeleteTaskId(null);
        },
        onError: () => toast.error('Görev silinemedi'),
    });

    return (
        <>
            <div className="space-y-6">
                <PageHeader
                    title={`Hoş geldiniz, ${profile?.full_name ?? ''}`}
                    description={`${roleLabel} · ${allTasks.length} toplam görev`}
                    action={
                        canCreate ? (
                            <Button asChild>
                                <Link href="/tasks/new">
                                    <Plus className="mr-2 h-4 w-4" /> Yeni Görev
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />

                {/* Overdue Warning */}
                {overdueCount > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-destructive text-sm">{overdueCount} Gecikmiş Görev</p>
                            <p className="text-xs text-muted-foreground">Süresi geçmiş görevler acil aksiyon gerektiriyor.</p>
                        </div>
                    </div>
                )}

                {/* Status Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatusCounter
                        label="Atanmamış"
                        count={statusCounts.unassigned}
                        color="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                        textColor="text-gray-700 dark:text-gray-300"
                        active={statusFilter === 'unassigned'}
                        onClick={() => { setStatusFilter(statusFilter === 'unassigned' ? 'all' : 'unassigned'); setPage(1); }}
                    />
                    <StatusCounter
                        label="Yeni Görevler"
                        count={statusCounts.open}
                        color="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                        textColor="text-blue-700 dark:text-blue-300"
                        active={statusFilter === 'open'}
                        onClick={() => { setStatusFilter(statusFilter === 'open' ? 'all' : 'open'); setPage(1); }}
                    />
                    <StatusCounter
                        label="Devam Eden"
                        count={statusCounts.in_progress}
                        color="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                        textColor="text-orange-700 dark:text-orange-300"
                        active={statusFilter === 'in_progress'}
                        onClick={() => { setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress'); setPage(1); }}
                    />
                    <StatusCounter
                        label="Tamamlanmış"
                        count={statusCounts.completed}
                        color="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                        textColor="text-green-700 dark:text-green-300"
                        active={statusFilter === 'completed'}
                        onClick={() => { setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed'); setPage(1); }}
                    />
                    <StatusCounter
                        label="Kapatılmış"
                        count={statusCounts.closed}
                        color="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                        textColor="text-gray-600 dark:text-gray-400"
                        active={statusFilter === 'closed'}
                        onClick={() => { setStatusFilter(statusFilter === 'closed' ? 'all' : 'closed'); setPage(1); }}
                    />
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                            <div className="relative lg:col-span-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ara... (seri no, açıklama)"
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                                    <SelectItem value="unassigned">Atanmamış</SelectItem>
                                    <SelectItem value="open">Açık</SelectItem>
                                    <SelectItem value="in_progress">Devam Ediyor</SelectItem>
                                    <SelectItem value="completed">Tamamlandı</SelectItem>
                                    <SelectItem value="closed">Kapatıldı</SelectItem>
                                    <SelectItem value="rejected">Reddedildi</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Önem" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Önem</SelectItem>
                                    <SelectItem value="5">★★★★★ Acil</SelectItem>
                                    <SelectItem value="4">★★★★ 2 Gün</SelectItem>
                                    <SelectItem value="3">★★★ 1 Hafta</SelectItem>
                                    <SelectItem value="2">★★ Sonraki Denetim</SelectItem>
                                    <SelectItem value="1">★ Planlı</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={locationFilter} onValueChange={(v) => { setLocationFilter(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Lokasyon" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Lokasyonlar</SelectItem>
                                    {locations?.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                                    {categories?.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Export buttons */}
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {tasksData?.count ?? 0} görev bulundu
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => tasksData?.tasks && exportToCsv(tasksData.tasks)}>
                            <Download className="mr-1 h-3 w-3" /> CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => tasksData?.tasks && exportToExcel(tasksData.tasks)}>
                            <Download className="mr-1 h-3 w-3" /> Excel
                        </Button>
                    </div>
                </div>

                {/* Table */}
                {isLoading ? (
                    <LoadingSpinner text="Görevler yükleniyor..." />
                ) : !tasksData?.tasks?.length ? (
                    <EmptyState
                        icon={ClipboardList}
                        title="Görev bulunamadı"
                        description="Arama kriterlerinize uygun görev bulunmuyor."
                    />
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Seri No</TableHead>
                                            <TableHead>Tarih</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Lokasyon</TableHead>
                                            <TableHead>Denetçi</TableHead>
                                            <TableHead>Önem</TableHead>
                                            <TableHead>Durum</TableHead>
                                            <TableHead>Görevli</TableHead>
                                            <TableHead>Son Tarih</TableHead>
                                            <TableHead className="text-right">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tasksData.tasks.map((task) => (
                                            <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/tasks/${task.id}`)}>
                                                <TableCell>
                                                    <div>
                                                        <span className="text-sm font-medium">{task.title || task.description.substring(0, 50)}</span>
                                                        <p className="text-[11px] text-muted-foreground font-mono">#{task.serial_number}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{formatDate(task.created_at)}</TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{task.category?.name ?? '-'}</span>
                                                </TableCell>
                                                <TableCell className="text-sm">{task.location?.name ?? '-'}</TableCell>
                                                <TableCell className="text-sm">{task.inspector?.full_name ?? '-'}</TableCell>
                                                <TableCell>
                                                    <SeverityBadge severity={task.severity} showStars={false} />
                                                </TableCell>
                                                <TableCell>
                                                    <TaskStatusBadge status={task.status} />
                                                </TableCell>
                                                <TableCell className="text-sm">{task.responsible?.full_name ?? '-'}</TableCell>
                                                <TableCell>
                                                    {task.due_date ? (
                                                        <span className={`text-sm ${isOverdue(task.due_date) && !['closed', 'completed', 'rejected'].includes(task.status) ? 'text-destructive font-semibold' : ''}`}>
                                                            {formatDate(task.due_date)}
                                                            {isOverdue(task.due_date) && !['closed', 'completed', 'rejected'].includes(task.status) && (
                                                                <AlertTriangle className="inline ml-1 h-3 w-3" />
                                                            )}
                                                        </span>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" asChild>
                                                            <Link href={`/tasks/${task.id}`}>
                                                                <Eye className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        {profile?.is_super_admin && (
                                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTaskId(task.id); }}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {tasksData.tasks.map((task) => (
                                <Link key={task.id} href={`/tasks/${task.id}`}>
                                    <Card className="hover:bg-muted/50 transition-colors">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <span className="text-sm font-bold">{task.title || task.description.substring(0, 50)}</span>
                                                    <p className="text-[11px] text-muted-foreground font-mono">#{task.serial_number}</p>
                                                </div>
                                                <TaskStatusBadge status={task.status} />
                                            </div>
                                            <p className="text-sm line-clamp-2 mb-2">{task.description}</p>
                                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span>{task.location?.name ?? '-'}</span>
                                                <SeverityBadge severity={task.severity} showStars={false} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span className="text-sm text-muted-foreground">/ sayfa</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Önceki</Button>
                                    <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sonraki</Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ConfirmDialog
                open={!!deleteTaskId}
                onOpenChange={() => setDeleteTaskId(null)}
                title="Görevi Sil"
                description="Bu görev ve tüm ilişkili veriler (fotoğraflar, aksiyonlar, bildirimler) kalıcı olarak silinecek. Bu işlem geri alınamaz."
                onConfirm={() => deleteTaskId && deleteTask.mutate(deleteTaskId)}
                loading={deleteTask.isPending}
            />
        </>
    );
}

function StatusCounter({ label, count, color, textColor, active, onClick }: {
    label: string;
    count: number;
    color: string;
    textColor: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-xl border p-4 text-center transition-all hover:shadow-md cursor-pointer ${color} ${active ? 'ring-2 ring-primary shadow-md' : ''}`}
        >
            <p className={`text-2xl font-bold ${textColor}`}>{count}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </button>
    );
}
