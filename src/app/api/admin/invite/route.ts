import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/mailer';
import { userInviteSchema } from '@/lib/validations/user';
import {
    adminApiErrorResponse,
    AdminApiError,
    escapeHtml,
    generateTemporaryPassword,
    noStoreHeaders,
    requireSuperAdmin,
} from '@/lib/auth/admin';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = userInviteSchema.safeParse({
            ...body,
            email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
            full_name: typeof body.full_name === 'string' ? body.full_name.trim() : body.full_name,
        });
        if (!parsed.success) {
            throw new AdminApiError(parsed.error.issues[0]?.message || 'Kullanıcı bilgileri geçersiz.', 400);
        }

        const { serviceClient } = await requireSuperAdmin();
        const temporaryPassword = generateTemporaryPassword();
        const { email, full_name, role, phone, company, title, location_id } = parsed.data;
        const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
            app_metadata: { app_role: role },
            user_metadata: { full_name },
        });

        if (createError || !newUser.user) {
            const message = createError?.message ?? 'Authentication kullanıcısı oluşturulamadı.';
            if (/already|registered|exists/i.test(message)) {
                throw new AdminApiError('Bu email adresi zaten kayıtlı.', 409);
            }
            throw new AdminApiError(message, 400);
        }

        const { error: profileError } = await serviceClient.from('profiles').upsert({
            id: newUser.user.id,
            full_name,
            email,
            role,
            phone: phone || null,
            company: company || null,
            title: title || null,
            location_id: location_id || null,
            is_active: true,
            must_change_password: true,
        }, { onConflict: 'id' });

        if (profileError) {
            await serviceClient.auth.admin.deleteUser(newUser.user.id);
            throw new AdminApiError(`Profil oluşturulamadı: ${profileError.message}`, 500);
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://isg-ats.vercel.app';
        const roleLabel = { admin: 'Yönetici', inspector: 'Denetçi', responsible: 'Görevli' }[role];
        const emailResult = await sendEmail({
            to: email,
            subject: 'İSG-ATS hesabınız oluşturuldu',
            html: `<!doctype html><html lang="tr"><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:28px"><h2 style="color:#1d4ed8">Hesabınız oluşturuldu</h2><p>Merhaba <strong>${escapeHtml(full_name)}</strong>,</p><p>İSG Aksiyon Takip Sistemi'ne <strong>${roleLabel}</strong> olarak kaydedildiniz.</p><p>Email: <strong>${escapeHtml(email)}</strong><br>Geçici şifre: <strong style="font-family:monospace;color:#dc2626">${escapeHtml(temporaryPassword)}</strong></p><p>İlk girişte kalıcı şifrenizi belirlemeniz istenecektir.</p><p><a href="${appUrl}/login" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Giriş yap</a></p></div></body></html>`,
        });

        return NextResponse.json({
            success: true,
            emailSent: emailResult.success,
            temporaryPassword,
            userId: newUser.user.id,
        }, { headers: noStoreHeaders });
    } catch (error) {
        return adminApiErrorResponse(error, 'Kullanıcı oluşturulamadı.');
    }
}
