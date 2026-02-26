import * as XLSX from 'xlsx';
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

export function exportToExcel(tasks: Task[], filename = 'gorevler'): void {
    const data = transformTasksForExport(tasks);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Görevler');

    // Kolon genişlikleri
    ws['!cols'] = [
        { wch: 15 }, // Seri No
        { wch: 25 }, // Görev İsmi
        { wch: 12 }, // Tarih
        { wch: 25 }, // Kategori
        { wch: 20 }, // Lokasyon
        { wch: 8 },  // Kat
        { wch: 40 }, // Açıklama
        { wch: 22 }, // Önem
        { wch: 15 }, // Durum
        { wch: 20 }, // Denetçi
        { wch: 20 }, // Görevli
        { wch: 12 }, // Son Tarih
        { wch: 15 }, // Oluşturma Tarihi
        { wch: 15 }, // Tamamlanma Tarihi
    ];

    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCsv(tasks: Task[], filename = 'gorevler'): void {
    const data = transformTasksForExport(tasks);
    const csv = Papa.unparse(data);
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
