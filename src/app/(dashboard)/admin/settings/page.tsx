import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader title="Sistem Ayarları" description="Uygulama yapılandırması" />
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Genel Ayarlar</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b">
                            <div>
                                <p className="text-sm font-medium">Uygulama Adı</p>
                                <p className="text-xs text-muted-foreground">Sistem genelinde görünen ad</p>
                            </div>
                            <p className="text-sm font-mono">İSG-ATS</p>
                        </div>
                        <div className="flex items-center justify-between py-3 border-b">
                            <div>
                                <p className="text-sm font-medium">Email Gönderim</p>
                                <p className="text-xs text-muted-foreground">Nodemailer + Gmail SMTP</p>
                            </div>
                            <p className="text-sm font-mono">{process.env.NEXT_PUBLIC_APP_NAME ?? 'İSG-ATS'}</p>
                        </div>
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="text-sm font-medium">Cron Jobs</p>
                                <p className="text-xs text-muted-foreground">Gecikmiş görev uyarıları + hatırlatmalar</p>
                            </div>
                            <p className="text-sm font-mono">08:00 / 09:00</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
