'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, AlertTriangle, CheckCircle, Clock, TrendingUp, CalendarDays } from 'lucide-react';
import type { TaskStatistics } from '@/types';

interface StatsCardsProps {
    stats: TaskStatistics;
}

export function StatsCards({ stats }: StatsCardsProps) {
    const cards = [
        {
            title: 'Toplam Görev',
            value: stats.total_count,
            icon: ClipboardList,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-950/30',
        },
        {
            title: 'Aktif Görevler',
            value: stats.active_count,
            icon: Clock,
            color: 'text-orange-600',
            bg: 'bg-orange-50 dark:bg-orange-950/30',
        },
        {
            title: 'Geciken',
            value: stats.overdue_count,
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50 dark:bg-red-950/30',
        },
        {
            title: 'Bu Ay Oluşturulan',
            value: stats.this_month_count,
            icon: CalendarDays,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-950/30',
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {card.title}
                        </CardTitle>
                        <div className={`p-2 rounded-lg ${card.bg}`}>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
