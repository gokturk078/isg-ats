'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, MapPin, Loader2 } from 'lucide-react';
import type { Location } from '@/types';

export default function LocationsPage() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState('');
    const [code, setCode] = useState('');

    const { data: locations, isLoading } = useQuery<Location[]>({
        queryKey: ['admin-locations'],
        queryFn: async () => {
            const { data } = await supabase.from('locations').select('*').order('sort_order');
            return (data as Location[]) ?? [];
        },
    });

    const createLocation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('locations').insert({ name, code: code || null, sort_order: (locations?.length ?? 0) + 1 } as Database['public']['Tables']['locations']['Insert']);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-locations'] });
            queryClient.invalidateQueries({ queryKey: ['locations'] });
            toast.success('Lokasyon eklendi');
            setDialogOpen(false);
            setName('');
            setCode('');
        },
        onError: () => toast.error('Lokasyon eklenemedi'),
    });

    const toggleActive = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase.from('locations').update({ is_active } as Database['public']['Tables']['locations']['Update']).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-locations'] });
            queryClient.invalidateQueries({ queryKey: ['locations'] });
            toast.success('Lokasyon güncellendi');
        },
    });

    if (isLoading) return <LoadingSpinner text="Lokasyonlar yükleniyor..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Lokasyon Yönetimi"
                description={`${locations?.length ?? 0} lokasyon`}
                action={<Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Yeni Lokasyon</Button>}
            />

            {!locations?.length ? (
                <EmptyState icon={MapPin} title="Lokasyon yok" description="Henüz lokasyon bulunmuyor." />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ad</TableHead>
                                <TableHead>Kod</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {locations.map((loc) => (
                                <TableRow key={loc.id}>
                                    <TableCell className="font-medium">{loc.name}</TableCell>
                                    <TableCell><Badge variant="outline">{loc.code ?? '-'}</Badge></TableCell>
                                    <TableCell><Badge variant={loc.is_active ? 'default' : 'secondary'}>{loc.is_active ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate({ id: loc.id, is_active: !loc.is_active })}>
                                            {loc.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Yeni Lokasyon</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lokasyon adı" /></div>
                        <div className="space-y-2"><Label>Kod (isteğe bağlı)</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ör: T2Z8" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
                        <Button onClick={() => createLocation.mutate()} disabled={createLocation.isPending || !name}>
                            {createLocation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ekle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
