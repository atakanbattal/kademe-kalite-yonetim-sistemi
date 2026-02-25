import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, MoreHorizontal, Eye, Edit, Trash2, AlertTriangle,
  FileText, ArrowUpDown, ArrowUp, ArrowDown, Settings2, BarChart3,
  ClipboardList, Filter, RefreshCw, ExternalLink, TrendingUp, AlertOctagon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import NonconformityFormModal from './NonconformityFormModal';
import NonconformityDetailModal from './NonconformityDetailModal';
import NonconformitySettings from './NonconformitySettings';

const severityColors = {
  'Düşük': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Orta': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Yüksek': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Kritik': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const statusColors = {
  'Açık': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'DF Önerildi': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  '8D Önerildi': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'DF Açıldı': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  '8D Açıldı': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Kapatıldı': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const NonconformityModule = ({ onOpenNCForm, onOpenNCView }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'detection_date', direction: 'desc' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [settings, setSettings] = useState(null);
  const [partCodeAnalysis, setPartCodeAnalysis] = useState({});
  const [convertDialog, setConvertDialog] = useState({ open: false, record: null, type: null });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nonconformity_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }, [toast]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('nonconformity_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (data) setSettings(data);
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchSettings();
  }, [fetchRecords, fetchSettings]);

  // Parça kodu bazlı tekrar analizi
  useEffect(() => {
    if (!records.length || !settings) return;

    const periodDays = settings.threshold_period_days || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const analysis = {};
    const activeRecords = records.filter(r => r.status !== 'Kapatıldı');

    activeRecords.forEach(record => {
      if (!record.part_code) return;
      if (!analysis[record.part_code]) {
        analysis[record.part_code] = { total: 0, inPeriod: 0, records: [] };
      }
      analysis[record.part_code].total += 1;
      if (new Date(record.detection_date) >= cutoffDate) {
        analysis[record.part_code].inPeriod += 1;
      }
      analysis[record.part_code].records.push(record);
    });

    setPartCodeAnalysis(analysis);
  }, [records, settings]);

  const getRecordSuggestion = useCallback((record) => {
    if (!settings?.auto_suggest) return null;
    if (['DF Açıldı', '8D Açıldı', 'Kapatıldı'].includes(record.status)) return null;

    // Adet bazlı kontrol: tek seferde yüksek adet
    const dfQtyThreshold = settings.df_quantity_threshold || 10;
    const eightDQtyThreshold = settings.eight_d_quantity_threshold || 20;
    if (record.quantity) {
      if (record.quantity >= eightDQtyThreshold) return '8D';
      if (record.quantity >= dfQtyThreshold) return 'DF';
    }

    // Tekrar bazlı kontrol
    if (!record.part_code || !partCodeAnalysis[record.part_code]) return null;
    const count = partCodeAnalysis[record.part_code].inPeriod;
    if (count >= (settings.eight_d_threshold || 5)) return '8D';
    if (count >= (settings.df_threshold || 3)) return 'DF';
    return null;
  }, [settings, partCodeAnalysis]);

  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.record_number?.toLowerCase().includes(lower) ||
        r.part_code?.toLowerCase().includes(lower) ||
        r.part_name?.toLowerCase().includes(lower) ||
        r.description?.toLowerCase().includes(lower) ||
        r.detected_by?.toLowerCase().includes(lower) ||
        r.category?.toLowerCase().includes(lower) ||
        r.department?.toLowerCase().includes(lower)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
    if (severityFilter !== 'all') filtered = filtered.filter(r => r.severity === severityFilter);

    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'detection_date':
          aVal = new Date(a.detection_date || 0); bVal = new Date(b.detection_date || 0); break;
        case 'part_code':
          aVal = (a.part_code || '').toLowerCase(); bVal = (b.part_code || '').toLowerCase(); break;
        case 'severity':
          const sevOrder = { 'Kritik': 4, 'Yüksek': 3, 'Orta': 2, 'Düşük': 1 };
          aVal = sevOrder[a.severity] || 0; bVal = sevOrder[b.severity] || 0; break;
        case 'quantity':
          aVal = a.quantity || 0; bVal = b.quantity || 0; break;
        default:
          aVal = a[sortConfig.key] || ''; bVal = b[sortConfig.key] || ''; break;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [records, searchTerm, statusFilter, severityFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('nonconformity_records').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Hata', description: error.message });
    } else {
      toast({ title: 'Başarılı', description: 'Kayıt silindi.' });
      fetchRecords();
    }
    setDeleteTarget(null);
  };

  const handleConvertToDF8D = async () => {
    const { record, type } = convertDialog;
    if (!record || !type) return;

    const ncFormData = {
      title: `[UYG] ${record.part_code || ''} - ${record.description?.substring(0, 80) || 'Uygunsuzluk'}`,
      description: [
        `Kaynak: Uygunsuzluk Yönetimi (${record.record_number})`,
        `Parça Kodu: ${record.part_code || '-'}`,
        `Parça Adı: ${record.part_name || '-'}`,
        `Kategori: ${record.category || '-'}`,
        `Tespit Alanı: ${record.detection_area || '-'}`,
        `Tespit Eden: ${record.detected_by || '-'}`,
        `Sorumlu Kişi: ${record.responsible_person || '-'}`,
        `Ciddiyet: ${record.severity || '-'}`,
        `Adet: ${record.quantity || '-'}`,
        '',
        `Açıklama: ${record.description || '-'}`,
        record.action_taken ? `Alınan Acil Aksiyon: ${record.action_taken}` : '',
      ].filter(Boolean).join('\n'),
      type: type,
      part_code: record.part_code || '',
      part_name: record.part_name || '',
      vehicle_type: record.vehicle_type || '',
      responsible_person: record.responsible_person || '',
      department: record.department || '',
      requesting_person: record.detected_by || record.responsible_person || '',
      requesting_unit: record.department || '',
      priority: record.severity === 'Kritik' ? 'Kritik' : record.severity === 'Yüksek' ? 'Yüksek' : 'Orta',
    };

    // DF/8D formunu aç
    if (onOpenNCForm) {
      onOpenNCForm(ncFormData, async (savedNC) => {
        if (savedNC?.id) {
          // Uygunsuzluk kaydını güncelle
          await supabase
            .from('nonconformity_records')
            .update({
              status: type === 'DF' ? 'DF Açıldı' : '8D Açıldı',
              source_nc_id: savedNC.id
            })
            .eq('id', record.id);
          fetchRecords();
        }
      });
    }

    setConvertDialog({ open: false, record: null, type: null });
  };

  const handleSaveSuccess = (savedRecord) => {
    fetchRecords();

    if (!settings?.auto_suggest || !savedRecord) return;

    setTimeout(async () => {
      const dfQtyThreshold = settings.df_quantity_threshold || 10;
      const eightDQtyThreshold = settings.eight_d_quantity_threshold || 20;
      let newStatus = null;
      let toastConfig = null;

      // 1) Adet bazlı kontrol
      if (savedRecord.quantity >= eightDQtyThreshold) {
        newStatus = '8D Önerildi';
        toastConfig = {
          variant: 'destructive',
          title: '8D Önerisi (Yüksek Adet)',
          description: `Tek seferde ${savedRecord.quantity} adet hatalı ürün tespit edildi. 8D açılması önerilir!`,
        };
      } else if (savedRecord.quantity >= dfQtyThreshold) {
        newStatus = 'DF Önerildi';
        toastConfig = {
          variant: 'warning',
          title: 'DF Önerisi (Yüksek Adet)',
          description: `Tek seferde ${savedRecord.quantity} adet hatalı ürün tespit edildi. DF açılması önerilir!`,
        };
      }

      // 2) Tekrar bazlı kontrol (adet eşiğini geçmediyse)
      if (!newStatus && savedRecord.part_code) {
        const { data: recurrence } = await supabase.rpc('check_part_code_recurrence', {
          p_part_code: savedRecord.part_code,
          p_period_days: settings.threshold_period_days || 30
        });

        if (recurrence) {
          const count = recurrence.period_count;
          if (count >= (settings.eight_d_threshold || 5)) {
            newStatus = '8D Önerildi';
            toastConfig = {
              variant: 'destructive',
              title: '8D Önerisi',
              description: `"${savedRecord.part_code}" parça kodunda ${settings.threshold_period_days} gün içinde ${count} kayıt tespit edildi. 8D açılması önerilir!`,
            };
          } else if (count >= (settings.df_threshold || 3)) {
            newStatus = 'DF Önerildi';
            toastConfig = {
              variant: 'warning',
              title: 'DF Önerisi (Tekrar)',
              description: `"${savedRecord.part_code}" parça kodunda ${settings.threshold_period_days} gün içinde ${count} kayıt tespit edildi. DF açılması önerilir!`,
            };
          }
        }
      }

      // 3) Durumu güncelle — eşik aşıldıysa öner, düşerse "Açık"a döndür
      const currentStatus = savedRecord.status;
      const isCurrentlySuggested = ['DF Önerildi', '8D Önerildi'].includes(currentStatus);

      if (newStatus && currentStatus !== newStatus && !['DF Açıldı', '8D Açıldı', 'Kapatıldı'].includes(currentStatus)) {
        await supabase.from('nonconformity_records')
          .update({ status: newStatus })
          .eq('id', savedRecord.id);
        if (toastConfig) toast({ ...toastConfig, duration: 10000 });
        fetchRecords();
      } else if (!newStatus && isCurrentlySuggested) {
        await supabase.from('nonconformity_records')
          .update({ status: 'Açık' })
          .eq('id', savedRecord.id);
        toast({
          title: 'Öneri Kaldırıldı',
          description: 'Kayıt artık eşik değerlerini aşmıyor, durum "Açık" olarak güncellendi.',
          duration: 5000,
        });
        fetchRecords();
      }
    }, 500);
  };

  // Dashboard istatistikleri
  const stats = useMemo(() => {
    const total = records.length;
    const open = records.filter(r => r.status === 'Açık').length;
    const dfSuggested = records.filter(r => r.status === 'DF Önerildi').length;
    const eightDSuggested = records.filter(r => r.status === '8D Önerildi').length;
    const converted = records.filter(r => ['DF Açıldı', '8D Açıldı'].includes(r.status)).length;
    const closed = records.filter(r => r.status === 'Kapatıldı').length;
    const critical = records.filter(r => r.severity === 'Kritik' && r.status !== 'Kapatıldı').length;

    // En çok tekrarlayan parça kodları
    const partCounts = {};
    records.filter(r => r.part_code && r.status !== 'Kapatıldı').forEach(r => {
      partCounts[r.part_code] = (partCounts[r.part_code] || 0) + 1;
    });
    const topParts = Object.entries(partCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Kategori dağılımı
    const categoryCounts = {};
    records.forEach(r => {
      const cat = r.category || 'Belirsiz';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // En çok sorumlu personeller (sorumlu oldukları uygunsuzluk sayısına göre)
    const responsibleCounts = {};
    records.filter(r => r.responsible_person && r.status !== 'Kapatıldı').forEach(r => {
      responsibleCounts[r.responsible_person] = (responsibleCounts[r.responsible_person] || 0) + 1;
    });
    const topResponsiblePersonnel = Object.entries(responsibleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // En çok tespit eden personeller (raporladıkları uygunsuzluk sayısına göre)
    const detectedByCounts = {};
    records.filter(r => r.detected_by).forEach(r => {
      detectedByCounts[r.detected_by] = (detectedByCounts[r.detected_by] || 0) + 1;
    });
    const topDetectedByPersonnel = Object.entries(detectedByCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, open, dfSuggested, eightDSuggested, converted, closed, critical, topParts, topCategories, topResponsiblePersonnel, topDetectedByPersonnel };
  }, [records]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="list" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <ClipboardList className="w-4 h-4" /> Kayıtlar
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <BarChart3 className="w-4 h-4" /> Analiz
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="w-4 h-4" /> Ayarlar
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => { setSelectedRecord(null); setIsFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-2" /> Yeni Uygunsuzluk
          </Button>
        </div>

        {/* KAYITLAR */}
        <TabsContent value="list" className="space-y-4">
          {/* Üst istatistik kartları */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard title="Toplam" value={stats.total} icon={<ClipboardList className="h-4 w-4" />} color="text-gray-600" />
            <StatCard title="Açık" value={stats.open} icon={<AlertTriangle className="h-4 w-4" />} color="text-blue-600" />
            <StatCard title="DF Önerisi" value={stats.dfSuggested} icon={<FileText className="h-4 w-4" />} color="text-indigo-600" />
            <StatCard title="8D Önerisi" value={stats.eightDSuggested} icon={<AlertOctagon className="h-4 w-4" />} color="text-purple-600" />
            <StatCard title="Dönüştürülen" value={stats.converted} icon={<ExternalLink className="h-4 w-4" />} color="text-emerald-600" />
            <StatCard title="Kritik" value={stats.critical} icon={<AlertTriangle className="h-4 w-4" />} color="text-red-600" />
          </div>

          {/* Filtreler */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Parça kodu, açıklama, kayıt no ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Ciddiyet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Ciddiyet</SelectItem>
                <SelectItem value="Düşük">Düşük</SelectItem>
                <SelectItem value="Orta">Orta</SelectItem>
                <SelectItem value="Yüksek">Yüksek</SelectItem>
                <SelectItem value="Kritik">Kritik</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { fetchRecords(); fetchSettings(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Tablo */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Henüz uygunsuzluk kaydı bulunmuyor.</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <SortableHeader label="Kayıt No" columnKey="record_number" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Parça Kodu" columnKey="part_code" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">Açıklama</th>
                    <SortableHeader label="Kategori" columnKey="category" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Ciddiyet" columnKey="severity" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Adet" columnKey="quantity" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Tarih" columnKey="detection_date" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">Öneri</th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, idx) => {
                    const suggestion = getRecordSuggestion(record);
                    const repeatCount = record.part_code ? partCodeAnalysis[record.part_code]?.inPeriod || 0 : 0;
                    const isQuantityBased = suggestion && settings && record.quantity >= (settings.df_quantity_threshold || 10) && !(record.part_code && partCodeAnalysis[record.part_code]?.inPeriod >= (settings.df_threshold || 3));

                    return (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { setDetailRecord(record); setIsDetailOpen(true); }}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold">{record.record_number || '-'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{record.part_code || '-'}</span>
                            {repeatCount > 1 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                x{repeatCount}
                              </Badge>
                            )}
                          </div>
                          {record.part_name && <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{record.part_name}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="truncate max-w-[200px] text-xs">{record.description}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{record.category || '-'}</td>
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[10px] ${severityColors[record.severity] || ''}`}>
                            {record.severity}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">{record.quantity}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {record.detection_date ? new Date(record.detection_date).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[10px] ${statusColors[record.status] || ''}`}>
                            {record.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {suggestion && !['DF Açıldı', '8D Açıldı', 'Kapatıldı'].includes(record.status) && (
                            <div className="flex flex-col items-start gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-7 text-[10px] font-bold gap-1 ${
                                  suggestion === '8D'
                                    ? 'border-red-300 text-red-700 hover:bg-red-50'
                                    : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                }`}
                                onClick={() => setConvertDialog({ open: true, record, type: suggestion })}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {suggestion} Aç
                              </Button>
                              <span className="text-[9px] text-muted-foreground">
                                {isQuantityBased ? `${record.quantity} adet` : `${repeatCount}x tekrar`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setDetailRecord(record); setIsDetailOpen(true); }}>
                                <Eye className="h-4 w-4 mr-2" /> Görüntüle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedRecord(record); setIsFormOpen(true); }}>
                                <Edit className="h-4 w-4 mr-2" /> Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!['DF Açıldı', '8D Açıldı', 'Kapatıldı'].includes(record.status) && (
                                <>
                                  <DropdownMenuItem onClick={() => setConvertDialog({ open: true, record, type: 'DF' })}>
                                    <FileText className="h-4 w-4 mr-2" /> DF'ye Dönüştür
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setConvertDialog({ open: true, record, type: '8D' })}>
                                    <AlertOctagon className="h-4 w-4 mr-2" /> 8D'ye Dönüştür
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {record.source_nc_id && (
                                <DropdownMenuItem onClick={() => {
                                  if (onOpenNCView) onOpenNCView({ id: record.source_nc_id });
                                }}>
                                  <ExternalLink className="h-4 w-4 mr-2" /> DF/8D Kaydını Görüntüle
                                </DropdownMenuItem>
                              )}
                              {record.status === 'Açık' && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    await supabase.from('nonconformity_records').update({ status: 'Kapatıldı' }).eq('id', record.id);
                                    toast({ title: 'Başarılı', description: 'Kayıt kapatıldı.' });
                                    fetchRecords();
                                  }}
                                >
                                  <AlertTriangle className="h-4 w-4 mr-2" /> Kapat
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(record)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-right">{filteredRecords.length} / {records.length} kayıt</p>
        </TabsContent>

        {/* ANALİZ / DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <DashboardCard title="Toplam Kayıt" value={stats.total} color="bg-gray-500" />
            <DashboardCard title="Açık Kayıtlar" value={stats.open} color="bg-blue-500" />
            <DashboardCard title="DF/8D Önerisi" value={stats.dfSuggested + stats.eightDSuggested} color="bg-amber-500" />
            <DashboardCard title="Dönüştürülen" value={stats.converted} color="bg-green-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* En çok tekrarlayan parça kodları */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  En Çok Tekrarlayan Parça Kodları
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topParts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topParts.map(([code, count], i) => {
                      const maxCount = stats.topParts[0]?.[1] || 1;
                      const pct = (count / maxCount) * 100;
                      const isOverDf = settings && count >= (settings.df_threshold || 3);
                      const isOver8d = settings && count >= (settings.eight_d_threshold || 5);

                      return (
                        <div key={code} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-mono font-medium">{code}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{count}</span>
                              {isOver8d && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">8D</Badge>}
                              {isOverDf && !isOver8d && <Badge className="text-[9px] px-1.5 py-0 bg-blue-600">DF</Badge>}
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isOver8d ? 'bg-red-500' : isOverDf ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Kategori dağılımı */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Kategori Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topCategories.map(([cat, count]) => {
                      const maxCount = stats.topCategories[0]?.[1] || 1;
                      const pct = (count / maxCount) * 100;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{cat}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Personel analizi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  En Çok Sorumlu Personeller
                </CardTitle>
                <p className="text-xs text-muted-foreground">Sorumlu oldukları uygunsuzluk sayısına göre</p>
              </CardHeader>
              <CardContent>
                {stats.topResponsiblePersonnel.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topResponsiblePersonnel.map(([name, count]) => {
                      const maxCount = stats.topResponsiblePersonnel[0]?.[1] || 1;
                      const pct = (count / maxCount) * 100;
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate">{name}</span>
                            <span className="font-semibold text-amber-600 shrink-0 ml-2">{count}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-600" />
                  En Çok Tespit Eden Personeller
                </CardTitle>
                <p className="text-xs text-muted-foreground">Raporladıkları uygunsuzluk sayısına göre</p>
              </CardHeader>
              <CardContent>
                {stats.topDetectedByPersonnel.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Veri yok</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topDetectedByPersonnel.map(([name, count]) => {
                      const maxCount = stats.topDetectedByPersonnel[0]?.[1] || 1;
                      const pct = (count / maxCount) * 100;
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate">{name}</span>
                            <span className="font-semibold text-indigo-600 shrink-0 ml-2">{count}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Eşik uyarıları - kayıtlarla birlikte */}
          {settings?.auto_suggest && (() => {
            const allWarningRecords = records.filter(r => {
              if (['DF Açıldı', '8D Açıldı', 'Kapatıldı'].includes(r.status)) return false;
              const suggestion = getRecordSuggestion(r);
              return suggestion !== null;
            });
            if (allWarningRecords.length === 0) return null;

            const groupedByPartCode = {};
            allWarningRecords.forEach(r => {
              const key = r.part_code || `_qty_${r.id}`;
              if (!groupedByPartCode[key]) groupedByPartCode[key] = [];
              groupedByPartCode[key].push(r);
            });

            return (
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    Eşik Aşımı Uyarıları ({allWarningRecords.length} kayıt)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groupedByPartCode)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([code, groupRecords]) => {
                        const suggestion = getRecordSuggestion(groupRecords[0]);
                        const is8D = suggestion === '8D';
                        const repeatCount = partCodeAnalysis[code]?.inPeriod || 0;

                        return (
                          <div key={code} className="rounded-lg bg-white dark:bg-background border overflow-hidden">
                            <div className="flex items-center justify-between p-3 bg-muted/30">
                              <div className="flex items-center gap-3">
                                {is8D ? (
                                  <AlertOctagon className="h-5 w-5 text-red-600" />
                                ) : (
                                  <FileText className="h-5 w-5 text-blue-600" />
                                )}
                                <div>
                                  <span className="font-mono font-semibold text-sm">{code.startsWith('_qty_') ? 'Yüksek Adet' : code}</span>
                                  <p className="text-xs text-muted-foreground">
                                    {repeatCount > 1
                                      ? `Son ${settings.threshold_period_days} günde ${repeatCount} tekrar`
                                      : `${groupRecords.length} kayıt`
                                    }
                                  </p>
                                </div>
                              </div>
                              <Badge className={is8D ? 'bg-red-600' : 'bg-blue-600'}>
                                {is8D ? '8D Önerilir' : 'DF Önerilir'}
                              </Badge>
                            </div>
                            <div className="divide-y">
                              {groupRecords.map(record => {
                                const recSuggestion = getRecordSuggestion(record);
                                return (
                                  <div key={record.id} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <span className="font-mono text-muted-foreground shrink-0">{record.record_number}</span>
                                      <span className="truncate text-foreground">{record.description?.substring(0, 60)}</span>
                                      <Badge className={`text-[9px] shrink-0 ${severityColors[record.severity] || ''}`}>{record.severity}</Badge>
                                      <span className="text-muted-foreground shrink-0">x{record.quantity}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={`h-6 text-[10px] font-bold gap-1 ${
                                          recSuggestion === '8D'
                                            ? 'border-red-300 text-red-700 hover:bg-red-50'
                                            : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                        }`}
                                        onClick={() => setConvertDialog({ open: true, record, type: recSuggestion || 'DF' })}
                                      >
                                        {recSuggestion || 'DF'} Aç
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* AYARLAR */}
        <TabsContent value="settings">
          <NonconformitySettings />
        </TabsContent>
      </Tabs>

      {/* Form Modal */}
      <NonconformityFormModal
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        record={selectedRecord}
        onSaveSuccess={handleSaveSuccess}
      />

      {/* Detail Modal */}
      <NonconformityDetailModal
        isOpen={isDetailOpen}
        setIsOpen={setIsDetailOpen}
        record={detailRecord}
      />

      {/* Silme Onayı */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydı silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.record_number}" numaralı uygunsuzluk kaydı kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DF/8D Dönüştürme Onayı */}
      <Dialog open={convertDialog.open} onOpenChange={(open) => !open && setConvertDialog({ open: false, record: null, type: null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {convertDialog.type === '8D' ? (
                <AlertOctagon className="h-5 w-5 text-red-600" />
              ) : (
                <FileText className="h-5 w-5 text-blue-600" />
              )}
              {convertDialog.type} Oluştur
            </DialogTitle>
            <DialogDescription>
              Bu uygunsuzluk kaydı {convertDialog.type === 'DF' ? 'Düzeltici Faaliyet (DF)' : '8D Problem Çözme'} sürecine dönüştürülecektir.
            </DialogDescription>
          </DialogHeader>

          {convertDialog.record && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kayıt No:</span>
                  <span className="font-mono font-semibold">{convertDialog.record.record_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Parça Kodu:</span>
                  <span className="font-semibold">{convertDialog.record.part_code || '-'}</span>
                </div>
                {convertDialog.record.part_code && partCodeAnalysis[convertDialog.record.part_code] && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tekrar Sayısı:</span>
                    <span className="font-semibold text-amber-600">{partCodeAnalysis[convertDialog.record.part_code].inPeriod}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hatalı Adet:</span>
                  <span className="font-semibold">{convertDialog.record.quantity || '-'}</span>
                </div>
                {convertDialog.record.responsible_person && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sorumlu Kişi:</span>
                    <span className="font-semibold">{convertDialog.record.responsible_person}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1 pt-2 border-t">
                  {convertDialog.record.description?.substring(0, 120)}...
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  {convertDialog.type} formu, uygunsuzluk kaydındaki bilgilerle otomatik doldurulacak ve {convertDialog.type} oluşturma ekranı açılacaktır.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialog({ open: false, record: null, type: null })}>
              İptal
            </Button>
            <Button
              onClick={handleConvertToDF8D}
              className={convertDialog.type === '8D' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {convertDialog.type} Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
    <div className={`${color} shrink-0`}>{icon}</div>
    <div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{title}</p>
    </div>
  </div>
);

const DashboardCard = ({ title, value, color }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center text-white font-bold text-lg`}>
          {value}
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      </div>
    </CardContent>
  </Card>
);

const SortableHeader = ({ label, columnKey, sortConfig, onSort }) => (
  <th
    className="px-3 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
    onClick={() => onSort(columnKey)}
  >
    <span className="inline-flex items-center">
      {label}
      {sortConfig.key === columnKey ? (
        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-primary" /> : <ArrowDown className="w-3 h-3 ml-1 text-primary" />
      ) : (
        <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
      )}
    </span>
  </th>
);

export default NonconformityModule;
