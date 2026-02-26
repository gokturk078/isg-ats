'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/hooks/useProfile';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function UserMenu() {
    const router = useRouter();
    const { data: profile, isLoading } = useProfile();
    const supabase = createClient();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error('Çıkış yapılırken hata oluştu');
            return;
        }
        router.push('/login');
        router.refresh();
    };

    if (isLoading) {
        return <Skeleton className="h-9 w-9 rounded-full" />;
    }

    const initials = profile?.full_name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) ?? '??';

    const roleLabel = {
        admin: 'Yönetici',
        inspector: 'Denetçi',
        responsible: 'Görevli',
    }[profile?.role ?? 'responsible'];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{profile?.full_name ?? 'Kullanıcı'}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile?.role === 'admin' && (
                    <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Ayarlar
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Çıkış Yap
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
