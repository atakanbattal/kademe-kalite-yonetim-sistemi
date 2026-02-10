import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Trash2, Edit, History } from 'lucide-react';

const DECISION_TYPES = ['Serbest Bırak', 'Sapma Onayı', 'Yeniden İşlem', 'Hurda', 'İade', 'Onay Bekliyor'];

const QuarantineHistoryModal = ({ isOpen, setIsOpen, record, refreshData }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentEntry, setCurrentEntry] = useState(null);
    const { toast } = useToast();

    const fetchHistory = useCallback(async () => {
        if (!record?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('quarantine_history')
            .select('*')
            .eq('quarantine_record_id', record.id)
            .order('decision_date', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'İşlem geçmişi alınamadı.' });
        } else {
            setHistory(data);
        }
        setLoading(false);
    }, [record, toast]);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    const handleAddNew = () => {
        setCurrentEntry({
            id: null,
            quarantine_record_id: record.id,
            processed_quantity: record.quantity,
            decision: '',
            notes: '',
            decision_date: new Date().toISOString().slice(0, 16),
        });
        setIsEditing(true);
    };

    const handleEdit = (entry) => {
        setCurrentEntry({
            ...entry,
            decision_date: format(new Date(entry.decision_date), "yyyy-MM-dd'T'HH:mm"),
        });
        setIsEditing(true);
    };

    const handleDelete = async (entryId) => {
        const { error } = await supabase.from('quarantine_history').delete().eq('id', entryId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Geçmiş kaydı silinemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'Geçmiş kaydı silindi.' });
            fetchHistory();
            refreshData();
        }
    };

    const handleSave = async () => {
        if (!currentEntry.decision || !currentEntry.processed_quantity) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen karar ve miktar alanlarını doldurun.' });
            return;
        }

        const { id, ...dbData } = currentEntry;
        
        const { error } = id
            ? await supabase.from('quarantine_history').update(dbData).eq('id', id)
            : await supabase.from('quarantine_history').insert(dbData);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `İşlem kaydedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'İşlem başarıyla kaydedildi.' });
            setIsEditing(false);
            setCurrentEntry(null);
            fetchHistory();
            refreshData();
        }
    };

    if (!record) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><History className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">İşlem Geçmişi: {record.part_name}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Kalan Miktar: {record.quantity} {record.unit}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Geçmiş</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    {isEditing ? (
                        <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                            <h3 className="font-semibold">{currentEntry.id ? 'Geçmişi Düzenle' : 'Yeni İşlem Ekle'}</h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div><Label>Karar</Label><Select value={currentEntry.decision} onValueChange={(v) => setCurrentEntry(p => ({ ...p, decision: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DECISION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                                <div><Label>İşlem Miktarı</Label><Input type="number" value={currentEntry.processed_quantity} onChange={(e) => setCurrentEntry(p => ({ ...p, processed_quantity: parseInt(e.target.value) || 0 }))} /></div>
                                <div><Label>İşlem Tarihi</Label><Input type="datetime-local" value={currentEntry.decision_date} onChange={(e) => setCurrentEntry(p => ({ ...p, decision_date: e.target.value }))} /></div>
                            </div>
                            <div><Label>Notlar</Label><Textarea value={currentEntry.notes} onChange={(e) => setCurrentEntry(p => ({ ...p, notes: e.target.value }))} /></div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsEditing(false)}>İptal</Button>
                                <Button onClick={handleSave}>Kaydet</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button onClick={handleAddNew}><PlusCircle className="w-4 h-4 mr-2" /> Yeni İşlem Ekle</Button>
                            </div>
                            {loading ? <p>Yükleniyor...</p> : history.map(entry => (
                                <div key={entry.id} className="p-4 border rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{entry.decision} - <span className="font-bold">{entry.processed_quantity} {record.unit}</span></p>
                                            <p className="text-sm text-muted-foreground">{format(new Date(entry.decision_date), 'dd.MM.yyyy HH:mm')}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}><Edit className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm italic bg-muted p-2 rounded-md">"{entry.notes || 'Not eklenmemiş.'}"</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter className="shrink-0">
                    <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default QuarantineHistoryModal;