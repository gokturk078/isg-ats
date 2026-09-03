import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { adminApiErrorResponse, noStoreHeaders, requireSuperAdmin } from '@/lib/auth/admin';
import type { AdminUserRecord, Profile, UserRole } from '@/types';

const PAGE_SIZE = 200;

function roleFromUser(user: User): UserRole {
    const candidate = user.app_metadata?.app_role ?? user.user_metadata?.role;
    return candidate === 'admin' || candidate === 'inspector' || candidate === 'responsible'
        ? candidate
        : 'responsible';
}

export async function GET() {
    try {
        const { serviceClient } = await requireSuperAdmin();
        const authUsers: User[] = [];

        for (let page = 1; page <= 50; page += 1) {
            const { data, error } = await serviceClient.auth.admin.listUsers({
                page,
                perPage: PAGE_SIZE,
            });
            if (error) throw error;
            authUsers.push(...data.users);
            if (data.users.length < PAGE_SIZE) break;
        }

        const ids = authUsers.map((user) => user.id);
        let profiles: Profile[] = [];

        if (ids.length > 0) {
            const { data, error } = await serviceClient
                .from('profiles')
                .select('*')
                .in('id', ids);
            if (error) throw error;
            profiles = (data ?? []) as unknown as Profile[];
        }

        const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
        const users: AdminUserRecord[] = authUsers.map((user) => {
            const profile = profileById.get(user.id);
            const isAuthBanned = Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now());
            return {
                id: user.id,
                email: profile?.email || user.email || '',
                full_name:
                    profile?.full_name ||
                    String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı'),
                role: profile?.role ?? roleFromUser(user),
                is_active: (profile?.is_active ?? false) && !isAuthBanned,
                is_super_admin: profile?.is_super_admin ?? false,
                must_change_password: profile?.must_change_password ?? true,
                profile_exists: Boolean(profile),
                email_confirmed: Boolean(user.email_confirmed_at),
                banned_until: user.banned_until,
                created_at: profile?.created_at || user.created_at,
                last_sign_in_at: user.last_sign_in_at,
            };
        });

        users.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return NextResponse.json({ users }, { headers: noStoreHeaders });
    } catch (error) {
        return adminApiErrorResponse(error, 'Kullanıcılar alınamadı.');
    }
}
