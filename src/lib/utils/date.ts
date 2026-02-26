import { format, formatDistanceToNow, isAfter, isBefore, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export function formatDate(date: string | Date): string {
    return format(new Date(date), 'dd/MM/yyyy', { locale: tr });
}

export function formatDateTime(date: string | Date): string {
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: tr });
}

export function formatDateLong(date: string | Date): string {
    return format(new Date(date), 'dd MMMM yyyy', { locale: tr });
}

export function formatDateTimeLong(date: string | Date): string {
    return format(new Date(date), 'dd MMMM yyyy HH:mm', { locale: tr });
}

export function formatRelative(date: string | Date): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
}

export function isOverdue(dueDate: string | Date): boolean {
    return isBefore(new Date(dueDate), new Date());
}

export function isDueSoon(dueDate: string | Date, hoursThreshold = 24): boolean {
    const due = new Date(dueDate);
    const now = new Date();
    const threshold = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);
    return isAfter(due, now) && isBefore(due, threshold);
}

export function getDaysOverdue(dueDate: string | Date): number {
    const days = differenceInDays(new Date(), new Date(dueDate));
    return Math.max(0, days);
}

export function getDaysRemaining(dueDate: string | Date): number {
    const days = differenceInDays(new Date(dueDate), new Date());
    return Math.max(0, days);
}
