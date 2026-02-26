import { z } from 'zod';

export const taskCreateSchema = z.object({
    location_id: z.string().uuid('Geçerli bir lokasyon seçiniz'),
    floor: z.string().optional(),
    exact_location: z.string().optional(),
    category_id: z.string().uuid('Geçerli bir kategori seçiniz'),
    work_type: z.string().optional(),
    detection_method: z.string().optional().default('Saha Gözlem'),
    description: z
        .string()
        .min(10, 'Açıklama en az 10 karakter olmalıdır')
        .max(2000, 'Açıklama en fazla 2000 karakter olabilir'),
    severity: z
        .number({ error: 'Önem derecesi seçiniz' })
        .int()
        .min(1, 'Önem derecesi 1-5 arası olmalıdır')
        .max(5, 'Önem derecesi 1-5 arası olmalıdır'),
    action_required: z.string().optional(),
    responsible_id: z.string().uuid('Geçerli bir görevli seçiniz').optional(),
    due_date: z.string().optional(),
});

export const taskUpdateSchema = z.object({
    location_id: z.string().uuid().optional(),
    floor: z.string().optional(),
    exact_location: z.string().optional(),
    category_id: z.string().uuid().optional(),
    work_type: z.string().optional(),
    detection_method: z.string().optional(),
    description: z.string().min(10).max(2000).optional(),
    severity: z.number().int().min(1).max(5).optional(),
    action_required: z.string().optional(),
    responsible_id: z.string().uuid().nullable().optional(),
    status: z
        .enum([
            'unassigned',
            'open',
            'in_progress',
            'completed',
            'closed',
            'rejected',
        ])
        .optional(),
    rejection_reason: z.string().optional(),
    due_date: z.string().optional(),
});

export const taskActionSchema = z.object({
    task_id: z.string().uuid(),
    comment: z.string().min(1, 'Yorum boş olamaz').max(2000),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskActionInput = z.infer<typeof taskActionSchema>;
