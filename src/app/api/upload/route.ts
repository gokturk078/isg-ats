import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Yetkilendirme hatası' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const bucket = (formData.get('bucket') as string) || 'task-photos';
        const path = formData.get('path') as string;

        if (!file) {
            return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 });
        }

        // Server-side type check
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: `Desteklenmeyen dosya türü: ${file.type}. Yalnızca JPEG, PNG, WebP, HEIC, GIF kabul edilir.` },
                { status: 400 }
            );
        }

        // Server-side size check
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: `Dosya boyutu 10MB limitini aşıyor (${(file.size / 1048576).toFixed(1)}MB)` },
                { status: 400 }
            );
        }

        const uploadPath = path || `${user.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(uploadPath, file);

        if (uploadError) {
            console.error('Upload hatası:', uploadError.message);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadPath);

        return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            path: uploadPath,
        });
    } catch (error) {
        console.error('Upload API hatası:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
