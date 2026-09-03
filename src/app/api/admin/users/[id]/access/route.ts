import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, AdminApiError, noStoreHeaders, requireSuperAdmin } from '@/lib/auth/admin';

const accessSchema = z.object({ active: z.boolean() });

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const parsed = accessSchema.safeParse(await request.json());
        if (!parsed.success) throw new AdminApiError('Geçersiz hesap durumu.', 400);

        const { caller, serviceClient } = await requireSuperAdmin();
        if (caller.id === id) {
            throw new AdminApiError('Kendi hesabınızı pasifleştiremez veya aktifleştiremezsiniz.', 409);
        }

        const { data: target, error: targetError } = await serviceClient
            .from('profiles')
            .select('is_super_admin, is_active')
            .eq('id', id)
            .maybeSingle();
        if (targetError) throw targetError;
        if (!target) throw new AdminApiError('Kullanıcı profili bulunamadı.', 404);
        if (target.is_super_admin) {
            throw new AdminApiError('Süper yönetici hesabının erişimi değiştirilemez.', 409);
        }

        const active = parsed.data.active;
        const { data: authTarget, error: authTargetError } = await serviceClient.auth.admin.getUserById(id);
        if (authTargetError || !authTarget.user) {
            throw new AdminApiError('Authentication kullanıcısı bulunamadı.', 404);
        }
        const wasBanned = Boolean(
            authTarget.user.banned_until && Date.parse(authTarget.user.banned_until) > Date.now(),
        );
        const { error: authError } = await serviceClient.auth.admin.updateUserById(id, {
            ban_duration: active ? 'none' : '876000h',
            ...(active ? { email_confirm: true } : {}),
        });
        if (authError) throw authError;

        const { error: profileError } = await serviceClient
            .from('profiles')
            .update({ is_active: active })
            .eq('id', id);
        if (profileError) {
            await serviceClient.auth.admin.updateUserById(id, {
                ban_duration: wasBanned ? '876000h' : 'none',
            });
            throw profileError;
        }

        return NextResponse.json({ success: true, active }, { headers: noStoreHeaders });
    } catch (error) {
        return adminApiErrorResponse(error, 'Kullanıcı erişimi güncellenemedi.');
    }
}
