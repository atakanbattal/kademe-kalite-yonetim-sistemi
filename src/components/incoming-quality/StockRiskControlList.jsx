import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Search, MoreVertical, Trash2, Eye, Edit, Play, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ListTableShell from '@/components/ui/ListTableShell';
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
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import StockRiskDetailModal from './StockRiskDetailModal';
import StockRiskControlEditModal from './StockRiskControlEditModal';
import { openPrintableReport } from '@/lib/reportUtils';

const StockRiskControlList = () => {
    const { stockRiskControls, loading, refreshData } = useData();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedControl, setSelectedControl] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedStockRiskDetail, setSelectedStockRiskDetail] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEditControl, setSelectedEditControl] = useState(null);

    const filteredControls = useMemo(() => {
        if (!stockRiskControls) return [];
        if (!searchTerm) return stockRiskControls;
        const lowercasedTerm = searchTerm.toLowerCase();
        return stockRiskControls.filter(control =>
            control.part_code?.toLowerCase().includes(lowercasedTerm) ||
            control.part_name?.toLowerCase().includes(lowercasedTerm) ||
            control.supplier?.name?.toLowerCase().includes(lowercasedTerm) ||
            control.source_inspection?.record_no?.toLowerCase().includes(lowercasedTerm) ||
            control.controlled_inspection?.record_no?.toLowerCase().includes(lowercasedTerm)
        );
    }, [stockRiskControls, searchTerm]);

    const getDecisionBadge = (decision) => {
        switch (decision) {
            case 'Uygun': return <Badge variant="success">Uygun</Badge>;
            case 'Uygun Değil': return <Badge variant="destructive">Uygun Değil</Badge>;
            case 'Kontrol Edilemedi': return <Badge className="bg-gray-500">Kontrol Edilemedi</Badge>;
            default: return <Badge variant="secondary">{decision || 'Beklemede'}</Badge>;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Başlatıldı': return <Badge className="bg-blue-500">Başlatıldı</Badge>;
            case 'Devam Ediyor': return <Badge className="bg-yellow-500">Devam Ediyor</Badge>;
            case 'Tamamlandı': return <Badge className="bg-green-500">Tamamlandı</Badge>;
            default: return <Badge variant="secondary">{status || 'Beklemede'}</Badge>;
        }
    };

    const handleEditControl = (control) => {
        setSelectedEditControl(control);
        setIsEditModalOpen(true);
    };

    const handleStartControl = async (control) => {
        const { error } = await supabase
            .from('stock_risk_controls')
            .update({
                status: 'Başlatıldı',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', control.id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Kontrol başlatılamadı: ${error.message}`,
            });
        } else {
            // Güncellenmiş kontrol verisini çek
            const { data: updatedControl, error: fetchError } = await supabase
                .from('stock_risk_controls')
                .select(`
                    *,
                    supplier:suppliers!stock_risk_controls_supplier_id_fkey(id, name),
                    source_inspection:incoming_inspections!stock_risk_controls_source_inspection_id_fkey(id, record_no, part_code, part_name),
                    controlled_inspection:incoming_inspections!stock_risk_controls_controlled_inspection_id_fkey(id, record_no, part_code, part_name),
                    controlled_by:profiles!stock_risk_controls_controlled_by_id_fkey(id, full_name)
                `)
                .eq('id', control.id)
                .single();

            if (fetchError) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: `Kontrol başlatıldı ancak veri yüklenemedi: ${fetchError.message}`,
                });
            } else {
                toast({
                    title: 'Başarılı',
                    description: 'Kontrol başlatıldı. Sonuçları girebilirsiniz.',
                });
                // Kontrol sonuçlarını girebilmek için düzenleme modalını aç
                setSelectedEditControl(updatedControl);
                setIsEditModalOpen(true);
            }
            refreshData();
        }
    };

    const handleCompleteControl = async (control) => {
        const { error } = await supabase
            .from('stock_risk_controls')
            .update({
                status: 'Tamamlandı',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', control.id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Kontrol tamamlanamadı: ${error.message}`,
            });
        } else {
            toast({
                title: 'Başarılı',
                description: 'Kontrol tamamlandı.',
            });
            refreshData();
        }
    };

    const handleDeleteClick = (control) => {
        setSelectedControl(control);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedControl) return;

        const { error } = await supabase
            .from('stock_risk_controls')
            .delete()
            .eq('id', selectedControl.id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Kayıt silinemedi: ${error.message}`,
            });
        } else {
            toast({
                title: 'Başarılı',
                description: 'Stok risk kontrol kaydı başarıyla silindi.',
            });
            refreshData();
        }
        setIsDeleteDialogOpen(false);
        setSelectedControl(null);
    };

    const handleViewRecord = (record) => {
        setSelectedStockRiskDetail(record);
        setIsDetailModalOpen(true);
    };

    const handleDownloadDetailPDF = (enrichedData) => {
        openPrintableReport(enrichedData, 'stock_risk_controls', true);
    };


    return (
        <TooltipProvider delayDuration={200}>
        <>
                <StockRiskDetailModal
                    isOpen={isDetailModalOpen}
                    setIsOpen={setIsDetailModalOpen}
                    record={selectedStockRiskDetail}
                    onDownloadPDF={handleDownloadDetailPDF}
                />
                <StockRiskControlEditModal
                    isOpen={isEditModalOpen}
                    setIsOpen={setIsEditModalOpen}
                    record={selectedEditControl}
                    refreshData={refreshData}
                />
                <div className="dashboard-widget">
            <div className="flex justify-between items-center mb-4">
                <h2 className="widget-title">Stok Risk Kontrol Kayıtları</h2>
                <div className="search-box w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Parça, tedarikçi, kayıt no ara..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ListTableShell noInner>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Parça Adı / Kodu</TableHead>
                            <TableHead>Tedarikçi</TableHead>
                            <TableHead>Kaynak GKK No</TableHead>
                            <TableHead>Kontrol Edilen GKK No</TableHead>
                            <TableHead>İrsaliye No</TableHead>
                            <TableHead>Kontrol Tarihi</TableHead>
                            <TableHead>Kontrol Eden</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Karar</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan="10" className="text-center">Yükleniyor...</TableCell></TableRow>
                        ) : filteredControls.length === 0 ? (
                            <TableRow><TableCell colSpan="10" className="text-center">Kayıt bulunamadı.</TableCell></TableRow>
                        ) : (
                            filteredControls.map((control, index) => (
                                <tr 
                                    key={control.id} 
                                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                                    style={{
                                        opacity: 0,
                                        animation: `fadeIn 0.3s ease-in forwards ${index * 0.05}s`
                                    }}
                                    onClick={(e) => {
                                        // Dropdown menüye tıklanırsa modal açılmasın
                                        if (e.target.closest('[role="menuitem"]') || e.target.closest('button')) {
                                            return;
                                        }
                                        handleViewRecord(control);
                                    }}
                                    title="Detayları görüntülemek için tıklayın"
                                >
                                    <TableCell>
                                        <div className="font-medium">{control.part_name}</div>
                                        <div className="text-sm text-muted-foreground">{control.part_code}</div>
                                    </TableCell>
                                    <TableCell>{control.supplier?.name || '-'}</TableCell>
                                    <TableCell>{control.source_inspection?.record_no}</TableCell>
                                    <TableCell>{control.controlled_inspection?.record_no}</TableCell>
                                    <TableCell>{control.controlled_inspection?.delivery_note_number || '-'}</TableCell>
                                    <TableCell>{control.created_at ? format(new Date(control.created_at), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                    <TableCell>{control.controlled_by?.full_name || '-'}</TableCell>
                                    <TableCell>{getStatusBadge(control.status)}</TableCell>
                                    <TableCell>{getDecisionBadge(control.decision)}</TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="inline-flex items-center justify-end gap-0.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); handleViewRecord(control); }} aria-label="Görüntüle">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">Görüntüle</TooltipContent>
                                            </Tooltip>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()} aria-label="Diğer işlemler">
                                                        <MoreVertical className="h-4 w-4 shrink-0" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem className="text-sm" onClick={(e) => { e.stopPropagation(); handleEditControl(control); }}>
                                                        <Edit className="mr-2 h-4 w-4 shrink-0" />
                                                        Düzenle
                                                    </DropdownMenuItem>
                                                    {(!control.status || control.status === 'Beklemede') && (
                                                        <DropdownMenuItem className="text-sm" onClick={(e) => { e.stopPropagation(); handleStartControl(control); }}>
                                                            <Play className="mr-2 h-4 w-4 shrink-0" />
                                                            Kontrolü Başlat
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(control.status === 'Başlatıldı' || control.status === 'Devam Ediyor') && (
                                                        <DropdownMenuItem className="text-sm" onClick={(e) => { e.stopPropagation(); handleCompleteControl(control); }}>
                                                            <CheckCircle className="mr-2 h-4 w-4 shrink-0" />
                                                            Tamamla
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(control); }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                                                        Sil
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </tr>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ListTableShell>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. Bu, stok risk kontrol kaydını kalıcı olarak sunucularımızdan silecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedControl(null)}>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className={buttonVariants({ variant: "destructive" })}>
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    </>
        </TooltipProvider>
    );
};

export default StockRiskControlList;