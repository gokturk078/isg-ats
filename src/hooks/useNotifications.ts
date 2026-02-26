'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types';

export function useNotifications() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    const query = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Bildirimler alınamadı:', error.message);
                return [];
            }

            return data as Notification[];
        },
    });

    const unreadCount = query.data?.filter((n) => !n.is_read).length ?? 0;

    const markAsRead = useMutation({
        mutationFn: async (notificationId: string) => {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsRead = useMutation({
        mutationFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    return {
        notifications: query.data ?? [],
        unreadCount,
        isLoading: query.isLoading,
        markAsRead,
        markAllAsRead,
    };
}
