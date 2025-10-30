import React, { useMemo, useState } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { formatDistanceToNow } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { motion } from 'framer-motion';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Input } from '@/components/ui/input';
    import { Search, Filter } from 'lucide-react';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const AuditLogModule = () => {
      const { auditLogs, loading } = useData();
      const [searchTerm, setSearchTerm] = useState('');
      const [tableFilter, setTableFilter] = useState('all');

      const filteredLogs = useMemo(() => {
        let logs = auditLogs;
        
        // Tablo filtresi
        if (tableFilter !== 'all') {
          logs = logs.filter(log => log.table_name === tableFilter);
        }
        
        // Arama filtresi
        if (searchTerm) {
          const lowercasedTerm = searchTerm.toLowerCase();
          logs = logs.filter(log =>
            log.action.toLowerCase().includes(lowercasedTerm) ||
            log.user_full_name?.toLowerCase().includes(lowercasedTerm) ||
            log.table_name?.toLowerCase().includes(lowercasedTerm) ||
            (log.details && JSON.stringify(log.details).toLowerCase().includes(lowercasedTerm))
          );
        }
        
        return logs;
      }, [auditLogs, searchTerm, tableFilter]);

      const renderDetails = (details) => {
        if (!details) return 'N/A';
        try {
            const formattedJson = JSON.stringify(details, null, 2);
            return <pre className="whitespace-pre-wrap max-w-md text-xs bg-muted/50 p-2 rounded-md">{formattedJson}</pre>;
        } catch (e) {
            return <span className="break-all">{String(details)}</span>;
        }
      };

      const getActionBadge = (action) => {
        if (action.startsWith('EKLEME')) return <Badge className="bg-green-600 hover:bg-green-700 text-white">EKLEME</Badge>;
        if (action.startsWith('GÜNCELLEME')) return <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white">GÜNCELLEME</Badge>;
        if (action.startsWith('SİLME')) return <Badge variant="destructive">SİLME</Badge>;
        return <Badge variant="secondary">{action}</Badge>;
      };

      const getReadableTableName = (tableName) => {
        const tableMap = {
          'tasks': 'Görevler',
          'task_assignees': 'Görev Atamaları',
          'task_comments': 'Görev Yorumları',
          'task_checklists': 'Görev Kontrol Listeleri',
          'non_conformities': 'Uygunsuzluklar',
          'deviations': 'Sapmalar',
          'audits': 'Tetkikler',
          'audit_findings': 'Tetkik Bulguları',
          'quarantine_records': 'Karantina Kayıtları',
          'quality_costs': 'Kalite Maliyetleri',
          'equipments': 'Ekipmanlar',
          'equipment_calibrations': 'Kalibrasyon Kayıtları',
          'suppliers': 'Tedarikçiler',
          'supplier_non_conformities': 'Tedarikçi Uygunsuzlukları',
          'incoming_inspections': 'Girdi Muayeneleri',
          'kaizen_entries': 'Kaizen Kayıtları',
          'documents': 'Dokümanlar',
          'personnel': 'Personel',
          'kpis': 'KPI Kayıtları',
          'produced_vehicles': 'Üretilen Araçlar',
          'quality_inspections': 'Kalite Kontrolleri',
        };
        return tableMap[tableName] || tableName;
      };

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
                <span className="font-semibold text-foreground"> Son 200 kayıt</span> gösterilmektedir.
              </p>
               <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="İşlem, kullanıcı, tablo veya detay ara..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={tableFilter} onValueChange={setTableFilter}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tüm Modüller" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Modüller</SelectItem>
                      <SelectItem value="tasks">Görev Yönetimi</SelectItem>
                      <SelectItem value="non_conformities">Uygunsuzluklar (DF/8D/MDI)</SelectItem>
                      <SelectItem value="deviations">Sapma Yönetimi</SelectItem>
                      <SelectItem value="audits">Tetkik Yönetimi</SelectItem>
                      <SelectItem value="quarantine_records">Karantina Yönetimi</SelectItem>
                      <SelectItem value="incoming_inspections">Girdi Kalite Kontrol</SelectItem>
                      <SelectItem value="kaizen_entries">Kaizen Yönetimi</SelectItem>
                      <SelectItem value="equipments">Ekipman & Kalibrasyon</SelectItem>
                      <SelectItem value="suppliers">Tedarikçi Yönetimi</SelectItem>
                      <SelectItem value="quality_costs">Kalite Maliyetleri</SelectItem>
                      <SelectItem value="documents">Doküman Yönetimi</SelectItem>
                      <SelectItem value="kpis">KPI Yönetimi</SelectItem>
                    </SelectContent>
                  </Select>
                  {(searchTerm || tableFilter !== 'all') && (
                    <Badge variant="secondary" className="self-center whitespace-nowrap">
                      {filteredLogs.length} kayıt
                    </Badge>
                  )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[70vh]">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>İşlem</TableHead>
                        <TableHead>Tablo</TableHead>
                        <TableHead>Yapan Kişi</TableHead>
                        <TableHead>Detaylar</TableHead>
                        <TableHead className="text-right">Zaman</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredLogs.length > 0 ? (
                        filteredLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{getActionBadge(log.action)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-medium">
                                  {getReadableTableName(log.table_name)}
                                </Badge>
                                <div className="text-xs text-muted-foreground mt-1">{log.table_name}</div>
                              </TableCell>
                              <TableCell className="font-medium">{log.user_full_name || 'Sistem'}</TableCell>
                              <TableCell>{renderDetails(log.details)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                              </TableCell>
                            </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">
                            Henüz denetim kaydı bulunmamaktadır.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default AuditLogModule;