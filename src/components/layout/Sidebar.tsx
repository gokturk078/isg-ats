'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ClipboardList,
    ClipboardCheck,
    BarChart3,
    Bell,
    Users,
    MapPin,
    Tags,
    Settings,
    Shield,
    Plus,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import {
    Sidebar as SidebarRoot,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarHeader,
    SidebarFooter,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

const mainNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'inspector', 'responsible'] },
    { label: 'Görevler', href: '/tasks', icon: ClipboardList, roles: ['admin', 'inspector', 'responsible'] },
    { label: 'Görevlerim', href: '/my-tasks', icon: ClipboardCheck, roles: ['responsible'] },
    { label: 'Yeni Görev', href: '/tasks/new', icon: Plus, roles: ['admin', 'inspector'] },
    { label: 'Raporlar', href: '/reports', icon: BarChart3, roles: ['admin', 'inspector'] },
    { label: 'Bildirimler', href: '/notifications', icon: Bell, roles: ['admin', 'inspector', 'responsible'] },
];

const adminNavItems = [
    { label: 'Kullanıcılar', href: '/admin/users', icon: Users },
    { label: 'Lokasyonlar', href: '/admin/locations', icon: MapPin },
    { label: 'Kategoriler', href: '/admin/categories', icon: Tags },
    { label: 'Ayarlar', href: '/admin/settings', icon: Settings },
];

export function AppSidebar() {
    const pathname = usePathname();
    const { data: profile, isLoading } = useProfile();
    const userRole = profile?.role ?? 'responsible';

    const filteredNavItems = mainNavItems.filter((item) =>
        item.roles.includes(userRole)
    );

    return (
        <SidebarRoot>
            <SidebarHeader className="border-b px-6 py-4">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Shield className="h-7 w-7 text-primary" />
                    <div>
                        <h1 className="text-lg font-bold leading-none">İSG-ATS</h1>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            Aksiyon Takip Sistemi
                        </p>
                    </div>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Ana Menü</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <SidebarMenuItem key={i}>
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <Skeleton className="h-4 w-4 rounded" />
                                            <Skeleton className="h-4 w-24 rounded" />
                                        </div>
                                    </SidebarMenuItem>
                                ))
                            ) : (
                                filteredNavItems.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                                            <Link href={item.href}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {!isLoading && userRole === 'admin' && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Yönetim</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {adminNavItems.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={pathname === item.href}>
                                            <Link href={item.href}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter className="border-t p-4">
                {isLoading ? (
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-28 rounded" />
                            <Skeleton className="h-3 w-16 rounded" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                                {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{profile?.full_name ?? 'Kullanıcı'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                                {userRole === 'admin' ? 'Yönetici' : userRole === 'inspector' ? 'Denetçi' : 'Görevli'}
                            </p>
                        </div>
                    </div>
                )}
            </SidebarFooter>
        </SidebarRoot>
    );
}
