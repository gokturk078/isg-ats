'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { taskCreateSchema, type TaskCreateInput } from '@/lib/validations/task';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SEVERITY_CONFIG } from '@/types';
import type { Location, TaskCategory, Profile } from '@/types';
import { toast } from 'sonner';
import { MapPin, AlertTriangle, Camera, FileText, ChevronLeft, ChevronRight, Loader2, Upload, X, ImageIcon } from 'lucide-react';

const STEPS = [
    { title: 'Lokasyon', icon: MapPin },
    { title: 'Risk Bilgisi', icon: AlertTriangle },
    { title: 'Fotoğraf', icon: Camera },
    { title: 'Detaylar', icon: FileText },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function NewTaskPage() {
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: profile } = useProfile();
    const [step, setStep] = useState(0);
    const [photos, setPhotos] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<TaskCreateInput>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(taskCreateSchema) as any,
        defaultValues: { detection_method: 'Saha Gözlem' },
    });

    const { data: locations } = useQuery<Location[]>({
        queryKey: ['locations'],
        queryFn: async () => {
            const { data } = await supabase.from('locations').select('*').eq('is_active', true).order('sort_order');
            return (data as Location[]) ?? [];
        },
    });

    const { data: categories } = useQuery<TaskCategory[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data } = await supabase.from('task_categories').select('*').eq('is_active', true).order('sort_order');
            return (data as TaskCategory[]) ?? [];
        },
    });

    const { data: responsibles } = useQuery<Profile[]>({
        queryKey: ['responsibles'],
        queryFn: async () => {
            const { data } = await supabase.from('profiles').select('*').eq('is_active', true).in('role', ['responsible', 'admin']);
            return (data as Profile[]) ?? [];
        },
    });

    const watchSeverity = watch('severity');

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
        if (oversized.length > 0) {
            toast.error(`${oversized.length} dosya 10MB limitini aşıyor`);
            return;
        }
        const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE);
        setPhotos((prev) => [...prev, ...validFiles]);
        validFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPreviews((prev) => [...prev, ev.target?.result as string]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    }, []);

    const removePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const onSubmit = async (data: TaskCreateInput) => {
        if (!profile) return;
        setIsSubmitting(true);

        try {
            const { data: task, error: taskError } = await supabase
                .from('tasks')
                .insert({
                    inspector_id: profile.id,
                    location_id: data.location_id,
                    category_id: data.category_id,
                    floor: data.floor || null,
                    exact_location: data.exact_location || null,
                    work_type: data.work_type || null,
                    detection_method: data.detection_method ?? 'Saha Gözlem',
                    description: data.description,
                    severity: data.severity,
                    action_required: data.action_required || null,
                    responsible_id: data.responsible_id || null,
                    due_date: data.due_date || null,
                    serial_number: '',
                    status: data.responsible_id ? 'open' : 'unassigned',
                })
                .select('id')
                .single();

            if (taskError) throw taskError;

            // Upload photos
            for (const photo of photos) {
                const ext = photo.name.split('.').pop();
                const path = `${task.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('task-photos')
                    .upload(path, photo);

                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('task-photos').getPublicUrl(path);
                    await supabase.from('task_photos').insert({
                        task_id: task.id,
                        photo_url: urlData.publicUrl,
                        storage_path: path,
                        photo_type: 'before',
                        uploaded_by: profile.id,
                        file_size: photo.size,
                    });
                }
            }

            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Görev başarıyla oluşturuldu');

            // Send notification to assigned responsible — MUST complete before navigation
            if (data.responsible_id) {
                try {
                    const res = await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: task.id, type: 'task_assigned' }),
                    });
                    const result = await res.json();
                    console.log('[Bildirim] Sonuç:', result);
                } catch (e) {
                    console.error('Bildirim gönderilemedi:', e);
                }
            }

            // Navigate AFTER notification is sent
            router.push(`/tasks/${task.id}`);
        } catch (error) {
            console.error('Görev oluşturulamadı:', error);
            toast.error('Görev oluşturulurken hata oluştu');
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = () => { if (step < 3) setStep(step + 1); };
    const prevStep = () => { if (step > 0) setStep(step - 1); };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title="Yeni Görev Oluştur"
                breadcrumbs={[
                    { label: 'Görevler', href: '/tasks' },
                    { label: 'Yeni Görev' },
                ]}
            />

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between">
                    {STEPS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => setStep(i)}
                            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${i === step ? 'text-primary' : i < step ? 'text-green-600' : 'text-muted-foreground'
                                }`}
                        >
                            <s.icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{s.title}</span>
                        </button>
                    ))}
                </div>
                <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Step 1: Lokasyon */}
                {step === 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MapPin className="h-5 w-5" /> Lokasyon Bilgisi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Lokasyon *</Label>
                                <Select onValueChange={(v) => setValue('location_id', v, { shouldValidate: true })}>
                                    <SelectTrigger><SelectValue placeholder="Lokasyon seçiniz" /></SelectTrigger>
                                    <SelectContent>
                                        {locations?.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.location_id && <p className="text-sm text-destructive">{errors.location_id.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Kat</Label>
                                    <Input placeholder="Ör: Zemin, 1, Bodrum" {...register('floor')} />
                                </div>
                                <div className="space-y-2">
                                    <Label>İş Kolu</Label>
                                    <Input placeholder="Ör: İnce İşler, Kaba İşler" {...register('work_type')} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Tam Konum Açıklaması</Label>
                                <Input placeholder="Ör: A Blok, 3. Kat koridor sonu" {...register('exact_location')} />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Risk Bilgisi */}
                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" /> Risk Bilgisi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Kategori *</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {categories?.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setValue('category_id', cat.id, { shouldValidate: true })}
                                            className={`p-3 rounded-lg border text-left text-sm transition-all ${watch('category_id') === cat.id
                                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                                : 'hover:border-primary/50'
                                                }`}
                                        >
                                            <div className="h-2 w-2 rounded-full mb-1.5" style={{ backgroundColor: cat.color }} />
                                            <span className="font-medium text-xs leading-tight">{cat.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {errors.category_id && <p className="text-sm text-destructive">{errors.category_id.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Tespit Usulü</Label>
                                <Select defaultValue="Saha Gözlem" onValueChange={(v) => setValue('detection_method', v, { shouldValidate: true })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Saha Gözlem">Saha Gözlem</SelectItem>
                                        <SelectItem value="Planlı Denetim">Planlı Denetim</SelectItem>
                                        <SelectItem value="İhbar">İhbar</SelectItem>
                                        <SelectItem value="Kaza Sonrası">Kaza Sonrası</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Fotoğraf */}
                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Camera className="h-5 w-5" /> Fotoğraf Yükleme
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div
                                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm font-medium">Fotoğraf eklemek için tıklayın</p>
                                <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, HEIC (maks. 10MB)</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,image/heic"
                                capture="environment"
                                multiple
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            {previews.length > 0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {previews.map((preview, index) => (
                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                                            <img src={preview} alt={`Fotoğraf ${index + 1}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(index)}
                                                className="absolute top-1 right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Step 4: Detaylar */}
                {step === 3 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Görev Detayları
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tehlikeli Durum Açıklaması *</Label>
                                <Textarea
                                    placeholder="Tespit edilen tehlikeli durumu detaylı açıklayınız..."
                                    rows={4}
                                    {...register('description')}
                                />
                                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Önem Derecesi *</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                                    {[5, 4, 3, 2, 1].map((sev) => {
                                        const config = SEVERITY_CONFIG[sev];
                                        return (
                                            <button
                                                key={sev}
                                                type="button"
                                                onClick={() => setValue('severity', sev as 1 | 2 | 3 | 4 | 5, { shouldValidate: true })}
                                                className={`p-3 rounded-lg border text-center transition-all ${watchSeverity === sev
                                                    ? `ring-2 ring-offset-1`
                                                    : 'hover:border-primary/50'
                                                    }`}
                                                style={watchSeverity === sev ? { borderColor: config.color, outlineColor: config.color } : undefined}
                                            >
                                                <p className="text-lg mb-0.5">{'★'.repeat(sev)}</p>
                                                <p className="text-[10px] font-medium leading-tight">{config.label}</p>
                                                <p className="text-[10px] text-muted-foreground">{config.interval}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                                {errors.severity && <p className="text-sm text-destructive">{errors.severity.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Aksiyon Gerekliliği</Label>
                                <Textarea
                                    placeholder="Yapılması gereken aksiyonu açıklayınız..."
                                    rows={2}
                                    {...register('action_required')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Görevli Ata</Label>
                                <Select onValueChange={(v) => setValue('responsible_id', v, { shouldValidate: true })}>
                                    <SelectTrigger><SelectValue placeholder="Görevli seçiniz (isteğe bağlı)" /></SelectTrigger>
                                    <SelectContent>
                                        {responsibles?.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.full_name} ({user.title ?? user.role})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-6">
                    <Button type="button" variant="outline" onClick={prevStep} disabled={step === 0}>
                        <ChevronLeft className="mr-1 h-4 w-4" /> Geri
                    </Button>
                    {step < 3 ? (
                        <Button type="button" onClick={nextStep}>
                            İleri <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Oluşturuluyor...
                                </>
                            ) : (
                                'Görev Oluştur'
                            )}
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
