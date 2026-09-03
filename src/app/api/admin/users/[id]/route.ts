import { NextResponse } from 'next/server';
import { adminApiErrorResponse, AdminApiError, noStoreHeaders, requireSuperAdmin } from '@/lib/auth/admin';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const { caller, serviceClient } = await requireSuperAdmin();
        if (caller.id === id) throw new AdminApiError('Kendi hesabınızı silemezsiniz.', 409);

        const { data: profile, error: profileError } = await serviceClient
            .from('profiles')
            .select('is_super_admin')
            .eq('id', id)
            .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.is_super_admin) {
            throw new AdminApiError('Süper yönetici hesabı silinemez.', 409);
        }

        const countQueries = await Promise.all([
            serviceClient.from('tasks').select('id', { count: 'exact', head: true }).eq('inspector_id', id),
            serviceClient.from('tasks').select('id', { count: 'exact', head: true }).eq('responsible_id', id),
            serviceClient.from('task_actions').select('id', { count: 'exact', head: true }).eq('user_id', id),
            serviceClient.from('task_photos').select('id', { count: 'exact', head: true }).eq('uploaded_by', id),
            serviceClient.from('task_attachments').select('id', { count: 'exact', head: true }).eq('uploaded_by', id),
            serviceClient.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', id),
        ]);

        const failedCount = countQueries.find((result) => result.error);
        if (failedCount?.error) throw failedCount.error;
        const dependencyCount = countQueries.reduce((total, result) => total + (result.count ?? 0), 0);

        if (dependencyCount > 0) {
            throw new AdminApiError(
                `Bu kullanıcı ${dependencyCount} geçmiş kayıtla ilişkili. Kayıt geçmişini korumak için kullanıcıyı silmek yerine pasif yapın.`,
                409,
            );
        }

        const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(id);
        if (authDeleteError && !authDeleteError.message.toLowerCase().includes('not found')) {
            throw new AdminApiError(`Authentication kullanıcısı silinemedi: ${authDeleteError.message}`, 409);
        }

        if (profile) {
            const { error: residualProfileError } = await serviceClient.from('profiles').delete().eq('id', id);
            if (residualProfileError) throw residualProfileError;
        }

        return NextResponse.json({ success: true }, { headers: noStoreHeaders });
    } catch (error) {
        return adminApiErrorResponse(error, 'Kullanıcı silinemedi.');
    }
}
