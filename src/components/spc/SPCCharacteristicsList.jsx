import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import SPCCharacteristicFormModal from './SPCCharacteristicFormModal';

const SPCCharacteristicsList = ({ characteristics, loading, onRefresh }) => {
    const { toast } = useToast();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingCharacteristic, setEditingCharacteristic] = useState(null);

    const openFormModal = (char = null) => {
        setEditingCharacteristic(char);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingCharacteristic(null);
        setFormModalOpen(false);
        onRefresh();
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
                    <h3 className="text-lg font-semibold">Kritik Karakteristikler</h3>
                    <p className="text-sm text-muted-foreground">
                        SPC takibi yapılacak kritik karakteristikleri tanımlayın
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
                            Henüz karakteristik tanımlanmamış.
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
                                    <Badge variant={char.is_active ? 'default' : 'secondary'}>
                                        {char.is_active ? 'Aktif' : 'Pasif'}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {char.part_name && (
                                        <div>
                                            <span className="text-muted-foreground">Parça: </span>
                                            <span className="font-medium">{char.part_name}</span>
                                        </div>
                                    )}
                                    {char.process_name && (
                                        <div>
                                            <span className="text-muted-foreground">Proses: </span>
                                            <span className="font-medium">{char.process_name}</span>
                                        </div>
                                    )}
                                    {char.usl && char.lsl && (
                                        <div>
                                            <span className="text-muted-foreground">Spesifikasyon: </span>
                                            <span className="font-medium">
                                                {char.lsl} - {char.usl} {char.measurement_unit || ''}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-muted-foreground">Grafik Tipi: </span>
                                        <Badge variant="outline" className="ml-1">
                                            {char.chart_type}
                                        </Badge>
                                    </div>
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
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('Bu karakteristiği silmek istediğinize emin misiniz?')) {
                                                try {
                                                    const { error } = await supabase
                                                        .from('spc_characteristics')
                                                        .delete()
                                                        .eq('id', char.id);
                                                    if (error) throw error;
                                                    toast({
                                                        title: 'Başarılı',
                                                        description: 'Karakteristik silindi.'
                                                    });
                                                    onRefresh();
                                                } catch (error) {
                                                    toast({
                                                        variant: 'destructive',
                                                        title: 'Hata',
                                                        description: error.message || 'Silme işlemi başarısız.'
                                                    });
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Sil
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormModalOpen && (
                <SPCCharacteristicFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingCharacteristic={editingCharacteristic}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default SPCCharacteristicsList;
