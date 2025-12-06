import React, { useState, useCallback } from 'react';
import { Plus, Edit, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CriticalCharacteristicFormModal from './CriticalCharacteristicFormModal';

const CriticalCharacteristics = () => {
    const { toast } = useToast();
    const [characteristics, setCharacteristics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingCharacteristic, setEditingCharacteristic] = useState(null);
    const [deletingCharacteristic, setDeletingCharacteristic] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadCharacteristics = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('critical_characteristics')
                .select(`
                    *,
                    responsible_department:responsible_department_id(unit_name)
                `)
                .order('characteristic_code', { ascending: true });

            if (error) throw error;
            setCharacteristics(data || []);
        } catch (error) {
            console.error('Critical characteristics loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kritik karakteristikler yüklenirken hata oluştu.'
            });
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

    const handleDelete = async () => {
        if (!deletingCharacteristic) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('critical_characteristics')
                .delete()
                .eq('id', deletingCharacteristic.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Kritik karakteristik silindi.'
            });
            
            setDeletingCharacteristic(null);
            loadCharacteristics();
        } catch (error) {
            console.error('Error deleting characteristic:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Karakteristik silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeletingCharacteristic(char)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CriticalCharacteristicFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingCharacteristic(null);
                    }
                }}
                existingCharacteristic={editingCharacteristic}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingCharacteristic} onOpenChange={(open) => !open && setDeletingCharacteristic(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Karakteristiği Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingCharacteristic?.characteristic_name}" karakteristiğini silmek istediğinizden emin misiniz?
                            Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Siliniyor...' : 'Sil'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CriticalCharacteristics;
