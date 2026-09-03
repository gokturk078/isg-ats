'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SEVERITY_CONFIG } from '@/types';
import type { SeverityDistribution } from '@/types';

interface SeverityBarChartProps {
    data: SeverityDistribution[];
}

export function SeverityBarChart({ data }: SeverityBarChartProps) {
    const chartData = data.map((d) => ({
        ...d,
        label: `★${d.severity}`,
        color: SEVERITY_CONFIG[d.severity]?.color ?? '#6b7280',
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Önem Derecesi Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: '1px solid hsl(var(--border))',
                                    backgroundColor: 'hsl(var(--background))',
                                }}
                                formatter={(value, name) => [
                                    value ?? 0,
                                    name === 'total_count' ? 'Toplam' : 'Kapatılan',
                                ]}
                            />
                            <Bar dataKey="total_count" name="Toplam" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
