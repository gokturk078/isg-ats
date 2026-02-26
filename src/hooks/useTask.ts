'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/types';

export function useTask(id: string) {
    const supabase = createClient();

    return useQuery<Task | null>({
        queryKey: ['task', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tasks')
                .select(
                    `
          *,
          inspector:profiles!tasks_inspector_id_fkey(*),
          responsible:profiles!tasks_responsible_id_fkey(*),
          location:locations!tasks_location_id_fkey(*),
          category:task_categories!tasks_category_id_fkey(*),
          photos:task_photos(*),
          actions:task_actions(
            *,
            user:profiles(id, full_name, email, avatar_url, role)
          )
        `
                )
                .eq('id', id)
                .single();

            if (error) {
                console.error('Görev alınamadı:', error.message);
                return null;
            }

            return data as unknown as Task;
        },
        enabled: !!id,
    });
}
