import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Award, Star, Shield, Eye, AlertOctagon, Check } from 'lucide-react';

const gradeOptions = [
    { 
        value: 'A', 
        label: 'A Sınıfı', 
        description: 'Stratejik İş Ortağı', 
        color: 'bg-green-500 hover:bg-green-600', 
        icon: Star,
        criteria: 'Mükemmel kalite, zamanında teslimat, güvenilir iş ortağı',
        resultStatus: 'Onaylı',
        statusColor: 'text-green-600'
    },
    { 
        value: 'B', 
        label: 'B Sınıfı', 
        description: 'Güvenilir Tedarikçi', 
        color: 'bg-blue-500 hover:bg-blue-600', 
        icon: Shield,
        criteria: 'İyi performans, kabul edilebilir kalite standartları',
        resultStatus: 'Onaylı',
        statusColor: 'text-green-600'
    },
    { 
        value: 'C', 
        label: 'C Sınıfı', 
        description: 'İzlemeye Alınacak', 
        color: 'bg-yellow-500 hover:bg-yellow-600', 
        icon: Eye,
        criteria: 'Geliştirilmesi gereken alanlar var, yakın takip gerekli',
        resultStatus: 'Askıya Alınmış',
        statusColor: 'text-yellow-600'
    },
    { 
        value: 'D', 
        label: 'D Sınıfı', 
        description: 'İş Birliği Sonlandırılacak', 
        color: 'bg-red-500 hover:bg-red-600', 
        icon: AlertOctagon,
        criteria: 'Ciddi performans sorunları, alternatif aranmalı',
        resultStatus: 'Red',
        statusColor: 'text-red-600'
    },
];

const SupplierGradeModal = ({ isOpen, setIsOpen, supplier, refreshSuppliers }) => {
    const { toast } = useToast();
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && supplier) {
            setSelectedGrade(supplier.supplier_grade || null);
            setReason(supplier.grade_reason || '');
        }
    }, [isOpen, supplier]);

    const handleSave = async () => {
        if (!selectedGrade) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen bir sınıf seçin.'
            });
            return;
        }

        if (!reason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen sınıf belirleme gerekçesini yazın.'
            });
            return;
        }

        setIsSubmitting(true);

        // Sınıfa göre durumu belirle
        const getStatusForGrade = (grade) => {
            switch (grade) {
                case 'A':
                case 'B':
                    return 'Onaylı'; // A ve B sınıfı tedarikçiler onaylı
                case 'C':
                    return 'Askıya Alınmış'; // C sınıfı izlemeye alınacak
                case 'D':
                    return 'Red'; // D sınıfı iş birliği sonlandırılacak
                default:
                    return supplier.status; // Değişiklik yok
            }
        };

        const newStatus = getStatusForGrade(selectedGrade);
        const statusChanged = newStatus !== supplier.status;

        const { error } = await supabase
            .from('suppliers')
            .update({
                supplier_grade: selectedGrade,
                grade_reason: reason.trim(),
                grade_updated_at: new Date().toISOString(),
                status: newStatus // Durumu da güncelle
            })
            .eq('id', supplier.id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Sınıf kaydedilemedi: ' + error.message
            });
        } else {
            let message = `${supplier.name} için ${selectedGrade} sınıfı belirlendi.`;
            if (statusChanged) {
                message += ` Durum "${newStatus}" olarak güncellendi.`;
            }
            toast({
                title: 'Başarılı',
                description: message
            });
            refreshSuppliers();
            setIsOpen(false);
        }

        setIsSubmitting(false);
    };

    const handleClearGrade = async () => {
        setIsSubmitting(true);

        const { error } = await supabase
            .from('suppliers')
            .update({
                supplier_grade: null,
                grade_reason: null,
                grade_updated_at: null
            })
            .eq('id', supplier.id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Sınıf temizlenemedi: ' + error.message
            });
        } else {
            toast({
                title: 'Başarılı',
                description: 'Manuel sınıf kaldırıldı, otomatik değerlendirme kullanılacak.'
            });
            refreshSuppliers();
            setIsOpen(false);
        }

        setIsSubmitting(false);
    };

    if (!supplier) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        Tedarikçi Sınıfı Belirle
                    </DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold text-foreground">{supplier.name}</span> için manuel tedarikçi sınıfı belirleyin.
                        Bu değerlendirme otomatik hesaplamayı geçersiz kılar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Mevcut Sınıf Bilgisi */}
                    {supplier.supplier_grade && (
                        <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Mevcut Manuel Sınıf:</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className={`${gradeOptions.find(g => g.value === supplier.supplier_grade)?.color || 'bg-gray-500'} text-white`}>
                                    {supplier.supplier_grade}
                                </Badge>
                                <span className="text-sm">{gradeOptions.find(g => g.value === supplier.supplier_grade)?.description}</span>
                            </div>
                            {supplier.grade_reason && (
                                <p className="text-xs text-muted-foreground mt-2">Gerekçe: {supplier.grade_reason}</p>
                            )}
                            {supplier.grade_updated_at && (
                                <p className="text-xs text-muted-foreground">
                                    Tarih: {new Date(supplier.grade_updated_at).toLocaleDateString('tr-TR')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Sınıf Seçimi */}
                    <div>
                        <Label className="mb-3 block">Tedarikçi Sınıfını Seçin</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {gradeOptions.map((opt) => {
                                const Icon = opt.icon;
                                const isSelected = selectedGrade === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setSelectedGrade(opt.value)}
                                        className={`
                                            relative p-4 rounded-lg border-2 transition-all text-left
                                            ${isSelected 
                                                ? 'border-primary bg-primary/10' 
                                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                            }
                                        `}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-2 right-2">
                                                <Check className="h-4 w-4 text-primary" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge className={`${opt.color} text-white`}>{opt.value}</Badge>
                                            <span className="font-semibold">{opt.label}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{opt.description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{opt.criteria}</p>
                                        <p className={`text-xs font-medium mt-2 ${opt.statusColor}`}>
                                            → Durum: {opt.resultStatus}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Gerekçe */}
                    <div>
                        <Label htmlFor="grade_reason">
                            Gerekçe / Açıklama <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="grade_reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Neden bu sınıfı seçtiğinizi açıklayın... (örn: Geçmiş performans değerlendirmesi, müşteri geri bildirimleri, kalite raporları vb.)"
                            rows={3}
                            className="mt-2"
                        />
                    </div>
                </div>

                <DialogFooter className="flex justify-between">
                    <div>
                        {supplier.supplier_grade && (
                            <Button 
                                variant="outline" 
                                onClick={handleClearGrade}
                                disabled={isSubmitting}
                                className="text-muted-foreground"
                            >
                                Manuel Sınıfı Kaldır
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !selectedGrade}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Sınıfı Kaydet'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierGradeModal;
