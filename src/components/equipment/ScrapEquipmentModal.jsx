import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Upload, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ScrapEquipmentModal = ({ isOpen, setIsOpen, equipment, onSuccess }) => {
    const { toast } = useToast();
    const { profile } = useAuth();
    const [scrapReason, setScrapReason] = useState('');
    const [scrapDate, setScrapDate] = useState(new Date().toISOString().split('T')[0]);
    const [scrapDocument, setScrapDocument] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Sadece PDF dosyası yükleyebilirsiniz.'
                });
                return;
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Dosya boyutu 10MB\'dan küçük olmalıdır.'
                });
                return;
            }
            setScrapDocument(file);
        }
    };

    const handleRemoveFile = () => {
        setScrapDocument(null);
    };

    const handleSubmit = async () => {
        if (!scrapReason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen hurdaya ayırma sebebini giriniz.'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            let documentPath = null;

            // PDF yükleme
            if (scrapDocument) {
                setIsUploading(true);
                const fileName = `scrap_${equipment.id}_${Date.now()}.pdf`;
                // Önce equipment_documents bucket'ını dene, yoksa documents bucket'ını kullan
                let uploadData, uploadError;
                ({ data: uploadData, error: uploadError } = await supabase.storage
                    .from('equipment_documents')
                    .upload(fileName, scrapDocument, {
                        contentType: 'application/pdf',
                        upsert: false
                    }));
                
                // Eğer bucket yoksa calibration_certificates bucket'ını kullan (mevcut bucket)
                if (uploadError && (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found'))) {
                    ({ data: uploadData, error: uploadError } = await supabase.storage
                        .from('calibration_certificates')
                        .upload(`scrap/${fileName}`, scrapDocument, {
                            contentType: 'application/pdf',
                            upsert: false
                        }));
                }

                if (uploadError) {
                    throw new Error(`PDF yükleme hatası: ${uploadError.message}`);
                }

                documentPath = uploadData.path;
                setIsUploading(false);
            }

            // Ekipmanı hurdaya ayır
            const { error: updateError } = await supabase
                .from('equipments')
                .update({
                    status: 'Hurdaya Ayrıldı',
                    scrap_date: scrapDate,
                    scrap_reason: scrapReason,
                    scrap_document_path: documentPath
                })
                .eq('id', equipment.id);

            if (updateError) {
                throw updateError;
            }

            // Aktif kalibrasyon kayıtlarını pasif yap (silme, sadece pasif yap)
            const { error: calibrationError } = await supabase
                .from('equipment_calibrations')
                .update({ is_active: false })
                .eq('equipment_id', equipment.id)
                .eq('is_active', true);

            if (calibrationError) {
                console.error('Kalibrasyon güncelleme hatası:', calibrationError);
                // Kritik değil, devam et
            }

            toast({
                title: 'Başarılı',
                description: 'Ekipman başarıyla hurdaya ayrıldı ve kalibrasyondan düşürüldü.'
            });

            // Formu temizle
            setScrapReason('');
            setScrapDate(new Date().toISOString().split('T')[0]);
            setScrapDocument(null);
            setIsOpen(false);
            onSuccess();
        } catch (error) {
            console.error('Hurdaya ayırma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Hurdaya ayırma işlemi başarısız: ${error.message}`
            });
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting && !isUploading) {
            setScrapReason('');
            setScrapDate(new Date().toISOString().split('T')[0]);
            setScrapDocument(null);
            setIsOpen(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>Ekipmanı Hurdaya Ayır</DialogTitle>
                    <DialogDescription>
                        {equipment?.name} ({equipment?.serial_number}) ekipmanını hurdaya ayırıyorsunuz.
                        Bu işlem geri alınamaz ve ekipman kalibrasyondan düşecektir.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Hurdaya Ayırma Tarihi */}
                    <div className="space-y-2">
                        <Label htmlFor="scrapDate">Hurdaya Ayırma Tarihi *</Label>
                        <Input
                            id="scrapDate"
                            type="date"
                            value={scrapDate}
                            onChange={(e) => setScrapDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Sebep */}
                    <div className="space-y-2">
                        <Label htmlFor="scrapReason">Hurdaya Ayırma Sebebi *</Label>
                        <Textarea
                            id="scrapReason"
                            value={scrapReason}
                            onChange={(e) => setScrapReason(e.target.value)}
                            placeholder="Ekipmanın neden hurdaya ayrıldığını detaylı olarak açıklayınız..."
                            rows={4}
                            required
                        />
                    </div>

                    {/* PDF Yükleme */}
                    <div className="space-y-2">
                        <Label htmlFor="scrapDocument">Hurdaya Ayırma Tutanağı (PDF)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="scrapDocument"
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="flex-1"
                                disabled={isUploading || isSubmitting}
                            />
                        </div>
                        {scrapDocument && (
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-foreground">{scrapDocument.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        ({(scrapDocument.size / 1024 / 1024).toFixed(2)} MB)
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveFile}
                                    disabled={isUploading || isSubmitting}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Maksimum dosya boyutu: 10MB. Sadece PDF formatı kabul edilir.
                        </p>
                    </div>

                    {/* Uyarı */}
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive font-semibold">⚠️ Uyarı</p>
                        <p className="text-xs text-destructive/80 mt-1">
                            Bu işlem sonrasında ekipman "Hurdaya Ayrıldı" durumuna geçecek ve tüm aktif kalibrasyon kayıtları pasif hale getirilecektir.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting || isUploading}
                    >
                        İptal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploading || !scrapReason.trim()}
                        variant="destructive"
                    >
                        {isUploading ? 'Yükleniyor...' : isSubmitting ? 'İşleniyor...' : 'Hurdaya Ayır'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ScrapEquipmentModal;

