import Papa from 'papaparse';
import type { Task } from '@/types';
import { SEVERITY_CONFIG, STATUS_CONFIG } from '@/types';

interface ExportTask {
    'Seri No': string;
    'Görev İsmi': string;
    'Tarih': string;
    'Kategori': string;
    'Lokasyon': string;
    'Kat': string;
    'Açıklama': string;
    'Önem Derecesi': string;
    'Durum': string;
    'Denetçi': string;
    'Görevli': string;
    'Son Tarih': string;
    'Oluşturma Tarihi': string;
    'Tamamlanma Tarihi': string;
}

function transformTasksForExport(tasks: Task[]): ExportTask[] {
    return tasks.map((task) => ({
        'Seri No': task.serial_number,
        'Görev İsmi': task.title ?? '-',
        'Tarih': new Date(task.created_at).toLocaleDateString('tr-TR'),
        'Kategori': task.category?.name ?? '-',
        'Lokasyon': task.location?.name ?? '-',
        'Kat': task.floor ?? '-',
        'Açıklama': task.description,
        'Önem Derecesi': SEVERITY_CONFIG[task.severity]?.label ?? '-',
        'Durum': STATUS_CONFIG[task.status]?.label ?? task.status,
        'Denetçi': task.inspector?.full_name ?? '-',
        'Görevli': task.responsible?.full_name ?? '-',
        'Son Tarih': task.due_date
            ? new Date(task.due_date).toLocaleDateString('tr-TR')
            : '-',
        'Oluşturma Tarihi': new Date(task.created_at).toLocaleDateString('tr-TR'),
        'Tamamlanma Tarihi': task.completed_at
            ? new Date(task.completed_at).toLocaleDateString('tr-TR')
            : '-',
    }));
}

export async function exportToExcel(tasks: Task[], filename = 'gorevler'): Promise<void> {
    const data = transformTasksForExport(tasks);
    const headers = Object.keys(data[0] ?? {}) as Array<keyof ExportTask>;
    const widths = [15, 25, 12, 25, 20, 8, 40, 22, 15, 20, 20, 12, 15, 15];
    const sheetData = [
        headers.map((header) => ({
            value: header,
            fontWeight: 'bold' as const,
            backgroundColor: '#E2E8F0',
        })),
        ...data.map((row) => headers.map((header) => ({
            value: row[header],
            type: String,
            wrap: header === 'Açıklama',
        }))),
    ];

    // Tarayıcı paketini yalnızca kullanıcı Excel indirdiğinde yükle.
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    await writeExcelFile(sheetData, {
        sheet: 'Görevler',
        columns: widths.map((width) => ({ width })),
        stickyRowsCount: 1,
    }).toFile(`${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCsv(tasks: Task[], filename = 'gorevler'): void {
    const data = transformTasksForExport(tasks);
    const csv = Papa.unparse(data, { escapeFormulae: true });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
