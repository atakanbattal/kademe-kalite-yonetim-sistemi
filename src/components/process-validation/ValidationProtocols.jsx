import React, { useState, useCallback } from 'react';
import { Plus, FileCheck, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ValidationProtocolFormModal from './ValidationProtocolFormModal';

const PROTOCOL_TYPES = ['IQ', 'OQ', 'PQ'];
const PROTOCOL_STATUSES = [
    { value: 'Başlanmadı', label: 'Başlanmadı' },
    { value: 'Devam Eden', label: 'Devam Eden' },
    { value: 'Tamamlanan', label: 'Tamamlanan' },
    { value: 'Başarısız', label: 'Başarısız' }
];

const ValidationProtocols = ({ plans }) => {
    const { toast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [protocols, setProtocols] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState(null);

    const loadProtocols = useCallback(async (planId) => {
        if (!planId) {
            setProtocols([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('validation_protocols')
                .select(`
                    *,
                    personnel!approved_by(id, full_name, email)
                `)
                .eq('validation_plan_id', planId)
                .order('protocol_number', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'validation_protocols tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-process-validation-module.sql script\'ini çalıştırın.'
                    });
                    setProtocols([]);
                    return;
                }
                throw error;
            }
            setProtocols(data || []);
        } catch (error) {
            console.error('Protocols loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Protokoller yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setProtocols([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (selectedPlan) {
            loadProtocols(selectedPlan);
        }
    }, [selectedPlan, loadProtocols]);

    const openFormModal = (protocol = null) => {
        setEditingProtocol(protocol);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingProtocol(null);
        setFormModalOpen(false);
        if (selectedPlan) {
            loadProtocols(selectedPlan);
        }
    };

    const activePlans = plans.filter(p => 
        ['Planlanan', 'Devam Eden'].includes(p.status)
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>IQ/OQ/PQ Protokolleri</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Installation Qualification, Operational Qualification, Performance Qualification
                        </p>
                    </div>
                    {selectedPlan && (
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Protokol
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select value={selectedPlan || ''} onValueChange={setSelectedPlan}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Validasyon planı seçin..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activePlans.map(plan => (
                                <SelectItem key={plan.id} value={plan.id}>
                                    {plan.plan_name} ({plan.plan_number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : !selectedPlan ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Lütfen bir validasyon planı seçin.
                    </div>
                ) : protocols.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Bu plan için henüz protokol tanımlanmamış.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {protocols.map((protocol) => (
                            <Card key={protocol.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-semibold">
                                                    {protocol.protocol_type} - Protokol #{protocol.protocol_number}
                                                </h4>
                                                <Badge variant={
                                                    protocol.status === 'Tamamlanan' ? 'success' :
                                                    protocol.status === 'Başarısız' ? 'destructive' :
                                                    protocol.status === 'Devam Eden' ? 'default' :
                                                    'secondary'
                                                }>
                                                    {protocol.status}
                                                </Badge>
                                            </div>
                                            {protocol.acceptance_criteria && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Kabul Kriterleri: {protocol.acceptance_criteria}
                                                </p>
                                            )}
                                            {protocol.personnel && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Onaylayan: {protocol.personnel.email || protocol.personnel.full_name} | 
                                                    {protocol.approved_at && ` ${new Date(protocol.approved_at).toLocaleDateString('tr-TR')}`}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openFormModal(protocol)}
                                            >
                                                <FileCheck className="w-4 h-4 mr-1" />
                                                Düzenle
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={async () => {
                                                    if (confirm('Bu protokolü silmek istediğinize emin misiniz?')) {
                                                        try {
                                                            const { error } = await supabase
                                                                .from('validation_protocols')
                                                                .delete()
                                                                .eq('id', protocol.id);
                                                            if (error) throw error;
                                                            toast({
                                                                title: 'Başarılı',
                                                                description: 'Protokol silindi.'
                                                            });
                                                            loadProtocols(selectedPlan);
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
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {isFormModalOpen && (
                    <ValidationProtocolFormModal
                        open={isFormModalOpen}
                        setOpen={setFormModalOpen}
                        existingProtocol={editingProtocol}
                        planId={selectedPlan}
                        onSuccess={closeFormModal}
                    />
                )}
            </CardContent>
        </Card>
    );
};

export default ValidationProtocols;

