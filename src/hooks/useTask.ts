'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/types';

type AssigneeRow = {
    id: string;
    task_id: string;
    user_id: string;
    assigned_by?: string | null;
    is_primary?: boolean | null;
    assigned_at?: string | null;
};

function isMissingAssigneesTableError(error: { message?: string } | null) {
    const message = error?.message?.toLowerCase() ?? '';
    return message.includes('task_assignees') || message.includes('schema cache') || message.includes('does not exist');
}

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

            const task = data as unknown as Task;
            const { data: assignees, error: assigneesError } = await supabase
                .from('task_assignees')
                .select('id, task_id, user_id, assigned_by, is_primary, assigned_at')
                .eq('task_id', id);

            if (assigneesError) {
                if (!isMissingAssigneesTableError(assigneesError)) {
                    console.error('Görevli listesi alınamadı:', assigneesError.message);
                }
                return task;
            }

            const assigneeRows = (assignees ?? []) as AssigneeRow[];
            const userIds = Array.from(new Set(assigneeRows.map((assignee) => assignee.user_id)));
            const { data: users } = userIds.length > 0
                ? await supabase.from('profiles').select('*').in('id', userIds)
                : { data: [] };
            const usersById = new Map((users ?? []).map((user) => [user.id, user]));

            return {
                ...task,
                assignees: assigneeRows.map((assignee) => ({
                    id: assignee.id,
                    task_id: assignee.task_id,
                    user_id: assignee.user_id,
                    assigned_by: assignee.assigned_by ?? undefined,
                    is_primary: assignee.is_primary ?? false,
                    assigned_at: assignee.assigned_at ?? '',
                    user: usersById.get(assignee.user_id),
                })),
            } as Task;
        },
        enabled: !!id,
    });
}
