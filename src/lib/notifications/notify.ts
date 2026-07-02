import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';
import type { Database } from '@/types/database.types';

type NotificationType =
    | 'task_assigned'
    | 'task_completed'
    | 'task_closed'
    | 'task_overdue'
    | 'task_reminder'
    | 'task_created'
    | 'task_rejected';

interface NotifyOptions {
    taskId: string;
    type: NotificationType;
    actorName?: string;
    rejectionReason?: string;
    recipientIds?: string[];
}

interface NotificationProfile {
    full_name: string;
    email: string;
}

interface TaskData {
    id: string;
    serial_number: string;
    title?: string;
    description: string;
    severity: number;
    status: string;
    inspector_id: string;
    responsible_id?: string;
    inspector?: NotificationProfile | null;
    responsible?: NotificationProfile | null;
    assignees?: Array<{ user_id: string; user: NotificationProfile | null }>;
    location?: { name: string } | null;
    category?: { name: string } | null;
}

type DbNotificationType = Database['public']['Enums']['notification_type'];

const SEVERITY_LABELS: Record<number, string> = {
    5: '★★★★★ İŞ DERHAL DURACAK',
    4: '★★★★ EN FAZLA 2 GÜN',
    3: '★★★ EN FAZLA 1 HAFTA',
    2: '★★ BİR SONRAKİ DENETİM',
    1: '★ PLANLANAN DENETİM',
};

const STATUS_LABELS: Record<string, string> = {
    unassigned: 'Atanmamış',
    open: 'Açık',
    in_progress: 'Devam Ediyor',
    completed: 'Tamamlandı',
    closed: 'Kapatıldı',
    rejected: 'Reddedildi',
};

export async function createTaskNotification(options: NotifyOptions) {
    const { taskId, type, actorName, rejectionReason, recipientIds } = options;

    try {
        const supabase = await createServiceClient();

        // Fetch task — avoid ambiguous FK joins for locations
        const { data: task, error: fetchError } = await supabase
            .from('tasks')
            .select(`
                id, serial_number, title, description, severity, status,
                inspector_id, responsible_id, location_id, category_id,
                inspector:profiles!tasks_inspector_id_fkey(full_name, email),
                responsible:profiles!tasks_responsible_id_fkey(full_name, email)
            `)
            .eq('id', taskId)
            .single();

        if (fetchError) {
            console.error('[Bildirim] Görev fetch hatası:', fetchError.message);
            return { success: false, error: `Görev bulunamadı: ${fetchError.message}` };
        }

        if (!task) {
            console.error('[Bildirim] Görev bulunamadı:', taskId);
            return { success: false, error: 'Görev bulunamadı' };
        }

        // Fetch location and category names separately to avoid FK ambiguity
        let locationName: string | null = null;
        let categoryName: string | null = null;

        if (task.location_id) {
            const { data: loc } = await supabase.from('locations').select('name').eq('id', task.location_id).single();
            locationName = loc?.name ?? null;
        }
        if (task.category_id) {
            const { data: cat } = await supabase.from('task_categories').select('name').eq('id', task.category_id).single();
            categoryName = cat?.name ?? null;
        }

        const { data: assignees, error: assigneesError } = await supabase
            .from('task_assignees')
            .select('user_id')
            .eq('task_id', taskId);

        if (assigneesError) {
            console.error('[Bildirim] Görevli listesi alınamadı:', assigneesError.message);
        }

        const assigneeUserIds = Array.from(new Set((assignees ?? []).map((assignee) => assignee.user_id)));
        const { data: assigneeProfiles } = assigneeUserIds.length > 0
            ? await supabase.from('profiles').select('id, full_name, email').in('id', assigneeUserIds)
            : { data: [] };
        const assigneeProfilesById = new Map((assigneeProfiles ?? []).map((user) => [user.id, user]));

        const taskData: TaskData = {
            id: task.id,
            serial_number: task.serial_number,
            title: task.title ?? undefined,
            description: task.description,
            severity: task.severity,
            status: task.status ?? 'unassigned',
            inspector_id: task.inspector_id,
            responsible_id: task.responsible_id ?? undefined,
            inspector: task.inspector,
            responsible: task.responsible,
            location: locationName ? { name: locationName } : null,
            category: categoryName ? { name: categoryName } : null,
            assignees: (assignees ?? []).map((assignee) => ({
                user_id: assignee.user_id,
                user: assigneeProfilesById.get(assignee.user_id) ?? null,
            })),
        };
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://isg-ats.vercel.app';
        const taskUrl = `${appUrl}/tasks/${taskData.id}`;

        // Determine notification targets and content
        const notifications = getNotificationConfig(type, taskData, actorName, rejectionReason, recipientIds);

        if (notifications.length === 0) {
            console.warn('[Bildirim] Gönderilecek bildirim hedefi yok:', type, taskId);
            return { success: true, sent: 0 };
        }

        let sentCount = 0;

        for (const notif of notifications) {
            // In-app notification — use the closest valid DB enum type
            const dbType = mapToDbType(type);
            const { error: insertError } = await supabase.from('notifications').insert({
                user_id: notif.userId,
                task_id: taskId,
                type: dbType,
                title: notif.title,
                message: notif.message,
            });

            if (insertError) {
                console.error('[Bildirim] DB insert hatası:', insertError.message, { userId: notif.userId, type: dbType });
            } else {
                console.log('[Bildirim] ✅ In-app bildirim gönderildi:', notif.recipientName, dbType);
            }

            // Email notification
            if (notif.email) {
                const html = buildEmailHtml({
                    recipientName: notif.recipientName,
                    title: notif.title,
                    message: notif.message,
                    taskData,
                    taskUrl,
                    type,
                    rejectionReason,
                });

                const emailResult = await sendEmail({
                    to: notif.email,
                    subject: `📋 ${notif.title} — #${taskData.serial_number}`,
                    html,
                });

                if (emailResult.success) {
                    console.log('[Bildirim] ✅ Email gönderildi:', notif.email);
                } else {
                    console.error('[Bildirim] ❌ Email gönderilemedi:', notif.email, emailResult.error);
                }
            }

            sentCount++;
        }

        return { success: true, sent: sentCount };
    } catch (error) {
        console.error('[Bildirim] Genel hata:', error);
        return { success: false, error: String(error) };
    }
}

