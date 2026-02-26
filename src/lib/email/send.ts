import { sendEmail } from './mailer';
import { createServiceClient } from '@/lib/supabase/server';
import type { Task, Profile } from '@/types';
import type { Database } from '@/types/database.types';

async function logEmail(
  taskId: string | null,
  toEmail: string,
  emailType: Database['public']['Enums']['notification_type'],
  subject: string,
  success: boolean,
  errorMsg?: string
) {
  try {
    const supabase = await createServiceClient();
    await supabase.from('email_logs').insert({
      task_id: taskId,
      to_email: toEmail,
      email_type: emailType,
      subject,
      status: success ? 'sent' : 'failed',
      error_msg: errorMsg,
    });
  } catch (err) {
    console.error('Email log kaydedilemedi:', err);
  }
}

function severityBadge(severity: number): string {
  const configs: Record<number, { label: string; color: string; bg: string }> = {
    5: { label: '★★★★★ İŞ DERHAL DURACAK', color: '#991b1b', bg: '#fee2e2' },
    4: { label: '★★★★ EN FAZLA 2 GÜN', color: '#9a3412', bg: '#ffedd5' },
    3: { label: '★★★ EN FAZLA 1 HAFTA', color: '#854d0e', bg: '#fef9c3' },
    2: { label: '★★ BİR SONRAKİ DENETİM', color: '#1e40af', bg: '#dbeafe' },
    1: { label: '★ PLANLANAN DENETİM', color: '#374151', bg: '#f3f4f6' },
  };
  const c = configs[severity] || configs[1];
  return `<span style="background:${c.bg};color:${c.color};padding:4px 12px;border-radius:4px;font-weight:700;font-size:13px;">${c.label}</span>`;
}

