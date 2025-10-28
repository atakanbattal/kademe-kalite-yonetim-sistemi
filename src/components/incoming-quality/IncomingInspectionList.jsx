import React from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Badge } from '@/components/ui/badge';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { MoreHorizontal, Plus, Search, Edit, FileSignature, FileDown, Trash2, Eye, CheckSquare, Filter, Check, XCircle as CircleX, FilePlus, ChevronLeft, ChevronRight } from 'lucide-react';
    import { format } from 'date-fns';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Label } from '@/components/ui/label';
    import { DateRangePicker } from '@/components/ui/date-range-picker';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const InspectionFilters = ({ filters, setFilters, suppliers }) => {
        const handleReset = () => {
            setFilters({
                searchTerm: '',
                dateRange: { from: null, to: null },
                decision: 'all',
                supplierId: 'all',
                controlPlanStatus: 'all',
            });
        };

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filtreler</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Filtreleme Seçenekleri</h4>
                            <p className="text-sm text-muted-foreground">Muayene kayıtlarını filtreleyin.</p>
                        </div>
                        <div className="grid gap-2">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Tarih Aralığı</Label>
                                <div className="col-span-2">
                                    <DateRangePicker
                                        date={filters.dateRange}
                                        onDateChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Karar</Label>
                                <Select value={filters.decision} onValueChange={(v) => setFilters(p => ({ ...p, decision: v }))}>
                                    <SelectTrigger className="col-span-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        <SelectItem value="Beklemede">Beklemede</SelectItem>
                                        <SelectItem value="Kabul">Kabul</SelectItem>
                                        <SelectItem value="Şartlı Kabul">Şartlı Kabul</SelectItem>
                                        <SelectItem value="Ret">Ret</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Tedarikçi</Label>
                                 <Select value={filters.supplierId} onValueChange={(v) => setFilters(p => ({ ...p, supplierId: v }))}>
                                    <SelectTrigger className="col-span-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        {(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Kontrol Planı</Label>
                                <Select value={filters.controlPlanStatus} onValueChange={(v) => setFilters(p => ({ ...p, controlPlanStatus: v }))}>
                                    <SelectTrigger className="col-span-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        <SelectItem value="Mevcut">Mevcut</SelectItem>
                                        <SelectItem value="Mevcut Değil">Mevcut Değil</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                         <Button variant="ghost" onClick={handleReset}>Filtreleri Temizle</Button>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };


    const IncomingInspectionList = ({ inspections, loading, onAdd, onEdit, onView, onDecide, onOpenNCForm, onDownloadPDF, refreshData, suppliers, filters, setFilters, onOpenControlPlanForm, page, setPage, totalCount, pageSize }) => {
        const { toast } = useToast();
        const totalPages = Math.ceil(totalCount / pageSize);

        const getDecisionBadge = (decision) => {
            switch (decision) {
                case 'Kabul': return <Badge variant="success">Kabul</Badge>;
                case 'Şartlı Kabul': return <Badge variant="warning">Şartlı Kabul</Badge>;
                case 'Ret': return <Badge variant="destructive">Ret</Badge>;
                default: return <Badge variant="secondary">Beklemede</Badge>;
            }
        };

        const handleDelete = async (inspection) => {
            const { id: inspectionId, record_no } = inspection;
            
            await supabase.from('incoming_inspection_defects').delete().eq('inspection_id', inspectionId);
            await supabase.from('incoming_inspection_results').delete().eq('inspection_id', inspectionId);
            await supabase.from('incoming_inspection_attachments').delete().eq('inspection_id', inspectionId);
            
            const { error } = await supabase.from('incoming_inspections').delete().eq('id', inspectionId);

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Kayıt başarıyla silindi.' });
                refreshData();
            }
        };

        return (
            <div className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-4 gap-2">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Parça, tedarikçi veya kayıt no ara..." className="pl-10" value={filters.searchTerm} onChange={(e) => setFilters(prev => ({...prev, searchTerm: e.target.value}))} />
                    </div>
                    <div className="flex items-center gap-2">
                        {filters.controlPlanStatus === 'Mevcut Değil' && (
                            <Button onClick={onOpenControlPlanForm} variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary">
                                <FilePlus className="mr-2 h-4 w-4" /> Yeni Kontrol Planı
                            </Button>
                        )}
                        <InspectionFilters filters={filters} setFilters={setFilters} suppliers={suppliers || []} />
                        <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" /> Yeni Muayene</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kayıt No</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Tedarikçi</TableHead>
                                <TableHead>Parça Adı/Kodu</TableHead>
                                <TableHead>Miktar</TableHead>
                                <TableHead>Kontrol Planı</TableHead>
                                <TableHead>Karar</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan="8" className="text-center">Yükleniyor...</TableCell></TableRow>
                            ) : inspections.length === 0 ? (
                                <TableRow><TableCell colSpan="8" className="text-center">Kayıt bulunamadı.</TableCell></TableRow>
                            ) : (
                                inspections.map(inspection => (
                                    <TableRow key={inspection.id} onClick={() => onView(inspection)} className="cursor-pointer">
                                        <TableCell className="font-medium">{inspection.record_no}</TableCell>
                                        <TableCell>{format(new Date(inspection.inspection_date), 'dd.MM.yyyy')}</TableCell>
                                        <TableCell>{inspection.supplier_name || '-'}</TableCell>
                                        <TableCell>
                                            <div>{inspection.part_name}</div>
                                            <div className="text-xs text-muted-foreground">{inspection.part_code}</div>
                                        </TableCell>
                                        <TableCell>{inspection.quantity_received} {inspection.unit}</TableCell>
                                        <TableCell className="text-center">{inspection.control_plan_status === 'Mevcut' ? <Check className="h-5 w-5 text-green-500 mx-auto"/> : <CircleX className="h-5 w-5 text-red-500 mx-auto"/>}</TableCell>
                                        <TableCell>{getDecisionBadge(inspection.decision)}</TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => onDecide(inspection)}>
                                                            <CheckSquare className="mr-2 h-4 w-4" /> Karar Ver
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onView(inspection)}>
                                                            <Eye className="mr-2 h-4 w-4" /> Görüntüle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onEdit(inspection)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onDownloadPDF(inspection)}>
                                                            <FileDown className="mr-2 h-4 w-4" /> Rapor Al
                                                        </DropdownMenuItem>
                                                        {inspection.decision === 'Ret' && (
                                                            <DropdownMenuItem onClick={() => onOpenNCForm({
                                                                source_inspection_id: inspection.id,
                                                                title: `${inspection.part_name} GKK Uygunsuzluğu`,
                                                                description: `Girdi kalite kontrol sırasında ${inspection.quantity_rejected} adet ${inspection.part_name} (${inspection.part_code}) reddedilmiştir.`,
                                                                supplier_id: inspection.supplier_id,
                                                                is_supplier_nc: true,
                                                                type: 'DF'
                                                            })}>
                                                                <FileSignature className="mr-2 h-4 w-4" /> DF Aç
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Sil
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                        <AlertDialogDescription>Bu işlem geri alınamaz. Bu muayene kaydını ve ilişkili tüm verileri kalıcı olarak sileceksiniz.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(inspection)} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">
                        Sayfa {page + 1} / {totalPages > 0 ? totalPages : 1} ({totalCount} kayıt)
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Önceki</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages - 1}
                    >
                        <span className="sr-only">Sonraki</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    };

    export default IncomingInspectionList;