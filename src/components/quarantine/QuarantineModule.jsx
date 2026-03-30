import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Search, Plus, MoreHorizontal, AlertOctagon, Trash2, Eye, Edit, GitBranch, ExternalLink, FileText, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Label } from '@/components/ui/label';
    import { DateRangePicker } from '@/components/ui/date-range-picker';
    import { Badge } from '@/components/ui/badge';
    import QuarantineFormModal from '@/components/quarantine/QuarantineFormModal';
    import QuarantineDecisionModal from '@/components/quarantine/QuarantineDecisionModal';
    import CreateNCFromQuarantineModal from '@/components/quarantine/CreateNCFromQuarantineModal';
    import QuarantineViewModal from '@/components/quarantine/QuarantineViewModal';
    import QuarantineAnalytics from '@/components/quarantine/QuarantineAnalytics';
    import QuarantineReportFilterModal from '@/components/quarantine/QuarantineReportFilterModal';
    import { useData } from '@/contexts/DataContext';
    import { openPrintableReport } from '@/lib/reportUtils';

    const QUARANTINE_STATUSES = [
      'Karantinada',
      'Yeniden İşlem',
      'Hurda',
      'Onay Bekliyor',
      'İade',
      'Serbest Bırakıldı',
      'Sapma Onaylı',
      'Tamamlandı',
    ];

    const QuarantineModule = ({ onOpenNCForm, onOpenNCView }) => {
      const { toast } = useToast();
      const { quarantineRecords, loading, refreshData } = useData();
      const [records, setRecords] = useState([]);

      const [isFormOpen, setIsFormOpen] = useState(false);
      const [isDecisionOpen, setIsDecisionOpen] = useState(false);
      const [isCreateNCOpen, setCreateNCOpen] = useState(false);
      const [isViewOpen, setIsViewOpen] = useState(false);
      const [isReportFilterOpen, setIsReportFilterOpen] = useState(false);
      const [selectedRecord, setSelectedRecord] = useState(null);
      const [searchTerm, setSearchTerm] = useState('');
      const [formMode, setFormMode] = useState('new');
      const [sortConfig, setSortConfig] = useState({ key: 'quarantine_date', direction: 'desc' });

      const [statusFilter, setStatusFilter] = useState('all');
      const [dateRange, setDateRange] = useState(null);
      const [departmentFilter, setDepartmentFilter] = useState('all');

      const uniqueDepartments = useMemo(() => {
        const deps = new Set();
        quarantineRecords.forEach(r => {
          if (r.source_department) deps.add(r.source_department);
        });
        return [...deps].sort();
      }, [quarantineRecords]);

      const activeFilterCount = useMemo(() => {
        let count = 0;
        if (statusFilter !== 'all') count++;
        if (dateRange) count++;
        if (departmentFilter !== 'all') count++;
        return count;
      }, [statusFilter, dateRange, departmentFilter]);

      const handleClearFilters = () => {
        setStatusFilter('all');
        setDateRange(null);
        setDepartmentFilter('all');
      };

      useEffect(() => {
        let filtered = [...quarantineRecords];
        
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            filtered = filtered.filter(record => 
                record.part_code?.toLowerCase().includes(lowercasedFilter) ||
                record.part_name?.toLowerCase().includes(lowercasedFilter) ||
                record.lot_no?.toLowerCase().includes(lowercasedFilter) ||
                record.nc_number?.toLowerCase().includes(lowercasedFilter) ||
                record.source_department?.toLowerCase().includes(lowercasedFilter) ||
                record.requesting_department?.toLowerCase().includes(lowercasedFilter) ||
                record.requesting_person_name?.toLowerCase().includes(lowercasedFilter) ||
                record.supplier_name?.toLowerCase().includes(lowercasedFilter)
            );
        }

        if (statusFilter !== 'all') {
          filtered = filtered.filter(r => r.status === statusFilter);
        }

        if (dateRange && dateRange.from) {
          filtered = filtered.filter(r => {
            const d = new Date(r.quarantine_date);
            if (dateRange.from && d < dateRange.from) return false;
            if (dateRange.to && d > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
            return true;
          });
        }

        if (departmentFilter !== 'all') {
          filtered = filtered.filter(r => r.source_department === departmentFilter);
        }

        filtered.sort((a, b) => {
            let aVal, bVal;
            
            switch (sortConfig.key) {
                case 'quarantine_date':
                    aVal = new Date(a.quarantine_date);
                    bVal = new Date(b.quarantine_date);
                    break;
                case 'part_name':
                    aVal = (a.part_name || '').toLowerCase();
                    bVal = (b.part_name || '').toLowerCase();
                    break;
                case 'part_code':
                    aVal = (a.part_code || '').toLowerCase();
                    bVal = (b.part_code || '').toLowerCase();
                    break;
                case 'quantity':
                    aVal = parseFloat(a.quantity) || 0;
                    bVal = parseFloat(b.quantity) || 0;
                    break;
                case 'source_department':
                    aVal = (a.source_department || '').toLowerCase();
                    bVal = (b.source_department || '').toLowerCase();
                    break;
                case 'status':
                    aVal = (a.status || '').toLowerCase();
                    bVal = (b.status || '').toLowerCase();
                    break;
                default:
                    aVal = a[sortConfig.key];
                    bVal = b[sortConfig.key];
            }
            
            if (aVal === bVal) return 0;
            
            const comparison = aVal < bVal ? -1 : 1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        setRecords(filtered);
      }, [searchTerm, quarantineRecords, sortConfig, statusFilter, dateRange, departmentFilter]);
      
      const handleDeleteRecord = async (recordId) => {
        const { error } = await supabase.from('quarantine_records').delete().eq('id', recordId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Kayıt başarıyla silindi.' });
            refreshData();
        }
      };

      const handleOpenView = (record) => {
        setSelectedRecord(record);
        setIsViewOpen(true);
      };

      const handleOpenEdit = (record) => {
        setSelectedRecord(record);
        setFormMode('edit');
        setIsFormOpen(true);
      };

      const handleOpenNew = () => {
        setSelectedRecord(null);
        setFormMode('new');
        setIsFormOpen(true);
      };
      
      const handleOpenDecision = (record) => {
        setSelectedRecord(record);
        setIsDecisionOpen(true);
      };
      
      const handleOpenCreateNC = (record) => {
        setSelectedRecord(record);
        setCreateNCOpen(true);
      };

      const handleOpenReportFilter = () => {
        setIsReportFilterOpen(true);
      };

      const handleGenerateReportFromSelection = (selectedRecords) => {
        const lightweightRecords = selectedRecords.map(r => ({
          id: r.id,
          quarantine_date: r.quarantine_date,
          part_code: r.part_code,
          part_name: r.part_name,
          lot_no: r.lot_no,
          quantity: r.quantity,
          unit: r.unit,
          reason: r.reason,
          source_department: r.source_department,
          supplier_name: r.supplier_name,
          requesting_department: r.requesting_department,
          requesting_person_name: r.requesting_person_name,
          status: r.status,
          notes: r.notes,
          description: r.description,
        }));
        
        const reportData = {
          title: 'Aktif Karantina Raporu',
          items: lightweightRecords,
          id: `quarantine-active-${new Date().toISOString()}`
        };
        
        openPrintableReport(reportData, 'quarantine_list', true);
      };

      const getStatusColor = (status) => {
        switch (status) {
          case 'Karantinada': return 'bg-red-100 text-red-800';
          case 'Yeniden İşlem': return 'bg-blue-100 text-blue-800';
          case 'Hurda': return 'bg-gray-200 text-gray-800';
          case 'Onay Bekliyor': return 'bg-yellow-100 text-yellow-800';
          case 'İade': return 'bg-orange-100 text-orange-800';
          case 'Serbest Bırakıldı': return 'bg-green-100 text-green-800';
          case 'Sapma Onaylı': return 'bg-purple-100 text-purple-800';
          default: return 'bg-gray-100 text-gray-800';
        }
      };

      const handleOpenNC = (nc) => {
        if(nc && onOpenNCView) {
            onOpenNCView(nc);
        }
      };

      const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
      };

      const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) {
            return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
        }
        return sortConfig.direction === 'asc' 
            ? <ArrowUp className="ml-1 h-3 w-3" />
            : <ArrowDown className="ml-1 h-3 w-3" />;
      };

      return (
        <div className="space-y-6">
          <QuarantineFormModal 
            isOpen={isFormOpen} 
            setIsOpen={setIsFormOpen} 
            existingRecord={selectedRecord} 
            refreshData={refreshData} 
            mode={formMode} 
          />
          <QuarantineDecisionModal 
            isOpen={isDecisionOpen} 
            setIsOpen={setIsDecisionOpen} 
            record={selectedRecord} 
            refreshData={refreshData} 
          />
          <QuarantineViewModal 
            isOpen={isViewOpen} 
            setIsOpen={setIsViewOpen} 
            record={selectedRecord} 
            onEdit={handleOpenEdit} 
          />
            <CreateNCFromQuarantineModal 
                isOpen={isCreateNCOpen}
                setIsOpen={setCreateNCOpen}
                quarantineRecord={selectedRecord}
                onOpenNCForm={onOpenNCForm}
                refreshData={refreshData}
            />
          <QuarantineReportFilterModal
            isOpen={isReportFilterOpen}
            setIsOpen={setIsReportFilterOpen}
            records={records}
            onGenerateReport={handleGenerateReportFromSelection}
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-muted-foreground mt-1">Karantinadaki ürünleri takip edin ve yönetin.</p>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
               <Button variant="outline" onClick={handleOpenReportFilter} disabled={loading || records.length === 0}>
                  <FileText className="w-4 h-4 mr-2" />
                  Rapor Oluştur
                </Button>
               <Button onClick={handleOpenNew}><Plus className="w-4 h-4 mr-2"/>Yeni Karantina Kaydı</Button>
            </div>
          </div>
          
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="list">Kayıt Listesi</TabsTrigger>
              <TabsTrigger value="analytics">Analiz & İstatistikler</TabsTrigger>
            </TabsList>

            <TabsContent value="list">
          <div className="dashboard-widget">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <div className="search-box w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Parça kodu, adı veya lot no ara..." 
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="relative">
                        <Filter className="mr-2 h-4 w-4" />
                        Filtrele
                        {activeFilterCount > 0 && (
                          <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div>
                          <Label>Durum</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tümü</SelectItem>
                              {QUARANTINE_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Sebep Olan Birim</Label>
                          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tümü</SelectItem>
                              {uniqueDepartments.map(d => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Tarih Aralığı</Label>
                          <DateRangePicker
                            date={dateRange}
                            onDateChange={(range) => setDateRange(range || null)}
                          />
                        </div>
                        <Button onClick={handleClearFilters} variant="outline" className="w-full">
                          <X className="mr-2 h-4 w-4" />
                          Filtreleri Temizle
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{records.length} kayıt</span>
                </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th 
                      className="cursor-pointer hover:bg-secondary/50 select-none"
                      onClick={() => handleSort('quarantine_date')}
                    >
                      <div className="flex items-center">
                        Tarih
                        {getSortIcon('quarantine_date')}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer hover:bg-secondary/50 select-none"
                      onClick={() => handleSort('part_name')}
                    >
                      <div className="flex items-center">
                        Parça Kodu/Adı
                        {getSortIcon('part_name')}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer hover:bg-secondary/50 select-none"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center">
                        Miktar
                        {getSortIcon('quantity')}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer hover:bg-secondary/50 select-none"
                      onClick={() => handleSort('source_department')}
                    >
                      <div className="flex items-center">
                        Sebep Olan Birim
                        {getSortIcon('source_department')}
                      </div>
                    </th>
                    <th className="whitespace-nowrap">Tedarikçi</th>
                    <th 
                      className="cursor-pointer hover:bg-secondary/50 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Durum
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th>İlişkili Uygunsuzluk</th>
                    <th className="px-4 py-2 text-center whitespace-nowrap z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan="8" className="text-center p-8 text-muted-foreground">Kayıt bulunamadı.</td></tr>
                  ) : (
                    records.map((item) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: item.id * 0.05 }}
                      >
                        <td className="text-foreground">{new Date(item.quarantine_date).toLocaleDateString('tr-TR')}</td>
                        <td className="font-medium text-foreground">
                            <div>{item.part_name}</div>
                            <div className="text-xs text-muted-foreground">{item.part_code} / {item.lot_no}</div>
                        </td>
                        <td className="text-foreground">
                            {item.status === 'Tamamlandı' && item.initial_quantity ? (
                                <span className="line-through text-muted-foreground">{item.initial_quantity}</span>
                            ) : (
                                item.quantity
                            )} {item.unit}
                            {item.status === 'Tamamlandı' && item.initial_quantity && (
                                <span className="block text-xs text-muted-foreground">Başlangıç: {item.initial_quantity} {item.unit}</span>
                            )}
                        </td>
                        <td className="text-foreground">{item.source_department || 'Belirtilmemiş'}</td>
                        <td className="text-foreground text-sm max-w-[180px] truncate" title={item.supplier_name || ''}>
                          {item.supplier_name || '—'}
                        </td>
                        <td>
                          <span className={`status-indicator ${getStatusColor(item.status)}`}>{item.status}</span>
                        </td>
                        <td>
                          {item.non_conformity_id && item.nc_number ? (
                            <Button 
                              variant="link" 
                              className="p-0 h-auto" 
                              onClick={() => {
                                if (onOpenNCView && item.non_conformity_id) {
                                  onOpenNCView({ id: item.non_conformity_id, nc_number: item.nc_number });
                                }
                              }}
                            >
                              {item.nc_number}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          ) : '-'}
                        </td>
                        <td>
                            <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Menüyü aç</span>
                                            <MoreHorizontal className="h-4 w-4 flex-shrink-0 text-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenView(item)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Görüntüle
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleOpenEdit(item)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Düzenle
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleOpenDecision(item)} disabled={item.quantity <= 0}>
                                            <GitBranch className="mr-2 h-4 w-4" />
                                            Karar Ver
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleOpenCreateNC(item)} disabled={!!item.non_conformity_id}>
                                            <AlertOctagon className="mr-2 h-4 w-4" />
                                            Uygunsuzluk Oluştur
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4"/>
                                                Kaydı Sil
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Bu işlem geri alınamaz. Bu karantina kaydını kalıcı olarak silecektir.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteRecord(item.id)}>Sil</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </TabsContent>

            <TabsContent value="analytics">
              <QuarantineAnalytics quarantineRecords={records} />
            </TabsContent>
          </Tabs>
        </div>
      );
    };

    export default QuarantineModule;
