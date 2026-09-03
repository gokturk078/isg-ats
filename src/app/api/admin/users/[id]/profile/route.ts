import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, AdminApiError, noStoreHeaders, requireSuperAdmin } from '@/lib/auth/admin';

const repairSchema = z.object({
    full_name: z.string().trim().min(2).max(120),
    role: z.enum(['admin', 'inspector', 'responsible']),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const parsed = repairSchema.safeParse(await request.json());
        if (!parsed.success) {
            throw new AdminApiError('Geçerli bir ad soyad ve rol seçiniz.', 400);
        }

        const { serviceClient } = await requireSuperAdmin();
        const { data: existingProfile, error: profileLookupError } = await serviceClient
            .from('profiles')
            .select('id')
            .eq('id', id)
            .maybeSingle();
        if (profileLookupError) throw profileLookupError;
        if (existingProfile) {
            throw new AdminApiError('Bu kullanıcının profili zaten mevcut.', 409);
        }

        const { data: authResult, error: authLookupError } = await serviceClient.auth.admin.getUserById(id);
        if (authLookupError || !authResult.user?.email) {
            throw new AdminApiError('Authentication kullanıcısı bulunamadı.', 404);
        }

        const previousMetadata = authResult.user.app_metadata;
        const previousUserMetadata = authResult.user.user_metadata;
        const { error: metadataError } = await serviceClient.auth.admin.updateUserById(id, {
            app_metadata: { ...previousMetadata, app_role: parsed.data.role },
            user_metadata: {
                ...authResult.user.user_metadata,
                full_name: parsed.data.full_name,
            },
        });
        if (metadataError) throw metadataError;

        const { error: insertError } = await serviceClient.from('profiles').insert({
            id,
            email: authResult.user.email,
            full_name: parsed.data.full_name,
            role: parsed.data.role,
            is_active: true,
            must_change_password: true,
        });

        if (insertError) {
            await serviceClient.auth.admin.updateUserById(id, {
                app_metadata: previousMetadata,
                user_metadata: previousUserMetadata,
            });
            throw insertError;
        }

        return NextResponse.json({ success: true }, { headers: noStoreHeaders });
    } catch (error) {
        return adminApiErrorResponse(error, 'Profil onarılamadı.');
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const parsed = repairSchema.safeParse(await request.json());
        if (!parsed.success) {
            throw new AdminApiError('Geçerli bir ad soyad ve rol seçiniz.', 400);
        }

        const { serviceClient } = await requireSuperAdmin();
        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('full_name, role, is_super_admin')
            .eq('id', id)
            .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new AdminApiError('Kullanıcı profili bulunamadı.', 404);
        if (profile.is_super_admin) {
            throw new AdminApiError('Süper yönetici profilinin rolü bu ekrandan değiştirilemez.', 409);
        }

        const { data: authResult, error: authLookupError } = await serviceClient.auth.admin.getUserById(id);
        if (authLookupError || !authResult.user) {
            throw new AdminApiError('Authentication kullanıcısı bulunamadı.', 404);
        }

        const previousAppMetadata = authResult.user.app_metadata;
        const previousUserMetadata = authResult.user.user_metadata;
        const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(id, {
            app_metadata: { ...previousAppMetadata, app_role: parsed.data.role },
            user_metadata: { ...previousUserMetadata, full_name: parsed.data.full_name },
        });
        if (authUpdateError) throw authUpdateError;

        const { error: updateError } = await serviceClient.from('profiles').update({
            full_name: parsed.data.full_name,
            role: parsed.data.role,
        }).eq('id', id);
        if (updateError) {
            await serviceClient.auth.admin.updateUserById(id, {
                app_metadata: previousAppMetadata,
                user_metadata: previousUserMetadata,
            });
            throw updateError;
        }

        return NextResponse.json({ success: true }, { headers: noStoreHeaders });
    } catch (error) {
        return adminApiErrorResponse(error, 'Profil güncellenemedi.');
    }
}
