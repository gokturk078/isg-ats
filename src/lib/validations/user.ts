import { z } from 'zod';

export const userInviteSchema = z.object({
    email: z.string().email('Geçerli bir email adresi giriniz'),
    full_name: z.string().min(2, 'Ad soyad en az 2 karakter olmalıdır'),
    role: z.enum(['admin', 'inspector', 'responsible'], {
        message: 'Rol seçiniz',
    }),
    phone: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    location_id: z.string().uuid().optional(),
});

export const userUpdateSchema = z.object({
    full_name: z.string().min(2).optional(),
    role: z.enum(['admin', 'inspector', 'responsible']).optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    location_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Geçerli bir email adresi giriniz'),
    password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
});

export const resetPasswordSchema = z.object({
    email: z.string().email('Geçerli bir email adresi giriniz'),
});

export const setPasswordSchema = z.object({
    password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
    confirmPassword: z.string().min(6, 'Şifre tekrarı en az 6 karakter olmalıdır'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Şifreler eşleşmiyor',
    path: ['confirmPassword'],
});

export type UserInviteInput = z.infer<typeof userInviteSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
