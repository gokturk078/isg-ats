import { describe, expect, it } from 'vitest';
import {
    normalizedMimeType,
    PHOTO_MAX_BYTES,
    selectTaskFiles,
    validateTaskFile,
} from './task-files';

describe('task file validation', () => {
    it('accepts supported image formats as photos', () => {
        const file = new File(['photo'], 'saha.HEIC', { type: '' });
        expect(normalizedMimeType(file)).toBe('image/heic');
        expect(validateTaskFile(file, 'photo')).toBeNull();
    });

    it('accepts PDF, Word and Excel formats as attachments', () => {
        const files = [
            new File(['pdf'], 'rapor.pdf', { type: 'application/pdf' }),
            new File(['word'], 'aksiyon.docx', { type: '' }),
            new File(['excel'], 'liste.xlsx', { type: '' }),
        ];
        expect(files.map((file) => validateTaskFile(file, 'attachment'))).toEqual([null, null, null]);
    });

    it('rejects executable or mismatched files', () => {
        const executable = new File(['binary'], 'zararli.exe', { type: 'application/octet-stream' });
        const pdfAsPhoto = new File(['pdf'], 'rapor.pdf', { type: 'application/pdf' });
        expect(validateTaskFile(executable, 'attachment')).toContain('yalnız PDF');
        expect(validateTaskFile(pdfAsPhoto, 'photo')).toContain('yalnız JPG');
    });

    it('rejects photos larger than the storage limit', () => {
        const largePhoto = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], 'buyuk.jpg', { type: 'image/jpeg' });
        expect(validateTaskFile(largePhoto, 'photo')).toContain('10 MB sınırını aşıyor');
    });

    it('keeps accepted and rejected selections separate', () => {
        const valid = new File(['photo'], 'foto.jpg', { type: 'image/jpeg' });
        const invalid = new File(['script'], 'script.js', { type: 'text/javascript' });
        const result = selectTaskFiles([valid, invalid], 'photo');
        expect(result.selected).toHaveLength(1);
        expect(result.selected[0]).toMatchObject({ kind: 'photo', status: 'pending', progress: 0 });
        expect(result.errors).toHaveLength(1);
    });
});
