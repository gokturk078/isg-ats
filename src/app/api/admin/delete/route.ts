import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify caller is super admin
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Yetkilendirme hatası.' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_super_admin) {
            return NextResponse.json({ error: 'Bu işlem için süper yönetici yetkisi gereklidir.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('id');
        const type = searchParams.get('type') ?? 'task'; // task | location | category | user

        if (!taskId) {
            return NextResponse.json({ error: 'ID gerekli.' }, { status: 400 });
        }

        const serviceClient = await createServiceClient();

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
                const { error } = await serviceClient.from('profiles').delete().eq('id', taskId);
                if (error) throw error;
                // Also delete auth user
                await serviceClient.auth.admin.deleteUser(taskId);
                break;
            }
            default:
                return NextResponse.json({ error: 'Geçersiz tip.' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Silme hatası:', error);
        return NextResponse.json({ error: 'Silme işlemi başarısız oldu.' }, { status: 500 });
    }
}
