import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, Filter, User, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeTurkishForSearch } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import AuditLogEntryRow from './AuditLogEntryRow';
import { getHumanReadableMessage, getActionBadge, getReadableTableName } from './auditLogHelpers';

const formatDetailValue = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const AuditDetailsPane = ({ details }) => {
  if (!details) return <p className="text-sm text-muted-foreground">Detay yok.</p>;
  const d = details;
  if (d.old && d.new && typeof d.old === 'object' && typeof d.new === 'object' && !Array.isArray(d.old)) {
    const keys = Array.from(new Set([...Object.keys(d.old), ...Object.keys(d.new)])).filter((k) => k !== 'changed_fields').sort();
    return (
      <ScrollArea className="h-[min(55vh,480px)] border rounded-md">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left p-2 font-semibold">Alan</th>
              <th className="text-left p-2 font-semibold">Önce</th>
              <th className="text-left p-2 font-semibold">Sonra</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const before = d.old[key];
              const after = d.new[key];
              const changed = JSON.stringify(before) !== JSON.stringify(after);
              return (
                <tr key={key} className={changed ? 'bg-amber-500/10' : ''}>
                  <td className="p-2 font-mono align-top border-t">{key}</td>
                  <td className="p-2 align-top border-t break-all max-w-[200px]">{formatDetailValue(before)}</td>
                  <td className="p-2 align-top border-t break-all max-w-[200px]">{formatDetailValue(after)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    );
  }
  return (
    <ScrollArea className="h-[min(55vh,480px)] border rounded-md p-3">
      <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(details, null, 2)}</pre>
    </ScrollArea>
  );
};

const AuditLogModule = () => {
      const { auditLogs, loading } = useData();
      const [searchTerm, setSearchTerm] = useState('');
      const [tableFilter, setTableFilter] = useState('all');
      const [userFilter, setUserFilter] = useState('all');
      const [selectedLog, setSelectedLog] = useState(null);
      const [expandedLogs, setExpandedLogs] = useState(new Set());
      const [additionalLogs, setAdditionalLogs] = useState([]);
      const [auditLoadMoreLoading, setAuditLoadMoreLoading] = useState(false);
      const [auditHasMore, setAuditHasMore] = useState(true);

      useEffect(() => {
        setAdditionalLogs([]);
        setAuditHasMore(true);
      }, [auditLogs]);

      const allAuditLogs = useMemo(() => [...auditLogs, ...additionalLogs], [auditLogs, additionalLogs]);

      const userOptions = useMemo(() => {
        const names = new Set();
        allAuditLogs.forEach((log) => names.add(log.user_full_name || 'Sistem'));
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
      }, [allAuditLogs]);

      const loadMoreAudit = useCallback(async () => {
        if (auditLoadMoreLoading || !auditHasMore) return;
        setAuditLoadMoreLoading(true);
        const offset = auditLogs.length + additionalLogs.length;
        try {
          const { data, error } = await supabase
            .from('audit_log_entries')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + 499);
          if (error) throw error;
          const batch = data || [];
          setAdditionalLogs((prev) => [...prev, ...batch]);
          setAuditHasMore(batch.length === 500);
        } catch (e) {
          console.error('Denetim kayıtları yüklenemedi:', e);
          setAuditHasMore(false);
        } finally {
          setAuditLoadMoreLoading(false);
        }
      }, [auditLoadMoreLoading, auditHasMore, auditLogs.length, additionalLogs.length]);

      const debouncedSearchTerm = useDebounce(searchTerm, 280);

      const auditSearchBlobById = useMemo(() => {
        const map = new Map();
        for (const log of allAuditLogs) {
          const detailStr = log.details != null ? JSON.stringify(log.details) : '';
          const blob = normalizeTurkishForSearch(
            [log.action, log.user_full_name || '', log.table_name, detailStr].join('\u0001')
          );
          map.set(log.id, blob);
        }
        return map;
      }, [allAuditLogs]);

      const filteredLogs = useMemo(() => {
        let logs = allAuditLogs;

        if (tableFilter !== 'all') {
          logs = logs.filter((log) => log.table_name === tableFilter);
        }

        if (userFilter !== 'all') {
          logs = logs.filter((log) => (log.user_full_name || 'Sistem') === userFilter);
        }

        if (debouncedSearchTerm.trim()) {
          const normalizedSearchTerm = normalizeTurkishForSearch(debouncedSearchTerm.trim());
          logs = logs.filter((log) => {
            const blob = auditSearchBlobById.get(log.id);
            return blob && blob.includes(normalizedSearchTerm);
          });
        }

        return logs;
      }, [allAuditLogs, debouncedSearchTerm, tableFilter, userFilter, auditSearchBlobById]);

      const toggleExpand = useCallback((logId) => {
        setExpandedLogs((prev) => {
          const next = new Set(prev);
          if (next.has(logId)) next.delete(logId);
          else next.add(logId);
          return next;
        });
      }, []);

      const handleSelectLog = useCallback((log) => {
        setSelectedLog(log);
      }, []);

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Sistem Denetim Kayıtları</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sistemde gerçekleştirilen tüm kritik işlemler (Ekleme, Güncelleme, Silme) aşağıda listelenmiştir.
                <span className="font-semibold text-foreground"> İlk yüklemede son 2000 kayıt</span> gelir; gerekirse daha fazlasını yükleyebilirsiniz.
              </p>
               <div className="flex flex-col gap-4 pt-4">
                  <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                  <div className="search-box flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="İşlem, kullanıcı, tablo veya detay ara..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <User className="h-4 w-4 mr-2 shrink-0" />
                      <SelectValue placeholder="Hesap (kullanıcı)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm kullanıcılar</SelectItem>
                      {userOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={tableFilter} onValueChange={setTableFilter}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tüm Modüller" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Modüller</SelectItem>
                      <SelectItem value="tasks">Görev Yönetimi</SelectItem>
                      <SelectItem value="non_conformities">Uygunsuzluklar (DF/8D/MDI)</SelectItem>
                      <SelectItem value="supplier_non_conformities">Tedarikçi Uygunsuzlukları</SelectItem>
                      <SelectItem value="deviations">Sapma Yönetimi</SelectItem>
                      <SelectItem value="audits">Tetkik Yönetimi</SelectItem>
                      <SelectItem value="supplier_audits">Tedarikçi Denetimleri</SelectItem>
                      <SelectItem value="quarantine_records">Karantina Yönetimi</SelectItem>
                      <SelectItem value="incoming_inspections">Girdi Kalite Kontrol</SelectItem>
                      <SelectItem value="sheet_metal_items">Sac Malzemeleri</SelectItem>
                      <SelectItem value="stock_risk_controls">Stok Risk Kontrol</SelectItem>
                      <SelectItem value="inkr_reports">İNKR Raporları</SelectItem>
                      <SelectItem value="kaizen_entries">Kaizen Yönetimi</SelectItem>
                      <SelectItem value="equipments">Ekipman & Kalibrasyon</SelectItem>
                      <SelectItem value="suppliers">Tedarikçi Yönetimi</SelectItem>
                      <SelectItem value="quality_costs">Kalite Maliyetleri</SelectItem>
                      <SelectItem value="documents">Doküman Yönetimi</SelectItem>
                      <SelectItem value="kpis">KPI Yönetimi</SelectItem>
                      <SelectItem value="customer_complaints">Müşteri Şikayetleri</SelectItem>
                      <SelectItem value="produced_vehicles">Üretilen Araçlar</SelectItem>
                      <SelectItem value="quality_inspections">Kalite Kontrolleri</SelectItem>
                      <SelectItem value="task_assignees">Görev Atamaları</SelectItem>
                      <SelectItem value="task_comments">Görev Yorumları</SelectItem>
                      <SelectItem value="deviation_approvals">Sapma Onayları</SelectItem>
                      <SelectItem value="equipment_calibrations">Kalibrasyon Kayıtları</SelectItem>
                      <SelectItem value="benchmarks">Benchmark Yönetimi</SelectItem>
                      <SelectItem value="skills">Polivalans Yönetimi</SelectItem>
                      <SelectItem value="trainings">Eğitim Yönetimi</SelectItem>
                      <SelectItem value="wps_procedures">WPS Yönetimi</SelectItem>
                      <SelectItem value="personnel">Personel</SelectItem>
                      <SelectItem value="cost_settings">Maliyet Ayarları</SelectItem>
                    </SelectContent>
                  </Select>
                  {(debouncedSearchTerm.trim() || tableFilter !== 'all' || userFilter !== 'all') && (
                    <Badge variant="secondary" className="self-center whitespace-nowrap">
                      {filteredLogs.length} kayıt
                      {searchTerm !== debouncedSearchTerm && searchTerm.trim() ? (
                        <span className="ml-1 text-[10px] font-normal opacity-80">(aranıyor…)</span>
                      ) : null}
                    </Badge>
                  )}
                  </div>
                  {auditHasMore && (
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={loadMoreAudit} disabled={auditLoadMoreLoading}>
                      {auditLoadMoreLoading ? 'Yükleniyor…' : 'Daha fazla yükle (500)'}
                    </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[70vh]">
                <div className="space-y-3">
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex gap-4 p-4 bg-muted/30 rounded-lg">
                        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))
                  ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <AuditLogEntryRow
                        key={log.id}
                        log={log}
                        isExpanded={expandedLogs.has(log.id)}
                        onToggleExpand={toggleExpand}
                        onSelectLog={handleSelectLog}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Henüz denetim kaydı bulunmamaktadır.</p>
                      <p className="text-sm mt-2">Sistem işlemleri otomatik olarak burada listelenecektir.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* Detay Modal */}
          <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
              <DialogHeader>
                <DialogTitle>İşlem Detayları</DialogTitle>
                <DialogDescription>
                  {selectedLog && getHumanReadableMessage(selectedLog).message}
                </DialogDescription>
              </DialogHeader>
              {selectedLog && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Modül</div>
                      <div className="text-sm font-semibold">{getReadableTableName(selectedLog.table_name)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">İşlem</div>
                      <div>{getActionBadge(selectedLog.action)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Kullanıcı</div>
                      <div className="text-sm">{selectedLog.user_full_name || 'Sistem'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Kullanıcı ID</div>
                      <div className="text-xs font-mono break-all">{selectedLog.user_id || '—'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Tarih</div>
                      <div className="text-sm">{format(new Date(selectedLog.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: tr })}</div>
                    </div>
                  </div>
                  
                  {selectedLog.details && (
                    <div className="mt-6 flex-1 min-h-0 flex flex-col">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Kayıt detayı</div>
                      <AuditDetailsPane details={selectedLog.details} />
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </motion.div>
      );
    };

export default AuditLogModule;
