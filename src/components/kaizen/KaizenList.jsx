import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Eye, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { utils, writeFile } from 'xlsx';

const KaizenList = ({ type, data, loading, onEdit, onDelete, onAdd, onView }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = data.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.kaizen_no && item.kaizen_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.proposer?.full_name && item.proposer.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleDelete = async (id) => {
        const { error } = await supabase.from('kaizen_entries').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Kaizen silinemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'Kaizen başarıyla silindi.' });
            onDelete();
        }
    };

    const handleExport = () => {
        const worksheetData = filteredData.map(item => ({
            'Kaizen No': item.kaizen_no,
            'Başlık': item.title,
            'Öneri Sahibi': item.proposer?.full_name,
            'Sorumlu Kişi': item.responsible_person?.full_name,
            'Departman': item.department?.unit_name,
            'Başlangıç Tarihi': item.start_date ? format(new Date(item.start_date), 'dd.MM.yyyy') : '',
            'Bitiş Tarihi': item.end_date ? format(new Date(item.end_date), 'dd.MM.yyyy') : '',
            'Durum': item.status,
            'Aylık Kazanç (₺)': item.total_monthly_gain,
            'Yıllık Kazanç (₺)': item.total_yearly_gain,
        }));
        const worksheet = utils.json_to_sheet(worksheetData);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Kaizen Listesi');
        writeFile(workbook, `Kaizen_Listesi_${type}_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': case 'Standartlaştırıldı': case 'Kapandı': return 'success';
            case 'Reddedildi': return 'destructive';
            case 'İncelemede': case 'Uygulamada': return 'warning';
            default: return 'secondary';
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="p-4 border rounded-lg bg-card"
        >
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                <h3 className="text-lg font-semibold">{type === 'vehicle_based' ? 'Araç Bazlı Kaizen Listesi' : 'Genel Kaizen Listesi'}</h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Button onClick={handleExport} variant="outline" size="sm" className="flex-shrink-0"><FileDown className="mr-2 h-4 w-4" /> Dışa Aktar</Button>
                    <Button onClick={onAdd} className="flex-shrink-0"><Plus className="mr-2 h-4 w-4" /> Yeni</Button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Kaizen No</th>
                            <th>Başlık</th>
                            <th>Öneri Sahibi</th>
                            <th>Sorumlu</th>
                            <th>Yıllık Kazanç</th>
                            <th>Tarih</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="text-center">Yükleniyor...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan="8" className="text-center">Kayıt bulunamadı.</td></tr>
                        ) : (
                            filteredData.map(item => (
                                <tr key={item.id} className="hover:bg-muted/50">
                                    <td onClick={() => onView(item)} className="cursor-pointer text-primary font-semibold">{item.kaizen_no}</td>
                                    <td onClick={() => onView(item)} className="cursor-pointer font-medium">{item.title}</td>
                                    <td>{item.proposer?.full_name || '-'}</td>
                                    <td>{item.responsible_person?.full_name || '-'}</td>
                                    <td className="font-semibold text-green-600">{(item.total_yearly_gain || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td>
                                    <td>{format(new Date(item.created_at), 'dd.MM.yyyy')}</td>
                                    <td><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge></td>
                                    <td className="flex gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => onView(item)}><Eye className="w-4 h-4" /></Button>
                                        <Button size="icon" variant="ghost" onClick={() => onEdit(item)}><Edit className="w-4 h-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Emin misiniz?</AlertDialogTitle><AlertDialogDescription>"{item.title}" başlıklı Kaizen kaydını kalıcı olarak sileceksiniz.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)}>Sil</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

export default KaizenList;