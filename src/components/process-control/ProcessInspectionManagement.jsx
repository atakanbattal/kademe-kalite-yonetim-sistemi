import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ListTableShell from '@/components/ui/ListTableShell';
import { MoreVertical, Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { formatInspectionDateOnly } from '@/lib/dateDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ProcessInspectionFormModal from './ProcessInspectionFormModal';
import ProcessInspectionDetailModal from './ProcessInspectionDetailModal';

const ProcessInspectionManagement = ({ externalOpenInspectionId, onExternalOpenConsumed }) => {
    const { toast } = useToast();
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination & Filters
    const [page, setPage] = useState(0);
    const [pageSize] = useState(15);
    const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [decisionFilter, setDecisionFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 500);
        return () => clearTimeout(id);
    }, [searchTerm]);

    useEffect(() => {
        setPage(0);
    }, [searchTerm, decisionFilter, dateFrom, dateTo]);

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    
    // Selected data for modals
    const [selectedInspectionForEdit, setSelectedInspectionForEdit] = useState(null);
    const [selectedInspectionForView, setSelectedInspectionForView] = useState(null);
    
    // View Mode flag (true if viewing, false if editing)
    const [isViewMode, setIsViewMode] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const totalPages = Math.ceil(totalCount / pageSize);

    const fetchInspections = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('process_inspections')
                .select('*', { count: 'exact' });

            if (debouncedSearch) {
                const term = debouncedSearch;
                query = query.or(`record_no.ilike.%${term}%,part_code.ilike.%${term}%,part_name.ilike.%${term}%`);
            }

            if (decisionFilter && decisionFilter !== 'all') {
                query = query.eq('decision', decisionFilter);
            }

            if (dateFrom) {
                query = query.gte('inspection_date', dateFrom);
            }
            if (dateTo) {
                query = query.lte('inspection_date', dateTo);
            }

            query = query
                .order('inspection_date', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            const { data, count, error } = await query;

            if (error) throw error;
            
            setInspections(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Proses muayeneleri getirilirken hata:', error);
            toast({ variant: 'destructive', title: 'Hata!', description: 'Muayene kayıtları alınamadı.' });
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, debouncedSearch, decisionFilter, dateFrom, dateTo, toast]);

    useEffect(() => {
        fetchInspections();
    }, [fetchInspections]);

    const getDecisionBadge = (decision) => {
        switch (decision) {
            case 'Kabul': return <Badge variant="success">Kabul</Badge>;
            case 'Şartlı Kabul': return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Şartlı Kabul</Badge>;
            case 'Ret': return <Badge variant="destructive">Ret</Badge>;
            default: return <Badge variant="secondary">Beklemede</Badge>;
        }
    };

    const handleAdd = () => {
        setIsViewMode(false);
        setSelectedInspectionForEdit(null);
        setIsFormModalOpen(true);
    };

    const loadFullInspectionRecord = useCallback(async (inspection) => {
        const { data: inspectionData, error: inspectionError } = await supabase
            .from('process_inspections')
            .select('*')
            .eq('id', inspection.id)
            .single();

        if (inspectionError) throw inspectionError;

        const [attachmentsRes, defectsRes, resultsRes] = await Promise.all([
            supabase.from('process_inspection_attachments').select('*').eq('inspection_id', inspection.id),
            supabase.from('process_inspection_defects').select('*').eq('inspection_id', inspection.id),
            supabase.from('process_inspection_results').select('*').eq('inspection_id', inspection.id),
        ]);

        if (attachmentsRes.error) throw attachmentsRes.error;
        if (defectsRes.error) throw defectsRes.error;
        if (resultsRes.error) throw resultsRes.error;

        return {
            ...inspectionData,
            attachments: attachmentsRes.data || [],
            defects: defectsRes.data || [],
            results: resultsRes.data || [],
        };
    }, []);

    useEffect(() => {
        if (!externalOpenInspectionId) return;
        let cancelled = false;
        (async () => {
            try {
                const full = await loadFullInspectionRecord({ id: externalOpenInspectionId });
                if (cancelled) return;
                setSelectedInspectionForView(full);
                setIsDetailModalOpen(true);
            } catch (error) {
                console.error('Muayene kaydı açılamadı:', error);
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: 'Muayene kaydı açılamadı.',
                });
            } finally {
                if (!cancelled) onExternalOpenConsumed?.();
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [externalOpenInspectionId, loadFullInspectionRecord, onExternalOpenConsumed, toast]);

    const handleEdit = async (inspection) => {
        try {
            const fullInspection = await loadFullInspectionRecord(inspection);
            setIsViewMode(false);
            setSelectedInspectionForEdit(fullInspection);
            setIsFormModalOpen(true);
        } catch (error) {
            console.error('Proses muayene detayı alınamadı:', error);
            toast({ variant: 'destructive', title: 'Hata!', description: 'Muayene kaydı detayları alınamadı.' });
        }
    };
    
    const handleViewDetail = async (inspection) => {
        try {
            const fullInspection = await loadFullInspectionRecord(inspection);
            setSelectedInspectionForView(fullInspection);
            setIsDetailModalOpen(true);
        } catch (error) {
            console.error('Proses muayene detayı alınamadı:', error);
            toast({ variant: 'destructive', title: 'Hata!', description: 'Muayene detayı açılamadı.' });
        }
    };
    
    const handleDelete = async (inspection) => {
        const { id: inspectionId } = inspection;
        try {
            // Delete related records (Due to ON DELETE CASCADE this might be redundant but good practice for storage)
            // If there's storage, we should handle that in the backend trigger or frontend
            
            // Fetch attachments to delete them from storage
            const { data: attachments } = await supabase
                .from('process_inspection_attachments')
                .select('file_path')
                .eq('inspection_id', inspectionId);
                
            if (attachments && attachments.length > 0) {
                const filePaths = attachments.map(a => a.file_path);
                const { error: storageError } = await supabase.storage.from('process_inspections').remove(filePaths);
                if(storageError) console.error("Depolama silme hatası:", storageError);
            }
            
            // Delete record
            const { error } = await supabase.from('process_inspections').delete().eq('id', inspectionId);

            if (error) throw error;
            
            toast({ title: 'Başarılı!', description: 'Kayıt başarıyla silindi.' });
            fetchInspections();
        } catch(error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt silinemedi: ${error.message}` });
        }
    };

    return (
        <TooltipProvider delayDuration={200}>
        <div className="space-y-4">
            <div className="space-y-3 bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="search-box w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Kayıt No, Parça Kodu veya Adı ile ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input h-11"
                        />
                    </div>
                    <Button onClick={handleAdd} className="shrink-0">
                        <Plus className="mr-2 h-4 w-4" /> Yeni Muayene
                    </Button>
                </div>
                <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Filter className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium uppercase tracking-wide">Filtreler</span>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="pi-decision" className="text-xs text-muted-foreground">
                            Karar
                        </Label>
                        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                            <SelectTrigger id="pi-decision" className="h-10 w-[180px]">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm kararlar</SelectItem>
                                <SelectItem value="Kabul">Kabul</SelectItem>
                                <SelectItem value="Şartlı Kabul">Şartlı Kabul</SelectItem>
                                <SelectItem value="Ret">Ret</SelectItem>
                                <SelectItem value="Beklemede">Beklemede</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="pi-from" className="text-xs text-muted-foreground">
                            Tarih başlangıç
                        </Label>
                        <input
                            id="pi-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="pi-to" className="text-xs text-muted-foreground">
                            Tarih bitiş
                        </Label>
                        <input
                            id="pi-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </div>
                    {(dateFrom || dateTo || decisionFilter !== 'all') && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mb-0.5"
                            onClick={() => {
                                setDecisionFilter('all');
                                setDateFrom('');
                                setDateTo('');
                            }}
                        >
                            Filtreleri temizle
                        </Button>
                    )}
                </div>
            </div>

            <ListTableShell noInner className="flex flex-col">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Kayıt No</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Parça Kodu / Adı</TableHead>
                            <TableHead>Üretilen Miktar</TableHead>
                            <TableHead>Operatör</TableHead>
                            <TableHead>Karar</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Yükleniyor...</TableCell>
                            </TableRow>
                        ) : inspections.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    Henüz muayene kaydı bulunmuyor.
                                </TableCell>
                            </TableRow>
                        ) : (
                            inspections.map((inspection) => (
                                <TableRow key={inspection.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-medium">{inspection.record_no}</TableCell>
                                    <TableCell>
                                        {inspection.inspection_date
                                            ? formatInspectionDateOnly(inspection.inspection_date)
                                            : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{inspection.part_code}</span>
                                            <span className="text-xs text-muted-foreground line-clamp-1">{inspection.part_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{inspection.quantity_produced}</TableCell>
                                    <TableCell>{inspection.operator_name || '-'}</TableCell>
                                    <TableCell>{getDecisionBadge(inspection.decision)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="inline-flex items-center justify-end gap-0.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleViewDetail(inspection)} aria-label="Görüntüle">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">Görüntüle</TooltipContent>
                                            </Tooltip>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Diğer işlemler">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem className="text-sm" onClick={() => handleEdit(inspection)}>
                                                        <Edit className="mr-2 h-4 w-4 shrink-0" /> Düzenle
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                                        onSelect={(e) => { e.preventDefault(); setDeleteTarget(inspection); }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4 shrink-0" /> Sil
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                
                {/* Pagination */}
                {totalCount > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                        <div className="text-sm text-muted-foreground">
                            Toplam <span className="font-medium text-foreground">{totalCount}</span> kayıt
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-sm font-medium">
                                {page + 1} / {totalPages || 1}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </ListTableShell>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu muayene kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteTarget(null)}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (deleteTarget) handleDelete(deleteTarget);
                                setDeleteTarget(null);
                            }}
                        >
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modals */}
            <ProcessInspectionFormModal 
                isOpen={isFormModalOpen} 
                setIsOpen={setIsFormModalOpen}
                existingInspection={selectedInspectionForEdit}
                isViewMode={isViewMode}
                refreshData={fetchInspections}
            />
            
            <ProcessInspectionDetailModal 
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                inspection={selectedInspectionForView}
            />
        </div>
        </TooltipProvider>
    );
};

export default ProcessInspectionManagement;
