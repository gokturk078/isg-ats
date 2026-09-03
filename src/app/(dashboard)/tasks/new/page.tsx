'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type FieldErrors } from 'react-hook-form';
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
import { TaskFilePicker } from '@/components/tasks/TaskFilePicker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SEVERITY_CONFIG, calculateDueDate } from '@/types';
import type { Location, TaskCategory, Profile } from '@/types';
import { toast } from 'sonner';
import { MapPin, AlertTriangle, Paperclip, FileText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { uploadTaskFile, type SelectedTaskFile } from '@/lib/uploads/task-files';

const STEPS = [
    { title: 'Lokasyon', icon: MapPin },
    { title: 'Risk Bilgisi', icon: AlertTriangle },
    { title: 'Dosyalar', icon: Paperclip },
    { title: 'Detaylar', icon: FileText },
];

export default function NewTaskPage() {
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: profile } = useProfile();
    const [step, setStep] = useState(0);
    const [files, setFiles] = useState<SelectedTaskFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, setValue, watch, trigger, formState: { errors } } = useForm<TaskCreateInput>({
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

    const onSubmit = async (data: TaskCreateInput) => {
        if (!profile) {
            toast.error('Kullanıcı profiliniz yüklenemedi. Lütfen yeniden giriş yapın.');
            return;
        }
        setIsSubmitting(true);

        try {
            const { data: task, error: taskError } = await supabase
                .from('tasks')
                .insert({
                    title: data.title,
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

            const failedUploads: string[] = [];
            for (const item of files) {
                setFiles((current) => current.map((file) => file.id === item.id
                    ? { ...file, status: 'uploading', progress: 0, error: undefined }
                    : file));
                try {
                    await uploadTaskFile({
                        supabase,
                        item,
                        taskId: task.id,
                        userId: profile.id,
                        photoType: 'before',
                        onProgress: (progress) => setFiles((current) => current.map((file) => file.id === item.id
                            ? { ...file, progress }
                            : file)),
                    });
                    setFiles((current) => current.map((file) => file.id === item.id
                        ? { ...file, status: 'success', progress: 100 }
                        : file));
                } catch (uploadError) {
                    const message = uploadError instanceof Error ? uploadError.message : 'Yükleme başarısız.';
                    failedUploads.push(item.file.name);
                    setFiles((current) => current.map((file) => file.id === item.id
                        ? { ...file, status: 'error', error: message }
                        : file));
                }
            }

            await queryClient.invalidateQueries({ queryKey: ['tasks'] });

            // Send notification to assigned responsible — MUST complete before navigation
            if (data.responsible_id) {
                try {
                    const res = await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: task.id, type: 'task_assigned' }),
                    });
                    if (!res.ok) throw new Error('Bildirim servisi hatası');
                } catch (e) {
                    console.error('Bildirim gönderilemedi:', e);
                    toast.warning('Görev oluşturuldu ancak atama bildirimi gönderilemedi.');
                }
            }

            if (failedUploads.length > 0) {
                toast.warning('Görev oluşturuldu; bazı dosyalar yüklenemedi.', {
                    description: `${failedUploads.slice(0, 3).join(', ')}${failedUploads.length > 3 ? '…' : ''}. Görev detayından yeniden ekleyebilirsiniz.`,
                    duration: 8000,
                });
            } else {
                toast.success('Görev ve dosyalar başarıyla oluşturuldu.');
            }

            router.push(`/tasks/${task.id}`);
        } catch (error) {
            console.error('Görev oluşturulamadı:', error);
            toast.error('Görev oluşturulurken hata oluştu');
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = async () => {
        const fieldsByStep: Record<number, Array<keyof TaskCreateInput>> = {
            0: ['title', 'location_id'],
            1: ['category_id'],
            2: [],
            3: ['description', 'severity'],
        };
        const fields = fieldsByStep[step];
        const valid = fields.length === 0 || await trigger(fields, { shouldFocus: true });
        if (valid && step < 3) setStep(step + 1);
    };
    const prevStep = () => { if (step > 0) setStep(step - 1); };

    const handleInvalidSubmit = (formErrors: FieldErrors<TaskCreateInput>) => {
        if (formErrors.title || formErrors.location_id) setStep(0);
        else if (formErrors.category_id) setStep(1);
        else setStep(3);
        toast.error('Lütfen zorunlu alanları tamamlayın.');
    };

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
                            type="button"
                            onClick={() => i <= step && setStep(i)}
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

            <form onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}>
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
                                <Label>Görev İsmi *</Label>
                                <Input
                                    placeholder="Ör: Merdiven korkuluğu eksik"
                                    {...register('title')}
                                />
                                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                            </div>
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
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                {/* Step 3: Fotoğraf ve dosyalar */}
                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Paperclip className="h-5 w-5" /> Fotoğraf ve Dosyalar
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Telefonda kamera veya galeriyi ayrı seçebilir; bilgisayarda fotoğraf, PDF, Word ve Excel dosyası ekleyebilirsiniz.
                            </p>
                            <TaskFilePicker files={files} onChange={setFiles} disabled={isSubmitting} />
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
                                                onClick={() => {
                                                    setValue('severity', sev as 1 | 2 | 3 | 4 | 5, { shouldValidate: true });
                                                    setValue('due_date', calculateDueDate(sev));
                                                }}
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
                <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
                    <Button type="button" variant="outline" className="min-h-11" onClick={prevStep} disabled={step === 0 || isSubmitting}>
                        <ChevronLeft className="mr-1 h-4 w-4" /> Geri
                    </Button>
                    {step < 3 ? (
                        <Button type="button" className="min-h-11" onClick={nextStep} disabled={isSubmitting}>
                            İleri <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button type="submit" className="min-h-11" disabled={isSubmitting}>
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
