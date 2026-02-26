'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useProfile } from '@/hooks/useProfile';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: profile } = useProfile();

    useRealtimeNotifications(profile?.id);

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <Header />
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}
