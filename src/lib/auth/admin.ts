import 'server-only';

import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export class AdminApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AdminApiError';
    }
}

export async function requireSuperAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new AdminApiError('Sunucu kullanıcı yönetimi için yapılandırılmamış.', 500);
    }

    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new AdminApiError('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 401);
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_super_admin, is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profile?.is_active || !profile.is_super_admin) {
        throw new AdminApiError('Bu işlem için süper yönetici yetkisi gereklidir.', 403);
    }

    return {
        caller: user,
        serviceClient: await createServiceClient(),
    };
}

export function generateTemporaryPassword(length = 16) {
    const groups = [
        'ABCDEFGHJKLMNPQRSTUVWXYZ',
        'abcdefghijkmnopqrstuvwxyz',
        '23456789',
        '!@#$%_-',
    ];
    const password = groups.map((group) => group[randomInt(group.length)]);
    const allCharacters = groups.join('');

    while (password.length < length) {
        password.push(allCharacters[randomInt(allCharacters.length)]);
    }

    for (let index = password.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
    }

    return password.join('');
}

export function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character] ?? character);
}

export function adminApiErrorResponse(error: unknown, fallback: string) {
    if (error instanceof AdminApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(fallback, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
}

export const noStoreHeaders = {
    'Cache-Control': 'no-store, max-age=0',
};
