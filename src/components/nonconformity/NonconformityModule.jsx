import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, MoreHorizontal, Eye, Edit, Trash2, AlertTriangle,
  FileText, ArrowUpDown, ArrowUp, ArrowDown, Settings2, BarChart3,
  ClipboardList, Filter, RefreshCw, ExternalLink, TrendingUp, AlertOctagon,
  Layers, ChevronDown, ChevronUp
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
import { openPrintableReport } from '@/lib/reportUtils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  backfillVehicleFaultNonconformities,
  parseNonconformityRecordNumber
} from '@/lib/vehicleFaultNonconformitySync';
import { backfillProcessInspectionNonconformities } from '@/lib/processInspectionNonconformitySync';
import { backfillLeakTestNonconformities } from '@/lib/leakTestNonconformitySync';
import {
  buildNonconformityDisplayNumberMap,
  getNonconformityDisplayRecordNumber
} from '@/lib/nonconformityRecordNumbers';

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

const CONVERTED_STATUSES = new Set(['DF Açıldı', '8D Açıldı']);

/** non_conformities kaydı hâlâ varsa (DF/8D silindiyse bağ kopar; tetikleyici status'ü Açık yapar) */
const isNonconformityLinkedToDf8d = (record) =>
  !!record?.source_nc_id && CONVERTED_STATUSES.has(record?.status);

/** PostgREST embed: linked_nc veya dizi dönüşü */
const getLinkedNcMeta = (record) => {
  const raw = record?.linked_nc;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row?.nc_number && !record?.source_nc_id) return null;
  return {
    nc_number: row?.nc_number || null,
    type: row?.type || (record?.status === '8D Açıldı' ? '8D' : 'DF'),
  };
};

const getStoredSuggestionType = (status) => {
  if (status === 'DF Önerildi') return 'DF';
  if (status === '8D Önerildi') return '8D';
  return null;
};

const INITIAL_CONVERT_DIALOG = {
  open: false,
  record: null,
  source: null,
  suggestedType: null,
  selectedType: null,
};

