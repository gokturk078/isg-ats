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

    return useQuery<UseTasksResult>({
        queryKey: ['tasks', options],
        queryFn: async () => {
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
                query = query.eq('responsible_id', responsibleId);
            }

            if (search) {
                query = query.or(
                    `description.ilike.%${search}%,serial_number.ilike.%${search}%`
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
                tasks: (data as unknown as Task[]) || [],
                count: count || 0,
            };
        },
    });
}
