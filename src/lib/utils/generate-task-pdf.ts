import jsPDF from 'jspdf';
import type { Task } from '@/types';
import { SEVERITY_CONFIG, STATUS_CONFIG } from '@/types';

// Helper: Fetch image URL → base64 data URL
async function imageToBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// Helper: Turkish-safe text (replace chars jsPDF can't render)
function safeText(text: string): string {
    return text
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C')
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/✅/g, '[OK]')
        .replace(/❌/g, '[X]')
        .replace(/📷/g, '')
        .replace(/★/g, '*');
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatDateShort(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

export async function generateTaskPdf(task: Task): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const severityLabel = SEVERITY_CONFIG[task.severity]?.label ?? String(task.severity);
    const statusLabel = STATUS_CONFIG[task.status]?.label ?? task.status;

    // ─── HEADER ───
    doc.setFillColor(29, 78, 216); // blue-700
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(safeText('ISG AKSIYON TAKIP SISTEMI'), margin, 10);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText('GOREV RAPORU'), margin, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateShort(new Date().toISOString()), pageWidth - margin, 20, { align: 'right' });

    y = 36;
    doc.setTextColor(0, 0, 0);

    // ─── TASK TITLE ───
    if (task.title) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(safeText(task.title), margin, y);
        y += 8;
    }

    // ─── INFO TABLE ───
    const infoRows: [string, string][] = [
        ['Seri No', `#${task.serial_number}`],
        ['Durum', safeText(statusLabel)],
        ['Onem Derecesi', safeText(severityLabel)],
        ['Lokasyon', safeText(`${task.location?.name ?? '-'}${task.floor ? ' - Kat ' + task.floor : ''}`)],
        ['Kategori', safeText(task.category?.name ?? '-')],
        ['Denetci', safeText(task.inspector?.full_name ?? '-')],
        ['Gorevli', safeText(task.responsible?.full_name ?? 'Atanmamis')],
        ['Olusturulma', task.created_at ? formatDate(task.created_at) : '-'],
        ['Son Tarih', task.due_date ? formatDateShort(task.due_date) : '-'],
    ];

    if (task.completed_at) {
        infoRows.push(['Tamamlanma', formatDate(task.completed_at)]);
    }
    if (task.closed_at) {
        infoRows.push(['Kapatilma', formatDate(task.closed_at)]);
    }

    doc.setFontSize(9);
    const labelWidth = 35;
    const rowHeight = 6;

    for (const [label, value] of infoRows) {
        if (y > pageHeight - 20) { doc.addPage(); y = margin; }

        // Alternating row background
        if (infoRows.indexOf([label, value] as unknown as [string, string]) % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 4, contentWidth, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(label, margin + 2, y);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(value, margin + labelWidth, y);

        y += rowHeight;
    }

    y += 4;

    // ─── DESCRIPTION ───
    if (y > pageHeight - 40) { doc.addPage(); y = margin; }
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, contentWidth, 6, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('ACIKLAMA', margin + 2, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const descLines = doc.splitTextToSize(safeText(task.description), contentWidth - 4);
    for (const line of descLines) {
        if (y > pageHeight - 15) { doc.addPage(); y = margin; }
        doc.text(line, margin + 2, y);
        y += 4.5;
    }
    y += 4;

    // ─── ACTION REQUIRED ───
    if (task.action_required) {
        if (y > pageHeight - 30) { doc.addPage(); y = margin; }
        doc.setFillColor(254, 252, 232);
        doc.rect(margin, y - 4, contentWidth, 6, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(146, 64, 14);
        doc.text('AKSIYON GEREKLILIGI', margin + 2, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        const actionLines = doc.splitTextToSize(safeText(task.action_required), contentWidth - 4);
        for (const line of actionLines) {
            if (y > pageHeight - 15) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2, y);
            y += 4.5;
        }
        y += 4;
    }

    // ─── REJECTION REASON ───
    if (task.rejection_reason) {
        if (y > pageHeight - 30) { doc.addPage(); y = margin; }
        doc.setFillColor(254, 226, 226);
        doc.rect(margin, y - 4, contentWidth, 6, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text('RED NEDENI', margin + 2, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        const rejectLines = doc.splitTextToSize(safeText(task.rejection_reason), contentWidth - 4);
        for (const line of rejectLines) {
            if (y > pageHeight - 15) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2, y);
            y += 4.5;
        }
        y += 4;
    }

    // ─── PHOTOS ───
    const beforePhotos = task.photos?.filter((p) => p.photo_type === 'before') ?? [];
    const afterPhotos = task.photos?.filter((p) => p.photo_type === 'after') ?? [];

    if (beforePhotos.length > 0 || afterPhotos.length > 0) {
        // Before photos
        if (beforePhotos.length > 0) {
            if (y > pageHeight - 60) { doc.addPage(); y = margin; }
            doc.setFillColor(255, 237, 213);
            doc.rect(margin, y - 4, contentWidth, 6, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(194, 65, 12);
            doc.text(`TESPIT FOTOGRAFLARI (${beforePhotos.length})`, margin + 2, y);
            y += 8;

            const photoSize = 50;
            const gap = 5;
            const photosPerRow = Math.floor((contentWidth + gap) / (photoSize + gap));
            let col = 0;

            for (const photo of beforePhotos) {
                if (col >= photosPerRow) { col = 0; y += photoSize + gap; }
                if (y + photoSize > pageHeight - 15) { doc.addPage(); y = margin; col = 0; }

                const base64 = await imageToBase64(photo.photo_url);
                if (base64) {
                    try {
                        doc.addImage(base64, 'JPEG', margin + col * (photoSize + gap), y, photoSize, photoSize);
                    } catch { /* skip corrupt images */ }
                } else {
                    doc.setDrawColor(200);
                    doc.rect(margin + col * (photoSize + gap), y, photoSize, photoSize);
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text('Yuklenemedi', margin + col * (photoSize + gap) + 10, y + 25);
                }
                col++;
            }
            y += photoSize + gap + 4;
        }

        // After photos
        if (afterPhotos.length > 0) {
            if (y > pageHeight - 60) { doc.addPage(); y = margin; }
            doc.setFillColor(220, 252, 231);
            doc.rect(margin, y - 4, contentWidth, 6, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(22, 101, 52);
            doc.text(`TAMAMLAMA FOTOGRAFLARI (${afterPhotos.length})`, margin + 2, y);
            y += 8;

            const photoSize = 50;
            const gap = 5;
            const photosPerRow = Math.floor((contentWidth + gap) / (photoSize + gap));
            let col = 0;

            for (const photo of afterPhotos) {
                if (col >= photosPerRow) { col = 0; y += photoSize + gap; }
                if (y + photoSize > pageHeight - 15) { doc.addPage(); y = margin; col = 0; }

                const base64 = await imageToBase64(photo.photo_url);
                if (base64) {
                    try {
                        doc.addImage(base64, 'JPEG', margin + col * (photoSize + gap), y, photoSize, photoSize);
                    } catch { /* skip corrupt images */ }
                } else {
                    doc.setDrawColor(200);
                    doc.rect(margin + col * (photoSize + gap), y, photoSize, photoSize);
                    doc.setFontSize(7);
                    doc.setTextColor(150);
                    doc.text('Yuklenemedi', margin + col * (photoSize + gap) + 10, y + 25);
                }
                col++;
            }
            y += photoSize + gap + 4;
        }
    }

    // ─── ACTION HISTORY ───
    if (task.actions && task.actions.length > 0) {
        if (y > pageHeight - 30) { doc.addPage(); y = margin; }
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y - 4, contentWidth, 6, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('AKSIYON GECMISI', margin + 2, y);
        y += 8;

        const sortedActions = [...task.actions].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        for (const action of sortedActions) {
            if (y > pageHeight - 20) { doc.addPage(); y = margin; }

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            const dateStr = action.created_at ? formatDate(action.created_at) : '';
            const userName = action.user?.full_name ?? 'Sistem';
            doc.text(`${dateStr}  ${safeText(userName)}`, margin + 2, y);
            y += 4;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(55, 65, 81);
            const commentLines = doc.splitTextToSize(safeText(action.comment ?? ''), contentWidth - 10);
            for (const line of commentLines) {
                if (y > pageHeight - 15) { doc.addPage(); y = margin; }
                doc.text(line, margin + 6, y);
                y += 4;
            }
            y += 2;
        }
    }

    // ─── FOOTER ───
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
            `ISG-ATS | Bu rapor otomatik olusturulmustur | Sayfa ${i}/${totalPages}`,
            pageWidth / 2, pageHeight - 8,
            { align: 'center' }
        );
        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    }

    // ─── DOWNLOAD ───
    const fileName = `Gorev_${task.serial_number.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`;
    doc.save(fileName);
}
