import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        supabaseResponse.cookies.set(name, value, options);
                    });
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();

    const redirect = (path: string) => {
        const response = NextResponse.redirect(new URL(path, request.url));
        supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        return response;
    };

    const { data: profile } = user
        ? await supabase
            .from('profiles')
            .select('role, is_super_admin, is_active, must_change_password')
            .eq('id', user.id)
            .maybeSingle()
        : { data: null };

    if (!user && request.nextUrl.pathname.startsWith('/set-password')) {
        return redirect('/login');
    }

    if (user && request.nextUrl.pathname.startsWith('/set-password') && (!profile || !profile.is_active)) {
        await supabase.auth.signOut();
        return redirect(`/login?error=${profile ? 'inactive' : 'profile_missing'}`);
    }

    const isAuthPage = ['/login', '/register', '/reset-password'].some((path) =>
        request.nextUrl.pathname.startsWith(path),
    );
    if (user && isAuthPage) {
        if (!profile || !profile.is_active) {
            await supabase.auth.signOut();
            return redirect(`/login?error=${profile ? 'inactive' : 'profile_missing'}`);
        }
        return redirect(profile.must_change_password ? '/set-password' : '/tasks');
    }

    if (request.nextUrl.pathname === '/dashboard' || request.nextUrl.pathname === '/reports') {
        return redirect('/tasks');
    }

    const protectedPaths = ['/tasks', '/my-tasks', '/notifications', '/admin'];
    const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

    if (!user && isProtected) {
        return redirect('/login');
    }

    if (user && isProtected && (!profile || !profile.is_active)) {
        await supabase.auth.signOut();
        return redirect(`/login?error=${profile ? 'inactive' : 'profile_missing'}`);
    }

    if (user && profile?.must_change_password && isProtected) {
        return redirect('/set-password');
    }

    if (user && request.nextUrl.pathname.startsWith('/admin')) {
        if (profile?.role !== 'admin') {
            return redirect('/tasks');
        }
        if (request.nextUrl.pathname.startsWith('/admin/users') && !profile.is_super_admin) {
            return redirect('/tasks');
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
