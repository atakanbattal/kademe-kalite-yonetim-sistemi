import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InfoCard } from '@/components/ui/InfoCard';
import { FileText, Calendar, Building2, User, DollarSign, AlertTriangle, CheckCircle, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const SupplierNCDetailModal = ({ isOpen, setIsOpen, ncRecord, refreshData }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        if (ncRecord) {
            setFormData({
                title: ncRecord.title || '',
                description: ncRecord.description || '',
                cost_impact: ncRecord.cost_impact || 0,
                responsible_person: ncRecord.responsible_person || '',
            });
            setIsEditMode(false);
        }
    }, [ncRecord]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const { error } = await supabase
            .from('supplier_non_conformities')
            .update(formData)
            .eq('id', ncRecord.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Uygunsuzluk güncellenemedi: ' + error.message });
        } else {
            toast({ title: 'Başarılı!', description: 'Uygunsuzluk başarıyla güncellendi.' });
            refreshData();
            setIsEditMode(false);
        }
        setIsSubmitting(false);
    };

    if (!ncRecord) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                                <AlertTriangle className="h-6 w-6" />
                                Tedarikçi Uygunsuzluğu Detayı
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                Uygunsuzluk kaydına ait tüm bilgiler aşağıda listelenmiştir.
                            </DialogDescription>
                        </div>
                        {ncRecord.status && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {ncRecord.status}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>
                
                <ScrollArea className="max-h-[65vh] pr-4 mt-4">
                    <div className="space-y-6">
                        {/* Önemli Bilgiler */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoCard 
                                icon={Hash} 
                                label="Uygunsuzluk No" 
                                value={ncRecord.nc_number} 
                                variant="primary"
                            />
                            <InfoCard 
                                icon={Calendar} 
                                label="Tarih" 
                                value={ncRecord.created_at ? format(new Date(ncRecord.created_at), 'dd MMMM yyyy', { locale: tr }) : '-'} 
                            />
                            <InfoCard 
                                icon={Building2} 
                                label="Tedarikçi" 
                                value={ncRecord.supplier?.name || '-'} 
                                variant="warning"
                            />
                        </div>

                        <Separator />

                        {/* Genel Bilgiler */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Genel Bilgiler
                            </h3>
                            {isEditMode ? (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <Label htmlFor="title">Başlık <span className="text-red-500">*</span></Label>
                                        <Input id="title" value={formData.title} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="description">Açıklama / Problem Tanımı <span className="text-red-500">*</span></Label>
                                        <Textarea id="description" value={formData.description} onChange={handleInputChange} required rows={6} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="cost_impact">Maliyet Etkisi (₺)</Label>
                                            <Input id="cost_impact" type="number" value={formData.cost_impact} onChange={handleInputChange} />
                                        </div>
                                        <div>
                                            <Label htmlFor="responsible_person">Sorumlu Kişi</Label>
                                            <Input id="responsible_person" value={formData.responsible_person} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => setIsEditMode(false)}>
                                            İptal
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoCard icon={FileText} label="Başlık" value={ncRecord.title} />
                                    {ncRecord.cost_impact && (
                                        <InfoCard 
                                            icon={DollarSign} 
                                            label="Maliyet Etkisi" 
                                            value={`${parseFloat(ncRecord.cost_impact || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`}
                                            variant="warning"
                                        />
                                    )}
                                    {ncRecord.responsible_person && (
                                        <InfoCard icon={User} label="Sorumlu Kişi" value={ncRecord.responsible_person} />
                                    )}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Açıklama */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Açıklama / Problem Tanımı
                            </h3>
                            <Card>
                                <CardContent className="p-6">
                                    {isEditMode ? (
                                        <Textarea 
                                            id="description" 
                                            value={formData.description} 
                                            onChange={handleInputChange} 
                                            required 
                                            rows={6}
                                            className="w-full"
                                        />
                                    ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{ncRecord.description || '-'}</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-6">
                    {!isEditMode && (
                        <Button variant="outline" onClick={() => setIsEditMode(true)}>
                            Düzenle
                        </Button>
                    )}
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" size="lg">Kapat</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierNCDetailModal;
