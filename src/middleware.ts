import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Auth sayfalarında zaten login ise dashboard'a yönlendir
    if (
        user &&
        (request.nextUrl.pathname.startsWith('/login') ||
            request.nextUrl.pathname.startsWith('/register') ||
            request.nextUrl.pathname.startsWith('/reset-password')) &&
        !request.nextUrl.pathname.startsWith('/set-password')
    ) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Korumalı sayfalar
    const protectedPaths = [
        '/dashboard',
        '/tasks',
        '/my-tasks',
        '/reports',
        '/notifications',
        '/admin',
    ];
    const isProtected = protectedPaths.some((p) =>
        request.nextUrl.pathname.startsWith(p)
    );

    if (!user && isProtected) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Admin-only rotaları koru
    if (user && request.nextUrl.pathname.startsWith('/admin')) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
