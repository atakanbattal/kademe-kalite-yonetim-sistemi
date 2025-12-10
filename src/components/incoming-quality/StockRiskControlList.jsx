import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Search, MoreHorizontal, Trash2, Eye, Edit, Play, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            toast({
                title: 'Başarılı',
                description: 'Kontrol başlatıldı.',
            });
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
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Parça, tedarikçi, kayıt no ara..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Parça Adı / Kodu</TableHead>
                            <TableHead>Tedarikçi</TableHead>
                            <TableHead>Kaynak GKK No</TableHead>
                            <TableHead>Kontrol Edilen GKK No</TableHead>
                            <TableHead>Kontrol Tarihi</TableHead>
                            <TableHead>Kontrol Eden</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Karar</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan="9" className="text-center">Yükleniyor...</TableCell></TableRow>
                        ) : filteredControls.length === 0 ? (
                            <TableRow><TableCell colSpan="9" className="text-center">Kayıt bulunamadı.</TableCell></TableRow>
                        ) : (
                            filteredControls.map((control, index) => (
                                <tr 
                                    key={control.id} 
                                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                                    style={{
                                        opacity: 0,
                                        animation: `fadeIn 0.3s ease-in forwards ${index * 0.05}s`
                                    }}
                                    onClick={() => handleViewRecord(control)}
                                >
                                    <TableCell>
                                        <div className="font-medium">{control.part_name}</div>
                                        <div className="text-sm text-muted-foreground">{control.part_code}</div>
                                    </TableCell>
                                    <TableCell>{control.supplier?.name || '-'}</TableCell>
                                    <TableCell>{control.source_inspection?.record_no}</TableCell>
                                    <TableCell>{control.controlled_inspection?.record_no}</TableCell>
                                    <TableCell>{control.created_at ? format(new Date(control.created_at), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                    <TableCell>{control.controlled_by?.full_name || '-'}</TableCell>
                                    <TableCell>{getStatusBadge(control.status)}</TableCell>
                                    <TableCell>{getDecisionBadge(control.decision)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                    <span className="sr-only">Menüyü aç</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleViewRecord(control)}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    <span>Görüntüle</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleEditControl(control)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Düzenle</span>
                                                </DropdownMenuItem>
                                                {(!control.status || control.status === 'Beklemede') && (
                                                    <DropdownMenuItem onClick={() => handleStartControl(control)}>
                                                        <Play className="mr-2 h-4 w-4" />
                                                        <span>Kontrolü Başlat</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {(control.status === 'Başlatıldı' || control.status === 'Devam Ediyor') && (
                                                    <DropdownMenuItem onClick={() => handleCompleteControl(control)}>
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        <span>Tamamla</span>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDeleteClick(control)}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    <span>Sil</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </tr>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
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
    );
};

export default StockRiskControlList;