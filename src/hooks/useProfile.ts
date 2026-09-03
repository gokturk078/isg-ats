'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';

export function useProfile() {
    const supabase = createClient();
    const { userId, isAuthReady } = useAuthSession();

    return useQuery<Profile | null>({
        queryKey: ['profile', userId],
        queryFn: async () => {
            if (!userId) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                throw new Error(`Profil alınamadı: ${error.message}`);
            }

            return (data as unknown as Profile | null) ?? null;
        },
        enabled: isAuthReady,
        staleTime: 1000 * 60 * 5, // 5 dakika cache
        retry: 1,
    });
}
