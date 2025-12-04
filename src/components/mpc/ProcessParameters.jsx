import React, { useState, useCallback } from 'react';
import { Plus, Edit, Activity, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ProcessParameterFormModal from './ProcessParameterFormModal';
import ProcessParameterRecords from './ProcessParameterRecords';

const ProcessParameters = () => {
    const { toast } = useToast();
    const [parameters, setParameters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingParameter, setEditingParameter] = useState(null);
    const [selectedParameter, setSelectedParameter] = useState(null);

    const loadParameters = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('process_parameters')
                .select(`
                    *,
                    equipments!machine_equipment_id(id, name, serial_number)
                `)
                .order('parameter_name', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'process_parameters tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-mpc-module.sql script\'ini çalıştırın.'
                    });
                    setParameters([]);
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
                description: 'Proses parametreleri yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setParameters([]);
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
                                    {param.equipments && (
                                        <div>
                                            <span className="text-muted-foreground">Ekipman: </span>
                                            <span className="font-medium">{param.equipments.name}</span>
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
                                        variant="destructive"
                                        size="sm"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('Bu proses parametresini silmek istediğinize emin misiniz?')) {
                                                try {
                                                    const { error } = await supabase
                                                        .from('process_parameters')
                                                        .delete()
                                                        .eq('id', param.id);
                                                    if (error) throw error;
                                                    toast({
                                                        title: 'Başarılı',
                                                        description: 'Proses parametresi silindi.'
                                                    });
                                                    loadParameters();
                                                    if (selectedParameter === param.id) {
                                                        setSelectedParameter(null);
                                                    }
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

            {selectedParameter && (
                <ProcessParameterRecords 
                    parameterId={selectedParameter}
                    onClose={() => setSelectedParameter(null)}
                />
            )}

            {isFormModalOpen && (
                <ProcessParameterFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingParameter={editingParameter}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default ProcessParameters;
