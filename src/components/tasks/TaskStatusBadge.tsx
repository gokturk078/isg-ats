'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_CONFIG, type TaskStatus } from '@/types';

interface TaskStatusBadgeProps {
    status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
    const config = STATUS_CONFIG[status];

    return (
        <Badge
            variant="outline"
            style={{
                borderColor: config.color,
                color: config.color,
                backgroundColor: `${config.color}15`,
            }}
        >
            {config.label}
        </Badge>
    );
}
