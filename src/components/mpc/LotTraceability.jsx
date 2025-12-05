import React, { useState, useCallback } from 'react';
import { Plus, Edit, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import LotTraceabilityFormModal from './LotTraceabilityFormModal';

const LotTraceability = () => {
    const { toast } = useToast();
    const [lots, setLots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingLot, setEditingLot] = useState(null);

    const loadLots = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('lot_traceability')
                .select('*')
                .order('production_date', { ascending: false })
                .limit(200);

            if (searchTerm) {
                query = query.or(`lot_number.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%,part_number.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setLots(data || []);
        } catch (error) {
            console.error('Lot traceability loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lot takibi yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [searchTerm, toast]);

    React.useEffect(() => {
        loadLots();
    }, [loadLots]);

    const openFormModal = (lot = null) => {
        setEditingLot(lot);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingLot(null);
        setFormModalOpen(false);
        loadLots();
    };

    const getStatusColor = (status) => {
        if (status === 'Shipped') return 'success';
        if (status === 'Recalled') return 'destructive';
        if (status === 'Quarantined') return 'warning';
        return 'default';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Lot/Seri Takibi</h3>
                    <p className="text-sm text-muted-foreground">
                        Üretim lot ve seri numarası takibi, geri çağırma yönetimi
                    </p>
                </div>
                <Button onClick={() => openFormModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Lot
                </Button>
            </div>

            {/* Arama */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Lot numarası, seri numarası veya parça numarası ile ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Yükleniyor...
                        </div>
                    </CardContent>
                </Card>
            ) : lots.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            {searchTerm ? 'Arama sonucu bulunamadı.' : 'Henüz lot kaydı bulunmuyor.'}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {lots.map((lot) => (
                        <Card key={lot.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-semibold font-mono">{lot.lot_number}</h4>
                                            {lot.serial_number && (
                                                <span className="text-sm text-muted-foreground font-mono">
                                                    Seri: {lot.serial_number}
                                                </span>
                                            )}
                                            <Badge variant={getStatusColor(lot.status)}>
                                                {lot.status === 'In Stock' ? 'Stokta' :
                                                 lot.status === 'Shipped' ? 'Sevk Edildi' :
                                                 lot.status === 'Recalled' ? 'Geri Çağrıldı' :
                                                 lot.status === 'Quarantined' ? 'Karantinada' : lot.status}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                                            {lot.part_name && (
                                                <div>
                                                    <span className="text-muted-foreground">Parça: </span>
                                                    <span className="font-medium">{lot.part_name}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-muted-foreground">Miktar: </span>
                                                <span className="font-medium">{lot.quantity} adet</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Üretim Tarihi: </span>
                                                <span className="font-medium">
                                                    {new Date(lot.production_date).toLocaleDateString('tr-TR')}
                                                </span>
                                            </div>
                                            {lot.production_line && (
                                                <div>
                                                    <span className="text-muted-foreground">Hat: </span>
                                                    <span className="font-medium">{lot.production_line}</span>
                                                </div>
                                            )}
                                        </div>
                                        {(lot.related_complaint_id || lot.related_nc_id) && (
                                            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                                                <span className="font-medium">İlişkili Kayıtlar: </span>
                                                {lot.related_complaint_id && 'Müşteri Şikayeti | '}
                                                {lot.related_nc_id && 'Uygunsuzluk'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(lot)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Düzenle
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormModalOpen && (
                <LotTraceabilityFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingLot={editingLot}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default LotTraceability;
