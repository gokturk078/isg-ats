import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/mailer';

type NotificationType =
    | 'task_assigned'
    | 'task_completed'
    | 'task_rejected'
    | 'task_closed'
    | 'task_status_changed';

interface NotifyOptions {
    taskId: string;
    type: NotificationType;
    actorName?: string;
    rejectionReason?: string;
}

interface TaskData {
    id: string;
    serial_number: string;
    description: string;
    severity: number;
    status: string;
    inspector_id: string;
    responsible_id?: string;
    inspector?: { full_name: string; email: string } | null;
    responsible?: { full_name: string; email: string } | null;
    location?: { name: string } | null;
    category?: { name: string } | null;
}

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
    const { taskId, type, actorName, rejectionReason } = options;

    try {
        const supabase = await createServiceClient();

        // Fetch task with relations
        const { data: task } = await supabase
            .from('tasks')
            .select(`
                id, serial_number, description, severity, status,
                inspector_id, responsible_id,
                inspector:profiles!tasks_inspector_id_fkey(full_name, email),
                responsible:profiles!tasks_responsible_id_fkey(full_name, email),
                location:locations(name),
                category:task_categories(name)
            `)
            .eq('id', taskId)
            .single();

        if (!task) {
            console.error('Bildirim: Görev bulunamadı:', taskId);
            return;
        }

        const taskData = task as unknown as TaskData;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://isg-ats.vercel.app';
        const taskUrl = `${appUrl}/tasks/${taskData.id}`;

        // Determine notification targets and content
        const notifications = getNotificationConfig(type, taskData, actorName, rejectionReason);

        for (const notif of notifications) {
            // In-app notification
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from('notifications').insert({
                user_id: notif.userId,
                task_id: taskId,
                type: type as string as any,
                title: notif.title,
                message: notif.message,
            } as any);

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

                await sendEmail({
                    to: notif.email,
                    subject: `📋 ${notif.title} — #${taskData.serial_number}`,
                    html,
                });
            }
        }
    } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
    }
}

function getNotificationConfig(
    type: NotificationType,
    task: TaskData,
    actorName?: string,
    rejectionReason?: string
): Array<{ userId: string; email?: string; recipientName: string; title: string; message: string }> {
    const notifications: Array<{ userId: string; email?: string; recipientName: string; title: string; message: string }> = [];

    switch (type) {
        case 'task_assigned':
            if (task.responsible_id && task.responsible) {
                notifications.push({
                    userId: task.responsible_id,
                    email: task.responsible.email,
                    recipientName: task.responsible.full_name,
                    title: 'Yeni Görev Atandı',
                    message: `"${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}" görevi size atandı. Önem: ${SEVERITY_LABELS[task.severity] ?? task.severity}`,
                });
            }
            break;

        case 'task_completed':
            // Notify admin + inspector
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

        case 'task_rejected':
            if (task.responsible_id && task.responsible) {
                notifications.push({
                    userId: task.responsible_id,
                    email: task.responsible.email,
                    recipientName: task.responsible.full_name,
                    title: 'Görev Reddedildi',
                    message: `#${task.serial_number} numaralı görev reddedildi.${rejectionReason ? ' Neden: ' + rejectionReason : ''}`,
                });
            }
            break;

        case 'task_closed':
            // Notify responsible + inspector
            if (task.responsible_id && task.responsible) {
                notifications.push({
                    userId: task.responsible_id,
                    email: task.responsible.email,
                    recipientName: task.responsible.full_name,
                    title: 'Görev Kapatıldı',
                    message: `#${task.serial_number} numaralı görev başarıyla kapatıldı. ✅`,
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
    }

    return notifications;
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
        task_rejected: '#dc2626',
        task_closed: '#6b7280',
        task_status_changed: '#f97316',
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
