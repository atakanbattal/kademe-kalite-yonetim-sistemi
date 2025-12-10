import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';

const StockRiskControlEditModal = ({ isOpen, setIsOpen, record, refreshData }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState(record?.status || 'Beklemede');
    const [results, setResults] = useState([]);
    const [decision, setDecision] = useState(record?.decision || 'Beklemede');
    const [notes, setNotes] = useState(record?.notes || '');

    useEffect(() => {
        if (isOpen && record) {
            setStatus(record.status || 'Beklemede');
            setDecision(record.decision || 'Beklemede');
            setNotes(record.notes || '');
            // Results'ı yükle veya varsayılan değer oluştur
            if (record.results && Array.isArray(record.results) && record.results.length > 0) {
                setResults(record.results);
            } else {
                setResults([{
                    measurement_type: 'Görsel Kontrol',
                    result: null,
                    value: '',
                    notes: ''
                }]);
            }
        }
    }, [isOpen, record]);

    const handleResultChange = (index, field, value) => {
        const newResults = [...results];
        newResults[index][field] = value;
        setResults(newResults);
    };

    const handleAddResult = () => {
        setResults([...results, {
            measurement_type: 'Görsel Kontrol',
            result: null,
            value: '',
            notes: ''
        }]);
    };

    const handleRemoveResult = (index) => {
        if (results.length > 1) {
            const newResults = results.filter((_, i) => i !== index);
            setResults(newResults);
        }
    };

    const handleStartControl = async () => {
        setIsSubmitting(true);
        
        const updateData = {
            status: 'Başlatıldı',
            started_at: new Date().toISOString(),
            controlled_by_id: user.id,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('stock_risk_controls')
            .update(updateData)
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kontrol başlatılamadı: ${error.message}` });
        } else {
            toast({ title: 'Başarılı', description: 'Kontrol başlatıldı.' });
            refreshData();
            setIsOpen(false);
        }

        setIsSubmitting(false);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        
        const updateData = {
            status: status,
            results: results,
            decision: decision,
            notes: notes,
            controlled_by_id: user.id,
            updated_at: new Date().toISOString()
        };

        // Eğer tamamlandıysa tamamlanma tarihini ekle
        if (status === 'Tamamlandı' && !record.completed_at) {
            updateData.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('stock_risk_controls')
            .update(updateData)
            .eq('id', record.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kayıt güncellenemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı', description: 'Kontrol kaydı başarıyla güncellendi.' });
            refreshData();
            setIsOpen(false);
        }

        setIsSubmitting(false);
    };

    if (!record) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Stok Risk Kontrolü Düzenle</DialogTitle>
                    <DialogDescription>
                        Parça: {record.part_name} ({record.part_code}) • Kayıt No: {record.id?.slice(0, 8)}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] p-4">
                    <div className="space-y-6">
                        {/* Durum */}
                        <div>
                            <Label>Kontrol Durumu</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Beklemede">Beklemede</SelectItem>
                                    <SelectItem value="Başlatıldı">Başlatıldı</SelectItem>
                                    <SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem>
                                    <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Kontrol Sonuçları */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <Label>Kontrol Sonuçları</Label>
                                <Button variant="outline" size="sm" onClick={handleAddResult}>
                                    <Plus className="h-4 w-4 mr-2" /> Sonuç Ekle
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {results.map((result, index) => (
                                    <div key={index} className="p-4 border rounded-lg space-y-3">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-sm font-semibold">Sonuç {index + 1}</Label>
                                            {results.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveResult(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <Label>Muayene Türü</Label>
                                                <Select
                                                    value={result.measurement_type || ''}
                                                    onValueChange={(v) => handleResultChange(index, 'measurement_type', v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seçin..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Görsel Kontrol">Görsel Kontrol</SelectItem>
                                                        <SelectItem value="Boyutsal Ölçüm">Boyutsal Ölçüm</SelectItem>
                                                        <SelectItem value="Laboratuvar Testi">Laboratuvar Testi</SelectItem>
                                                        <SelectItem value="Fonksiyonel Test">Fonksiyonel Test</SelectItem>
                                                        <SelectItem value="Diğer">Diğer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Sonuç</Label>
                                                <Select
                                                    value={result.result || ''}
                                                    onValueChange={(v) => handleResultChange(index, 'result', v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Sonuç seçin..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Uygun">Uygun</SelectItem>
                                                        <SelectItem value="Uygun Değil">Uygun Değil</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Ölçüm Değeri</Label>
                                                <Input
                                                    value={result.value || ''}
                                                    onChange={(e) => handleResultChange(index, 'value', e.target.value)}
                                                    placeholder="Sayısal veri (opsiyonel)"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Gözlemler</Label>
                                            <Textarea
                                                value={result.notes || ''}
                                                onChange={(e) => handleResultChange(index, 'notes', e.target.value)}
                                                placeholder="Gözlemlerinizi yazın..."
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Genel Karar */}
                        <div>
                            <Label>Genel Karar</Label>
                            <Select value={decision} onValueChange={setDecision}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Beklemede">Beklemede</SelectItem>
                                    <SelectItem value="Uygun">Uygun</SelectItem>
                                    <SelectItem value="Uygun Değil">Uygun Değil</SelectItem>
                                    <SelectItem value="Revizyon Gerekli">Revizyon Gerekli</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Notlar */}
                        <div>
                            <Label>Genel Notlar</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Genel notlarınızı yazın..."
                                rows={4}
                            />
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        İptal
                    </Button>
                    {status === 'Beklemede' && (
                        <Button onClick={handleStartControl} disabled={isSubmitting}>
                            {isSubmitting ? 'Başlatılıyor...' : 'Kontrolü Başlat'}
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default StockRiskControlEditModal;

