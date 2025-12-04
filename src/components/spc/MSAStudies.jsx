import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import MSAFormModal from './MSAFormModal';

const MSAStudies = () => {
    const { toast } = useToast();
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [selectedStudy, setSelectedStudy] = useState(null);

    const loadStudies = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('spc_msa_studies')
                .select(`
                    *,
                    spc_characteristics!characteristic_id(id, characteristic_name, characteristic_code),
                    measurement_equipment!measurement_equipment_id(id, name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'spc_msa_studies tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-spc-module.sql script\'ini çalıştırın.'
                    });
                    setStudies([]);
                    return;
                }
                throw error;
            }
            setStudies(data || []);
        } catch (error) {
            console.error('MSA studies loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'MSA çalışmaları yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadStudies();
    }, [loadStudies]);

    const getMSAStatus = (percent) => {
        if (!percent) return { status: 'unknown', label: 'Bilinmiyor', color: 'secondary' };
        if (percent <= 10) return { status: 'acceptable', label: 'Kabul Edilebilir', color: 'success' };
        if (percent <= 30) return { status: 'marginal', label: 'Sınırda', color: 'warning' };
        return { status: 'unacceptable', label: 'Kabul Edilemez', color: 'destructive' };
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Ölçüm Sistemi Analizi (MSA)</CardTitle>
                        <CardDescription>
                            Gage R&R, Bias, Linearity, Stability çalışmaları
                        </CardDescription>
                    </div>
                    <Button onClick={() => {
                        setSelectedStudy(null);
                        setFormModalOpen(true);
                    }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni MSA Çalışması
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : studies.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Henüz MSA çalışması bulunmuyor.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {studies.map((study) => {
                            const status = getMSAStatus(study.gage_rr_percent);
                            return (
                                <Card key={study.id} className="hover:shadow-lg transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-lg">{study.study_name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {study.study_type} - {new Date(study.study_date).toLocaleDateString('tr-TR')}
                                                </p>
                                            </div>
                                            <Badge variant={status.color}>
                                                {status.label}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">%Gage R&R: </span>
                                                <span className="font-semibold">{study.gage_rr_percent?.toFixed(2) || 'N/A'}%</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">NDC: </span>
                                                <span className="font-semibold">{study.ndc || 'N/A'}</span>
                                            </div>
                                            {study.characteristic && (
                                                <div>
                                                    <span className="text-muted-foreground">Karakteristik: </span>
                                                    <span className="font-medium">{study.spc_characteristics?.characteristic_name}</span>
                                                </div>
                                            )}
                                            {study.equipment && (
                                                <div>
                                                    <span className="text-muted-foreground">Ekipman: </span>
                                                    <span className="font-medium">{study.measurement_equipment?.name}</span>
                                                </div>
                                            )}
                                        </div>

                                        {study.recommendation && (
                                            <div className="mt-4 p-3 bg-muted rounded-lg">
                                                <p className="text-sm font-medium mb-1">Öneri:</p>
                                                <p className="text-sm text-muted-foreground">{study.recommendation}</p>
                                            </div>
                                        )}

                                        <div className="mt-4 flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedStudy(study);
                                                    setFormModalOpen(true);
                                                }}
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                Düzenle
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={async () => {
                                                    if (confirm('Bu MSA çalışmasını silmek istediğinize emin misiniz?')) {
                                                        try {
                                                            const { error } = await supabase
                                                                .from('spc_msa_studies')
                                                                .delete()
                                                                .eq('id', study.id);
                                                            if (error) throw error;
                                                            toast({
                                                                title: 'Başarılı',
                                                                description: 'MSA çalışması silindi.'
                                                            });
                                                            loadStudies();
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
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Sil
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </CardContent>
            <MSAFormModal
                open={formModalOpen}
                setOpen={setFormModalOpen}
                existingStudy={selectedStudy}
                onSuccess={() => {
                    loadStudies();
                    setSelectedStudy(null);
                }}
            />
        </Card>
    );
};

export default MSAStudies;
