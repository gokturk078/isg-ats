import { SEVERITY_CONFIG } from '@/types';

export function getSeverityLabel(severity: number): string {
    return SEVERITY_CONFIG[severity]?.label ?? 'Bilinmeyen';
}

export function getSeverityColor(severity: number): string {
    return SEVERITY_CONFIG[severity]?.color ?? '#6b7280';
}

export function getSeverityBgColor(severity: number): string {
    return SEVERITY_CONFIG[severity]?.bgColor ?? 'bg-gray-50';
}

export function getSeverityTextColor(severity: number): string {
    return SEVERITY_CONFIG[severity]?.textColor ?? 'text-gray-600';
}

export function getSeverityBorderColor(severity: number): string {
    return SEVERITY_CONFIG[severity]?.borderColor ?? 'border-gray-400';
}

export function getSeverityInterval(severity: number): string {
    return SEVERITY_CONFIG[severity]?.interval ?? '-';
}

export function getSeverityStars(severity: number): string {
    return '★'.repeat(severity) + '☆'.repeat(5 - severity);
}