const NonconformityModule = ({ onOpenNCForm, onOpenNCView }) => {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'record_number', direction: 'desc' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [settings, setSettings] = useState(null);
  const [partCodeAnalysis, setPartCodeAnalysis] = useState({});
  const [categoryAnalysis, setCategoryAnalysis] = useState({});
  const [convertDialog, setConvertDialog] = useState(INITIAL_CONVERT_DIALOG);
  const [groupConvertDialog, setGroupConvertDialog] = useState({ open: false, group: null, selectedType: null });
  const [groupPanelOpen, setGroupPanelOpen] = useState(true);
  const [vehicleFaultSyncDone, setVehicleFaultSyncDone] = useState(false);
  const [processInspectionSyncDone, setProcessInspectionSyncDone] = useState(false);
  const [leakTestSyncDone, setLeakTestSyncDone] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const pageSize = 1000;
      const allRows = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('nonconformity_records')
          .select('*, linked_nc:non_conformities!source_nc_id(nc_number,type)')
          .order('record_number', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data || [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      setRecords(allRows);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Hata', description: err.message });
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

  useEffect(() => {
    if (vehicleFaultSyncDone || authLoading || !user) return;

    let isCancelled = false;

    const syncVehicleFaultRecords = async () => {
      try {
        const stats = await backfillVehicleFaultNonconformities({
          supabase,
          reporterName: profile?.full_name || user?.email || null,
          userId: user?.id || null,
        });

        if (isCancelled) return;

        setVehicleFaultSyncDone(true);

        if (stats.created || stats.updated || stats.deletedDuplicates) {
          await fetchRecords();

          toast({
            title: 'Araç Hataları Senkronize Edildi',
            description: [
              stats.created > 0 ? `${stats.created} yeni kayıt açıldı` : null,
              stats.deletedDuplicates > 0 ? `${stats.deletedDuplicates} kayıt birleştirildi` : null,
              stats.updated > 0 ? `${stats.updated} kayıt güncellendi` : null,
            ].filter(Boolean).join(', ')
          });
        }
      } catch (error) {
        if (isCancelled) return;

        console.error('Araç hataları uygunsuzluk senkronizasyonu başarısız:', error);
        setVehicleFaultSyncDone(true);
        toast({
          variant: 'destructive',
          title: 'Senkronizasyon Hatası',
          description: `Araç hataları uygunsuzluk kayıtlarına aktarılırken hata oluştu: ${error.message}`
        });
      }
    };

    void syncVehicleFaultRecords();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, fetchRecords, profile?.full_name, toast, user, user?.email, user?.id, vehicleFaultSyncDone]);

  useEffect(() => {
    if (!vehicleFaultSyncDone || processInspectionSyncDone || authLoading || !user) return;

    let isCancelled = false;

    const syncProcessInspectionRecords = async () => {
      try {
        const stats = await backfillProcessInspectionNonconformities({
          supabase,
          userId: user?.id || null,
        });

        if (isCancelled) return;

        setProcessInspectionSyncDone(true);

        if (stats.created || stats.updated || stats.deletedDuplicates) {
          await fetchRecords();

          toast({
            title: 'Proses Muayene Uygunsuzlukları Senkronize Edildi',
            description: [
              stats.created > 0 ? `${stats.created} yeni kayıt açıldı` : null,
              stats.deletedDuplicates > 0 ? `${stats.deletedDuplicates} kayıt birleştirildi` : null,
              stats.updated > 0 ? `${stats.updated} kayıt güncellendi` : null,
            ].filter(Boolean).join(', ')
          });
        }
      } catch (error) {
        if (isCancelled) return;

        console.error('Proses muayene uygunsuzluk senkronizasyonu başarısız:', error);
        setProcessInspectionSyncDone(true);
        toast({
          variant: 'destructive',
          title: 'Senkronizasyon Hatası',
          description: `Proses muayene uygunsuzluk kayıtları aktarılırken hata oluştu: ${error.message}`
        });
      }
    };

    void syncProcessInspectionRecords();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, fetchRecords, processInspectionSyncDone, toast, user, user?.id, vehicleFaultSyncDone]);

  useEffect(() => {
    if (!processInspectionSyncDone || leakTestSyncDone || authLoading || !user) return;

    let isCancelled = false;

    const syncLeakTestRecords = async () => {
      try {
        const stats = await backfillLeakTestNonconformities({
          supabase,
          userId: user?.id || null,
        });

        if (isCancelled) return;

        setLeakTestSyncDone(true);

        if (
          stats.created ||
          stats.updated ||
          stats.deletedDuplicates ||
          stats.deleted ||
          stats.preserved
        ) {
          await fetchRecords();

          toast({
            title: 'Sızdırmazlık uygunsuzlukları senkronize edildi',
            description: [
              stats.created > 0 ? `${stats.created} yeni kayıt açıldı` : null,
              stats.updated > 0 ? `${stats.updated} kayıt güncellendi` : null,
              stats.deleted > 0 ? `${stats.deleted} kayıt kaldırıldı` : null,
              stats.preserved > 0 ? `${stats.preserved} kayıt DF/8D nedeniyle korundu` : null,
              stats.deletedDuplicates > 0 ? `${stats.deletedDuplicates} yinelenen kayıt birleştirildi` : null,
            ].filter(Boolean).join(', '),
          });
        }
      } catch (error) {
        if (isCancelled) return;

        console.error('Sızdırmazlık uygunsuzluk senkronizasyonu başarısız:', error);
        setLeakTestSyncDone(true);
        toast({
          variant: 'destructive',
          title: 'Senkronizasyon hatası',
          description: `Sızdırmazlık kayıtları uygunsuzluğa aktarılırken hata oluştu: ${error.message}`,
        });
      }
    };

    void syncLeakTestRecords();

    return () => {
      isCancelled = true;
    };
  }, [
    authLoading,
    fetchRecords,
    leakTestSyncDone,
    processInspectionSyncDone,
    toast,
    user,
    user?.id,
  ]);

  // Parça kodu ve kategori bazlı tekrar analizi — settings yüklenmeden de çalışır
  useEffect(() => {
    if (!records.length) return;

    const periodDays = settings?.threshold_period_days || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const partAnalysis = {};
    const catAnalysis = {};
    const activeRecords = records.filter(r => r.status !== 'Kapatıldı' && !isNonconformityLinkedToDf8d(r));

    activeRecords.forEach(record => {
      const inPeriod = new Date(record.detection_date) >= cutoffDate;

      // Parça kodu analizi
      if (record.part_code) {
        if (!partAnalysis[record.part_code]) {
          partAnalysis[record.part_code] = { total: 0, inPeriod: 0, records: [] };
        }
        partAnalysis[record.part_code].total += 1;
        if (inPeriod) partAnalysis[record.part_code].inPeriod += 1;
        partAnalysis[record.part_code].records.push(record);
      }

      // Kategori analizi
      if (record.category) {
        if (!catAnalysis[record.category]) {
          catAnalysis[record.category] = { total: 0, inPeriod: 0, records: [] };
        }
        catAnalysis[record.category].total += 1;
        if (inPeriod) catAnalysis[record.category].inPeriod += 1;
        catAnalysis[record.category].records.push(record);
      }
    });

    setPartCodeAnalysis(partAnalysis);
    setCategoryAnalysis(catAnalysis);
  }, [records, settings]);

  const smartGroups = useMemo(() => {
    if (!records.length) return [];

    const dfThreshold = settings?.df_threshold ?? 5;
    const eightDThreshold = settings?.eight_d_threshold ?? 10;
    const dfQtyThreshold = settings?.df_quantity_threshold ?? 10;
    const eightDQtyThreshold = settings?.eight_d_quantity_threshold ?? 20;

    const eligible = records.filter(r =>
      r.status === 'Açık' && !r.source_nc_id
    );

    const buckets = {};
    eligible.forEach(r => {
      const key = `${r.detection_area || 'Belirsiz'}|||${r.category || 'Belirsiz'}`;
      if (!buckets[key]) {
        buckets[key] = {
          key,
          detection_area: r.detection_area || 'Belirsiz',
          category: r.category || 'Belirsiz',
          records: [],
          totalQuantity: 0,
          severities: {},
        };
      }
      buckets[key].records.push(r);
      buckets[key].totalQuantity += (r.quantity || 1);
      const sev = r.severity || 'Belirsiz';
      buckets[key].severities[sev] = (buckets[key].severities[sev] || 0) + 1;
    });

    return Object.values(buckets)
      .map(g => {
        const cnt = g.records.length;
        let suggestion = null;
        let reason = '';

        if (cnt >= eightDThreshold) {
          suggestion = '8D';
          reason = `${cnt} kayıt (eşik: ${eightDThreshold})`;
        } else if (cnt >= dfThreshold) {
          suggestion = 'DF';
          reason = `${cnt} kayıt (eşik: ${dfThreshold})`;
        }

        if (g.totalQuantity >= eightDQtyThreshold && suggestion !== '8D') {
          suggestion = '8D';
          reason = `Toplam ${g.totalQuantity} adet (eşik: ${eightDQtyThreshold})`;
        } else if (g.totalQuantity >= dfQtyThreshold && !suggestion) {
          suggestion = 'DF';
          reason = `Toplam ${g.totalQuantity} adet (eşik: ${dfQtyThreshold})`;
        }

        return { ...g, suggestion, reason };
      })
      .filter(g => g.suggestion)
      .sort((a, b) => {
        if (a.suggestion !== b.suggestion) return a.suggestion === '8D' ? -1 : 1;
        return b.records.length - a.records.length;
      });
  }, [records, settings]);

  const recordGroupMap = useMemo(() => {
    const map = new Map();
    smartGroups.forEach(g => g.records.forEach(r => map.set(r.id, g)));
    return map;
  }, [smartGroups]);

  const getRecordSuggestion = useCallback((record) => {
    // DF/8D açılmışsa öneri gösterme; Kapatıldı olsa bile öneri göster
    if (isNonconformityLinkedToDf8d(record)) return null;

    // Eşik değerleri — settings yüklenmemişse varsayılanlar kullanılır
    const dfQtyThreshold = settings?.df_quantity_threshold ?? 10;
    const eightDQtyThreshold = settings?.eight_d_quantity_threshold ?? 20;
    const dfThreshold = settings?.df_threshold ?? 3;
    const eightDThreshold = settings?.eight_d_threshold ?? 5;

    // 1) Adet bazlı kontrol: tek seferde yüksek adet
    if (record.quantity) {
      if (record.quantity >= eightDQtyThreshold) return '8D';
      if (record.quantity >= dfQtyThreshold) return 'DF';
    }

    // 2) Parça kodu bazlı tekrar kontrolü
    const partCount = record.part_code ? (partCodeAnalysis[record.part_code]?.inPeriod || 0) : 0;

    // 3) Kategori bazlı tekrar kontrolü
    const catCount = record.category ? (categoryAnalysis[record.category]?.inPeriod || 0) : 0;

    // En yüksek tekrar sayısını kullan (parça kodu veya kategori hangisi daha kritikse)
    const maxCount = Math.max(partCount, catCount);
    if (maxCount === 0) return null;

    if (maxCount >= eightDThreshold) return '8D';
    if (maxCount >= dfThreshold) return 'DF';
    return null;
  }, [settings, partCodeAnalysis, categoryAnalysis]);

  const getEffectiveSuggestionForStats = useCallback((record) => {
    if (!record || isNonconformityLinkedToDf8d(record)) return null;

    if (settings?.auto_suggest) {
      return getRecordSuggestion(record);
    }

    return getStoredSuggestionType(record.status);
  }, [getRecordSuggestion, settings?.auto_suggest]);

  const displayRecordNumberMap = useMemo(
    () => buildNonconformityDisplayNumberMap(records),
    [records]
  );

  const getDisplayRecordNumber = useCallback(
    (record) => getNonconformityDisplayRecordNumber(record, displayRecordNumberMap),
    [displayRecordNumberMap]
  );

  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        getDisplayRecordNumber(r).toLowerCase().includes(lower) ||
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
        case 'record_number':
          aVal = parseNonconformityRecordNumber(getDisplayRecordNumber(a));
          bVal = parseNonconformityRecordNumber(getDisplayRecordNumber(b));
          break;
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
  }, [getDisplayRecordNumber, records, searchTerm, statusFilter, severityFilter, sortConfig]);

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

  const handleGenerateReport = useCallback(() => {
    if (filteredRecords.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Rapor oluşturmak için en az bir uygunsuzluk kaydı olmalıdır.',
      });
      return;
    }

    const statusCounts = filteredRecords.reduce((acc, item) => {
      const key = item.status || 'Belirsiz';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const severityCounts = filteredRecords.reduce((acc, item) => {
      const key = item.severity || 'Belirsiz';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const personnelPerformance = Object.values(filteredRecords.reduce((acc, item) => {
      const name = item.responsible_person || item.detected_by || 'Atanmamış';

      if (!acc[name]) {
        acc[name] = {
          name,
          total: 0,
          closed: 0,
          open: 0,
          critical: 0,
          quantity: 0,
        };
      }

      acc[name].total += 1;
      acc[name].quantity += Number(item.quantity) || 0;

      if (item.status === 'Kapatıldı') {
        acc[name].closed += 1;
      } else {
        acc[name].open += 1;
      }

      if (item.severity === 'Kritik') {
        acc[name].critical += 1;
      }

      return acc;
    }, {})).map((person) => ({
      ...person,
      closeRate: person.total > 0 ? Math.round((person.closed / person.total) * 100) : 0,
    })).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.closed !== a.closed) return b.closed - a.closed;
      return a.name.localeCompare(b.name, 'tr');
    });

    const reportData = {
      id: `nonconformity-record-list-${Date.now()}`,
      title: 'Uygunsuzluk Yönetimi Liste Raporu',
      statusCounts,
      severityCounts,
      personnelPerformance,
      items: filteredRecords.map((item) => ({
        record_number: getDisplayRecordNumber(item),
        part_code: item.part_code || '-',
        part_name: item.part_name || '-',
        category: item.category || '-',
        severity: item.severity || '-',
        quantity: item.quantity || 0,
        detection_date: item.detection_date ? new Date(item.detection_date).toLocaleDateString('tr-TR') : '-',
        status: item.status || '-',
        responsible_person: item.responsible_person || '-',
      })),
    };

    openPrintableReport(reportData, 'nonconformity_record_list', true);
  }, [filteredRecords, getDisplayRecordNumber, toast]);

  const closeConvertDialog = useCallback(() => {
    setConvertDialog(INITIAL_CONVERT_DIALOG);
  }, []);

  const openConvertDialog = useCallback(({ record, type, source = 'manual', suggestedType = null }) => {
    const normalizedType = type || suggestedType;
    if (!record || !normalizedType) return;

    setConvertDialog({
      open: true,
      record,
      source,
      suggestedType: source === 'suggestion' ? (suggestedType || normalizedType) : null,
      selectedType: normalizedType,
    });
  }, []);

  const handleConvertToDF8D = async () => {
    const { record, selectedType } = convertDialog;
    if (!record || !selectedType) return;

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
    const recNo = getDisplayRecordNumber(record);
    const partCount = record.part_code ? (partCodeAnalysis[record.part_code]?.inPeriod || 0) : 0;
    const catCount = record.category ? (categoryAnalysis[record.category]?.inPeriod || 0) : 0;

    const L = [
      '■ KAYNAK BİLGİSİ',
      `  Uygunsuzluk No : ${recNo}`,
      `  Tespit Tarihi  : ${fmtDate(record.detection_date)}`,
      `  Tespit Alanı   : ${record.detection_area || '-'}`,
      `  Tespit Eden    : ${record.detected_by || '-'}`,
      `  Ciddiyet       : ${record.severity || '-'}`,
      record.shift ? `  Vardiya         : ${record.shift}` : null,
      '',
      '■ ÜRÜN / PARÇA BİLGİSİ',
      record.part_code ? `  Parça Kodu      : ${record.part_code}` : null,
      record.part_name ? `  Parça Adı       : ${record.part_name}` : null,
      record.vehicle_type ? `  Araç Tipi       : ${record.vehicle_type}` : null,
      record.vehicle_identifier ? `  Araç Seri/Şasi  : ${record.vehicle_identifier}` : null,
      '',
      '■ UYGUNSUZLUK DETAYI',
      `  Kategori        : ${record.category || '-'}`,
      `  Hatalı Adet     : ${record.quantity || '-'}`,
      record.department ? `  Sorumlu Birim   : ${record.department}` : null,
      record.responsible_person ? `  Sorumlu Kişi    : ${record.responsible_person}` : null,
      '',
      '  Açıklama:',
      `  ${(record.description || '-').replace(/\n/g, '\n  ')}`,
    ];

    if (partCount > 1 || catCount > 1) {
      L.push('', '■ TEKRAR ANALİZİ');
      if (partCount > 1)
        L.push(`  Aynı parça kodu (${record.part_code}) son dönemde ${partCount} kez tekrarladı.`);
      if (catCount > 1)
        L.push(`  Aynı kategori (${record.category}) son dönemde ${catCount} kez tekrarladı.`);
    }

    if (record.action_taken) {
      L.push('', '■ ALINAN ACİL AKSİYON', `  ${record.action_taken.replace(/\n/g, '\n  ')}`);
    }

    if (record.notes) {
      L.push('', '■ EK NOTLAR', `  ${record.notes.replace(/\n/g, '\n  ')}`);
    }

    const titleParts = [record.category || 'Uygunsuzluk'];
    if (record.part_code) titleParts.push(record.part_code);
    else if (record.vehicle_type && record.vehicle_identifier) titleParts.push(`${record.vehicle_type}/${record.vehicle_identifier}`);
    else if (record.vehicle_type) titleParts.push(record.vehicle_type);

    const ncFormData = {
      title: `[UYG-${recNo}] ${titleParts.join(' — ')}`,
      description: L.filter(l => l !== null).join('\n'),
      type: selectedType,
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
              status: selectedType === 'DF' ? 'DF Açıldı' : '8D Açıldı',
              source_nc_id: savedNC.id
            })
            .eq('id', record.id);
          fetchRecords();
        }
      });
    }

    closeConvertDialog();
  };

  const handleGroupConvertToDF8D = async () => {
    const { group, selectedType } = groupConvertDialog;
    if (!group || !selectedType) return;

    const sorted = [...group.records].sort(
      (a, b) => new Date(a.detection_date || 0) - new Date(b.detection_date || 0)
    );
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
    const earliest = sorted[0]?.detection_date;
    const latest = sorted[sorted.length - 1]?.detection_date;

    const deptCounts = {};
    const vehicleCounts = {};
    const faultSnippets = {};
    sorted.forEach(r => {
      if (r.department) deptCounts[r.department] = (deptCounts[r.department] || 0) + 1;
      if (r.vehicle_type) vehicleCounts[r.vehicle_type] = (vehicleCounts[r.vehicle_type] || 0) + 1;

      const desc = r.description || '';
      const lines = desc.split('\n').filter(l => l.startsWith('- ') || l.startsWith('• '));
      lines.forEach(l => {
        const clean = l.replace(/^[-•]\s*/, '').trim();
        if (clean) faultSnippets[clean] = (faultSnippets[clean] || 0) + 1;
      });
    });

    const topDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
    const topVehicles = Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1]);
    const topFaults = Object.entries(faultSnippets).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const sevEntries = Object.entries(group.severities).sort((a, b) => b[1] - a[1]);

    const descLines = [
      '■ GRUP ÖZETİ',
      `  Kategori        : ${group.category}`,
      `  Tespit Alanı    : ${group.detection_area}`,
      `  Toplam Kayıt    : ${group.records.length}`,
      `  Toplam Adet     : ${group.totalQuantity}`,
      `  Dönem           : ${fmtDate(earliest)} — ${fmtDate(latest)}`,
      `  Ciddiyet Dağılımı: ${sevEntries.map(([s, c]) => `${s}: ${c}`).join(' | ')}`,
    ];

    if (topDepts.length > 0) {
      descLines.push('', '■ ETKİLENEN BİRİMLER');
      topDepts.forEach(([d, c]) => descLines.push(`  ${d}: ${c} kayıt`));
    }

    if (topVehicles.length > 0) {
      descLines.push('', '■ ETKİLENEN ARAÇ TİPLERİ');
      topVehicles.forEach(([v, c]) => descLines.push(`  ${v}: ${c} kayıt`));
    }

    if (topFaults.length > 0) {
      descLines.push('', '■ EN SIK TEKRARLAYAN HATALAR');
      topFaults.forEach(([f, c]) => descLines.push(`  • ${f}${c > 1 ? ` (${c}x)` : ''}`));
    }

    descLines.push('', '■ İLGİLİ UYGUNSUZLUK KAYITLARI');
    sorted.slice(0, 50).forEach(r => {
      const vInfo = [r.vehicle_type, r.vehicle_identifier].filter(Boolean).join('/');
      descLines.push(
        `  ${getDisplayRecordNumber(r)} | ${fmtDate(r.detection_date)} | ${vInfo || r.part_code || '-'} | x${r.quantity || 1} | ${r.severity || '-'}`
      );
    });
    if (sorted.length > 50) descLines.push(`  ... ve ${sorted.length - 50} kayıt daha`);

    const actionRecords = sorted.filter(r => r.action_taken);
    if (actionRecords.length > 0) {
      descLines.push('', '■ ALINAN ACİL AKSİYONLAR');
      actionRecords.slice(0, 10).forEach(r => {
        descLines.push(`  ${getDisplayRecordNumber(r)}: ${r.action_taken.substring(0, 120)}`);
      });
    }

    const mostCommonDept = topDepts[0]?.[0] || '';
    const mostCommonVehicle = topVehicles[0]?.[0] || '';

    const ncFormData = {
      title: `[UYG-GRUP] ${group.category} — ${group.detection_area} (${group.records.length} kayıt, ${group.totalQuantity} adet)`,
      description: descLines.join('\n'),
      type: selectedType,
      department: mostCommonDept,
      vehicle_type: mostCommonVehicle,
      priority: group.severities['Kritik'] ? 'Kritik' : group.severities['Yüksek'] ? 'Yüksek' : 'Orta',
    };

    setGroupConvertDialog({ open: false, group: null, selectedType: null });

    if (onOpenNCForm) {
      onOpenNCForm(ncFormData, async (savedNC) => {
        if (!savedNC?.id) return;
        const ids = group.records.map(r => r.id);
        const status = selectedType === 'DF' ? 'DF Açıldı' : '8D Açıldı';
        const BATCH = 100;
        for (let i = 0; i < ids.length; i += BATCH) {
          await supabase
            .from('nonconformity_records')
            .update({ status, source_nc_id: savedNC.id })
            .in('id', ids.slice(i, i + BATCH));
        }
        toast({
          title: 'Toplu Dönüştürme Başarılı',
          description: `${ids.length} uygunsuzluk kaydı tek ${selectedType} kaydına bağlandı. Sayaçlar sıfırlandı.`,
          duration: 6000,
        });
        fetchRecords();
      });
    }
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
    const summary = records.reduce((acc, record) => {
      acc.total += 1;

      if (record.severity === 'Kritik' && record.status !== 'Kapatıldı') {
        acc.critical += 1;
      }

      if (record.status === 'Kapatıldı') {
        acc.closed += 1;
        return acc;
      }

      if (CONVERTED_STATUSES.has(record.status)) {
        if (record.source_nc_id) {
          acc.converted += 1;
        } else {
          acc.open += 1;
        }
        return acc;
      }

      const suggestion = getEffectiveSuggestionForStats(record);

      if (suggestion === 'DF') {
        acc.dfSuggested += 1;
        return acc;
      }

      if (suggestion === '8D') {
        acc.eightDSuggested += 1;
        return acc;
      }

      acc.open += 1;
      return acc;
    }, {
      total: 0,
      open: 0,
      dfSuggested: 0,
      eightDSuggested: 0,
      converted: 0,
      closed: 0,
      critical: 0,
    });

    // En çok tekrarlayan parça kodları (Üretilen araçlar modülünden gelen seri/şasi numaralarını hariç tut)
    const partCounts = {};
    records.filter(r => r.part_code && r.status !== 'Kapatıldı' && r.detection_area !== 'Üretilen Araçlar').forEach(r => {
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
    const excludedDetectors = ['Üretilen Araçlar', 'Atakan Battal', 'atakan.battal@kademe.com.tr'];
    records.filter(r => r.detected_by && !excludedDetectors.includes(r.detected_by)).forEach(r => {
      detectedByCounts[r.detected_by] = (detectedByCounts[r.detected_by] || 0) + 1;
    });
    const topDetectedByPersonnel = Object.entries(detectedByCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { ...summary, topParts, topCategories, topResponsiblePersonnel, topDetectedByPersonnel };
  }, [getEffectiveSuggestionForStats, records]);

  const activeConvertType = convertDialog.selectedType || convertDialog.suggestedType;
  const is8DConversion = activeConvertType === '8D';

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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleGenerateReport}>
              <FileText className="w-4 h-4 mr-2" /> Rapor Al
            </Button>
            <Button onClick={() => { setSelectedRecord(null); setIsFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" /> Yeni Uygunsuzluk
            </Button>
          </div>
        </div>

        {/* KAYITLAR */}
        <TabsContent value="list" className="space-y-4">
          {/* Üst istatistik kartları */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard title="Toplam" value={stats.total} icon={<ClipboardList className="h-4 w-4" />} color="text-gray-600" />
            <StatCard title="Açık" value={stats.open} icon={<AlertTriangle className="h-4 w-4" />} color="text-blue-600" />
            <StatCard
              title="Grup Önerisi"
              value={smartGroups.length > 0 ? `${smartGroups.length}` : '0'}
              icon={<Layers className="h-4 w-4" />}
              color="text-amber-600"
              subtitle={smartGroups.length > 0 ? `${smartGroups.reduce((s, g) => s + g.records.length, 0)} kayıt` : undefined}
            />
            <StatCard title="Dönüştürülen" value={stats.converted} icon={<ExternalLink className="h-4 w-4" />} color="text-emerald-600" />
            <StatCard title="Kapatılan" value={stats.closed} icon={<FileText className="h-4 w-4" />} color="text-gray-500" />
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

          {/* Akıllı Gruplandırma Önerileri */}
          {smartGroups.length > 0 && settings?.auto_suggest && (
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 dark:border-amber-800">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setGroupPanelOpen(v => !v)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <Layers className="h-4 w-4" />
                    Toplu Dönüştürme Önerileri
                    <Badge variant="outline" className="text-[10px] border-amber-300 bg-white dark:bg-transparent">
                      {smartGroups.length} grup — {smartGroups.reduce((s, g) => s + g.records.length, 0)} kayıt
                    </Badge>
                  </CardTitle>
                  {groupPanelOpen
                    ? <ChevronUp className="h-4 w-4 text-amber-600" />
                    : <ChevronDown className="h-4 w-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Benzer uygunsuzluklar gruplandı. Tek seferde toplu DF/8D açarak sistemi verimli kullanın.
                </p>
              </CardHeader>
              {groupPanelOpen && (
                <CardContent className="pt-0">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {smartGroups.map(group => {
                      const is8D = group.suggestion === '8D';
                      const hasCritical = group.severities['Kritik'] > 0;
                      return (
                        <div
                          key={group.key}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            is8D
                              ? 'border-red-200 bg-white dark:bg-red-950/20 dark:border-red-800'
                              : 'border-blue-200 bg-white dark:bg-blue-950/20 dark:border-blue-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-xs truncate">{group.category}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{group.detection_area}</p>
                            </div>
                            <Badge className={`shrink-0 text-[10px] ${is8D ? 'bg-red-600' : 'bg-blue-600'}`}>
                              {group.suggestion}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{group.records.length} kayıt</span>
                            <span>•</span>
                            <span>{group.totalQuantity} adet</span>
                            {hasCritical && (
                              <>
                                <span>•</span>
                                <span className="text-red-600 font-medium">{group.severities['Kritik']} kritik</span>
                              </>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{group.reason}</p>
                          <Button
                            size="sm"
                            className={`w-full h-7 text-xs font-bold gap-1.5 ${
                              is8D ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            onClick={() => setGroupConvertDialog({
                              open: true,
                              group,
                              selectedType: group.suggestion,
                            })}
                          >
                            <Layers className="w-3 h-3" />
                            Toplu {group.suggestion} Aç ({group.records.length} kayıt)
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

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
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">Araç Bilgisi</th>
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
                    const partCount = record.part_code ? partCodeAnalysis[record.part_code]?.inPeriod || 0 : 0;
                    const catCount = record.category ? categoryAnalysis[record.category]?.inPeriod || 0 : 0;
                    const repeatCount = Math.max(partCount, catCount);
                    const repeatSource = (partCount >= catCount && partCount > 0) ? 'parça' : (catCount > 0 ? 'kategori' : '');
                    const isQuantityBased = suggestion && settings && record.quantity >= (settings.df_quantity_threshold || 10) && repeatCount < (settings.df_threshold || 3);

                    return (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setDetailRecord({
                            ...record,
                            display_record_number: getDisplayRecordNumber(record),
                          });
                          setIsDetailOpen(true);
                        }}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold">{getDisplayRecordNumber(record)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">
                              {record.detection_area === 'Üretilen Araçlar' ? '-' : (record.part_code || '-')}
                            </span>
                            {repeatCount > 1 && record.detection_area !== 'Üretilen Araçlar' && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                x{repeatCount}
                              </Badge>
                            )}
                          </div>
                          {record.part_name && record.detection_area !== 'Üretilen Araçlar' && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{record.part_name}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {record.detection_area === 'Üretilen Araçlar' ? (
                            <div className="text-xs">
                              {[record.vehicle_type, record.vehicle_identifier].filter(Boolean).join(' / ') || '-'}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                          {(() => {
                            if (isNonconformityLinkedToDf8d(record)) {
                              const linked = getLinkedNcMeta(record);
                              const label = linked?.nc_number
                                ? `${linked.type} ${linked.nc_number}`
                                : `${linked?.type || 'DF/8D'} — no yükleniyor`;
                              return (
                                <div className="flex flex-col items-start gap-0.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 max-w-[160px] text-[10px] font-mono font-semibold gap-1 border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:bg-emerald-950/40"
                                    onClick={() => {
                                      if (onOpenNCView && record.source_nc_id) {
                                        onOpenNCView({ id: record.source_nc_id });
                                      }
                                    }}
                                    disabled={!onOpenNCView || !record.source_nc_id}
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </Button>
                                  <span className="text-[9px] text-muted-foreground">Bağlı</span>
                                </div>
                              );
                            }
                            const group = recordGroupMap.get(record.id);
                            if (group && settings?.auto_suggest) {
                              const is8D = group.suggestion === '8D';
                              return (
                                <div className="flex flex-col items-start gap-0.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 cursor-pointer ${
                                      is8D
                                        ? 'border-red-300 text-red-700 bg-red-50'
                                        : 'border-blue-300 text-blue-700 bg-blue-50'
                                    }`}
                                    onClick={() => setGroupConvertDialog({ open: true, group, selectedType: group.suggestion })}
                                  >
                                    <Layers className="w-2.5 h-2.5 mr-1" />
                                    Grup {group.suggestion}
                                  </Badge>
                                  <span className="text-[9px] text-muted-foreground">
                                    {group.records.length} kayıt
                                  </span>
                                </div>
                              );
                            }
                            if (suggestion && settings?.auto_suggest) {
                              return (
                                <div className="flex flex-col items-start gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-7 text-[10px] font-bold gap-1 ${
                                      suggestion === '8D'
                                        ? 'border-red-300 text-red-700 hover:bg-red-50'
                                        : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                    }`}
                                    onClick={() =>
                                      openConvertDialog({
                                        record,
                                        type: suggestion,
                                        source: 'suggestion',
                                        suggestedType: suggestion,
                                      })
                                    }
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    {suggestion} Aç
                                  </Button>
                                  <span className="text-[9px] text-muted-foreground">
                                    {isQuantityBased
                                      ? `${record.quantity} adet`
                                      : `${repeatCount}x tekrar${repeatSource ? ` (${repeatSource})` : ''}`}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setDetailRecord({
                                  ...record,
                                  display_record_number: getDisplayRecordNumber(record),
                                });
                                setIsDetailOpen(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" /> Görüntüle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPrintableReport({
                                ...record,
                                record_number: getDisplayRecordNumber(record),
                              }, 'nonconformity_record', true)}>
                                <FileText className="h-4 w-4 mr-2" /> Rapor Al
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedRecord({
                                  ...record,
                                  display_record_number: getDisplayRecordNumber(record),
                                });
                                setIsFormOpen(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" /> Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!isNonconformityLinkedToDf8d(record) && (
                                <>
                                  <DropdownMenuItem onClick={() => openConvertDialog({ record, type: 'DF' })}>
                                    <FileText className="h-4 w-4 mr-2" /> DF'ye Dönüştür
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openConvertDialog({ record, type: '8D' })}>
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

          {/* Akıllı gruplandırma uyarıları */}
          {smartGroups.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Layers className="h-4 w-4" />
                  Toplu Dönüştürme Önerileri ({smartGroups.length} grup — {smartGroups.reduce((s, g) => s + g.records.length, 0)} kayıt)
                </CardTitle>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70">
                  Aynı tespit alanı ve kategorideki uygunsuzluklar gruplandırıldı. Tek seferde toplu DF/8D açarak sistemi verimli kullanın.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {smartGroups.map(group => {
                    const is8D = group.suggestion === '8D';
                    const hasCritical = group.severities['Kritik'] > 0;
                    const sevEntries = Object.entries(group.severities).sort((a, b) => b[1] - a[1]);

                    return (
                      <div key={group.key} className="rounded-lg bg-white dark:bg-background border overflow-hidden">
                        <div className={`flex items-center justify-between p-3 ${
                          is8D ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-blue-50/50 dark:bg-blue-950/20'
                        }`}>
                          <div className="flex items-center gap-3">
                            {is8D ? (
                              <AlertOctagon className="h-5 w-5 text-red-600 shrink-0" />
                            ) : (
                              <Layers className="h-5 w-5 text-blue-600 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">{group.category}</p>
                              <p className="text-xs text-muted-foreground">{group.detection_area}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs font-medium">{group.records.length} kayıt</span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{group.totalQuantity} toplam adet</span>
                                {sevEntries.map(([sev, cnt]) => (
                                  <Badge key={sev} variant="outline" className={`text-[9px] px-1.5 py-0 ${severityColors[sev] || ''}`}>
                                    {sev} ({cnt})
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                            <Badge className={`text-xs ${is8D ? 'bg-red-600' : 'bg-blue-600'}`}>
                              {group.suggestion} Önerilir
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{group.reason}</span>
                          </div>
                        </div>
                        <div className="divide-y max-h-48 overflow-y-auto">
                          {group.records.slice(0, 10).map(record => (
                            <div key={record.id} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="font-mono text-muted-foreground shrink-0">{getDisplayRecordNumber(record)}</span>
                                <span className="truncate text-foreground">{record.description?.substring(0, 50)}</span>
                                <Badge className={`text-[9px] shrink-0 ${severityColors[record.severity] || ''}`}>{record.severity}</Badge>
                                <span className="text-muted-foreground shrink-0">x{record.quantity || 1}</span>
                              </div>
                            </div>
                          ))}
                          {group.records.length > 10 && (
                            <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-center">
                              ... ve {group.records.length - 10} kayıt daha
                            </div>
                          )}
                        </div>
                        <div className="p-3 border-t bg-muted/30">
                          <Button
                            size="sm"
                            className={`w-full h-8 text-xs font-bold gap-1.5 ${
                              is8D ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            onClick={() => setGroupConvertDialog({ open: true, group, selectedType: group.suggestion })}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            Toplu {group.suggestion} Aç — {group.records.length} kayıt birleştir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
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
              "{deleteTarget ? getDisplayRecordNumber(deleteTarget) : '-'}" numaralı uygunsuzluk kaydı kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toplu DF/8D Grup Dönüştürme Onayı */}
      <Dialog
        open={groupConvertDialog.open}
        onOpenChange={(open) => {
          if (!open) setGroupConvertDialog({ open: false, group: null, selectedType: null });
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className={`h-5 w-5 ${groupConvertDialog.selectedType === '8D' ? 'text-red-600' : 'text-blue-600'}`} />
              Toplu {groupConvertDialog.selectedType} Oluştur
            </DialogTitle>
            <DialogDescription>
              Aşağıdaki gruptaki tüm uygunsuzluk kayıtları tek bir {groupConvertDialog.selectedType === 'DF' ? 'Düzeltici Faaliyet (DF)' : '8D Problem Çözme'} kaydına bağlanacaktır. Sayaçlar sıfırlanacaktır.
            </DialogDescription>
          </DialogHeader>

          {groupConvertDialog.group && (
            <div className="space-y-3 py-2">
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                      Sistem önerisi: {groupConvertDialog.group.suggestion}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                      {groupConvertDialog.group.reason}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-amber-300 bg-white text-amber-700 dark:border-amber-700 dark:bg-transparent dark:text-amber-200">
                    {groupConvertDialog.group.suggestion} önerildi
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['DF', '8D'].map((type) => {
                    const isSelected = groupConvertDialog.selectedType === type;
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        className={
                          type === '8D'
                            ? isSelected ? 'bg-red-600 hover:bg-red-700' : 'border-red-300 text-red-700 hover:bg-red-50'
                            : isSelected ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                        }
                        onClick={() => setGroupConvertDialog(prev => ({ ...prev, selectedType: type }))}
                      >
                        {type === '8D' ? <AlertOctagon className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
                        {type}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kategori:</span>
                  <span className="font-semibold">{groupConvertDialog.group.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tespit Alanı:</span>
                  <span className="font-semibold">{groupConvertDialog.group.detection_area}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kayıt Sayısı:</span>
                  <span className="font-semibold text-amber-600">{groupConvertDialog.group.records.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Toplam Hatalı Adet:</span>
                  <span className="font-semibold">{groupConvertDialog.group.totalQuantity}</span>
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {Object.entries(groupConvertDialog.group.severities).map(([sev, cnt]) => (
                    <Badge key={sev} variant="outline" className={`text-[9px] px-1.5 py-0 ${severityColors[sev] || ''}`}>
                      {sev}: {cnt}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t max-h-32 overflow-y-auto space-y-0.5">
                  {groupConvertDialog.group.records.slice(0, 15).map(r => (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="font-mono shrink-0">{getDisplayRecordNumber(r)}</span>
                      <span className="truncate">{r.description?.substring(0, 50)}</span>
                      <span className="shrink-0">x{r.quantity || 1}</span>
                    </div>
                  ))}
                  {groupConvertDialog.group.records.length > 15 && (
                    <div className="text-center text-[10px]">... ve {groupConvertDialog.group.records.length - 15} kayıt daha</div>
                  )}
                </div>
              </div>

              <div className={`rounded-lg border p-3 ${
                groupConvertDialog.selectedType === '8D'
                  ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                  : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
              }`}>
                <p className={`text-xs ${
                  groupConvertDialog.selectedType === '8D'
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}>
                  {groupConvertDialog.group.records.length} kayıt tek bir {groupConvertDialog.selectedType} formuna birleştirilecek. Tüm kayıtlar "{groupConvertDialog.selectedType} Açıldı" olarak işaretlenecek ve eşik sayaçları sıfırlanacaktır.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupConvertDialog({ open: false, group: null, selectedType: null })}>
              İptal
            </Button>
            <Button
              onClick={handleGroupConvertToDF8D}
              disabled={!groupConvertDialog.selectedType}
              className={groupConvertDialog.selectedType === '8D' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              <Layers className="w-4 h-4 mr-2" />
              Toplu {groupConvertDialog.selectedType} Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DF/8D Dönüştürme Onayı */}
      <Dialog
        open={convertDialog.open}
        onOpenChange={(open) => {
          if (!open) closeConvertDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {is8DConversion ? (
                <AlertOctagon className="h-5 w-5 text-red-600" />
              ) : (
                <FileText className="h-5 w-5 text-blue-600" />
              )}
              {activeConvertType} Oluştur
            </DialogTitle>
            <DialogDescription>
              Bu uygunsuzluk kaydı {activeConvertType === 'DF' ? 'Düzeltici Faaliyet (DF)' : '8D Problem Çözme'} sürecine dönüştürülecektir.
            </DialogDescription>
          </DialogHeader>

          {convertDialog.record && (
            <div className="space-y-3 py-2">
              {convertDialog.source === 'suggestion' && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                        Sistem önerisi: {convertDialog.suggestedType}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                        Önerilen seçenek varsayılan olarak işaretlenir, ancak son kararı burada siz verirsiniz.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-amber-300 bg-white text-amber-700 dark:border-amber-700 dark:bg-transparent dark:text-amber-200">
                      {convertDialog.suggestedType} önerildi
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {['DF', '8D'].map((type) => {
                      const isSelected = activeConvertType === type;
                      const isSuggested = convertDialog.suggestedType === type;

                      return (
                        <Button
                          key={type}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          className={
                            type === '8D'
                              ? isSelected
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'border-red-300 text-red-700 hover:bg-red-50'
                              : isSelected
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                          }
                          onClick={() =>
                            setConvertDialog((previous) => ({
                              ...previous,
                              selectedType: type,
                            }))
                          }
                        >
                          {type === '8D' ? (
                            <AlertOctagon className="mr-2 h-4 w-4" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {type}
                          {isSuggested ? ' (Önerilen)' : ''}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kayıt No:</span>
                  <span className="font-mono font-semibold">{getDisplayRecordNumber(convertDialog.record)}</span>
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
              <div
                className={`rounded-lg border p-3 ${
                  is8DConversion
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                }`}
              >
                <p
                  className={`text-xs ${
                    is8DConversion
                      ? 'text-red-800 dark:text-red-200'
                      : 'text-blue-800 dark:text-blue-200'
                  }`}
                >
                  {activeConvertType} formu, uygunsuzluk kaydındaki bilgilerle otomatik doldurulacak ve {activeConvertType} oluşturma ekranı açılacaktır.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeConvertDialog}>
              İptal
            </Button>
            <Button
              onClick={handleConvertToDF8D}
              disabled={!activeConvertType}
              className={is8DConversion ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {activeConvertType} Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
    <div className={`${color} shrink-0`}>{icon}</div>
    <div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{title}</p>
      {subtitle && <p className="text-[9px] text-muted-foreground">{subtitle}</p>}
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
