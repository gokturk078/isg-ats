import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function translateSupabaseError(message: string): string {
    if (message.includes('rate limit') || message.includes('Rate limit')) {
        return 'Email gönderim limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.';
    }
    if (message.includes('already been registered') || message.includes('already exists')) {
        return 'Bu email adresi zaten kayıtlı.';
    }
    if (message.includes('invalid') && message.includes('email')) {
        return 'Geçersiz email adresi.';
    }
    if (message.includes('not authorized') || message.includes('not allowed')) {
        return 'Bu işlem için yetkiniz yok.';
    }
    if (message.includes('service_role')) {
        return 'Sunucu yapılandırma hatası. Lütfen yöneticinize başvurun.';
    }
    return message;
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
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' }, { status: 403 });
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
            return NextResponse.json({ error: 'Geçersiz rol. admin, inspector veya responsible olmalıdır.' }, { status: 400 });
        }

        // Service role client for admin API
        const { createServiceClient } = await import('@/lib/supabase/server');
        const serviceClient = await createServiceClient();

        const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
            data: { full_name, role },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/set-password`,
        });

        if (inviteError) {
            console.error('Davet hatası:', inviteError.message);
            return NextResponse.json(
                { error: translateSupabaseError(inviteError.message) },
                { status: 400 }
            );
        }

        // Update profile with role and name (trigger creates the profile)
        if (inviteData?.user) {
            await serviceClient.from('profiles').update({
                full_name,
                role,
            }).eq('id', inviteData.user.id);
        }

        return NextResponse.json({ success: true, user: inviteData?.user });
    } catch (error) {
        console.error('Davet API hatası:', error);
        return NextResponse.json(
            { error: 'Beklenmeyen bir sunucu hatası oluştu. Lütfen tekrar deneyin.' },
            { status: 500 }
        );
    }
}

