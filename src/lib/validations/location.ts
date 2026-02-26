import { z } from 'zod';

export const locationCreateSchema = z.object({
    name: z.string().min(2, 'Lokasyon adı en az 2 karakter olmalıdır'),
    code: z.string().min(1, 'Lokasyon kodu gerekli').optional(),
    parent_id: z.string().uuid().nullable().optional(),
    sort_order: z.number().int().min(0).default(0),
});

export const locationUpdateSchema = z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(1).optional(),
    parent_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
});

export const categoryCreateSchema = z.object({
    name: z.string().min(2, 'Kategori adı en az 2 karakter olmalıdır'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Geçerli bir renk kodu giriniz'),
    icon: z.string().optional(),
    sort_order: z.number().int().min(0).default(0),
});

export const categoryUpdateSchema = z.object({
    name: z.string().min(2).optional(),
    color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
    icon: z.string().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
});

export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
