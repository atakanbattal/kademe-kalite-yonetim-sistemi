import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileDown, X, File, Image, FileText as FileTextIcon, Download, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';

const InkrDetailModal = ({
    isOpen,
    setIsOpen,
    report,
    onDownloadPDF,
    onViewPdf,
}) => {
    const { toast } = useToast();
    const { characteristics, equipment } = useData();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [inspectionInfo, setInspectionInfo] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);

    const getCharacteristicName = (id) => {
        const char = characteristics?.find(c => c.value === id);
        return char ? char.label : id || '-';
    };

    const getEquipmentName = (id) => {
        const eq = equipment?.find(e => e.value === id);
        return eq ? eq.label : id || '-';
    };

    const handleGenerateReport = async () => {
        try {
            // Items'a karakteristik ve ekipman isimlerini ekle
            const enrichedItems = (report.items || []).map(item => ({
                ...item,
                characteristic_name: getCharacteristicName(item.characteristic_id),
                equipment_name: getEquipmentName(item.equipment_id)
            }));

            const enrichedData = {
                ...report,
                items: enrichedItems,
                prepared_by: preparedBy || '',
                controlled_by: controlledBy || '',
                created_by: createdBy || '',
            };
            onDownloadPDF(enrichedData);
            toast({
                title: 'Başarılı',
                description: 'Rapor oluşturuldu!',
            });
            setIsOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturulamadı!',
            });
        }
    };

    useEffect(() => {
        const fetchInspectionInfo = async () => {
            if (report?.part_code) {
                try {
                    const { data, error } = await supabase
                        .from('incoming_inspections')
                        .select('delivery_note_number, inspection_date, record_no, quantity_received, quantity_rejected, quantity_conditional, decision')
                        .eq('part_code', report.part_code)
                        .order('inspection_date', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    if (!error && data) {
                        setInspectionInfo(data);
                    }
                } catch (err) {
                    console.error('İrsaliye bilgileri alınamadı:', err);
                }
            }
        };

        const fetchAttachments = async () => {
            if (report?.id) {
                setLoadingAttachments(true);
                try {
                    const { data, error } = await supabase
                        .from('inkr_attachments')
                        .select('*')
                        .eq('inkr_report_id', report.id)
                        .order('uploaded_at', { ascending: false });
                    
                    if (!error && data) {
                        setAttachments(data);
                    }
                } catch (err) {
                    console.error('Ek dosyalar alınamadı:', err);
                }
                setLoadingAttachments(false);
            }
        };

        if (isOpen && report) {
            fetchInspectionInfo();
            fetchAttachments();
        }
    }, [isOpen, report]);

    const getFileIcon = (fileType) => {
        if (fileType?.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
        if (fileType === 'application/pdf') return <FileTextIcon className="h-5 w-5 text-red-500" />;
        return <File className="h-5 w-5 text-gray-500" />;
    };

    const handleViewAttachment = async (attachment) => {
        try {
            const { data, error } = await supabase.storage
                .from('inkr_attachments')
                .createSignedUrl(attachment.file_path, 3600);
            
            if (error) throw error;
            
            if (attachment.file_type === 'application/pdf' && onViewPdf) {
                onViewPdf(attachment.file_path);
            } else if (attachment.file_type?.startsWith('image/')) {
                window.open(data.signedUrl, '_blank');
            } else {
                window.open(data.signedUrl, '_blank');
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya açılamadı: ' + err.message
            });
        }
    };

    const handleDownloadAttachment = async (attachment) => {
        try {
            const { data, error } = await supabase.storage
                .from('inkr_attachments')
                .download(attachment.file_path);
            
            if (error) throw error;
            
            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = attachment.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya indirilemedi: ' + err.message
            });
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    if (!report) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><FileSpreadsheet className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">INKR Detayları</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">INKR No: {report.inkr_number} • {format(new Date(report.report_date || report.created_at), 'dd MMMM yyyy', { locale: tr })}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Rapor</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="details">Muayene Sonuçları</TabsTrigger>
                        <TabsTrigger value="attachments">
                            Dosyalar {attachments.length > 0 && <Badge variant="secondary" className="ml-1">{attachments.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="basic" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>INKR Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-600">INKR Numarası</Label>
                                        <p className="font-medium">{report.inkr_number || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Ürün Adı</Label>
                                        <p className="font-medium">{report.part_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Ürün Kodu</Label>
                                        <p className="font-medium">{report.part_code || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Tedarikçi</Label>
                                        <p className="font-medium">{report.supplier_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Rapor Tarihi</Label>
                                        <p className="font-medium">
                                            {format(
                                                new Date(report.report_date || report.created_at),
                                                'dd.MM.yyyy'
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Durum</Label>
                                        <p className="font-medium">{report.status || 'Aktif'}</p>
                                    </div>
                                    {inspectionInfo && (
                                        <>
                                            <div>
                                                <Label className="text-gray-600">İrsaliye Numarası</Label>
                                                <p className="font-medium">{inspectionInfo.delivery_note_number || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-600">Muayene Kayıt No</Label>
                                                <p className="font-medium">{inspectionInfo.record_no || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-600">Muayene Tarihi</Label>
                                                <p className="font-medium">
                                                    {inspectionInfo.inspection_date ? format(new Date(inspectionInfo.inspection_date), 'dd.MM.yyyy') : '-'}
                                                </p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-600">Alınan Miktar</Label>
                                                <p className="font-medium">{inspectionInfo.quantity_received || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-600">Ret Miktarı</Label>
                                                <p className="font-medium">{inspectionInfo.quantity_rejected || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-600">Şartlı Kabul Miktarı</Label>
                                                <p className="font-medium">{inspectionInfo.quantity_conditional || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-gray-600">Karar</Label>
                                                <p className="font-medium">{inspectionInfo.decision || '-'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {report.notes && (
                                    <div>
                                        <Label className="text-gray-600">Notlar</Label>
                                        <p className="font-medium whitespace-pre-wrap">
                                            {report.notes}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: MUAYENE SONUÇLARI */}
                    <TabsContent value="details" className="space-y-4">
                        {report.items && report.items.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ölçüm Sonuçları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="p-2 text-left text-xs font-semibold">#</th>
                                                    <th className="p-2 text-left text-xs font-semibold">Karakteristik</th>
                                                    <th className="p-2 text-left text-xs font-semibold">Ekipman</th>
                                                    <th className="p-2 text-left text-xs font-semibold">Nominal</th>
                                                    <th className="p-2 text-left text-xs font-semibold">Min</th>
                                                    <th className="p-2 text-left text-xs font-semibold">Max</th>
                                                    <th className="p-2 text-left text-xs font-semibold">Ölçülen</th>
                                                    <th className="p-2 text-center text-xs font-semibold">Durum</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.items.map((item, idx) => {
                                                    // Virgülleri noktaya çevirerek sayısal değerleri al
                                                    const normalizeValue = (val) => {
                                                        if (!val) return NaN;
                                                        return parseFloat(val.toString().replace(',', '.'));
                                                    };

                                                    const measuredValStr = item.measured_value?.toString().trim().toUpperCase() || '';
                                                    const nominalValStr = item.nominal_value?.toString().trim().toUpperCase() || '';

                                                    const measured = normalizeValue(item.measured_value);
                                                    const min = normalizeValue(item.min_value);
                                                    const max = normalizeValue(item.max_value);

                                                    // 1. KESİN RED KELİMELERİ (Önce kontrol et)
                                                    const isExplicitFail = ['RET', 'UYGUNSUZ', 'NOK', 'NG', 'HATALI', 'RED'].some(failText =>
                                                        measuredValStr === failText || measuredValStr.startsWith(failText + ' ')
                                                    );

                                                    // 2. KESİN KABUL KELİMELERİ
                                                    const isExplicitPass = ['OK', 'UYGUN', 'KABUL', 'PASS', 'GEÇER', 'VAR', 'EVET'].some(okText =>
                                                        measuredValStr === okText || measuredValStr.startsWith(okText + ' ')
                                                    );

                                                    let isInRange = false;

                                                    if (isExplicitFail) {
                                                        isInRange = false;
                                                    } else if (isExplicitPass) {
                                                        isInRange = true;
                                                    } else if (nominalValStr && measuredValStr === nominalValStr) {
                                                        // 3. NOMİNAL DEĞER İLE BİREBİR EŞLEŞME (Metin olarak)
                                                        isInRange = true;
                                                    } else if (!isNaN(measured)) {
                                                        // 4. SAYISAL KONTROL
                                                        if (!isNaN(min) && !isNaN(max)) {
                                                            isInRange = measured >= min && measured <= max;
                                                        } else if (!isNaN(min)) {
                                                            isInRange = measured >= min;
                                                        } else if (!isNaN(max)) {
                                                            isInRange = measured <= max;
                                                        } else {
                                                            // Sayısal değer var ama limit yoksa ve nominal de eşleşmediyse
                                                            // Eğer nominal değer sayısal ise ve eşitse kabul et
                                                            const nominalNum = normalizeValue(item.nominal_value);
                                                            if (!isNaN(nominalNum) && measured === nominalNum) {
                                                                isInRange = true;
                                                            }
                                                        }
                                                    }


                                                    const statusBadge = item.measured_value ? (
                                                        isInRange ? (
                                                            <Badge variant="success" className="bg-green-500 hover:bg-green-600">Uygun</Badge>
                                                        ) : (
                                                            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">Uygunsuz</Badge>
                                                        )
                                                    ) : (
                                                        <Badge variant="secondary">Ölçülmedi</Badge>
                                                    );

                                                    return (
                                                        <tr key={item.id || idx} className="border-b">
                                                            <td className="p-2">{idx + 1}</td>
                                                            <td className="p-2">{getCharacteristicName(item.characteristic_id)}</td>
                                                            <td className="p-2">{getEquipmentName(item.equipment_id)}</td>
                                                            <td className="p-2">{item.nominal_value || '-'}</td>
                                                            <td className="p-2">{item.min_value || '-'}</td>
                                                            <td className="p-2">{item.max_value || '-'}</td>
                                                            <td className="p-2 font-semibold">{item.measured_value || '-'}</td>
                                                            <td className="p-2 text-center">{statusBadge}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-gray-500">Ölçüm sonucu bulunamadı.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* TAB 3: DOSYALAR */}
                    <TabsContent value="attachments" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ek Dosyalar</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingAttachments ? (
                                    <p className="text-gray-500 text-center py-4">Yükleniyor...</p>
                                ) : attachments.length > 0 ? (
                                    <div className="space-y-2">
                                        {attachments.map((attachment) => (
                                            <div 
                                                key={attachment.id} 
                                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {getFileIcon(attachment.file_type)}
                                                    <div>
                                                        <p className="font-medium text-sm">{attachment.file_name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatFileSize(attachment.file_size)} • {attachment.uploaded_at ? format(new Date(attachment.uploaded_at), 'dd.MM.yyyy HH:mm') : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => handleViewAttachment(attachment)}
                                                    >
                                                        <ExternalLink className="h-4 w-4 mr-1" />
                                                        Görüntüle
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => handleDownloadAttachment(attachment)}
                                                    >
                                                        <Download className="h-4 w-4 mr-1" />
                                                        İndir
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">Bu INKR kaydına henüz dosya eklenmemiş.</p>
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
                                <div>
                                    <Label htmlFor="preparedBy">Hazırlayan</Label>
                                    <Input
                                        id="preparedBy"
                                        placeholder="Ad Soyad"
                                        value={preparedBy}
                                        onChange={(e) => setPreparedBy(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="controlledBy">Kontrol Eden</Label>
                                    <Input
                                        id="controlledBy"
                                        placeholder="Ad Soyad"
                                        value={controlledBy}
                                        onChange={(e) => setControlledBy(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="createdBy">Onaylayan</Label>
                                    <Input
                                        id="createdBy"
                                        placeholder="Ad Soyad"
                                        value={createdBy}
                                        onChange={(e) => setCreatedBy(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                <X className="mr-2 h-4 w-4" /> Kapat
                            </Button>
                            <Button
                                onClick={handleGenerateReport}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <FileDown className="mr-2 h-4 w-4" /> Rapor Al
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default InkrDetailModal;
