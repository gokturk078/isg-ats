'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { loginSchema, type LoginInput } from '@/lib/validations/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const routeError = searchParams.get('error') === 'inactive'
        ? 'Hesabınız yönetici tarafından pasif duruma alınmış. Lütfen yöneticinizle görüşün.'
        : searchParams.get('error') === 'profile_missing'
            ? 'Hesabınızın uygulama profili eksik. Süper yönetici profil onarma işlemini yapmalıdır.'
            : '';
    const displayedError = error || routeError;

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginInput) => {
        setError('');

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
        });

        if (authError) {
            if (authError.message.includes('Invalid login credentials')) {
                setError('Email veya şifre hatalı. Lütfen tekrar deneyiniz.');
            } else if (authError.message.toLocaleLowerCase('en-US').includes('banned')) {
                setError('Hesabınız yönetici tarafından pasif duruma alınmış.');
            } else {
                setError(authError.message);
            }
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_active, must_change_password')
            .eq('id', authData.user.id)
            .maybeSingle();

        if (profileError || !profile) {
            await supabase.auth.signOut();
            setError('Hesabınız var ancak uygulama profiliniz eksik. Süper yönetici profilinizi onarmalıdır.');
            return;
        }

        if (!profile.is_active) {
            await supabase.auth.signOut();
            setError('Hesabınız yönetici tarafından pasif duruma alınmış.');
            return;
        }

        toast.success('Giriş başarılı!');
        router.push(profile.must_change_password ? '/set-password' : '/tasks');
        router.refresh();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <Card className="w-full max-w-md shadow-xl border-0">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">İSG-ATS</CardTitle>
                    <CardDescription>İş Sağlığı ve Güvenliği Aksiyon Takip Sistemi</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {displayedError && (
                            <Alert variant="destructive">
                                <AlertDescription>{displayedError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Adresi</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email@sirketiniz.com"
                                autoComplete="email"
                                {...register('email')}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Şifre</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    {...register('password')}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password.message}</p>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Giriş yapılıyor...
                                </>
                            ) : (
                                'Giriş Yap'
                            )}
                        </Button>

                        <div className="text-center">
                            <Link
                                href="/reset-password"
                                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                Şifremi Unuttum
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
