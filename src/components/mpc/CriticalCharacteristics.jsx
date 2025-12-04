import React, { useState, useCallback } from 'react';
import { Plus, Edit, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import CriticalCharacteristicFormModal from './CriticalCharacteristicFormModal';

const CriticalCharacteristics = () => {
    const { toast } = useToast();
    const [characteristics, setCharacteristics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingCharacteristic, setEditingCharacteristic] = useState(null);

    const loadCharacteristics = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('critical_characteristics')
                .select(`
                    *,
                    cost_settings!responsible_department_id(id, unit_name)
                `)
                .order('characteristic_code', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'critical_characteristics tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-mpc-module.sql script\'ini çalıştırın.'
                    });
                    setCharacteristics([]);
                    return;
                }
                throw error;
            }
            setCharacteristics(data || []);
            } catch (error) {
            console.error('Critical characteristics loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kritik karakteristikler yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setCharacteristics([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadCharacteristics();
    }, [loadCharacteristics]);

    const openFormModal = (char = null) => {
        setEditingCharacteristic(char);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingCharacteristic(null);
        setFormModalOpen(false);
        loadCharacteristics();
    };

    const getTypeColor = (type) => {
        if (type === 'CC') return 'destructive';
        if (type === 'SC') return 'warning';
        return 'default';
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        Yükleniyor...
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Kritik Karakteristikler (CC/SC)</h3>
                    <p className="text-sm text-muted-foreground">
                        Critical Characteristics ve Significant Characteristics tanımlayın
                    </p>
                </div>
                <Button onClick={() => openFormModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Karakteristik
                </Button>
            </div>

            {characteristics.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Henüz kritik karakteristik tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {characteristics.map((char) => (
                        <Card key={char.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">{char.characteristic_name}</h4>
                                        <p className="text-sm text-muted-foreground font-mono">
                                            {char.characteristic_code}
                                        </p>
                                    </div>
                                    <Badge variant={getTypeColor(char.characteristic_type)}>
                                        {char.characteristic_type}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {char.part_name && (
                                        <div>
                                            <span className="text-muted-foreground">Parça: </span>
                                            <span className="font-medium">{char.part_name}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-muted-foreground">Kaynak: </span>
                                        <span className="font-medium">{char.classification_source || 'İç'}</span>
                                    </div>
                                    {char.usl && char.lsl && (
                                        <div>
                                            <span className="text-muted-foreground">Spesifikasyon: </span>
                                            <span className="font-medium">
                                                {char.lsl} - {char.usl} {char.measurement_unit || ''}
                                            </span>
                                        </div>
                                    )}
                                    {char.target_value && (
                                        <div>
                                            <span className="text-muted-foreground">Hedef: </span>
                                            <span className="font-medium">{char.target_value} {char.measurement_unit || ''}</span>
                                        </div>
                                    )}
                                    {char.inspection_frequency && (
                                        <div>
                                            <span className="text-muted-foreground">Kontrol Sıklığı: </span>
                                            <span className="font-medium">{char.inspection_frequency}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openFormModal(char)}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormModalOpen && (
                <CriticalCharacteristicFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingCharacteristic={editingCharacteristic}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default CriticalCharacteristics;
