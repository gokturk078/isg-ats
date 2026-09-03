'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuthSessionContextValue {
    userId: string | null;
    isAuthReady: boolean;
}

const AuthSessionContext = createContext<AuthSessionContextValue>({
    userId: null,
    isAuthReady: false,
});

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
    const supabase = useMemo(() => createClient(), []);
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        void supabase.auth.getUser().then(({ data }) => {
            if (!mounted) return;
            setUserId(data.user?.id ?? null);
            setIsAuthReady(true);
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            setUserId(session?.user.id ?? null);
            setIsAuthReady(true);
        });

        return () => {
            mounted = false;
            subscription.subscription.unsubscribe();
        };
    }, [supabase]);

    return (
        <AuthSessionContext.Provider value={{ userId, isAuthReady }}>
            {children}
        </AuthSessionContext.Provider>
    );
}

export function useAuthSession() {
    return useContext(AuthSessionContext);
}
