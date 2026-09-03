import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskFilePicker } from './TaskFilePicker';

describe('TaskFilePicker', () => {
    it('shows separate camera, gallery and document controls', () => {
        render(<TaskFilePicker files={[]} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: /kamerayı aç/i })).toBeVisible();
        expect(screen.getByRole('button', { name: /galeriden seç/i })).toBeVisible();
        expect(screen.getByRole('button', { name: /dosya seç/i })).toBeVisible();
    });

    it('can restrict completion evidence to photos', () => {
        render(<TaskFilePicker files={[]} onChange={vi.fn()} allowAttachments={false} />);
        expect(screen.getByRole('button', { name: /kamerayı aç/i })).toBeVisible();
        expect(screen.getByRole('button', { name: /galeriden seç/i })).toBeVisible();
        expect(screen.queryByRole('button', { name: /dosya seç/i })).not.toBeInTheDocument();
    });

    it('can expose only document upload for a responsible user', () => {
        render(<TaskFilePicker files={[]} onChange={vi.fn()} allowPhotos={false} />);
        expect(screen.queryByRole('button', { name: /kamerayı aç/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /galeriden seç/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /dosya seç/i })).toBeVisible();
    });
});
