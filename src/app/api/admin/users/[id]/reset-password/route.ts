import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/mailer';
import {
    adminApiErrorResponse,
    AdminApiError,
    escapeHtml,
    generateTemporaryPassword,
    noStoreHeaders,
    requireSuperAdmin,
} from '@/lib/auth/admin';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const { serviceClient } = await requireSuperAdmin();
        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('email, full_name, must_change_password, is_super_admin')
            .eq('id', id)
            .maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new AdminApiError('Önce kullanıcının eksik profilini onarın.', 409);
        if (profile.is_super_admin) {
            throw new AdminApiError('Süper yönetici hesabının şifresi bu ekrandan değiştirilemez.', 409);
        }

        const temporaryPassword = generateTemporaryPassword();
        const { error: flagError } = await serviceClient
            .from('profiles')
            .update({ must_change_password: true })
            .eq('id', id);
        if (flagError) throw flagError;

        const { error: passwordError } = await serviceClient.auth.admin.updateUserById(id, {
            password: temporaryPassword,
            email_confirm: true,
        });
        if (passwordError) {
            await serviceClient
                .from('profiles')
                .update({ must_change_password: profile.must_change_password })
                .eq('id', id);
            throw passwordError;
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://isg-ats.vercel.app';
        const safeName = escapeHtml(profile.full_name);
        const safeEmail = escapeHtml(profile.email);
        const safePassword = escapeHtml(temporaryPassword);
        const emailResult = await sendEmail({
            to: profile.email,
            subject: 'İSG-ATS geçici giriş şifreniz',
            html: `<!doctype html><html lang="tr"><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:28px"><h2 style="color:#1d4ed8">Şifreniz yenilendi</h2><p>Merhaba <strong>${safeName}</strong>,</p><p>Yöneticiniz hesabınız için geçici bir şifre oluşturdu.</p><p>Email: <strong>${safeEmail}</strong><br>Geçici şifre: <strong style="font-family:monospace;color:#dc2626">${safePassword}</strong></p><p>İlk girişte kalıcı şifrenizi belirlemeniz istenecektir.</p><p><a href="${appUrl}/login" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Giriş yap</a></p></div></body></html>`,
        });

        return NextResponse.json(
            { success: true, emailSent: emailResult.success, temporaryPassword },
            { headers: noStoreHeaders },
        );
    } catch (error) {
        return adminApiErrorResponse(error, 'Geçici şifre oluşturulamadı.');
    }
}
