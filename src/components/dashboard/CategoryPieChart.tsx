'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CategoryStatistic } from '@/types';

interface CategoryPieChartProps {
    data: CategoryStatistic[];
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
    const chartData = data.filter((d) => d.total_count > 0).slice(0, 8);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Kategori Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="total_count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                innerRadius={50}
                                paddingAngle={2}
                                label={({ name, percent }) =>
                                    `${name?.slice(0, 12)} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                }
                                labelLine={false}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: '1px solid hsl(var(--border))',
                                    backgroundColor: 'hsl(var(--background))',
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