// Map our notification types to the DB enum values
function mapToDbType(type: NotificationType): DbNotificationType {
    const mapping: Record<NotificationType, DbNotificationType> = {
        task_assigned: 'task_assigned',
        task_completed: 'task_completed',
        task_closed: 'task_closed',
        task_overdue: 'task_overdue',
        task_reminder: 'task_reminder',
        task_created: 'task_created',
        task_rejected: 'task_assigned', // DB may not have task_rejected enum — fallback to task_assigned
    };
    return mapping[type] ?? 'task_assigned';
}

function getNotificationConfig(
    type: NotificationType,
    task: TaskData,
    actorName?: string,
    rejectionReason?: string,
    recipientIds?: string[]
): Array<{ userId: string; email?: string; recipientName: string; title: string; message: string }> {
    const notifications: Array<{ userId: string; email?: string; recipientName: string; title: string; message: string }> = [];
    const targetRecipientIds = recipientIds ? new Set(recipientIds) : null;
    const assignees = getTaskAssignees(task).filter((assignee) => !targetRecipientIds || targetRecipientIds.has(assignee.userId));

    switch (type) {
        case 'task_assigned':
            for (const assignee of assignees) {
                notifications.push({
                    userId: assignee.userId,
                    email: assignee.email,
                    recipientName: assignee.recipientName,
                    title: 'Yeni Görev Atandı',
                    message: `"${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}" görevi size atandı. Önem: ${SEVERITY_LABELS[task.severity] ?? task.severity}`,
                });
            }
            break;

        case 'task_completed':
            // Notify inspector
            if (task.inspector) {
                notifications.push({
                    userId: task.inspector_id,
                    email: task.inspector.email,
                    recipientName: task.inspector.full_name,
                    title: 'Görev Tamamlandı',
                    message: `${actorName ?? 'Görevli'}, #${task.serial_number} numaralı görevi tamamladı. Kontrol edip kapatabilirsiniz.`,
                });
            }
            break;

        case 'task_closed':
            // Notify responsible + inspector
            for (const assignee of assignees) {
                notifications.push({
                    userId: assignee.userId,
                    email: assignee.email,
                    recipientName: assignee.recipientName,
                    title: 'Görev Kapatıldı',
                    message: `#${task.serial_number} numaralı görev başarıyla kapatıldı.${rejectionReason ? ' Not: ' + rejectionReason : ''} ✅`,
                });
            }
            if (task.inspector) {
                notifications.push({
                    userId: task.inspector_id,
                    email: task.inspector.email,
                    recipientName: task.inspector.full_name,
                    title: 'Görev Kapatıldı',
                    message: `#${task.serial_number} numaralı görev başarıyla kapatıldı. ✅`,
                });
            }
            break;

        case 'task_rejected':
            // Notify responsible about rejection
            for (const assignee of assignees) {
                const taskLabel = task.title || task.description.substring(0, 80);
                notifications.push({
                    userId: assignee.userId,
                    email: assignee.email,
                    recipientName: assignee.recipientName,
                    title: 'Görev Reddedildi',
                    message: `#${task.serial_number} "${taskLabel}" görevi reddedildi.${rejectionReason ? ' Neden: ' + rejectionReason : ''} Lütfen düzelterek tekrar gönderin.`,
                });
            }
            break;
    }

    return notifications;
}