function baseLayout(title: string, content: string, accentColor = '#1d4ed8'): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${accentColor};padding:28px 32px;">
              <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:1px;">İSG AKSİYON TAKİP SİSTEMİ</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                Bu email İSG Aksiyon Takip Sistemi tarafından otomatik gönderilmiştir.<br>
                Lütfen bu emaile yanıt vermeyiniz.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatTurkishDate(date: string): string {
  return new Date(date).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function sendTaskAssigned(task: Task, responsible: Profile) {
  const subject = `📋 Yeni Görev Atandı: ${task.serial_number}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const content = `
    <p style="color:#374151;font-size:15px;margin:0 0 24px;">
      Merhaba <strong>${responsible.full_name}</strong>,<br><br>
      Aşağıdaki İSG görevi size atanmıştır. Lütfen en kısa sürede inceleyiniz.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="color:#64748b;font-size:13px;width:140px;">Seri Numarası</td>
            <td style="color:#1e293b;font-weight:700;font-size:13px;">#${task.serial_number}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Kategori</td>
            <td style="color:#1e293b;font-size:13px;">${task.category?.name || '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Lokasyon</td>
            <td style="color:#1e293b;font-size:13px;">${task.location?.name || '-'}${task.floor ? ' · Kat ' + task.floor : ''}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Önem Derecesi</td>
            <td style="padding:6px 0;">${severityBadge(task.severity)}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Son Tarih</td>
            <td style="color:#dc2626;font-weight:700;font-size:13px;">${task.due_date ? formatTurkishDate(task.due_date) : '-'}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="color:#374151;font-size:14px;margin:0 0 24px;padding:16px;background:#fefce8;border-left:4px solid #eab308;border-radius:4px;">
      <strong>Aksiyon Gerekliliği:</strong><br>
      ${task.action_required || task.description}
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${appUrl}/tasks/${task.id}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        GÖREVE GİT →
      </a>
    </div>`;

  const html = baseLayout(subject, content);
  const result = await sendEmail({ to: responsible.email, subject, html });
  await logEmail(task.id, responsible.email, 'task_assigned', subject, result.success, result.error ? String(result.error) : undefined);
}

export async function sendTaskCritical(task: Task, recipients: Profile[]) {
  const subject = `🚨 ACİL: İŞ DERHAL DURACAK — ${task.location?.name || ''} #${task.serial_number}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const content = `
    <div style="background:#fee2e2;border:2px solid #ef4444;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#991b1b;font-size:20px;font-weight:800;">🚨 ACİL DURUM</p>
      <p style="margin:8px 0 0;color:#991b1b;font-size:15px;">Çalışmalar derhal durdurulmalıdır!</p>
    </div>
    <table width="100%" cellpadding="6" cellspacing="0" style="background:#f8fafc;border:1px solid #fca5a5;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px;">
        <table width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="color:#64748b;font-size:13px;width:140px;">Seri No</td>
            <td style="color:#1e293b;font-weight:700;">#${task.serial_number}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Lokasyon</td>
            <td style="color:#991b1b;font-weight:700;font-size:15px;">${task.location?.name || '-'}${task.floor ? ' — Kat ' + task.floor : ''}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Kategori</td>
            <td style="color:#1e293b;">${task.category?.name || '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Tespit Eden</td>
            <td style="color:#1e293b;">${task.inspector?.full_name || '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Tarih</td>
            <td style="color:#1e293b;">${formatTurkishDate(task.created_at)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="color:#7f1d1d;font-size:14px;padding:16px;background:#fee2e2;border-radius:6px;margin-bottom:24px;">
      <strong>Tehlikeli Durum:</strong><br>${task.description}
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${appUrl}/tasks/${task.id}" style="background:#dc2626;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        ACİL GÖREVE GİT →
      </a>
    </div>`;

  const html = baseLayout('🚨 ACİL: İŞ DERHAL DURACAK', content, '#dc2626');

  for (const recipient of recipients) {
    const result = await sendEmail({ to: recipient.email, subject, html });
    await logEmail(task.id, recipient.email, 'task_created', subject, result.success, result.error ? String(result.error) : undefined);
  }
}

export async function sendTaskCompleted(task: Task, inspector: Profile) {
  const subject = `✅ Görev Tamamlandı: #${task.serial_number}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const content = `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#166534;font-size:18px;font-weight:700;">✅ Görev Tamamlandı</p>
      <p style="margin:8px 0 0;color:#16a34a;font-size:14px;">Lütfen sahayı kontrol ederek görevi kapatınız.</p>
    </div>
    <table width="100%" cellpadding="6" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px;">
        <table width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="color:#64748b;font-size:13px;width:140px;">Seri No</td>
            <td style="color:#1e293b;font-weight:700;">#${task.serial_number}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Tamamlayan</td>
            <td style="color:#1e293b;">${task.responsible?.full_name || '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Tamamlanma</td>
            <td style="color:#166534;font-weight:700;">${task.completed_at ? formatTurkishDate(task.completed_at) : '-'}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${appUrl}/tasks/${task.id}" style="background:#16a34a;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        GÖREVE GİT → KAPAT
      </a>
    </div>`;

  const html = baseLayout(subject, content, '#16a34a');
  const result = await sendEmail({ to: inspector.email, subject, html });
  await logEmail(task.id, inspector.email, 'task_completed', subject, result.success, result.error ? String(result.error) : undefined);
}

export async function sendOverdueWarning(task: Task, responsible: Profile) {
  const daysOverdue = task.due_date
    ? Math.floor((Date.now() - new Date(task.due_date).getTime()) / 86400000)
    : 0;

  const subject = `⚠️ GECİKEN GÖREV (${daysOverdue} gün): #${task.serial_number}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const content = `
    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#92400e;font-size:18px;font-weight:700;">⚠️ GÖREV GECİKİYOR</p>
      <p style="margin:8px 0 0;color:#b45309;font-size:14px;">Bu görev <strong>${daysOverdue} gün</strong> gecikmiştir.</p>
    </div>
    <table width="100%" cellpadding="6" cellspacing="0" style="background:#f8fafc;border:1px solid #fcd34d;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px;">
        <table width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="color:#64748b;font-size:13px;width:140px;">Seri No</td>
            <td style="color:#1e293b;font-weight:700;">#${task.serial_number}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Kategori</td>
            <td style="color:#1e293b;">${task.category?.name || '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Lokasyon</td>
            <td style="color:#1e293b;">${task.location?.name || '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Son Tarih</td>
            <td style="color:#dc2626;font-weight:700;">${task.due_date ? new Date(task.due_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Önem</td>
            <td style="padding:6px 0;">${severityBadge(task.severity)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${appUrl}/tasks/${task.id}" style="background:#d97706;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        GÖREVI TAMAMLA →
      </a>
    </div>`;

  const html = baseLayout(subject, content, '#d97706');
  const result = await sendEmail({ to: responsible.email, subject, html });
  await logEmail(task.id, responsible.email, 'task_overdue', subject, result.success, result.error ? String(result.error) : undefined);
}

export async function sendReminderEmail(task: Task, responsible: Profile) {
  const subject = `🔔 Hatırlatma: Görevin Son Tarihi Yarın — #${task.serial_number}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const content = `
    <p style="color:#374151;font-size:15px;margin:0 0 24px;">
      Merhaba <strong>${responsible.full_name}</strong>,<br><br>
      Aşağıdaki görevin son tarihi <strong>yarın</strong> dolmaktadır.
    </p>
    <table width="100%" cellpadding="6" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px;">
        <table width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="color:#64748b;font-size:13px;width:140px;">Seri No</td>
            <td style="color:#1e293b;font-weight:700;">#${task.serial_number}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Son Tarih</td>
            <td style="color:#dc2626;font-weight:700;">${task.due_date ? new Date(task.due_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;">Önem</td>
            <td style="padding:6px 0;">${severityBadge(task.severity)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${appUrl}/tasks/${task.id}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        GÖREVE GİT →
      </a>
    </div>`;

  const html = baseLayout(subject, content);
  const result = await sendEmail({ to: responsible.email, subject, html });
  await logEmail(task.id, responsible.email, 'task_reminder', subject, result.success, result.error ? String(result.error) : undefined);
}
