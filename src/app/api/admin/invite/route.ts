import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify caller is admin
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Yetkilendirme hatası' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Yönetici yetkisi gerekli' }, { status: 403 });
        }

        const body = await request.json();
        const { email, full_name, role } = body as {
            email: string;
            full_name: string;
            role: 'admin' | 'inspector' | 'responsible';
        };

        if (!email || !full_name || !role) {
            return NextResponse.json({ error: 'Email, ad ve rol gerekli' }, { status: 400 });
        }

        // Service role client for admin API
        const { createServiceClient } = await import('@/lib/supabase/server');
        const serviceClient = await createServiceClient();

        const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
            data: { full_name, role },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
        });

        if (inviteError) {
            console.error('Davet hatası:', inviteError.message);
            return NextResponse.json({ error: inviteError.message }, { status: 400 });
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
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
