'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MonthlyTrend } from '@/types';

interface TaskTrendChartProps {
    data: MonthlyTrend[];
}

export function TaskTrendChart({ data }: TaskTrendChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Aylık Görev Trendi</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="month_label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: '1px solid hsl(var(--border))',
                                    backgroundColor: 'hsl(var(--background))',
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="created_count"
                                name="Oluşturulan"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="closed_count"
                                name="Kapatılan"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="overdue_count"
                                name="Geciken"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
