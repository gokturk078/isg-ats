import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();
    const { data: profile, error: lookupError } = await serviceClient
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (lookupError || !profile) {
        return NextResponse.json({ error: 'Kullanıcı profili bulunamadı.' }, { status: 409 });
    }
    if (!profile.is_active) {
        return NextResponse.json({ error: 'Hesabınız pasif durumdadır.' }, { status: 403 });
    }

    const { error } = await serviceClient
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
    if (error) {
        console.error('Şifre değiştirme bayrağı güncellenemedi:', error);
        return NextResponse.json({ error: 'Şifre durumu güncellenemedi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
