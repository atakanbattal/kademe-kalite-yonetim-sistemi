import React, { useState, useCallback } from 'react';
import { Plus, Edit, Activity, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import ProcessParameterFormModal from './ProcessParameterFormModal';
import ProcessParameterRecords from './ProcessParameterRecords';

const ProcessParameters = () => {
    const { toast } = useToast();
    const [parameters, setParameters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingParameter, setEditingParameter] = useState(null);
    const [selectedParameter, setSelectedParameter] = useState(null);
    const [deletingParameter, setDeletingParameter] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadParameters = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('process_parameters')
                .select(`
                    *,
                    equipment:equipment_id(id, name, serial_number)
                `)
                .order('parameter_name', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'process_parameters tablosu henüz oluşturulmamış.'
                    });
                    setParameters([]);
                    setLoading(false);
                    return;
                }
                throw error;
            }
            setParameters(data || []);
        } catch (error) {
            console.error('Process parameters loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Proses parametreleri yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadParameters();
    }, [loadParameters]);

    const openFormModal = (param = null) => {
        setEditingParameter(param);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingParameter(null);
        setFormModalOpen(false);
        loadParameters();
    };

    const handleDelete = async () => {
        if (!deletingParameter) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('process_parameters')
                .delete()
                .eq('id', deletingParameter.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Proses parametresi silindi.'
            });
            
            setDeletingParameter(null);
            loadParameters();
        } catch (error) {
            console.error('Error deleting parameter:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Parametre silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
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
                    <h3 className="text-lg font-semibold">Proses Parametreleri</h3>
                    <p className="text-sm text-muted-foreground">
                        Makine/tezgah parametrelerini tanımlayın ve takip edin
                    </p>
                </div>
                <Button onClick={() => openFormModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Parametre
                </Button>
            </div>

            {parameters.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Henüz proses parametresi tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parameters.map((param) => (
                        <Card 
                            key={param.id} 
                            className={`hover:shadow-lg transition-shadow cursor-pointer ${selectedParameter === param.id ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setSelectedParameter(param.id)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">{param.parameter_name}</h4>
                                        {param.process_name && (
                                            <p className="text-sm text-muted-foreground">
                                                {param.process_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {param.is_critical && (
                                            <Badge variant="destructive">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                Kritik
                                            </Badge>
                                        )}
                                        <Badge variant={param.is_active ? 'default' : 'secondary'}>
                                            {param.is_active ? 'Aktif' : 'Pasif'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {param.equipment && (
                                        <div>
                                            <span className="text-muted-foreground">Ekipman: </span>
                                            <span className="font-medium">{param.equipment.name || param.equipment.equipment_name || 'Bilinmeyen'}</span>
                                            {param.equipment.serial_number && (
                                                <span className="text-muted-foreground ml-1">({param.equipment.serial_number})</span>
                                            )}
                                        </div>
                                    )}
                                    {param.target_value && (
                                        <div>
                                            <span className="text-muted-foreground">Hedef: </span>
                                            <span className="font-medium">{param.target_value} {param.unit || ''}</span>
                                        </div>
                                    )}
                                    {param.usl && param.lsl && (
                                        <div>
                                            <span className="text-muted-foreground">Limitler: </span>
                                            <span className="font-medium">
                                                {param.lsl} - {param.usl} {param.unit || ''}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openFormModal(param);
                                        }}
                                        className="flex-1"
                                    >
                                        <Edit className="w-4 h-4 mr-1" />
                                        Düzenle
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingParameter(param);
                                        }}
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

            {selectedParameter && (
                <ProcessParameterRecords 
                    parameterId={selectedParameter}
                    onClose={() => setSelectedParameter(null)}
                />
            )}

            <ProcessParameterFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingParameter(null);
                    }
                }}
                existingParameter={editingParameter}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingParameter} onOpenChange={(open) => !open && setDeletingParameter(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Parametreyi Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingParameter?.parameter_name}" proses parametresini silmek istediğinizden emin misiniz?
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

export default ProcessParameters;
