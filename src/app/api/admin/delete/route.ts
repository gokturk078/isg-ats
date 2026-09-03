import { NextRequest, NextResponse } from 'next/server';
import { adminApiErrorResponse, requireSuperAdmin } from '@/lib/auth/admin';

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('id');
        const type = searchParams.get('type') ?? 'task'; // task | location | category | user

        if (!taskId) {
            return NextResponse.json({ error: 'ID gerekli.' }, { status: 400 });
        }

        const { serviceClient } = await requireSuperAdmin();

        switch (type) {
            case 'task': {
                // Cascade delete: photos, actions, notifications, then task
                await serviceClient.from('task_photos').delete().eq('task_id', taskId);
                await serviceClient.from('task_actions').delete().eq('task_id', taskId);
                await serviceClient.from('notifications').delete().eq('task_id', taskId);
                const { error } = await serviceClient.from('tasks').delete().eq('id', taskId);
                if (error) throw error;
                break;
            }
            case 'location': {
                // Nullify FK references first
                await serviceClient.from('tasks').update({ location_id: null }).eq('location_id', taskId);
                await serviceClient.from('profiles').update({ location_id: null }).eq('location_id', taskId);
                const { error } = await serviceClient.from('locations').delete().eq('id', taskId);
                if (error) throw error;
                break;
            }
            case 'category': {
                await serviceClient.from('tasks').update({ category_id: null }).eq('category_id', taskId);
                const { error } = await serviceClient.from('task_categories').delete().eq('id', taskId);
                if (error) throw error;
                break;
            }
            case 'user': {
                return NextResponse.json(
                    { error: 'Kullanıcı silme için güvenli kullanıcı yönetimi ekranını kullanın.' },
                    { status: 410 },
                );
            }
            default:
                return NextResponse.json({ error: 'Geçersiz tip.' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return adminApiErrorResponse(error, 'Silme işlemi başarısız oldu.');
    }
}
