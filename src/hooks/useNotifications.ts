'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import type { Notification } from '@/types';

export function useNotifications() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: profile } = useProfile();

    const query = useQuery<Notification[]>({
        queryKey: ['notifications', profile?.id],
        queryFn: async () => {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Bildirimler alınamadı:', error.message);
                return [];
            }

            return data as Notification[];
        },
        enabled: !!profile?.id,
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
