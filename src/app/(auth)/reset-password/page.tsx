'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const supabase = createClient();
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordInput>({
        resolver: zodResolver(resetPasswordSchema),
    });

    const onSubmit = async (data: ResetPasswordInput) => {
        setError('');
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        });

        if (resetError) {
            setError('Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyiniz.');
            return;
        }

        setSent(true);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <Card className="w-full max-w-md shadow-xl border-0">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Şifre Sıfırlama</CardTitle>
                    <CardDescription>
                        Email adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sent ? (
                        <div className="text-center space-y-4">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                            <p className="text-sm text-muted-foreground">
                                Şifre sıfırlama bağlantısı email adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz.
                            </p>
                            <Button variant="outline" asChild className="w-full">
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Giriş Sayfasına Dön
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Adresi</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="email@sirketiniz.com"
                                    {...register('email')}
                                />
                                {errors.email && (
                                    <p className="text-sm text-destructive">{errors.email.message}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Gönderiliyor...
                                    </>
                                ) : (
                                    'Sıfırlama Bağlantısı Gönder'
                                )}
                            </Button>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                    Giriş sayfasına dön
                                </Link>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
