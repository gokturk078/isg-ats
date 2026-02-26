'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Tags, Loader2, Trash2 } from 'lucide-react';
import type { TaskCategory } from '@/types';
import { useProfile } from '@/hooks/useProfile';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function CategoriesPage() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366f1');
    const [deleteTarget, setDeleteTarget] = useState<TaskCategory | null>(null);
    const { data: profile } = useProfile();

    const { data: categories, isLoading } = useQuery<TaskCategory[]>({
        queryKey: ['admin-categories'],
        queryFn: async () => {
            const { data } = await supabase.from('task_categories').select('*').order('sort_order');
            return (data as TaskCategory[]) ?? [];
        },
    });

    const createCategory = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('task_categories').insert({ name, color, sort_order: (categories?.length ?? 0) + 1 } as Database['public']['Tables']['task_categories']['Insert']);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Kategori eklendi');
            setDialogOpen(false);
            setName('');
            setColor('#6366f1');
        },
        onError: () => toast.error('Kategori eklenemedi'),
    });

    const toggleActive = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase.from('task_categories').update({ is_active } as Database['public']['Tables']['task_categories']['Update']).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Kategori güncellendi');
        },
    });

    const deleteItem = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/delete?id=${id}&type=category`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Silme başarısız');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Kategori silindi');
            setDeleteTarget(null);
        },
        onError: (e: Error) => toast.error(e.message || 'Kategori silinemedi.'),
    });

    if (isLoading) return <LoadingSpinner text="Kategoriler yükleniyor..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kategori Yönetimi"
                description={`${categories?.length ?? 0} kategori`}
                action={<Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Yeni Kategori</Button>}
            />

            {!categories?.length ? (
                <EmptyState icon={Tags} title="Kategori yok" description="Henüz kategori bulunmuyor." />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Renk</TableHead>
                                <TableHead>Ad</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell><div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} /></TableCell>
                                    <TableCell className="font-medium">{cat.name}</TableCell>
                                    <TableCell><Badge variant={cat.is_active ? 'default' : 'secondary'}>{cat.is_active ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate({ id: cat.id, is_active: !cat.is_active })}>
                                                {cat.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                                            </Button>
                                            {profile?.is_super_admin && (
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(cat); }}>
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
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Yeni Kategori</DialogTitle><DialogDescription>Görevleri gruplamak için yeni bir kategori ekleyin.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kategori adı" /></div>
                        <div className="space-y-2"><Label>Renk</Label><div className="flex items-center gap-2"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 rounded border cursor-pointer" /><Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" /></div></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                        <Button onClick={() => createCategory.mutate()} disabled={createCategory.isPending || !name}>
                            {createCategory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ekle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={() => setDeleteTarget(null)}
                title="Kategoriyi Sil"
                description={`"${deleteTarget?.name}" kategorisi kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
                onConfirm={() => deleteTarget && deleteItem.mutate(deleteTarget.id)}
                loading={deleteItem.isPending}
            />
        </div>
    );
}
