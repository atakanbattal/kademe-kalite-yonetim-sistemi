import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, X, History, RotateCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const ControlPlanDetailModal = ({
    isOpen,
    setIsOpen,
    plan,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const { characteristics, equipment, standards } = useData();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [revisionHistory, setRevisionHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [restoreRevisionId, setRestoreRevisionId] = useState(null);

    useEffect(() => {
        if (plan) {
            console.log('📋 ControlPlanDetailModal opened with plan:', plan);
            console.log('📊 Plan items:', plan.items);
            console.log('📊 Items count:', plan.items ? plan.items.length : 0);
            fetchRevisionHistory();
        }
    }, [plan, isOpen]);

    const fetchRevisionHistory = async () => {
        if (!plan?.id) return;
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('incoming_control_plan_revisions')
                .select('*')
                .eq('control_plan_id', plan.id)
                .order('revision_number', { ascending: false });
            
            if (error) {
                // Tablo yoksa veya başka bir hata varsa sessizce boş liste döndür
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.warn('Revizyon geçmişi tablosu henüz oluşturulmamış. Migration script çalıştırılmalı.');
                    setRevisionHistory([]);
                    return;
                }
                throw error;
            }
            setRevisionHistory(data || []);
        } catch (error) {
            console.error('Revizyon geçmişi yüklenemedi:', error);
            // Sadece kritik hatalarda toast göster
            if (error.code !== '42P01' && !error.message?.includes('does not exist')) {
                toast({ 
                    variant: 'destructive', 
                    title: 'Hata', 
                    description: `Revizyon geçmişi yüklenemedi: ${error.message || 'Bilinmeyen hata'}` 
                });
            }
            setRevisionHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleRestoreRevision = async (revisionId) => {
        try {
            const revision = revisionHistory.find(r => r.id === revisionId);
            if (!revision) return;

            // Plan'ı eski haline geri yükle
            const { error: updateError } = await supabase
                .from('incoming_control_plans')
                .update({
                    part_code: revision.old_part_code,
                    part_name: revision.old_part_name,
                    items: revision.old_items,
                    file_path: revision.old_file_path,
                    file_name: revision.old_file_name,
                    revision_number: revision.revision_number,
                    revision_date: revision.revision_date,
                    updated_at: new Date().toISOString()
                })
                .eq('id', plan.id);

            if (updateError) throw updateError;

            // Revizyon geçmişini işaretle
            await supabase
                .from('incoming_control_plan_revisions')
                .update({
                    is_active: false,
                    restored_at: new Date().toISOString()
                })
                .eq('id', revisionId);

            toast({ title: 'Başarılı!', description: 'Revizyon geri alındı. Plan eski haline döndürüldü.' });
            setRestoreRevisionId(null);
            fetchRevisionHistory();
            setIsOpen(false);
            // Parent component'e bildir
            if (onDownloadPDF) {
                window.location.reload(); // Sayfayı yenile
            }
        } catch (error) {
            console.error('Revizyon geri alınamadı:', error);
            toast({ variant: 'destructive', title: 'Hata', description: `Revizyon geri alınamadı: ${error.message}` });
        }
    };

    // Karakteristik ve ekipman bilgilerini al
    const getCharacteristicName = (id) => {
        const char = characteristics?.find(c => c.value === id);
        return char ? char.label : id || '-';
    };

    const getEquipmentName = (id) => {
        const eq = equipment?.find(e => e.value === id);
        return eq ? eq.label : id || '-';
    };

    const getStandardName = (item) => {
        if (item.standard_class) {
            return item.standard_class;
        }
        if (item.standard_id) {
            const std = standards?.find(s => s.value === item.standard_id);
            return std ? std.label : item.standard_id;
        }
        return '-';
    };

    const handleGenerateReport = () => {
        // Process control modülündeki gibi senkron çalış
        try {
            if (!plan || !plan.id) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Geçerli bir kontrol planı bulunamadı!',
                });
                return;
            }
            
            const enrichedData = {
                ...plan,
                prepared_by: preparedBy || '',
                controlled_by: controlledBy || '',
                created_by: createdBy || '',
            };
            
            console.log('📄 Rapor oluşturuluyor:', enrichedData);
            
            // onDownloadPDF fonksiyonunu çağır (senkron)
            onDownloadPDF(enrichedData);
            
            toast({
                title: 'Başarılı',
                description: 'Rapor oluşturuldu!',
            });
            setIsOpen(false);
        } catch (error) {
            console.error('Rapor oluşturma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Rapor oluşturulamadı: ${error.message}`,
            });
        }
    };

    if (!plan) return null;

    // Güvenli tarih formatı
    const formatSafeDate = (dateStr, formatStr = 'dd.MM.yyyy') => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), formatStr, { locale: tr });
        } catch {
            return '-';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><AlertTriangle className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Kontrol Planı Detayları</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Plan: {plan.part_code} • {formatSafeDate(plan.updated_at || plan.created_at, 'dd MMMM yyyy')}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Rev. {plan.revision_number ?? '-'}</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="measurements">Ölçüm Noktaları</TabsTrigger>
                        <TabsTrigger value="history">Revizyon Geçmişi</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="basic" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Plan Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-600">Parça Kodu</Label>
                                        <p className="font-medium">{plan.part_code || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Parça Adı</Label>
                                        <p className="font-medium">{plan.part_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Revizyon No</Label>
                                        <p className="font-medium">Rev.{plan.revision_number || 0}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Revizyon Tarihi</Label>
                                        <p className="font-medium">{formatSafeDate(plan.revision_date)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Karakteristik Sayısı</Label>
                                        <p className="font-medium">{(plan.items || []).length} adet</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: ÖLÇÜM NOKTALARI */}
                    <TabsContent value="measurements" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ölçülmesi Gereken Noktalar ve Ölçüler</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {plan.items && plan.items.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-muted">
                                                    <th className="border p-2 text-left">#</th>
                                                    <th className="border p-2 text-left">Karakteristik</th>
                                                    <th className="border p-2 text-left">Ölçüm Ekipmanı</th>
                                                    <th className="border p-2 text-left">Standart</th>
                                                    <th className="border p-2 text-center">Nominal</th>
                                                    <th className="border p-2 text-center">Min</th>
                                                    <th className="border p-2 text-center">Max</th>
                                                    <th className="border p-2 text-center">Yön</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plan.items.map((item, idx) => (
                                                    <tr key={item.id || idx} className="hover:bg-muted/50">
                                                        <td className="border p-2 font-medium">{idx + 1}</td>
                                                        <td className="border p-2">
                                                            <div>
                                                                <div className="font-medium">{getCharacteristicName(item.characteristic_id)}</div>
                                                                {item.characteristic_type && (
                                                                    <Badge variant="outline" className="mt-1 text-xs">
                                                                        {item.characteristic_type}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="border p-2">{getEquipmentName(item.equipment_id)}</td>
                                                        <td className="border p-2">
                                                            <div>
                                                                <div>{getStandardName(item)}</div>
                                                                {item.tolerance_class && (
                                                                    <Badge variant="secondary" className="mt-1 text-xs">
                                                                        {item.tolerance_class}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="border p-2 text-center font-medium bg-blue-50">
                                                            {item.nominal_value || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center bg-yellow-50">
                                                            {item.min_value || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center bg-yellow-50">
                                                            {item.max_value || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center">
                                                            <Badge variant="outline">{item.tolerance_direction || '±'}</Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">Ölçüm noktası bulunamadı.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 3: REVİZYON GEÇMİŞİ */}
                    <TabsContent value="history" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="w-5 h-5" />
                                    Revizyon Geçmişi
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingHistory ? (
                                    <p className="text-center py-8 text-muted-foreground">Yükleniyor...</p>
                                ) : revisionHistory.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">Revizyon geçmişi bulunamadı.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {revisionHistory.map((revision, index) => (
                                            <Card key={revision.id} className={revision.is_active ? '' : 'opacity-60 border-dashed'}>
                                                <CardHeader className="pb-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-base">
                                                                Rev. {revision.revision_number}
                                                                {!revision.is_active && (
                                                                    <Badge variant="secondary" className="ml-2">Geri Alındı</Badge>
                                                                )}
                                                            </CardTitle>
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                {formatSafeDate(revision.revision_date, 'dd MMMM yyyy HH:mm')}
                                                            </p>
                                                        </div>
                                                        {revision.is_active && index === 0 && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setRestoreRevisionId(revision.id)}
                                                                className="text-destructive hover:text-destructive"
                                                            >
                                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                                Geri Al
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    {revision.changes && Object.keys(revision.changes).length > 0 && (
                                                        <div>
                                                            <Label className="text-sm font-semibold mb-2 block">Değişiklikler:</Label>
                                                            <div className="space-y-1 text-sm">
                                                                {Object.entries(revision.changes).map(([field, change]) => (
                                                                    <div key={field} className="flex items-start gap-2">
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {field === 'part_code' ? 'Parça Kodu' : 
                                                                             field === 'part_name' ? 'Parça Adı' : 
                                                                             field === 'file_path' ? 'Dosya' : field}
                                                                        </Badge>
                                                                        <span className="text-muted-foreground">
                                                                            {change.old || '-'} → {change.new || '-'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {revision.changed_items && revision.changed_items.length > 0 && (
                                                        <div>
                                                            <Label className="text-sm font-semibold mb-2 block">
                                                                Değişen Öğeler ({revision.changed_items.length}):
                                                            </Label>
                                                            <div className="space-y-2 text-sm">
                                                                {revision.changed_items.map((item, idx) => (
                                                                    <div key={idx} className="border-l-2 border-primary pl-3 py-1">
                                                                        <div className="font-medium">Öğe #{item.index}</div>
                                                                        {item.action === 'added' && (
                                                                            <Badge variant="default" className="mt-1">Yeni Eklendi</Badge>
                                                                        )}
                                                                        {item.action === 'removed' && (
                                                                            <Badge variant="destructive" className="mt-1">Silindi</Badge>
                                                                        )}
                                                                        {item.changes && (
                                                                            <div className="mt-1 space-y-1">
                                                                                {Object.entries(item.changes).map(([field, change]) => (
                                                                                    <div key={field} className="text-xs text-muted-foreground">
                                                                                        {field}: {change.old || '-'} → {change.new || '-'}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {revision.revision_note && (
                                                        <div>
                                                            <Label className="text-sm font-semibold mb-2 block">Not:</Label>
                                                            <p className="text-sm text-muted-foreground">{revision.revision_note}</p>
                                                        </div>
                                                    )}
                                                    {revision.restored_at && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Geri alındı: {formatSafeDate(revision.restored_at, 'dd MMMM yyyy HH:mm')}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 4: RAPOR */}
                    <TabsContent value="report" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Rapor Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <Label>Hazırlayan</Label>
                                        <Input
                                            value={preparedBy}
                                            onChange={(e) => setPreparedBy(e.target.value)}
                                            placeholder="Hazırlayan kişinin adı"
                                        />
                                    </div>
                                    <div>
                                        <Label>Kontrol Eden</Label>
                                        <Input
                                            value={controlledBy}
                                            onChange={(e) => setControlledBy(e.target.value)}
                                            placeholder="Kontrol eden kişinin adı"
                                        />
                                    </div>
                                    <div>
                                        <Label>Onaylayan</Label>
                                        <Input
                                            value={createdBy}
                                            onChange={(e) => setCreatedBy(e.target.value)}
                                            placeholder="Onaylayan kişinin adı"
                                        />
                                    </div>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        💡 Bu isimler PDF raporunda imzalayan kişiler olarak görünecektir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                </div>

                <DialogFooter className="shrink-0">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Kapat
                    </Button>
                    <Button onClick={handleGenerateReport}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Rapor Oluştur & İndir
                    </Button>
                </DialogFooter>
            </DialogContent>
            
            {/* Revizyon Geri Alma Onay Dialog */}
            <AlertDialog open={!!restoreRevisionId} onOpenChange={() => setRestoreRevisionId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Revizyonu Geri Al
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem planı önceki revizyona geri döndürecektir. Mevcut revizyon kaybolacak ve plan eski haline dönecektir. 
                            Bu işlemi geri alamazsınız. Devam etmek istediğinizden emin misiniz?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleRestoreRevision(restoreRevisionId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Evet, Geri Al
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
};

export default ControlPlanDetailModal;
