'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export function useProfile() {
    const supabase = createClient();

    return useQuery<Profile | null>({
        queryKey: ['profile'],
        queryFn: async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Profil alınamadı:', error.message);
                return null;
            }

            // Self-healing: profil yoksa auth metadata'dan otomatik oluştur
            if (!data) {
                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        full_name:
                            user.user_metadata?.full_name ||
                            user.email?.split('@')[0] ||
                            'Kullanıcı',
                        email: user.email || '',
                        role: (['admin', 'inspector', 'responsible'].includes(
                            user.user_metadata?.role
                        )
                            ? user.user_metadata.role
                            : 'responsible') as 'admin' | 'inspector' | 'responsible',
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Profil otomatik oluşturulamadı:', insertError.message);
                    return null;
                }

                return newProfile as unknown as Profile;
            }

            return data as unknown as Profile;
        },
        staleTime: 1000 * 60 * 5, // 5 dakika cache
        retry: 2,
    });
}
