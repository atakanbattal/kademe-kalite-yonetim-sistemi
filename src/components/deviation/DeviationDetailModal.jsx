import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { Printer, Loader2, Hourglass, CheckCircle, XCircle, FileText, Truck, Download, Package, AlertTriangle, DollarSign, Link2 } from 'lucide-react';
import { openPrintableReport } from '@/lib/reportUtils';
import { Card, CardContent } from '@/components/ui/card';

const DeviationDetailModal = ({ isOpen, setIsOpen, deviation }) => {
    const [isPrinting, setIsPrinting] = useState(false);

    if (!deviation) return null;

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'destructive';
            case 'Onay Bekliyor': return 'warning';
            case 'Açık': return 'secondary';
            default: return 'outline';
        }
    };

    const getApprovalStatusIcon = (status) => {
        switch (status) {
            case 'Onaylandı': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'Reddedildi': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'Beklemede': return <Hourglass className="w-5 h-5 text-yellow-500" />;
            default: return null;
        }
    };

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            await openPrintableReport(deviation, 'deviation', true);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadAttachment = async (filePath) => {
        const { data, error } = await supabase.storage.from('deviation_attachments').createSignedUrl(filePath, 60);
        if (error) {
            console.error('Error getting signed URL:', error);
            return;
        }
        window.open(data.signedUrl, '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl">Sapma Detayı</DialogTitle>
                            <DialogDescription>Talep No: {deviation.request_no}</DialogDescription>
                        </div>
                        <Badge variant={getStatusVariant(deviation.status)} className="text-sm">{deviation.status}</Badge>
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] p-1">
                    {/* Kaynak Kayıt Bilgisi */}
                    {deviation.source_type && deviation.source_type !== 'manual' && (
                        <Card className="mb-4 border-2 border-primary">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Link2 className="h-5 w-5 text-primary" />
                                    <span className="font-semibold text-primary">Kaynak Kayıt Bilgisi</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    {deviation.source_type === 'incoming_inspection' && (
                                        <Package className="h-5 w-5 text-blue-500 mt-1" />
                                    )}
                                    {deviation.source_type === 'quarantine' && (
                                        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-1" />
                                    )}
                                    {deviation.source_type === 'quality_cost' && (
                                        <DollarSign className="h-5 w-5 text-green-500 mt-1" />
                                    )}
                                    <div className="flex-1">
                                        <Badge variant="outline" className="mb-2">
                                            {deviation.source_type === 'incoming_inspection' && 'Girdi Kalite Kontrol'}
                                            {deviation.source_type === 'quarantine' && 'Karantina'}
                                            {deviation.source_type === 'quality_cost' && 'Kalitesizlik Maliyeti'}
                                        </Badge>
                                        {deviation.source_record_details && (
                                            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                                {deviation.source_record_details.part_code && (
                                                    <div>
                                                        <span className="text-muted-foreground">Parça Kodu:</span>
                                                        <span className="ml-2 font-medium">{deviation.source_record_details.part_code}</span>
                                                    </div>
                                                )}
                                                {deviation.source_record_details.quantity && (
                                                    <div>
                                                        <span className="text-muted-foreground">Miktar:</span>
                                                        <span className="ml-2 font-medium">{deviation.source_record_details.quantity}</span>
                                                    </div>
                                                )}
                                                {deviation.source_record_details.supplier && (
                                                    <div className="col-span-2">
                                                        <span className="text-muted-foreground">Tedarikçi:</span>
                                                        <span className="ml-2 font-medium">{deviation.source_record_details.supplier}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                        <div><p className="text-sm text-muted-foreground">Parça Kodu</p><p className="font-semibold">{deviation.part_code || '-'}</p></div>
                        <div><p className="text-sm text-muted-foreground">Kaynak</p><p className="font-semibold">{deviation.source || '-'}</p></div>
                        <div><p className="text-sm text-muted-foreground">Talep Eden Birim</p><p className="font-semibold">{deviation.requesting_unit || '-'}</p></div>
                        <div><p className="text-sm text-muted-foreground">Talep Eden Kişi</p><p className="font-semibold">{deviation.requesting_person || '-'}</p></div>
                        <div className="col-span-2"><p className="text-sm text-muted-foreground">Oluşturma Tarihi</p><p className="font-semibold">{format(new Date(deviation.created_at), 'dd.MM.yyyy HH:mm')}</p></div>
                        <div className="col-span-full"><p className="text-sm text-muted-foreground">Açıklama</p><p className="font-semibold whitespace-pre-wrap">{deviation.description || '-'}</p></div>
                    </div>

                    <Tabs defaultValue="approvals" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="approvals">Onay Süreci</TabsTrigger>
                            <TabsTrigger value="vehicles">İlgili Araçlar</TabsTrigger>
                            <TabsTrigger value="attachments">Ekler</TabsTrigger>
                        </TabsList>
                        <TabsContent value="approvals" className="p-4">
                            <div className="space-y-4">
                                {deviation.deviation_approvals && deviation.deviation_approvals.length > 0 ? deviation.deviation_approvals.map(approval => (
                                    <div key={approval.id} className="flex items-start gap-4 p-3 border rounded-lg">
                                        <div className="flex-shrink-0">{getApprovalStatusIcon(approval.status)}</div>
                                        <div className="flex-grow">
                                            <p className="font-semibold">{approval.approval_stage}</p>
                                            <p className="text-sm text-muted-foreground">Onaylayan: {approval.approver_name || 'Bekleniyor'}</p>
                                            <p className="text-sm text-muted-foreground italic">"{approval.notes || 'Yorum yok.'}"</p>
                                            <p className="text-xs text-muted-foreground mt-1">{format(new Date(approval.created_at), 'dd.MM.yyyy HH:mm')}</p>
                                        </div>
                                    </div>
                                )) : <p className="text-center text-muted-foreground">Onay kaydı bulunamadı.</p>}
                            </div>
                        </TabsContent>
                        <TabsContent value="vehicles" className="p-4">
                             <div className="space-y-2">
                                {deviation.deviation_vehicles && deviation.deviation_vehicles.length > 0 ? deviation.deviation_vehicles.map(vehicle => (
                                    <div key={vehicle.id} className="grid grid-cols-3 items-center gap-3 p-2 border rounded-md">
                                        <div className="flex items-center gap-2">
                                            <Truck className="w-5 h-5 text-primary" />
                                            <span className="font-semibold">{deviation.vehicle_type || 'Bilinmiyor'}</span>
                                        </div>
                                        <p className="font-mono text-sm">{vehicle.chassis_no || vehicle.vehicle_serial_no}</p>
                                        <p className="text-sm text-muted-foreground ml-auto">{vehicle.customer_name}</p>
                                    </div>
                                )) : <p className="text-center text-muted-foreground">İlgili araç kaydı bulunamadı.</p>}
                            </div>
                        </TabsContent>
                        <TabsContent value="attachments" className="p-4">
                            <div className="space-y-2">
                                {deviation.deviation_attachments && deviation.deviation_attachments.length > 0 ? deviation.deviation_attachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between p-2 border rounded-md">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-muted-foreground" />
                                            <span className="text-sm font-medium">{att.file_name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDownloadAttachment(att.file_path)}>
                                            <Download className="w-5 h-5" />
                                        </Button>
                                    </div>
                                )) : <p className="text-center text-muted-foreground">Ekli dosya bulunmuyor.</p>}
                            </div>
                        </TabsContent>
                    </Tabs>
                </ScrollArea>
                <DialogFooter className="p-4 border-t">
                    <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                        {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        Yazdır / PDF
                    </Button>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DeviationDetailModal;