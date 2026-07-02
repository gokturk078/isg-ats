import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request: NextRequest) {
  try {
    // Service role key kontrolü
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('SERVICE_ROLE_KEY')) {
      console.error('SUPABASE_SERVICE_ROLE_KEY yapılandırılmamış!');
      return NextResponse.json(
        { error: 'Sunucu yapılandırma hatası. SUPABASE_SERVICE_ROLE_KEY ayarlanmamış.' },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Verify caller is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Yetkilendirme hatası. Lütfen tekrar giriş yapın.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Bu işlem için süper yönetici yetkisi gereklidir.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, full_name, role } = body as {
      email: string;
      full_name: string;
      role: 'admin' | 'inspector' | 'responsible';
    };

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'Email, ad soyad ve rol alanları zorunludur.' }, { status: 400 });
    }

    if (!['admin', 'inspector', 'responsible'].includes(role)) {
      return NextResponse.json({ error: 'Geçersiz rol.' }, { status: 400 });
    }

    // Service role client for admin operations
    const { createServiceClient } = await import('@/lib/supabase/server');
    const serviceClient = await createServiceClient();

    // Geçici şifre oluştur
    const tempPassword = generateTempPassword();

    // Kullanıcıyı Supabase'de oluştur (email göndermeden)
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Email'i otomatik doğrula
      user_metadata: { full_name, role },
    });

    if (createError) {
      console.error('Kullanıcı oluşturma hatası:', createError.message);
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        return NextResponse.json({ error: 'Bu email adresi zaten kayıtlı.' }, { status: 400 });
      }
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Profile'ı oluştur veya güncelle (trigger çalışmamış olabilir)
    if (newUser?.user) {
      await serviceClient.from('profiles').upsert({
        id: newUser.user.id,
        full_name,
        email,
        role,
        is_active: true,
      }, { onConflict: 'id' });
    }

    // Davet emaili gönder (kendi Gmail'imizden)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://isg-ats.vercel.app';
    const roleLabel = { admin: 'Yönetici', inspector: 'Denetçi', responsible: 'Görevli' }[role];

    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1d4ed8;padding:28px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:1px;">İSG AKSİYON TAKİP SİSTEMİ</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Hesabınız Oluşturuldu 🎉</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="color:#374151;font-size:15px;margin:0 0 24px;">
              Merhaba <strong>${full_name}</strong>,<br><br>
              İSG Aksiyon Takip Sistemi'ne <strong>${roleLabel}</strong> olarak kaydedildiniz.
              Aşağıdaki bilgilerle giriş yapabilirsiniz.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:20px;">
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color:#64748b;font-size:13px;width:120px;">Email</td>
                    <td style="color:#1e293b;font-weight:700;font-size:14px;">${email}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:13px;">Geçici Şifre</td>
                    <td style="color:#dc2626;font-weight:700;font-size:16px;font-family:monospace;letter-spacing:1px;">${tempPassword}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:13px;">Rol</td>
                    <td style="color:#1e293b;font-size:14px;">${roleLabel}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="color:#92400e;font-size:13px;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;margin-bottom:24px;">
              <strong>⚠️ Önemli:</strong> İlk girişinizden sonra lütfen şifrenizi değiştiriniz.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${appUrl}/login" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
                GİRİŞ YAP →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
              Bu email İSG Aksiyon Takip Sistemi tarafından otomatik gönderilmiştir.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const emailResult = await sendEmail({
      to: email,
      subject: `🔐 İSG Hesabınız Oluşturuldu — Giriş Bilgileriniz`,
      html,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      tempPassword, // Her zaman döndür — admin gerekirse manuel iletebilsin
      user: newUser?.user,
    });
  } catch (error) {
    console.error('Davet API hatası:', error);
    return NextResponse.json(
      { error: 'Beklenmeyen bir sunucu hatası oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
