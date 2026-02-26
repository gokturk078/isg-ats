'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTask } from '@/hooks/useTask';
import { useProfile } from '@/hooks/useProfile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, Save, ArrowLeft } from 'lucide-react';

export default function TaskEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { data: task, isLoading } = useTask(id);
    const { data: profile } = useProfile();
    const [isSaving, setIsSaving] = useState(false);

    // Form state — initialized from task data
    const [title, setTitle] = useState<string | null>(null);
    const [description, setDescription] = useState<string | null>(null);
    const [actionRequired, setActionRequired] = useState<string | null>(null);
    const [severity, setSeverity] = useState<string | null>(null);
    const [locationId, setLocationId] = useState<string | null>(null);
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [responsibleId, setResponsibleId] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [floor, setFloor] = useState<string | null>(null);
    const [exactLocation, setExactLocation] = useState<string | null>(null);

    // Fetch reference data
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

    if (isLoading) return <LoadingSpinner text="Görev yükleniyor..." />;
    if (!task) return <div className="text-center py-12 text-muted-foreground">Görev bulunamadı</div>;

    // Use form state if modified, otherwise fall back to task data
    const currentTitle = title ?? task.title ?? '';
    const currentDescription = description ?? task.description;
    const currentActionRequired = actionRequired ?? task.action_required ?? '';
    const currentSeverity = severity ?? String(task.severity);
    const currentLocationId = locationId ?? task.location_id ?? '';
    const currentCategoryId = categoryId ?? task.category_id ?? '';
    const currentResponsibleId = responsibleId ?? task.responsible_id ?? '';
    const currentDueDate = dueDate ?? (task.due_date ? task.due_date.split('T')[0] : '');
    const currentFloor = floor ?? task.floor ?? '';
    const currentExactLocation = exactLocation ?? task.exact_location ?? '';

    const handleSave = async () => {
        if (!currentDescription.trim()) {
            toast.error('Açıklama zorunludur');
            return;
        }

        setIsSaving(true);
        try {
            const updates: Record<string, unknown> = {
                title: currentTitle.trim() || null,
                description: currentDescription.trim(),
                action_required: currentActionRequired.trim() || null,
                severity: Number(currentSeverity),
                location_id: currentLocationId || null,
                category_id: currentCategoryId || null,
                responsible_id: currentResponsibleId || null,
                due_date: currentDueDate || null,
                floor: currentFloor.trim() || null,
                exact_location: currentExactLocation.trim() || null,
            };

            // If responsible changed and new one assigned, set status to open
            if (currentResponsibleId && !task.responsible_id && task.status === 'unassigned') {
                updates.status = 'open';
            }

            const { error } = await supabase.from('tasks').update(updates).eq('id', id);
            if (error) throw error;

            // Send notification if responsible just assigned
            if (currentResponsibleId && currentResponsibleId !== task.responsible_id) {
                try {
                    await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: id, type: 'task_assigned' }),
                    });
                } catch (e) {
                    console.error('Bildirim gönderilemedi:', e);
                }
            }

            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Görev güncellendi');
            router.push(`/tasks/${id}`);
        } catch (error) {
            console.error('Güncelleme hatası:', error);
            toast.error('Görev güncellenirken hata oluştu');
        } finally {
            setIsSaving(false);
        }
    };

    const isAdmin = profile?.role === 'admin';
    const isInspector = profile?.role === 'inspector' && task.inspector_id === profile?.id;
    if (!isAdmin && !isInspector) {
        return <div className="text-center py-12 text-muted-foreground">Bu görevi düzenleme yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader
                title={`Görev Düzenle — #${task.serial_number}`}
                breadcrumbs={[
                    { label: 'Görevler', href: '/tasks' },
                    { label: `#${task.serial_number}`, href: `/tasks/${id}` },
                    { label: 'Düzenle' },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Görev Bilgileri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Görev İsmi */}
                    <div className="space-y-2">
                        <Label>Görev İsmi</Label>
                        <Input
                            value={currentTitle}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ör: Merdiven korkuluğu eksik"
                        />
                    </div>

                    {/* Açıklama */}
                    <div className="space-y-2">
                        <Label>Açıklama *</Label>
                        <Textarea
                            value={currentDescription}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                        />
                    </div>

                    {/* Aksiyon Gerekliliği */}
                    <div className="space-y-2">
                        <Label>Yapılması Gereken İş</Label>
                        <Textarea
                            value={currentActionRequired}
                            onChange={(e) => setActionRequired(e.target.value)}
                            rows={2}
                            placeholder="Yapılması gereken aksiyon..."
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Önem */}
                        <div className="space-y-2">
                            <Label>Önem Derecesi *</Label>
                            <Select value={currentSeverity} onValueChange={(v) => {
                                setSeverity(v);
                                setDueDate(calculateDueDate(Number(v)));
                            }}>
                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SEVERITY_CONFIG).sort(([a], [b]) => Number(b) - Number(a)).map(([val, cfg]) => (
                                        <SelectItem key={val} value={val}>
                                            <span style={{ color: cfg.color }}>{cfg.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Lokasyon */}
                        <div className="space-y-2">
                            <Label>Lokasyon</Label>
                            <Select value={currentLocationId} onValueChange={(v) => setLocationId(v)}>
                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {locations?.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Kategori */}
                        <div className="space-y-2">
                            <Label>Kategori</Label>
                            <Select value={currentCategoryId} onValueChange={(v) => setCategoryId(v)}>
                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {categories?.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Görevli */}
                        <div className="space-y-2">
                            <Label>Görevli</Label>
                            <Select value={currentResponsibleId} onValueChange={(v) => setResponsibleId(v)}>
                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    {responsibles?.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Son Tarih */}
                        <div className="space-y-2">
                            <Label>Son Tarih</Label>
                            <Input
                                type="date"
                                value={currentDueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>

                        {/* Kat */}
                        <div className="space-y-2">
                            <Label>Kat</Label>
                            <Input
                                value={currentFloor}
                                onChange={(e) => setFloor(e.target.value)}
                                placeholder="Ör: 3. Kat"
                            />
                        </div>
                    </div>

                    {/* Tam Konum */}
                    <div className="space-y-2">
                        <Label>Tam Konum</Label>
                        <Input
                            value={currentExactLocation}
                            onChange={(e) => setExactLocation(e.target.value)}
                            placeholder="Ör: B blok, koridor sonu"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => router.push(`/tasks/${id}`)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Geri
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" /> Kaydet</>
                    )}
                </Button>
            </div>
        </div>
    );
}
