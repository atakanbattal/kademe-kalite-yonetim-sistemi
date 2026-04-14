import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreVertical, Edit, Trash2, FileText, Search, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CheckCircle2, XCircle } from 'lucide-react';

const BalanceRecordsList = ({ records, loading, onEdit, onView, onDelete, onDownloadPDF }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    const getResultBadge = (result) => {
        if (result === 'PASS') {
            return <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PASS
            </Badge>;
        } else if (result === 'FAIL') {
            return <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" /> FAIL
            </Badge>;
        }
        return <Badge variant="secondary">-</Badge>;
    };

    const filteredRecords = records.filter(record => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            record.serial_number?.toLowerCase().includes(term) ||
            record.supplier_name?.toLowerCase().includes(term) ||
            record.test_operator?.toLowerCase().includes(term) ||
            record.overall_result?.toLowerCase().includes(term) ||
            record.fan_products?.product_code?.toLowerCase().includes(term) ||
            record.fan_products?.product_name?.toLowerCase().includes(term)
        );
    });

    const handleDeleteClick = (record) => {
        setRecordToDelete(record);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!recordToDelete) return;

        try {
            const { error } = await supabase
                .from('fan_balance_records')
                .delete()
                .eq('id', recordToDelete.id);

            if (error) throw error;

            toast({
                title: "Başarılı!",
                description: "Balans kaydı silindi."
            });

            setDeleteDialogOpen(false);
            setRecordToDelete(null);
            if (onDelete) onDelete();
        } catch (error) {
            console.error('Silme hatası:', error);
            toast({
                variant: "destructive",
                title: "Hata!",
                description: error.message || "Kayıt silinirken bir hata oluştu."
            });
        }
    };

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>;
    }

    if (records.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Henüz balans kaydı bulunmamaktadır.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Arama */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Seri no, ürün, tedarikçi, operatör veya sonuç ile ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="!pl-10"
                    />
                </div>
            </div>

            {/* Tablo */}
            <TooltipProvider delayDuration={250}>
            <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="data-table data-table-wide-actions">
                    <thead>
                        <tr>
                            <th>Seri No</th>
                            <th>Ürün Tanımı</th>
                            <th>Test Tarihi</th>
                            <th>Tedarikçi</th>
                            <th>Ağırlık (kg)</th>
                            <th>Devir (RPM)</th>
                            <th>Kalite Sınıfı</th>
                            <th>Sol Düzlem</th>
                            <th>Sağ Düzlem</th>
                            <th>Genel Sonuç</th>
                            <th className="text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan="11" className="text-center py-10 text-muted-foreground">
                                    Arama kriterlerine uygun kayıt bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            filteredRecords.map((record, index) => (
                                <motion.tr
                                    key={record.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-secondary/50 cursor-pointer"
                                    onClick={(e) => {
                                        if (e.target.closest('[role="menuitem"]') || e.target.closest('button')) return;
                                        onView?.(record);
                                    }}
                                >
                                    <td className="font-medium">{record.serial_number}</td>
                                    <td>
                                        {record.fan_products ? (
                                            <span className="text-sm">
                                                {record.fan_products.product_code} - {record.fan_products.product_name}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td>
                                        {record.test_date
                                            ? format(new Date(record.test_date), 'dd.MM.yyyy', { locale: tr })
                                            : '-'}
                                    </td>
                                    <td>{record.supplier_name || '-'}</td>
                                    <td>{record.fan_weight_kg ? record.fan_weight_kg.toFixed(3) : '-'}</td>
                                    <td>{record.operating_rpm || '-'}</td>
                                    <td>
                                        <Badge variant="outline">{record.balancing_grade}</Badge>
                                    </td>
                                    <td>
                                        {record.left_plane_result ? (
                                            getResultBadge(record.left_plane_result)
                                        ) : (
                                            <Badge variant="secondary">-</Badge>
                                        )}
                                    </td>
                                    <td>
                                        {record.right_plane_result ? (
                                            getResultBadge(record.right_plane_result)
                                        ) : (
                                            <Badge variant="secondary">-</Badge>
                                        )}
                                    </td>
                                    <td>
                                        {record.overall_result ? (
                                            getResultBadge(record.overall_result)
                                        ) : (
                                            <Badge variant="secondary">-</Badge>
                                        )}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()} className="align-middle">
                                        <div className="inline-flex items-center justify-end gap-0.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Görüntüle" onClick={() => onView?.(record)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">Görüntüle</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Rapor al" onClick={() => onDownloadPDF(record)}>
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">Rapor al</TooltipContent>
                                            </Tooltip>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Diğer işlemler">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem className="text-sm" onClick={() => onEdit(record)}>
                                                        <Edit className="w-4 h-4 mr-2 shrink-0" />
                                                        Düzenle
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                                        onClick={() => handleDeleteClick(record)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2 shrink-0" />
                                                        Sil
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            </div>
            </TooltipProvider>

            {/* Silme Onay Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı Silmek İstediğinize Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. "{recordToDelete?.serial_number}" seri numaralı balans kaydı kalıcı olarak silinecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default BalanceRecordsList;


