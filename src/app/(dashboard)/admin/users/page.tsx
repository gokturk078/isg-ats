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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Users, Loader2, Trash2 } from 'lucide-react';
import type { Profile, UserRole } from '@/types';
import { useProfile } from '@/hooks/useProfile';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function UsersPage() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: profile } = useProfile();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('responsible');
    const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

    // Guard: only super admin
    if (profile && !profile.is_super_admin) {
        return (
            <div className="space-y-6">
                <PageHeader title="Kullanıcılar" description="Bu sayfaya erişim yetkiniz bulunmuyor." />
                <EmptyState icon={Users} title="Yetkisiz Erişim" description="Kullanıcı yönetimi yalnızca süper yönetici tarafından yapılabilir." />
            </div>
        );
    }

    const { data: users, isLoading } = useQuery<Profile[]>({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            return (data as Profile[]) ?? [];
        },
    });

    const inviteUser = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/admin/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Davet gönderilemedi');
            }
            return data as { success: boolean; emailSent: boolean; tempPassword: string };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            if (data.emailSent) {
                toast.success('Kullanıcı oluşturuldu ve davet emaili gönderildi.');
            } else {
                toast('Kullanıcı oluşturuldu ancak email gönderilemedi.', {
                    description: `Geçici şifre: ${data.tempPassword}`,
                    duration: 30000,
                    action: {
                        label: 'Kopyala',
                        onClick: () => navigator.clipboard.writeText(data.tempPassword),
                    },
                });
            }
            // Her durumda geçici şifreyi logla (admin görebilsin)
            console.info(`[Davet] ${inviteEmail} → Geçici şifre: ${data.tempPassword}`);
            setDialogOpen(false);
            setInviteEmail('');
            setInviteName('');
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const toggleActive = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase.from('profiles').update({ is_active } as Database['public']['Tables']['profiles']['Update']).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Kullanıcı durumu güncellendi');
        },
    });

    const deleteUser = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success('Kullanıcı silindi');
            setDeleteTarget(null);
        },
        onError: () => toast.error('Kullanıcı silinemedi'),
    });

    const roleLabel: Record<string, string> = { admin: 'Yönetici', inspector: 'Denetçi', responsible: 'Görevli' };

    if (isLoading) return <LoadingSpinner text="Kullanıcılar yükleniyor..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kullanıcı Yönetimi"
                description={`${users?.length ?? 0} kullanıcı kayıtlı`}
                action={
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Kullanıcı Davet Et
                    </Button>
                }
            />

            {!users?.length ? (
                <EmptyState icon={Users} title="Kullanıcı yok" description="Henüz kayıtlı kullanıcı bulunmuyor." />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ad Soyad</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.full_name}</TableCell>
                                    <TableCell className="text-sm">{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{roleLabel[user.role] ?? user.role}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                                            {user.is_active ? 'Aktif' : 'Pasif'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleActive.mutate({ id: user.id, is_active: !user.is_active })}
                                            >
                                                {user.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                                            </Button>
                                            {profile?.is_super_admin && !user.is_super_admin && (
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(user)}>
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
                    <DialogHeader>
                        <DialogTitle>Kullanıcı Davet Et</DialogTitle>
                        <DialogDescription>Sisteme yeni bir kullanıcı davet edin. Email adresine giriş bağlantısı gönderilecektir.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Ad Soyad</Label>
                            <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Ad Soyad" />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@sirket.com" />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol</Label>
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Yönetici</SelectItem>
                                    <SelectItem value="inspector">Denetçi</SelectItem>
                                    <SelectItem value="responsible">Görevli</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                        <Button onClick={() => inviteUser.mutate()} disabled={inviteUser.isPending || !inviteEmail || !inviteName}>
                            {inviteUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Davet Gönder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={() => setDeleteTarget(null)}
                title="Kullanıcıyı Sil"
                description={`"${deleteTarget?.full_name}" kullanıcısı kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
                onConfirm={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
                loading={deleteUser.isPending}
            />
        </div>
    );
}
