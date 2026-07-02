'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskStatus } from '@/types';

interface UseTasksOptions {
    status?: TaskStatus | TaskStatus[];
    severity?: number;
    locationId?: string;
    categoryId?: string;
    inspectorId?: string;
    responsibleId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    overdue?: boolean;
}

interface UseTasksResult {
    tasks: Task[];
    count: number;
}

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

export function useTasks(options: UseTasksOptions = {}) {
    const supabase = createClient();
    const {
        status,
        severity,
        locationId,
        categoryId,
        inspectorId,
        responsibleId,
        search,
        page = 1,
        pageSize = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        overdue,
    } = options;

    async function hydrateAssignees(tasks: Task[]) {
        if (tasks.length === 0) return tasks;

        const taskIds = tasks.map((task) => task.id);
        const { data: assignees, error: assigneesError } = await supabase
            .from('task_assignees')
            .select('id, task_id, user_id, assigned_by, is_primary, assigned_at')
            .in('task_id', taskIds);

        if (assigneesError) {
            if (!isMissingAssigneesTableError(assigneesError)) {
                console.error('Görevli listesi alınamadı:', assigneesError.message);
            }
            return tasks;
        }

        const assigneeRows = (assignees ?? []) as AssigneeRow[];
        const userIds = Array.from(new Set(assigneeRows.map((assignee) => assignee.user_id)));
        const { data: users } = userIds.length > 0
            ? await supabase.from('profiles').select('id, full_name, email, role, title').in('id', userIds)
            : { data: [] };
        const usersById = new Map((users ?? []).map((user) => [user.id, user]));
        const assigneesByTaskId = new Map<string, NonNullable<Task['assignees']>>();

        for (const assignee of assigneeRows) {
            const list = assigneesByTaskId.get(assignee.task_id) ?? [];
            list.push({
                id: assignee.id,
                task_id: assignee.task_id,
                user_id: assignee.user_id,
                assigned_by: assignee.assigned_by ?? undefined,
                is_primary: assignee.is_primary ?? false,
                assigned_at: assignee.assigned_at ?? '',
                user: usersById.get(assignee.user_id),
            });
            assigneesByTaskId.set(assignee.task_id, list);
        }

        return tasks.map((task) => ({
            ...task,
            assignees: assigneesByTaskId.get(task.id) ?? [],
        }));
    }

    return useQuery<UseTasksResult>({
        queryKey: ['tasks', options],
        queryFn: async () => {
            let assignedTaskIds: string[] = [];

            if (responsibleId) {
                const { data: taskAssignees, error: assigneeError } = await supabase
                    .from('task_assignees')
                    .select('task_id')
                    .eq('user_id', responsibleId);

                if (assigneeError && !isMissingAssigneesTableError(assigneeError)) {
                    console.error('Görevli atamaları alınamadı:', assigneeError.message);
                } else {
                    assignedTaskIds = Array.from(new Set((taskAssignees ?? []).map((row: { task_id: string }) => row.task_id)));
                }
            }

            let query = supabase
                .from('tasks')
                .select(
                    `
          *,
          inspector:profiles!tasks_inspector_id_fkey(id, full_name, email, role),
          responsible:profiles!tasks_responsible_id_fkey(id, full_name, email, role),
          location:locations!tasks_location_id_fkey(id, name, code),
          category:task_categories!tasks_category_id_fkey(id, name, color, icon)
        `,
                    { count: 'exact' }
                );

            if (status) {
                if (Array.isArray(status)) {
                    query = query.in('status', status);
                } else {
                    query = query.eq('status', status);
                }
            }

            if (severity) {
                query = query.eq('severity', severity);
            }

            if (locationId) {
                query = query.eq('location_id', locationId);
            }

            if (categoryId) {
                query = query.eq('category_id', categoryId);
            }

            if (inspectorId) {
                query = query.eq('inspector_id', inspectorId);
            }

            if (responsibleId) {
                if (assignedTaskIds.length > 0) {
                    query = query.or(`responsible_id.eq.${responsibleId},id.in.(${assignedTaskIds.join(',')})`);
                } else {
                    query = query.eq('responsible_id', responsibleId);
                }
            }

            if (search) {
                query = query.or(
                    `description.ilike.%${search}%,serial_number.ilike.%${search}%,title.ilike.%${search}%`
                );
            }

            if (overdue) {
                query = query
                    .lt('due_date', new Date().toISOString())
                    .not('status', 'in', '("closed","completed","rejected")');
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            query = query
                .order(sortBy, { ascending: sortOrder === 'asc' })
                .range(from, to);

            const { data, error, count } = await query;

            if (error) {
                console.error('Görevler alınamadı:', error.message);
                return { tasks: [], count: 0 };
            }

            return {
                tasks: await hydrateAssignees((data as unknown as Task[]) || []),
                count: count || 0,
            };
        },
    });
}
