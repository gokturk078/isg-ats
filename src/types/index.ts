export type UserRole = 'admin' | 'inspector' | 'responsible';

export type TaskStatus =
    | 'unassigned'
    | 'open'
    | 'in_progress'
    | 'completed'
    | 'closed'
    | 'rejected';

export type Severity = 1 | 2 | 3 | 4 | 5;

export interface Profile {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    role: UserRole;
    company?: string;
    title?: string;
    location_id?: string;
    avatar_url?: string;
    is_active: boolean;
    last_seen?: string;
    created_at: string;
    updated_at?: string;
}

export interface Location {
    id: string;
    name: string;
    parent_id?: string;
    code?: string;
    is_active: boolean;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface TaskCategory {
    id: string;
    name: string;
    color: string;
    icon?: string;
    is_active: boolean;
    sort_order: number;
    created_at?: string;
}

export interface Task {
    id: string;
    serial_number: string;
    inspector_id: string;
    responsible_id?: string;
    location_id?: string;
    category_id?: string;
    floor?: string;
    exact_location?: string;
    work_type?: string;
    detection_method: string;
    description: string;
    severity: Severity;
    action_required?: string;
    status: TaskStatus;
    due_date?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at: string;
    viewed_at?: string;
    completed_at?: string;
    closed_at?: string;
    is_recurring: boolean;
    qr_location_id?: string;
    inspector?: Profile;
    responsible?: Profile;
    location?: Location;
    category?: TaskCategory;
    photos?: TaskPhoto[];
    actions?: TaskAction[];
}

export interface TaskPhoto {
    id: string;
    task_id: string;
    photo_url: string;
    storage_path: string;
    photo_type: 'before' | 'after';
    caption?: string;
    uploaded_by: string;
    file_size?: number;
    created_at: string;
}

export interface TaskAction {
    id: string;
    task_id: string;
    user_id: string;
    comment: string;
    is_system: boolean;
    created_at: string;
    user?: Profile;
}

export interface TaskAttachment {
    id: string;
    task_id: string;
    file_url: string;
    storage_path: string;
    file_name: string;
    file_type?: string;
    file_size?: number;
    uploaded_by: string;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    task_id?: string;
    type: string;
    title: string;
    message?: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
    task?: Task;
}

export interface EmailLog {
    id: string;
    task_id?: string;
    to_email: string;
    to_name?: string;
    email_type: string;
    subject?: string;
    status: 'sent' | 'failed' | 'pending';
    error_msg?: string;
    resend_id?: string;
    sent_at: string;
    retry_count: number;
}

export interface TaskStatistics {
    unassigned_count: number;
    active_count: number;
    completed_count: number;
    closed_count: number;
    rejected_count: number;
    overdue_count: number;
    this_month_count: number;
    total_count: number;
}

export interface CategoryStatistic {
    id: string;
    name: string;
    color: string;
    total_count: number;
    closed_count: number;
    overdue_count: number;
    closure_rate: number;
}

export interface MonthlyTrend {
    month: string;
    month_label: string;
    created_count: number;
    closed_count: number;
    overdue_count: number;
}

export interface SeverityDistribution {
    severity: number;
    severity_label: string;
    total_count: number;
    closed_count: number;
}

export const SEVERITY_CONFIG: Record<number, {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    interval: string;
    dueDays: number;
}> = {
    5: {
        label: 'İŞ DERHAL DURACAK',
        color: '#ef4444',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-500',
        textColor: 'text-red-700',
        interval: 'Aynı Gün',
        dueDays: 0,
    },
    4: {
        label: 'EN FAZLA 2 GÜN',
        color: '#f97316',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-500',
        textColor: 'text-orange-700',
        interval: '2 Gün',
        dueDays: 2,
    },
    3: {
        label: 'EN FAZLA 1 HAFTA',
        color: '#eab308',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-500',
        textColor: 'text-yellow-700',
        interval: '1 Hafta',
        dueDays: 7,
    },
    2: {
        label: 'BİR SONRAKİ DENETİM',
        color: '#3b82f6',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-500',
        textColor: 'text-blue-700',
        interval: '~30 Gün',
        dueDays: 30,
    },
    1: {
        label: 'PLANLANAN DENETİM',
        color: '#6b7280',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-400',
        textColor: 'text-gray-600',
        interval: 'Planlı',
        dueDays: 90,
    },
};

/** Önem derecesine göre son tarih hesapla (bugünden itibaren) */
export function calculateDueDate(severity: number): string {
    const days = SEVERITY_CONFIG[severity]?.dueDays ?? 7;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export const STATUS_CONFIG: Record<TaskStatus, {
    label: string;
    color: string;
    bgColor: string;
}> = {
    unassigned: { label: 'Atanmamış', color: '#9ca3af', bgColor: 'bg-gray-100' },
    open: { label: 'Açık', color: '#3b82f6', bgColor: 'bg-blue-100' },
    in_progress: { label: 'Devam Ediyor', color: '#f97316', bgColor: 'bg-orange-100' },
    completed: { label: 'Tamamlandı', color: '#22c55e', bgColor: 'bg-green-100' },
    closed: { label: 'Kapatıldı', color: '#6b7280', bgColor: 'bg-gray-200' },
    rejected: { label: 'Reddedildi', color: '#ef4444', bgColor: 'bg-red-100' },
};