function getTaskAssignees(task: TaskData): Array<{ userId: string; email?: string; recipientName: string }> {
    const assignees = new Map<string, { userId: string; email?: string; recipientName: string }>();

    for (const assignee of task.assignees ?? []) {
        if (assignee.user_id && assignee.user) {
            assignees.set(assignee.user_id, {
                userId: assignee.user_id,
                email: assignee.user.email,
                recipientName: assignee.user.full_name,
            });
        }
    }

    if (task.responsible_id && task.responsible && !assignees.has(task.responsible_id)) {
        assignees.set(task.responsible_id, {
            userId: task.responsible_id,
            email: task.responsible.email,
            recipientName: task.responsible.full_name,
        });
    }

    return Array.from(assignees.values());
}

function buildEmailHtml(opts: {
    recipientName: string;
    title: string;
    message: string;
    taskData: TaskData;
    taskUrl: string;
    type: NotificationType;
    rejectionReason?: string;
}): string {
    const { recipientName, title, message, taskData, taskUrl, type, rejectionReason } = opts;

    const headerColors: Record<string, string> = {
        task_assigned: '#1d4ed8',
        task_completed: '#16a34a',
        task_closed: '#6b7280',
        task_created: '#dc2626',
        task_overdue: '#f97316',
        task_reminder: '#f97316',
    };
    const headerColor = headerColors[type] ?? '#1d4ed8';

    return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${headerColor};padding:24px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;letter-spacing:1px;">İSG AKSİYON TAKİP SİSTEMİ</p>
            <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="color:#374151;font-size:14px;margin:0 0 20px;">Merhaba <strong>${recipientName}</strong>,</p>
            <p style="color:#374151;font-size:14px;margin:0 0 20px;">${message}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
              <tr><td style="padding:16px;">
                <table width="100%" cellpadding="6" cellspacing="0">
                  <tr><td style="color:#64748b;font-size:12px;width:110px;">Seri No</td><td style="color:#1e293b;font-weight:700;font-size:13px;">#${taskData.serial_number}</td></tr>
                  <tr><td style="color:#64748b;font-size:12px;">Lokasyon</td><td style="color:#1e293b;font-size:13px;">${taskData.location?.name ?? '-'}</td></tr>
                  <tr><td style="color:#64748b;font-size:12px;">Kategori</td><td style="color:#1e293b;font-size:13px;">${taskData.category?.name ?? '-'}</td></tr>
                  <tr><td style="color:#64748b;font-size:12px;">Önem</td><td style="color:#1e293b;font-size:13px;">${SEVERITY_LABELS[taskData.severity] ?? taskData.severity}</td></tr>
                  <tr><td style="color:#64748b;font-size:12px;">Durum</td><td style="color:#1e293b;font-size:13px;">${STATUS_LABELS[taskData.status] ?? taskData.status}</td></tr>
                </table>
              </td></tr>
            </table>
            ${rejectionReason ? `<p style="color:#92400e;font-size:13px;padding:12px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;margin-bottom:20px;"><strong>Red Nedeni:</strong> ${rejectionReason}</p>` : ''}
            <div style="text-align:center;margin:28px 0 8px;">
              <a href="${taskUrl}" style="background:${headerColor};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">GÖREVE GİT →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Bu email İSG Aksiyon Takip Sistemi tarafından otomatik gönderilmiştir.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
