'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTask } from '@/hooks/useTask';
import { useProfile } from '@/hooks/useProfile';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { SeverityBadge } from '@/components/tasks/SeverityBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateTimeLong, formatRelative, isOverdue } from '@/lib/utils/date';
import { toast } from 'sonner';
import {
    MapPin, User, Calendar, Clock, AlertTriangle, Send,
    CheckCircle, XCircle, Play, Lock, MessageSquare, Image,
} from 'lucide-react';
import type { TaskStatus } from '@/types';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: task, isLoading } = useTask(id);
    const { data: profile } = useProfile();
    const [comment, setComment] = useState('');
    const [confirmAction, setConfirmAction] = useState<{ type: string; title: string; desc: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const updateStatus = useMutation({
        mutationFn: async ({ status, extra }: { status: TaskStatus; extra?: Record<string, unknown> }) => {
            const updates: Record<string, unknown> = { status, ...extra };
            if (status === 'completed') updates.completed_at = new Date().toISOString();
            if (status === 'closed') updates.closed_at = new Date().toISOString();

            const { error } = await supabase.from('tasks').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Görev durumu güncellendi');
            setConfirmAction(null);
        },
        onError: () => toast.error('Durum güncellenemedi'),
    });

    const addComment = useMutation({
        mutationFn: async () => {
            if (!comment.trim() || !profile) return;
            const { error } = await supabase.from('task_actions').insert({
                task_id: id,
                user_id: profile.id,
                comment: comment.trim(),
                is_system: false,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setComment('');
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            toast.success('Yorum eklendi');
        },
        onError: () => toast.error('Yorum eklenemedi'),
    });

    if (isLoading) return <LoadingSpinner text="Görev yükleniyor..." />;
    if (!task) return <div className="text-center py-12 text-muted-foreground">Görev bulunamadı</div>;

    const isAdmin = profile?.role === 'admin';
    const isInspector = profile?.role === 'inspector' && task.inspector_id === profile?.id;
    const isResponsible = profile?.role === 'responsible' && task.responsible_id === profile?.id;
    const overdue = task.due_date && isOverdue(task.due_date) && !['closed', 'completed', 'rejected'].includes(task.status);

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Görev #${task.serial_number}`}
                breadcrumbs={[
                    { label: 'Görevler', href: '/tasks' },
                    { label: `#${task.serial_number}` },
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol: Detay */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Ana Bilgiler */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-lg">Görev Bilgileri</CardTitle>
                                <div className="flex items-center gap-2">
                                    <SeverityBadge severity={task.severity} />
                                    <TaskStatusBadge status={task.status} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {overdue && (
                                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                    <span className="text-sm text-destructive font-medium">Bu görev gecikmiş durumda!</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Lokasyon" value={`${task.location?.name ?? '-'}${task.floor ? ' · Kat ' + task.floor : ''}`} />
                                <InfoRow icon={<User className="h-4 w-4" />} label="Denetçi" value={task.inspector?.full_name ?? '-'} />
                                <InfoRow icon={<User className="h-4 w-4" />} label="Görevli" value={task.responsible?.full_name ?? 'Atanmamış'} />
                                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Oluşturulma" value={task.created_at ? formatDateTimeLong(task.created_at) : '-'} />
                                <InfoRow icon={<Clock className="h-4 w-4" />} label="Son Tarih" value={task.due_date ? formatDateTimeLong(task.due_date) : '-'} highlight={!!overdue} />
                                {task.category && (
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.category.color }} />
                                        <span className="text-sm">{task.category.name}</span>
                                    </div>
                                )}
                            </div>

                            <Separator />
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Açıklama</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                            </div>
                            {task.action_required && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 rounded">
                                    <h4 className="text-sm font-semibold mb-1">Aksiyon Gerekliliği</h4>
                                    <p className="text-sm">{task.action_required}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Fotoğraflar */}
                    {task.photos && task.photos.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Image className="h-4 w-4" /> Fotoğraflar ({task.photos.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {task.photos.map((photo) => (
                                        <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity">
                                            <img src={photo.photo_url} alt={photo.caption || 'Görev fotoğrafı'} className="w-full h-full object-cover" />
                                            <Badge className="absolute bottom-1 right-1 text-[10px]" variant="secondary">
                                                {photo.photo_type === 'before' ? 'Önce' : 'Sonra'}
                                            </Badge>
                                        </a>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Aksiyon Zaman Çizelgesi */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Aksiyon Notları
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {task.actions && task.actions.length > 0 ? (
                                <div className="space-y-3">
                                    {task.actions.map((action) => (
                                        <div key={action.id} className={`flex gap-3 ${action.is_system ? 'opacity-70' : ''}`}>
                                            <Avatar className="h-8 w-8 flex-shrink-0">
                                                <AvatarFallback className="text-xs">{action.user?.full_name?.charAt(0) ?? '?'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">{action.user?.full_name ?? 'Sistem'}</span>
                                                    <span className="text-xs text-muted-foreground">{formatRelative(action.created_at)}</span>
                                                </div>
                                                <p className="text-sm mt-0.5 whitespace-pre-wrap">{action.comment}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Henüz aksiyon notu bulunmuyor.</p>
                            )}

                            <Separator />
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Yorum ekleyin..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={2}
                                    className="flex-1"
                                />
                                <Button
                                    size="icon"
                                    onClick={() => addComment.mutate()}
                                    disabled={!comment.trim() || addComment.isPending}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sağ: Durum & Aksiyonlar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Aksiyonlar</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {/* Görevli Aksiyonları */}
                            {isResponsible && task.status === 'open' && (
                                <Button className="w-full" onClick={() => updateStatus.mutate({ status: 'in_progress' })}>
                                    <Play className="mr-2 h-4 w-4" /> Devam Ediyorum
                                </Button>
                            )}
                            {isResponsible && (task.status === 'open' || task.status === 'in_progress') && (
                                <Button className="w-full" variant="outline" onClick={() => setConfirmAction({ type: 'complete', title: 'Görevi Tamamla', desc: 'Bu görevi tamamlandı olarak işaretlemek istediğinize emin misiniz?' })}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Tamamlandı
                                </Button>
                            )}

                            {/* Admin Aksiyonları */}
                            {isAdmin && task.status === 'completed' && (
                                <Button className="w-full" onClick={() => setConfirmAction({ type: 'close', title: 'Görevi Kapat', desc: 'Bu görev kapatılacak. Emin misiniz?' })}>
                                    <Lock className="mr-2 h-4 w-4" /> Görevi Kapat
                                </Button>
                            )}
                            {isAdmin && !['closed', 'rejected'].includes(task.status) && (
                                <Button className="w-full" variant="destructive" onClick={() => setConfirmAction({ type: 'reject', title: 'Görevi Reddet', desc: 'Bu görev reddedilecek. Red nedenini yazınız.' })}>
                                    <XCircle className="mr-2 h-4 w-4" /> Reddet
                                </Button>
                            )}

                            {/* Denetçi: Düzenle */}
                            {isInspector && !['closed', 'rejected'].includes(task.status) && (
                                <Button className="w-full" variant="outline" onClick={() => router.push(`/tasks/${id}/edit`)}>
                                    Düzenle
                                </Button>
                            )}

                            {(!isAdmin && !isInspector && !isResponsible) && (
                                <p className="text-sm text-muted-foreground text-center py-2">Bu görev üzerinde işlem yetkiniz bulunmuyor.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Confirm Dialogs */}
            <ConfirmDialog
                open={confirmAction?.type === 'complete'}
                onOpenChange={() => setConfirmAction(null)}
                title={confirmAction?.title ?? ''}
                description={confirmAction?.desc ?? ''}
                onConfirm={() => updateStatus.mutate({ status: 'completed' })}
                loading={updateStatus.isPending}
            />
            <ConfirmDialog
                open={confirmAction?.type === 'close'}
                onOpenChange={() => setConfirmAction(null)}
                title={confirmAction?.title ?? ''}
                description={confirmAction?.desc ?? ''}
                onConfirm={() => updateStatus.mutate({ status: 'closed' })}
                loading={updateStatus.isPending}
            />
            <ConfirmDialog
                open={confirmAction?.type === 'reject'}
                onOpenChange={() => setConfirmAction(null)}
                title={confirmAction?.title ?? ''}
                description={confirmAction?.desc ?? ''}
                onConfirm={() => updateStatus.mutate({ status: 'rejected', extra: { rejection_reason: rejectReason } })}
                loading={updateStatus.isPending}
                variant="destructive"
                confirmText="Reddet"
            />
        </div>
    );
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-sm text-muted-foreground">{label}:</span>
            <span className={`text-sm font-medium ${highlight ? 'text-destructive' : ''}`}>{value}</span>
        </div>
    );
}
