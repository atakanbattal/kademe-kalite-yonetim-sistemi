import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, FilterX, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const SupplierNCTab = ({ allSuppliers, loading, onOpenNCForm, onOpenNCView, refreshData }) => {
    const { toast } = useToast();
    const [ncs, setNcs] = useState([]);
    const [ncLoading, setNcLoading] = useState(true);
    const [filters, setFilters] = useState({
        supplierId: 'all',
        status: 'all',
        type: 'all',
        dateRange: { from: null, to: null },
        showDelayed: 'all'
    });

    const fetchNCs = useCallback(async () => {
        setNcLoading(true);
        const { data, error } = await supabase
            .from('supplier_non_conformities_view')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Tedarikçi uygunsuzlukları alınamadı: ' + error.message });
            setNcs([]);
        } else {
            setNcs(data || []);
        }
        setNcLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchNCs();
    }, [fetchNCs]);

    const filteredNcs = useMemo(() => {
        return ncs.filter(nc => {
            const supplierMatch = filters.supplierId === 'all' || nc.supplier_id === filters.supplierId;
            const statusMatch = filters.status === 'all' || nc.status === filters.status;
            const typeMatch = filters.type === 'all' || nc.type === filters.type;
            const delayedMatch = filters.showDelayed === 'all' || (filters.showDelayed === 'yes' && nc.delay_days > 0);
            
            let dateMatch = true;
            if (filters.dateRange.from && filters.dateRange.to) {
                const recordDate = new Date(nc.opening_date);
                dateMatch = recordDate >= filters.dateRange.from && recordDate <= filters.dateRange.to;
            } else if (filters.dateRange.from) {
                dateMatch = new Date(nc.opening_date) >= filters.dateRange.from;
            } else if (filters.dateRange.to) {
                dateMatch = new Date(nc.opening_date) <= filters.dateRange.to;
            }

            return supplierMatch && statusMatch && typeMatch && delayedMatch && dateMatch;
        });
    }, [ncs, filters]);

    const handleSelectChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleDateChange = (dateRange) => {
        setFilters(prev => ({ ...prev, dateRange }));
    }

    const clearFilters = () => {
        setFilters({
            supplierId: 'all',
            status: 'all',
            type: 'all',
            dateRange: { from: null, to: null },
            showDelayed: 'all'
        });
    };

    const handleView = (nc) => {
        if (nc.nc) {
            onOpenNCView(nc.nc);
        } else {
            toast({ title: 'Detay Yok', description: 'Bu uygunsuzluk için detay bulunamadı.' });
        }
    };
    
    const handleEdit = (nc) => {
      if (nc.nc) {
        onOpenNCForm(nc.type, nc.nc);
      } else {
        toast({ title: 'Detay Yok', description: 'Bu uygunsuzluk için düzenlenecek bir form bulunamadı.' });
      }
    };

    const handleDelete = async (id) => {
      // Note: This only deletes from `non_conformities`. Cascading delete should be set up in DB.
      const { error } = await supabase.from('non_conformities').delete().eq('id', id);
      if (error) {
        toast({ variant: 'destructive', title: 'Hata', description: 'Kayıt silinemedi: ' + error.message });
      } else {
        toast({ title: 'Başarılı', description: 'Kayıt başarıyla silindi.' });
        fetchNCs();
        if (refreshData) refreshData();
      }
    };
    
    const getStatusBadge = (status, delay_days) => {
        if (delay_days > 0 && status !== 'Kapatıldı') {
             return <Badge variant="destructive">Gecikmiş ({delay_days} gün)</Badge>;
        }
        switch (status) {
            case 'Açık': return <Badge variant="secondary">Açık</Badge>;
            case 'Kapatıldı': return <Badge className="bg-green-600 hover:bg-green-700 text-white">Kapatıldı</Badge>;
            case 'Reddedildi': return <Badge variant="destructive">Reddedildi</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="dashboard-widget">
            <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-card">
                <Select value={filters.supplierId} onValueChange={(v) => handleSelectChange('supplierId', v)}>
                    <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Tedarikçiye Göre Filtrele" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
                        {allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.status} onValueChange={(v) => handleSelectChange('status', v)}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Duruma Göre Filtrele" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Durumlar</SelectItem>
                        <SelectItem value="Açık">Açık</SelectItem>
                        <SelectItem value="Kapatıldı">Kapatıldı</SelectItem>
                        <SelectItem value="Reddedildi">Reddedildi</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.type} onValueChange={(v) => handleSelectChange('type', v)}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Türe Göre Filtrele" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Türler</SelectItem>
                        <SelectItem value="DF">DF</SelectItem>
                        <SelectItem value="8D">8D</SelectItem>
                        <SelectItem value="MDI">MDI</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.showDelayed} onValueChange={(v) => handleSelectChange('showDelayed', v)}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Gecikme Durumu" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="yes">Sadece Gecikenler</SelectItem>
                    </SelectContent>
                </Select>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            Tarih Aralığı: {filters.dateRange.from ? format(filters.dateRange.from, "dd/MM/yy") : 'Başlangıç'} - {filters.dateRange.to ? format(filters.dateRange.to, "dd/MM/yy") : 'Bitiş'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="range" selected={filters.dateRange} onSelect={handleDateChange} numberOfMonths={2} />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" onClick={clearFilters} className="w-full sm:w-auto"><FilterX className="w-4 h-4 mr-2"/>Filtreleri Temizle</Button>
            </div>
            <ScrollArea className="h-[60vh]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tedarikçi</TableHead>
                            <TableHead>No / Tip</TableHead>
                            <TableHead>Başlık</TableHead>
                            <TableHead>Açılış / Termin</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Kapanış Süresi</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(loading || ncLoading) ? (
                            <TableRow><TableCell colSpan="7" className="text-center p-8 text-muted-foreground">Yükleniyor...</TableCell></TableRow>
                        ) : filteredNcs.length === 0 ? (
                            <TableRow><TableCell colSpan="7" className="text-center p-8 text-muted-foreground">Kayıt bulunamadı.</TableCell></TableRow>
                        ) : (
                            filteredNcs.map(nc => (
                                <TableRow 
                                    key={nc.id} 
                                    className={cn(
                                        "cursor-pointer hover:bg-accent/50 transition-colors",
                                        nc.delay_days > 0 && nc.status !== 'Kapatıldı' && "bg-destructive/10"
                                    )}
                                    onClick={() => handleView(nc)}
                                    title="Detayları görüntülemek için tıklayın"
                                >
                                    <TableCell className="font-medium">{nc.supplier_name}</TableCell>
                                    <TableCell>
                                        <div className="font-mono text-primary font-semibold underline decoration-dotted">{nc.nc_number || nc.mdi_no || '-'}</div>
                                        <div className="text-xs text-muted-foreground">{nc.type}</div>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{nc.title}</TableCell>
                                    <TableCell>
                                        <div>{nc.df_opened_at ? format(new Date(nc.df_opened_at), "dd.MM.yyyy") : (nc.created_at ? format(new Date(nc.created_at), "dd.MM.yyyy") : '-')}</div>
                                        <div className="text-xs text-muted-foreground">{nc.due_at || nc.due_date ? format(new Date(nc.due_at || nc.due_date), "dd.MM.yyyy") : '-'}</div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(nc.status, nc.delay_days)}</TableCell>
                                    <TableCell>{nc.closure_duration_days !== null ? `${nc.closure_duration_days} gün` : '-'}</TableCell>
                                    <TableCell className="text-right">
                                      <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Menüyü aç</span>
                                                    <MoreHorizontal className="h-4 w-4 text-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleView(nc)}>
                                                    <Eye className="mr-2 h-4 w-4" /> Görüntüle
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleEdit(nc)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Düzenle
                                                </DropdownMenuItem>
                                                <AlertDialogTrigger asChild>
                                                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                      <Trash2 className="mr-2 h-4 w-4"/> Sil
                                                  </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                              <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                  Bu işlem geri alınamaz. Bu uygunsuzluk kaydını kalıcı olarak sileceksiniz.
                                              </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                              <AlertDialogCancel>İptal</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => handleDelete(nc.id)}>Evet, Sil</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
};

export default SupplierNCTab;