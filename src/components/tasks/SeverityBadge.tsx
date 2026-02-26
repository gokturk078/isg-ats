'use client';

import { Badge } from '@/components/ui/badge';
import { SEVERITY_CONFIG } from '@/types';

interface SeverityBadgeProps {
    severity: number;
    showStars?: boolean;
}

export function SeverityBadge({ severity, showStars = true }: SeverityBadgeProps) {
    const config = SEVERITY_CONFIG[severity];
    if (!config) return null;

    const stars = showStars ? '★'.repeat(severity) + ' ' : '';

    return (
        <Badge
            variant="outline"
            style={{
                borderColor: config.color,
                color: config.color,
                backgroundColor: `${config.color}15`,
            }}
            className="whitespace-nowrap"
        >
            {stars}{config.label}
        </Badge>
    );
}
