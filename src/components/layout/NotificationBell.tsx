'use client';

import { Bell, Check, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelative } from '@/lib/utils/date';
import Link from 'next/link';
import { useState } from 'react';

export function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const handleNotificationClick = (notification: typeof notifications[0]) => {
        if (!notification.is_read) {
            markAsRead.mutate(notification.id);
        }
        if (notification.task_id) {
            setOpen(false);
            router.push(`/tasks/${notification.task_id}`);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-3 border-b">
                    <h4 className="text-sm font-semibold">Bildirimler</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => markAllAsRead.mutate()}
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Tümünü Oku
                        </Button>
                    )}
                </div>
                <ScrollArea className="max-h-80">
                    {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            Bildirim yok
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.slice(0, 10).map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-primary/5' : ''
                                        }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-tight">
                                                {notification.title}
                                            </p>
                                            {notification.message && (
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {formatRelative(notification.created_at)}
                                            </p>
                                        </div>
                                        {!notification.is_read && (
                                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full justify-center text-xs" asChild>
                        <Link href="/notifications">Tüm Bildirimleri Gör</Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
