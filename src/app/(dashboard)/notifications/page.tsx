'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/utils/date';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

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
                            className={`transition-colors ${!notification.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
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
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {notification.task_id && (
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/tasks/${notification.task_id}`}>Göreve Git</Link>
                                            </Button>
                                        )}
                                        {!notification.is_read && (
                                            <Button variant="ghost" size="sm" onClick={() => markAsRead.mutate(notification.id)}>
                                                Okundu
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
