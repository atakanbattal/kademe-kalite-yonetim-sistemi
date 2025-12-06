import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
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
import MSAFormModal from './MSAFormModal';

const STUDY_TYPES = {
    'GageR&R': 'Gage R&R',
    'Bias': 'Bias',
    'Linearity': 'Linearity',
    'Stability': 'Stability'
};

const getGageRRStatus = (percent) => {
    if (percent < 10) return { label: 'Mükemmel', color: 'success' };
    if (percent < 30) return { label: 'Kabul Edilebilir', color: 'default' };
    return { label: 'Kabul Edilemez', color: 'destructive' };
};

const MSAStudies = () => {
    const { toast } = useToast();
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingStudy, setEditingStudy] = useState(null);
    const [deletingStudy, setDeletingStudy] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadStudies();
    }, []);

    const loadStudies = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('spc_msa_studies')
                .select(`
                    *,
                    characteristic:characteristic_id(characteristic_name, characteristic_code),
                    equipment:measurement_equipment_id(id, name, serial_number)
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
    };

    const openFormModal = (study = null) => {
        setEditingStudy(study);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingStudy(null);
        setFormModalOpen(false);
        loadStudies();
    };

    const handleDelete = async () => {
        if (!deletingStudy) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('spc_msa_studies')
                .delete()
                .eq('id', deletingStudy.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'MSA çalışması silindi.'
            });

            setDeletingStudy(null);
            loadStudies();
        } catch (error) {
            console.error('Error deleting MSA study:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'MSA çalışması silinirken hata oluştu.'
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
                    <h3 className="text-lg font-semibold">MSA Çalışmaları</h3>
                    <p className="text-sm text-muted-foreground">
                        Gage R&R, Bias, Linearity ve Stability çalışmaları
                    </p>
                </div>
                <Button onClick={() => openFormModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni MSA Çalışması
                </Button>
            </div>

            {studies.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Henüz MSA çalışması tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studies.map((study) => {
                        const gageRRStatus = study.gage_rr_percent ? getGageRRStatus(study.gage_rr_percent) : null;
                        
                        return (
                            <Card key={study.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-lg">{study.study_name}</h4>
                                            <Badge variant="outline" className="mt-1">
                                                {STUDY_TYPES[study.study_type] || study.study_type}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        {study.characteristic && (
                                            <div>
                                                <span className="text-muted-foreground">Karakteristik: </span>
                                                <span className="font-medium">{study.characteristic.characteristic_name}</span>
                                            </div>
                                        )}
                                        {study.equipment && (
                                            <div>
                                                <span className="text-muted-foreground">Ekipman: </span>
                                                <span className="font-medium">{study.equipment.name || study.equipment.equipment_name || 'Bilinmeyen'}</span>
                                                {study.equipment.serial_number && (
                                                    <span className="text-muted-foreground ml-1">({study.equipment.serial_number})</span>
                                                )}
                                            </div>
                                        )}
                                        {study.gage_rr_percent !== null && (
                                            <div>
                                                <span className="text-muted-foreground">Gage R&R: </span>
                                                <span className="font-medium">{study.gage_rr_percent.toFixed(2)}%</span>
                                                {gageRRStatus && (
                                                    <Badge 
                                                        variant={gageRRStatus.color === 'success' ? 'default' : gageRRStatus.color === 'destructive' ? 'destructive' : 'secondary'}
                                                        className="ml-2"
                                                    >
                                                        {gageRRStatus.label}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                        {study.ndc !== null && (
                                            <div>
                                                <span className="text-muted-foreground">NDC: </span>
                                                <span className="font-medium">{study.ndc.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {study.recommendation && (
                                            <div className="pt-2 border-t">
                                                <span className="text-muted-foreground">Öneri: </span>
                                                <span className="text-sm">{study.recommendation}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(study)}
                                            className="flex-1"
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDeletingStudy(study)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <MSAFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingStudy(null);
                    }
                }}
                existingStudy={editingStudy}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingStudy} onOpenChange={(open) => !open && setDeletingStudy(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>MSA Çalışmasını Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingStudy?.study_name}" MSA çalışmasını silmek istediğinizden emin misiniz?
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

export default MSAStudies;
