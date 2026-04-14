import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
    import { motion } from 'framer-motion';
    import { Search, Plus, MoreHorizontal, AlertOctagon, Trash2, Eye, Edit, GitBranch, ExternalLink, FileText, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, PackageX } from 'lucide-react';
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
    import QuarantineHurdaTutanagiModal from '@/components/quarantine/QuarantineHurdaTutanagiModal';
    import CreateNCFromQuarantineModal from '@/components/quarantine/CreateNCFromQuarantineModal';
    import QuarantineViewModal from '@/components/quarantine/QuarantineViewModal';
    import QuarantineAnalytics from '@/components/quarantine/QuarantineAnalytics';
    import QuarantineReportFilterModal from '@/components/quarantine/QuarantineReportFilterModal';
    import DeviationFormModal from '@/components/deviation/DeviationFormModal';
    import { useData } from '@/contexts/DataContext';
    import { openPrintableReport } from '@/lib/reportUtils';
    import { cn } from '@/lib/utils';

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
      const [isHurdaTutanagiOpen, setIsHurdaTutanagiOpen] = useState(false);
      const [hurdaTutanagiPayload, setHurdaTutanagiPayload] = useState(null);
      const [isDeviationModalOpen, setIsDeviationModalOpen] = useState(false);
      const [quarantineDecisionFinalize, setQuarantineDecisionFinalize] = useState(null);
      const [decisionRestoreDraft, setDecisionRestoreDraft] = useState(null);
      const deviationFlowCompletedRef = useRef(false);
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
        setDecisionRestoreDraft(null);
        setIsDecisionOpen(true);
      };

      const handleStartDeviationFlow = useCallback((payload) => {
        setDecisionRestoreDraft({
          decision: payload.decision,
          quantity: payload.quantity,
          notes: payload.notes || '',
        });
        setQuarantineDecisionFinalize(payload);
        setIsDeviationModalOpen(true);
      }, []);

      const handleDeviationModalOpenChange = useCallback((open) => {
        if (open) {
          setIsDeviationModalOpen(true);
          return;
        }
        const completed = deviationFlowCompletedRef.current;
        deviationFlowCompletedRef.current = false;
        setIsDeviationModalOpen(false);
        setQuarantineDecisionFinalize(null);
        if (!completed) {
          setIsDecisionOpen(true);
        } else {
          setDecisionRestoreDraft(null);
        }
      }, []);

      const handleDeviationConsumed = useCallback(() => {
        deviationFlowCompletedRef.current = true;
        setDecisionRestoreDraft(null);
      }, []);

      const clearDecisionRestoreDraft = useCallback(() => setDecisionRestoreDraft(null), []);

      const handleHurdaTutanagiRequest = useCallback((payload) => {
        setHurdaTutanagiPayload(payload);
        setIsHurdaTutanagiOpen(true);
      }, []);

      const handleHurdaTutanagiCompleted = useCallback(() => {
        setHurdaTutanagiPayload(null);
        refreshData();
      }, [refreshData]);
      
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

      const getStatusBadgeClass = (status) => {
        switch (status) {
          case 'Karantinada':
            return 'border-red-200/80 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800/50';
          case 'Yeniden İşlem':
            return 'border-blue-200/80 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100';
          case 'Hurda':
            return 'border-slate-200 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100';
          case 'Onay Bekliyor':
            return 'border-amber-200/80 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100';
          case 'İade':
            return 'border-orange-200/80 bg-orange-50 text-orange-950 dark:bg-orange-950/30';
          case 'Serbest Bırakıldı':
            return 'border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30';
          case 'Sapma Onaylı':
            return 'border-violet-200/80 bg-violet-50 text-violet-950 dark:bg-violet-950/30';
          case 'Tamamlandı':
            return 'border-teal-200/80 bg-teal-50 text-teal-950 dark:bg-teal-950/30';
          default:
            return 'border-border bg-muted text-foreground';
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
            onHurdaTutanagiRequest={handleHurdaTutanagiRequest}
            onStartDeviationFlow={handleStartDeviationFlow}
            restoreDraft={decisionRestoreDraft}
            onRestoreDraftApplied={clearDecisionRestoreDraft}
          />
          {isDeviationModalOpen && (
            <DeviationFormModal
              isOpen={isDeviationModalOpen}
              setIsOpen={handleDeviationModalOpenChange}
              refreshData={refreshData}
              existingDeviation={null}
              quarantineDecisionFinalize={quarantineDecisionFinalize}
              onConsumedQuarantineDecision={handleDeviationConsumed}
            />
          )}
          <QuarantineHurdaTutanagiModal
            isOpen={isHurdaTutanagiOpen}
            setIsOpen={(open) => {
              setIsHurdaTutanagiOpen(open);
              if (!open) setHurdaTutanagiPayload(null);
            }}
            record={selectedRecord}
            processedQuantity={hurdaTutanagiPayload?.quantity}
            decisionNotes={hurdaTutanagiPayload?.notes}
            onCompleted={handleHurdaTutanagiCompleted}
          />
          <QuarantineViewModal 
            isOpen={isViewOpen} 
            setIsOpen={setIsViewOpen} 
            record={selectedRecord} 
            onEdit={handleOpenEdit}
            refreshData={refreshData}
            onRecordUpdated={(updated) => setSelectedRecord(updated)}
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

          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4 sm:gap-5 min-w-0">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <PackageX className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Karantina
                  </h1>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    Karantinadaki ürünleri takip edin, karar verin ve kayıtları yönetin.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 border-border/80 bg-background/80"
                  onClick={handleOpenReportFilter}
                  disabled={loading || records.length === 0}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Rapor Oluştur
                </Button>
                <Button size="lg" className="h-11 font-semibold shadow-md shadow-primary/20" onClick={handleOpenNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Karantina Kaydı
                </Button>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="list" className="w-full space-y-6">
            <TabsList className="grid w-full max-w-xl grid-cols-2 h-11 items-center rounded-xl bg-muted/60 p-1 text-muted-foreground shadow-inner">
              <TabsTrigger
                value="list"
                className="rounded-lg py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Kayıt listesi
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-lg py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Analiz & istatistikler
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0 sm:mt-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0">
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-border/40">
            <div className="flex flex-col gap-2 border-b border-border/80 bg-gradient-to-b from-muted/30 to-muted/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
                <div className="search-box w-full min-w-0 sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Parça kodu, adı veya lot no ara..." 
                    className="search-input h-9 border-border/80 bg-background text-sm shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 border-border/80 bg-background shadow-sm">
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
                  <span className="text-sm tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{records.length}</span>
                    {' '}kayıt
                  </span>
                </div>
            </div>
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th 
                      className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors first:pl-4 hover:bg-muted/60 sm:px-4"
                      onClick={() => handleSort('quarantine_date')}
                    >
                      <div className="flex items-center gap-1">
                        Tarih
                        {getSortIcon('quarantine_date')}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 sm:px-4 min-w-[200px]"
                      onClick={() => handleSort('part_name')}
                    >
                      <div className="flex items-center gap-1">
                        Parça / lot
                        {getSortIcon('part_name')}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 sm:px-4"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center gap-1">
                        Miktar
                        {getSortIcon('quantity')}
                      </div>
                    </th>
                    <th 
                      className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 sm:px-4 min-w-[140px]"
                      onClick={() => handleSort('source_department')}
                    >
                      <div className="flex items-center gap-1">
                        Sebep olan birim
                        {getSortIcon('source_department')}
                      </div>
                    </th>
                    <th className="min-w-[120px] whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground sm:px-4">Tedarikçi</th>
                    <th 
                      className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 sm:px-4"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Durum
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th className="min-w-[120px] px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground sm:px-4">Uygunsuzluk</th>
                    <th className="w-14 px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground last:pr-4 sm:w-16">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" className="border-b border-border/50 p-10 text-center text-muted-foreground">Yükleniyor...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan="8" className="border-b border-border/50 p-10 text-center text-muted-foreground">Kayıt bulunamadı.</td></tr>
                  ) : (
                    records.map((item, rowIndex) => (
                      <motion.tr 
                        key={item.id}
                        className="group border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: Math.min(rowIndex * 0.02, 0.35) }}
                      >
                        <td className="px-3 py-3 align-middle text-foreground first:pl-4 sm:px-4">
                          <span className="font-medium tabular-nums">{new Date(item.quarantine_date).toLocaleDateString('tr-TR')}</span>
                        </td>
                        <td className="max-w-[min(100vw,20rem)] px-3 py-3 align-middle sm:px-4">
                            <div className="font-semibold leading-snug text-foreground">{item.part_name}</div>
                            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              {item.part_code && <span className="font-mono">{item.part_code}</span>}
                              {item.lot_no && <span>· {item.lot_no}</span>}
                            </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-middle tabular-nums text-foreground sm:px-4">
                            {item.status === 'Tamamlandı' && item.initial_quantity ? (
                                <span className="line-through text-muted-foreground">{item.initial_quantity}</span>
                            ) : (
                                item.quantity
                            )} {item.unit}
                            {item.status === 'Tamamlandı' && item.initial_quantity && (
                                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Başlangıç: {item.initial_quantity} {item.unit}</span>
                            )}
                        </td>
                        <td className="max-w-[220px] px-3 py-3 align-middle text-foreground sm:px-4">
                          <span className="line-clamp-2 text-sm leading-snug">{item.source_department || 'Belirtilmemiş'}</span>
                        </td>
                        <td className="max-w-[200px] px-3 py-3 align-middle text-sm sm:px-4" title={item.supplier_name || ''}>
                          <span className="line-clamp-2 text-muted-foreground">{item.supplier_name || '—'}</span>
                        </td>
                        <td className="px-3 py-3 align-middle sm:px-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              'max-w-[11rem] whitespace-normal px-2.5 py-1 text-left text-xs font-medium leading-snug',
                              getStatusBadgeClass(item.status)
                            )}
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="max-w-[140px] px-3 py-3 align-middle sm:px-4">
                          {item.non_conformity_id && item.nc_number ? (
                            <Button 
                              variant="link" 
                              className="h-auto p-0 text-sm font-medium" 
                              onClick={() => {
                                if (onOpenNCView && item.non_conformity_id) {
                                  onOpenNCView({ id: item.non_conformity_id, nc_number: item.nc_number });
                                }
                              }}
                            >
                              {item.nc_number}
                              <ExternalLink className="ml-1 h-3 w-3 shrink-0" />
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="w-14 px-1 py-2 text-center align-middle sm:w-16 sm:px-2">
                            <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                                            <span className="sr-only">Menüyü aç</span>
                                            <MoreHorizontal className="h-4 w-4 shrink-0" />
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
