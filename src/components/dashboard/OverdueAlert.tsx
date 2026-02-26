'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface OverdueAlertProps {
    count: number;
}

export function OverdueAlert({ count }: OverdueAlertProps) {
    if (count === 0) return null;

    return (
        <Alert variant="destructive" className="border-red-300 bg-red-50 dark:bg-red-950/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Geciken Görevler</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
                <span>
                    <strong>{count} görev</strong> son tarihini geçmiş durumda. Acil aksiyon gereklidir.
                </span>
                <Button size="sm" variant="destructive" asChild>
                    <Link href="/tasks?filter=overdue">Görevleri Göster</Link>
                </Button>
            </AlertDescription>
        </Alert>
    );
}
