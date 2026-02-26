'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function useRealtimeNotifications(userId: string | undefined) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const notification = payload.new as { title: string; message?: string };
                    toast.info(notification.title, {
                        description: notification.message,
                    });
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, supabase, queryClient]);
}
