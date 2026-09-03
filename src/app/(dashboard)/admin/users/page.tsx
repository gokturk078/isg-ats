'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Ban, CheckCircle2, Copy, KeyRound, Loader2, Pencil, Plus, Trash2, Users, Wrench } from 'lucide-react';
import type { AdminUserRecord, UserRole } from '@/types';
import { useProfile } from '@/hooks/useProfile';

const roleLabel: Record<UserRole, string> = {
    admin: 'Yönetici',
    inspector: 'Denetçi',
    responsible: 'Görevli',
};

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
    return result as T;
}

export default function UsersPage() {
    const queryClient = useQueryClient();
    const { data: profile, isLoading: profileLoading } = useProfile();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('responsible');
    const [repairTarget, setRepairTarget] = useState<AdminUserRecord | null>(null);
    const [repairName, setRepairName] = useState('');
    const [repairRole, setRepairRole] = useState<UserRole>('responsible');
    const [accessTarget, setAccessTarget] = useState<AdminUserRecord | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminUserRecord | null>(null);
    const [credential, setCredential] = useState<{
        title: string;
        email: string;
        password: string;
        emailSent: boolean;
    } | null>(null);
    const [search, setSearch] = useState('');

    const usersQuery = useQuery<AdminUserRecord[]>({
        queryKey: ['admin-users'],
        queryFn: async () => (await apiRequest<{ users: AdminUserRecord[] }>('/api/admin/users')).users,
        enabled: Boolean(profile?.is_super_admin),
    });

    const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

    const inviteUser = useMutation({
        mutationFn: () => apiRequest<{
            emailSent: boolean;
            temporaryPassword: string;
        }>('/api/admin/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
        }),
        onSuccess: (result) => {
            void refreshUsers();
            setCredential({
                title: 'Kullanıcı oluşturuldu',
                email: inviteEmail.trim().toLowerCase(),
                password: result.temporaryPassword,
                emailSent: result.emailSent,
            });
            setInviteOpen(false);
            setInviteEmail('');
            setInviteName('');
            setInviteRole('responsible');
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const repairProfile = useMutation({
        mutationFn: () => apiRequest(`/api/admin/users/${repairTarget?.id}/profile`, {
            method: repairTarget?.profile_exists ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: repairName, role: repairRole }),
        }),
        onSuccess: () => {
            void refreshUsers();
            setRepairTarget(null);
            toast.success(repairTarget?.profile_exists ? 'Kullanıcı adı ve rolü güncellendi.' : 'Eksik profil oluşturuldu. Kullanıcı artık giriş yapabilir.');
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const resetPassword = useMutation({
        mutationFn: (user: AdminUserRecord) => apiRequest<{
            emailSent: boolean;
            temporaryPassword: string;
        }>(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' }),
        onSuccess: (result, user) => {
            void refreshUsers();
            setCredential({
                title: 'Geçici şifre oluşturuldu',
                email: user.email,
                password: result.temporaryPassword,
                emailSent: result.emailSent,
            });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const changeAccess = useMutation({
        mutationFn: (user: AdminUserRecord) => apiRequest(`/api/admin/users/${user.id}/access`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !user.is_active }),
        }),
        onSuccess: (_result, user) => {
            void refreshUsers();
            setAccessTarget(null);
            toast.success(user.is_active ? 'Kullanıcı pasif yapıldı.' : 'Kullanıcı aktifleştirildi.');
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const deleteUser = useMutation({
        mutationFn: (user: AdminUserRecord) => apiRequest(`/api/admin/users/${user.id}`, { method: 'DELETE' }),
        onSuccess: () => {
            void refreshUsers();
            setDeleteTarget(null);
            toast.success('Kullanıcı kalıcı olarak silindi.');
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('tr-TR');
        if (!term) return usersQuery.data ?? [];
        return (usersQuery.data ?? []).filter((user) =>
            `${user.full_name} ${user.email} ${roleLabel[user.role]}`.toLocaleLowerCase('tr-TR').includes(term),
        );
    }, [search, usersQuery.data]);

    const startRepair = (user: AdminUserRecord) => {
        setRepairTarget(user);
        setRepairName(user.full_name);
        setRepairRole(user.role);
    };

    const copyCredential = async () => {
        if (!credential) return;
        try {
            await navigator.clipboard.writeText(`Email: ${credential.email}\nGeçici şifre: ${credential.password}`);
            toast.success('Giriş bilgileri panoya kopyalandı.');
        } catch {
            toast.error('Panoya kopyalanamadı. Bilgileri elle kopyalayın.');
        }
    };

    if (profileLoading) return <LoadingSpinner text="Yetki kontrol ediliyor..." />;

    if (!profile?.is_super_admin) {
        return (
            <div className="space-y-6">
                <PageHeader title="Kullanıcılar" description="Bu sayfaya erişim yetkiniz bulunmuyor." />
                <EmptyState icon={Users} title="Yetkisiz erişim" description="Kullanıcı yönetimi yalnızca süper yönetici tarafından kullanılabilir." />
            </div>
        );
    }

    if (usersQuery.isLoading) return <LoadingSpinner text="Kullanıcılar yükleniyor..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kullanıcı Yönetimi"
                description={`${usersQuery.data?.length ?? 0} Authentication hesabı`}
                action={(
                    <Button onClick={() => setInviteOpen(true)} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Kullanıcı Ekle
                    </Button>
                )}
            />

            <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, email veya rol ara..."
                className="max-w-md"
            />

            {usersQuery.isError && (
                <Alert variant="destructive">
                    <AlertDescription>{usersQuery.error.message}</AlertDescription>
                </Alert>
            )}

            {!filteredUsers.length && !usersQuery.isError ? (
                <EmptyState icon={Users} title="Kullanıcı bulunamadı" description="Arama ölçütüne uygun kullanıcı yok." />
            ) : (
                <>
                    <Card className="hidden overflow-hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kullanıcı</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Hesap</TableHead>
                                    <TableHead>Şifre</TableHead>
                                    <TableHead className="text-right">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="font-medium">{user.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{roleLabel[user.role]}</Badge></TableCell>
                                        <TableCell><AccountBadges user={user} /></TableCell>
                                        <TableCell>
                                            <Badge variant={user.must_change_password ? 'secondary' : 'outline'}>
                                                {user.must_change_password ? 'Değişiklik bekliyor' : 'Belirlenmiş'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <UserActions
                                                user={user}
                                                currentUserId={profile.id}
                                                busy={resetPassword.isPending || changeAccess.isPending || deleteUser.isPending}
                                                onRepair={() => startRepair(user)}
                                                onEdit={() => startRepair(user)}
                                                onReset={() => resetPassword.mutate(user)}
                                                onAccess={() => setAccessTarget(user)}
                                                onDelete={() => setDeleteTarget(user)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

                    <div className="grid gap-3 md:hidden">
                        {filteredUsers.map((user) => (
                            <Card key={user.id}>
                                <CardContent className="space-y-4 p-4">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold">{user.full_name}</p>
                                        <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline">{roleLabel[user.role]}</Badge>
                                        <AccountBadges user={user} />
                                        {user.must_change_password && <Badge variant="secondary">Şifre değişikliği bekliyor</Badge>}
                                    </div>
                                    <UserActions
                                        user={user}
                                        currentUserId={profile.id}
                                        busy={resetPassword.isPending || changeAccess.isPending || deleteUser.isPending}
                                        onRepair={() => startRepair(user)}
                                        onEdit={() => startRepair(user)}
                                        onReset={() => resetPassword.mutate(user)}
                                        onAccess={() => setAccessTarget(user)}
                                        onDelete={() => setDeleteTarget(user)}
                                        mobile
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Kullanıcı ekle</DialogTitle>
                        <DialogDescription>Hesap, profil ve geçici şifre birlikte güvenli biçimde oluşturulur.</DialogDescription>
                    </DialogHeader>
                    <UserFields
                        name={inviteName}
                        onNameChange={setInviteName}
                        role={inviteRole}
                        onRoleChange={setInviteRole}
                        email={inviteEmail}
                        onEmailChange={setInviteEmail}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>İptal</Button>
                        <Button
                            onClick={() => inviteUser.mutate()}
                            disabled={inviteUser.isPending || !inviteEmail.trim() || inviteName.trim().length < 2}
                        >
                            {inviteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Hesabı oluştur
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(repairTarget)} onOpenChange={(open) => !open && setRepairTarget(null)}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{repairTarget?.profile_exists ? 'Kullanıcıyı düzenle' : 'Eksik profili onar'}</DialogTitle>
                        <DialogDescription>
                            {repairTarget?.profile_exists
                                ? `${repairTarget.email} hesabının adı ve uygulama rolü güncellenecek.`
                                : `${repairTarget?.email} için uygulama profili oluşturulacak.`}
                        </DialogDescription>
                    </DialogHeader>
                    <UserFields name={repairName} onNameChange={setRepairName} role={repairRole} onRoleChange={setRepairRole} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRepairTarget(null)}>İptal</Button>
                        <Button onClick={() => repairProfile.mutate()} disabled={repairProfile.isPending || repairName.trim().length < 2}>
                            {repairProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {repairTarget?.profile_exists ? 'Değişiklikleri kaydet' : 'Profili oluştur'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{credential?.title}</DialogTitle>
                        <DialogDescription>
                            {credential?.emailSent
                                ? 'Bilgiler kullanıcıya email ile gönderildi. Yine de aşağıdaki şifre yalnız bu ekranda bir kez gösterilir.'
                                : 'Email gönderilemedi. Aşağıdaki bilgileri kullanıcıya güvenli bir kanaldan iletin.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border bg-muted/40 p-4">
                        <p className="break-all text-sm text-muted-foreground">{credential?.email}</p>
                        <p className="mt-2 break-all font-mono text-lg font-semibold">{credential?.password}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCredential(null)}>Kapat</Button>
                        <Button onClick={copyCredential}><Copy className="mr-2 h-4 w-4" /> Kopyala</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(accessTarget)}
                onOpenChange={(open) => !open && setAccessTarget(null)}
                title={accessTarget?.is_active ? 'Kullanıcıyı pasif yap' : 'Kullanıcıyı aktifleştir'}
                description={accessTarget?.is_active
                    ? `${accessTarget?.full_name} artık giriş yapamayacak; geçmiş görev kayıtları korunacak.`
                    : `${accessTarget?.full_name} yeniden giriş yapabilecek.`}
                confirmText={accessTarget?.is_active ? 'Pasif yap' : 'Aktifleştir'}
                variant={accessTarget?.is_active ? 'destructive' : 'default'}
                onConfirm={() => accessTarget && changeAccess.mutate(accessTarget)}
                loading={changeAccess.isPending}
            />

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Kullanıcıyı kalıcı sil"
                description={`${deleteTarget?.full_name} yalnızca hiçbir geçmiş kayıtla ilişkili değilse silinecek. İlişkili kayıt varsa sistem silmeyi güvenli biçimde engeller.`}
                confirmText="Kalıcı sil"
                variant="destructive"
                onConfirm={() => deleteTarget && deleteUser.mutate(deleteTarget)}
                loading={deleteUser.isPending}
            />
        </div>
    );
}

function AccountBadges({ user }: { user: AdminUserRecord }) {
    if (!user.profile_exists) return <Badge variant="destructive">Profil eksik</Badge>;
    return (
        <div className="flex flex-wrap gap-1">
            <Badge variant={user.is_active ? 'default' : 'secondary'}>{user.is_active ? 'Aktif' : 'Pasif'}</Badge>
            {user.is_super_admin && <Badge variant="outline">Süper yönetici</Badge>}
            {!user.email_confirmed && <Badge variant="destructive">Email doğrulanmamış</Badge>}
        </div>
    );
}

function UserActions({
    user,
    currentUserId,
    busy,
    onRepair,
    onEdit,
    onReset,
    onAccess,
    onDelete,
    mobile = false,
}: {
    user: AdminUserRecord;
    currentUserId: string;
    busy: boolean;
    onRepair: () => void;
    onEdit: () => void;
    onReset: () => void;
    onAccess: () => void;
    onDelete: () => void;
    mobile?: boolean;
}) {
    if (!user.profile_exists) {
        return (
            <Button size="sm" variant="outline" onClick={onRepair} className={mobile ? 'w-full min-h-11' : ''}>
                <Wrench className="mr-2 h-4 w-4" /> Profili onar
            </Button>
        );
    }

    const protectedAccount = user.id === currentUserId || user.is_super_admin;
    return (
        <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex items-center justify-end gap-1'}>
            {!user.is_super_admin && (
                <Button size="sm" variant="outline" onClick={onEdit} disabled={busy} className={mobile ? 'min-h-11' : ''}>
                    <Pencil className="mr-2 h-4 w-4" /> Düzenle
                </Button>
            )}
            {!user.is_super_admin && (
                <Button size="sm" variant="outline" onClick={onReset} disabled={busy} className={mobile ? 'min-h-11' : ''}>
                    <KeyRound className="mr-2 h-4 w-4" /> Şifre
                </Button>
            )}
            {!protectedAccount && (
                <>
                    <Button size="sm" variant="outline" onClick={onAccess} disabled={busy} className={mobile ? 'min-h-11' : ''}>
                        {user.is_active
                            ? <><Ban className="mr-2 h-4 w-4" /> Pasif</>
                            : <><CheckCircle2 className="mr-2 h-4 w-4" /> Aktif</>}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDelete}
                        disabled={busy}
                        className={mobile ? 'col-span-2 min-h-11 text-destructive' : 'text-destructive hover:text-destructive'}
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Sil
                    </Button>
                </>
            )}
        </div>
    );
}

function UserFields({
    name,
    onNameChange,
    role,
    onRoleChange,
    email,
    onEmailChange,
}: {
    name: string;
    onNameChange: (value: string) => void;
    role: UserRole;
    onRoleChange: (value: UserRole) => void;
    email?: string;
    onEmailChange?: (value: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="user-full-name">Ad soyad</Label>
                <Input id="user-full-name" value={name} onChange={(event) => onNameChange(event.target.value)} autoComplete="name" />
            </div>
            {onEmailChange && (
                <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input id="user-email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} autoComplete="email" />
                </div>
            )}
            <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={role} onValueChange={(value) => onRoleChange(value as UserRole)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Yönetici</SelectItem>
                        <SelectItem value="inspector">Denetçi</SelectItem>
                        <SelectItem value="responsible">Görevli</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
