import React from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Badge } from '@/components/ui/badge';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { MoreHorizontal, Plus, Search, Edit, FileSignature, Trash2, Eye, CheckSquare, Filter, Check, XCircle as CircleX, FilePlus, ChevronLeft, ChevronRight } from 'lucide-react';
    import { format } from 'date-fns';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Label } from '@/components/ui/label';
    import { DateRangePicker } from '@/components/ui/date-range-picker';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import IncomingInspectionDetailModal from './IncomingInspectionDetailModal';

    const InspectionFilters = ({ filters, setFilters, suppliers }) => {
        
        const handleClear = () => {
            setFilters({
                searchTerm: '',
                supplier: 'all',
                controlPlanStatus: 'all',
                decision: 'all',
                dateRange: { from: null, to: null },
            });
        };

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filtrele
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                    <div className="space-y-4">
                        <div>
                            <Label>Tedarikçi</Label>
                            <Select value={filters.supplier || 'all'} onValueChange={(val) => setFilters(prev => ({...prev, supplier: val}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Kontrol Planı Durumu</Label>
                            <Select value={filters.controlPlanStatus || 'all'} onValueChange={(val) => setFilters(prev => ({...prev, controlPlanStatus: val}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    <SelectItem value="Mevcut">Mevcut</SelectItem>
                                    <SelectItem value="Mevcut Değil">Mevcut Değil</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Karar</Label>
                            <Select value={filters.decision || 'all'} onValueChange={(val) => setFilters(prev => ({...prev, decision: val}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tümü" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tümü</SelectItem>
                                    <SelectItem value="Kabul">Kabul</SelectItem>
                                    <SelectItem value="Şartlı Kabul">Şartlı Kabul</SelectItem>
                                    <SelectItem value="Ret">Ret</SelectItem>
                                    <SelectItem value="Beklemede">Beklemede</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tarih Aralığı</Label>
                            <DateRangePicker
                                date={filters.dateRange}
                                onDateChange={(range) => setFilters(prev => ({...prev, dateRange: range || { from: null, to: null }}))}
                            />
                        </div>
                        <Button onClick={handleClear} variant="outline" className="w-full">Temizle</Button>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };


    const IncomingInspectionList = ({ inspections, loading, onAdd, onEdit, onView, onDecide, onOpenNCForm, onDownloadPDF, refreshData, suppliers, filters, setFilters, onOpenControlPlanForm, page, setPage, totalCount, pageSize }) => {
        const { toast } = useToast();
        const totalPages = Math.ceil(totalCount / pageSize);
        const [selectedInspection, setSelectedInspection] = React.useState(null);
        const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);

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

        const handleViewDetail = async (inspection) => {
            // İlk olarak incoming_inspections_with_supplier VIEW'dan temel bilgi al (supplier_name dahil)
            const { data: inspectionWithSupplier, error: viewError } = await supabase
                .from('incoming_inspections_with_supplier')
                .select('*')
                .eq('id', inspection.id)
                .single();
            
            if (viewError) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Muayene detayları alınamadı.' });
                return;
            }
            
            // Related data'yı ayrı ayrı çek
            const [attachmentsRes, defectsRes, resultsRes] = await Promise.all([
                supabase.from('incoming_inspection_attachments').select('*').eq('inspection_id', inspection.id),
                supabase.from('incoming_inspection_defects').select('*').eq('inspection_id', inspection.id),
                supabase.from('incoming_inspection_results').select('*').eq('inspection_id', inspection.id)
            ]);
            
            const fullData = {
                ...inspectionWithSupplier,
                attachments: attachmentsRes.data || [],
                defects: defectsRes.data || [],
                results: resultsRes.data || []
            };
            
            setSelectedInspection(fullData);
            setIsDetailModalOpen(true);
        };

        // Same logic for edit - fetch full data with results/defects/attachments
        const handleEditWithFullData = async (inspection) => {
            const { data: inspectionWithSupplier, error: viewError } = await supabase
                .from('incoming_inspections_with_supplier')
                .select('*')
                .eq('id', inspection.id)
                .single();
            
            if (viewError) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Muayene detayları alınamadı.' });
                return;
            }
            
            // Related data'yı ayrı ayrı çek
            const [attachmentsRes, defectsRes, resultsRes] = await Promise.all([
                supabase.from('incoming_inspection_attachments').select('*').eq('inspection_id', inspection.id),
                supabase.from('incoming_inspection_defects').select('*').eq('inspection_id', inspection.id),
                supabase.from('incoming_inspection_results').select('*').eq('inspection_id', inspection.id)
            ]);
            
            const fullData = {
                ...inspectionWithSupplier,
                attachments: attachmentsRes.data || [],
                defects: defectsRes.data || [],
                results: resultsRes.data || []
            };
            
            // Call onEdit with full data
            onEdit(fullData);
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
                                <TableHead>Parça</TableHead>
                                <TableHead>Miktar</TableHead>
                                <TableHead>Karar</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center py-8">Yükleniyor...</TableCell>
                                </TableRow>
                            ) : inspections && inspections.length > 0 ? (
                                inspections.map(inspection => (
                                    <TableRow key={inspection.id} onClick={() => handleViewDetail(inspection)} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>{inspection.record_no || '-'}</TableCell>
                                        <TableCell>{format(new Date(inspection.inspection_date), 'dd.MM.yyyy')}</TableCell>
                                        <TableCell>{inspection.supplier_name || '-'}</TableCell>
                                        <TableCell>{inspection.part_name || '-'}</TableCell>
                                        <TableCell>{inspection.quantity_received} {inspection.unit}</TableCell>
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
                                                        <DropdownMenuItem onClick={() => handleViewDetail(inspection)}>
                                                            <Eye className="mr-2 h-4 w-4" /> Görüntüle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEditWithFullData(inspection)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onDecide(inspection)}>
                                                            <CheckSquare className="mr-2 h-4 w-4" /> Karar Ver
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                                                                <Trash2 className="mr-2 h-4 w-4" /> Sil
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Kayıtı Sil</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Bu kayıtı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(inspection)} className="bg-red-600">
                                                            Sil
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center py-8">Muayene kaydı bulunamadı</TableCell>
                                </TableRow>
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

                <IncomingInspectionDetailModal
                    isOpen={isDetailModalOpen}
                    setIsOpen={setIsDetailModalOpen}
                    inspection={selectedInspection}
                    onDownloadPDF={onDownloadPDF}
                />
            </div>
        );
    };

    export default IncomingInspectionList;
