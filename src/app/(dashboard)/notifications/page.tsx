'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/utils/date';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const router = useRouter();

    const handleClick = (notification: typeof notifications[0]) => {
        if (!notification.is_read) {
            markAsRead.mutate(notification.id);
        }
        if (notification.task_id) {
            router.push(`/tasks/${notification.task_id}`);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Bildirimler"
                description={`${unreadCount} okunmamış bildirim`}
                action={
                    unreadCount > 0 ? (
                        <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()}>
                            <CheckCheck className="mr-2 h-4 w-4" /> Tümünü Okundu İşaretle
                        </Button>
                    ) : undefined
                }
            />

            {notifications.length === 0 ? (
                <EmptyState icon={Bell} title="Bildirim yok" description="Henüz bildiriminiz bulunmuyor." />
            ) : (
                <div className="space-y-2">
                    {notifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`transition-colors cursor-pointer hover:bg-muted/50 ${!notification.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
                            onClick={() => handleClick(notification)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-medium">{notification.title}</h4>
                                            {!notification.is_read && <Badge className="text-[10px]">Yeni</Badge>}
                                        </div>
                                        {notification.message && (
                                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">{formatRelative(notification.created_at)}</p>
                                    </div>
                                    {!notification.is_read && (
                                        <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
