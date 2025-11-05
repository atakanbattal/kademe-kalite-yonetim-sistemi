import React, { useMemo, useState } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Badge } from '@/components/ui/badge';
    import { formatDistanceToNow, format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Input } from '@/components/ui/input';
    import { Search, Filter, Clock, User, FileText, Plus, Edit, Trash2, ChevronRight } from 'lucide-react';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const AuditLogModule = () => {
      const { auditLogs, loading } = useData();
      const [searchTerm, setSearchTerm] = useState('');
      const [tableFilter, setTableFilter] = useState('all');

      const filteredLogs = useMemo(() => {
        let logs = auditLogs;
        
        // Debug: İlk 3 kaydın table_name'ini logla
        if (logs.length > 0) {
          console.log('🔍 İlk 3 Audit Log:', logs.slice(0, 3).map(l => ({ id: l.id, action: l.action, table_name: l.table_name })));
        }
        
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

      // Kullanıcı dostu mesaj oluştur
      const getHumanReadableMessage = (log) => {
        const action = log.action;
        const tableName = getReadableTableName(log.table_name);
        const details = log.details;
        
        // İşlem türünü belirle
        let actionType = 'değiştirildi';
        let actionIcon = <Edit className="h-4 w-4" />;
        
        if (action.startsWith('EKLEME')) {
          actionType = 'oluşturuldu';
          actionIcon = <Plus className="h-4 w-4" />;
        } else if (action.startsWith('SİLME')) {
          actionType = 'silindi';
          actionIcon = <Trash2 className="h-4 w-4" />;
        } else if (action.startsWith('GÜNCELLEME')) {
          actionType = 'güncellendi';
          actionIcon = <Edit className="h-4 w-4" />;
        }
        
        // Detaylardan önemli bilgileri çıkar
        let extraInfo = '';
        
        try {
          if (details) {
            // Yeni kayıt için bilgi
            if (details.new && typeof details.new === 'object') {
              const newData = details.new;
              if (newData.part_code) extraInfo = `Parça: ${newData.part_code}`;
              else if (newData.nc_number) extraInfo = `Uygunsuzluk No: ${newData.nc_number}`;
              else if (newData.request_number) extraInfo = `Talep No: ${newData.request_number}`;
              else if (newData.record_no) extraInfo = `Kayıt No: ${newData.record_no}`;
              else if (newData.inspection_number) extraInfo = `Muayene No: ${newData.inspection_number}`;
              else if (newData.title) extraInfo = `Başlık: ${newData.title}`;
              else if (newData.name) extraInfo = `Ad: ${newData.name}`;
            }
            
            // Değişen alanlar varsa göster
            if (details.changed_fields && Array.isArray(details.changed_fields) && details.changed_fields.length > 0) {
              const fieldNames = {
                'status': 'Durum',
                'decision': 'Karar',
                'part_code': 'Parça Kodu',
                'quantity': 'Miktar',
                'unit': 'Birim',
                'amount': 'Tutar',
                'name': 'Ad',
                'title': 'Başlık',
                'description': 'Açıklama',
                'assigned_to': 'Atanan',
                'priority': 'Öncelik',
                'due_date': 'Bitiş Tarihi'
              };
              
              const changedFieldsStr = details.changed_fields
                .map(f => fieldNames[f] || f)
                .slice(0, 3)
                .join(', ');
              
              extraInfo = `Değişiklik: ${changedFieldsStr}`;
              if (details.changed_fields.length > 3) {
                extraInfo += ` (+${details.changed_fields.length - 3} alan daha)`;
              }
            }
            
            // Doğrudan ekleme için
            if (!details.new && !details.changed_fields) {
              if (details.part_code) extraInfo = `Parça: ${details.part_code}`;
              else if (details.nc_number) extraInfo = `Uygunsuzluk No: ${details.nc_number}`;
              else if (details.request_number) extraInfo = `Talep No: ${details.request_number}`;
              else if (details.record_no) extraInfo = `Kayıt No: ${details.record_no}`;
              else if (details.inspection_number) extraInfo = `Muayene No: ${details.inspection_number}`;
              else if (details.title) extraInfo = `Başlık: ${details.title}`;
              else if (details.name) extraInfo = `Ad: ${details.name}`;
            }
          }
        } catch (e) {
          console.error('Detay parse hatası:', e);
        }
        
        return {
          message: `${tableName} kaydı ${actionType}`,
          extraInfo,
          actionIcon
        };
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
          'task_tags': 'Görev Etiketleri',
          'non_conformities': 'Uygunsuzluklar',
          'deviations': 'Sapmalar',
          'deviation_approvals': 'Sapma Onayları',
          'deviation_attachments': 'Sapma Ekleri',
          'deviation_vehicles': 'Sapma Araçları',
          'audits': 'Tetkikler',
          'audit_findings': 'Tetkik Bulguları',
          'quarantine_records': 'Karantina Kayıtları',
          'quality_costs': 'Kalite Maliyetleri',
          'equipments': 'Ekipmanlar',
          'equipment_calibrations': 'Kalibrasyon Kayıtları',
          'equipment_assignments': 'Ekipman Atamaları',
          'suppliers': 'Tedarikçiler',
          'supplier_non_conformities': 'Tedarikçi Uygunsuzlukları',
          'supplier_audits': 'Tedarikçi Denetimleri',
          'supplier_certificates': 'Tedarikçi Sertifikaları',
          'supplier_scores': 'Tedarikçi Skorları',
          'supplier_audit_plans': 'Tedarikçi Denetim Planları',
          'supplier_audit_attendees': 'Tedarikçi Denetim Katılımcıları',
          'supplier_audit_questions': 'Tedarikçi Denetim Soruları',
          'incoming_inspections': 'Girdi Muayeneleri',
          'incoming_control_plans': 'Kontrol Planları',
          'incoming_inspection_results': 'Muayene Sonuçları',
          'incoming_inspection_defects': 'Muayene Hataları',
          'incoming_inspection_attachments': 'Muayene Ekleri',
          'sheet_metal_items': 'Sac Malzemeleri',
          'stock_risk_controls': 'Stok Risk Kontrolleri',
          'inkr_reports': 'İNKR Raporları',
          'kaizen_entries': 'Kaizen Kayıtları',
          'documents': 'Dokümanlar',
          'document_revisions': 'Doküman Revizyonları',
          'personnel': 'Personel',
          'kpis': 'KPI Kayıtları',
          'produced_vehicles': 'Üretilen Araçlar',
          'quality_inspections': 'Kalite Kontrolleri',
          'quality_inspection_faults': 'Kalite Hataları',
          'fault_categories': 'Hata Kategorileri',
          'customer_complaints': 'Müşteri Şikayetleri',
          'complaint_analyses': 'Şikayet Analizleri',
          'complaint_actions': 'Şikayet Aksiyonları',
          'complaint_documents': 'Şikayet Dokümanları',
          'customers': 'Müşteriler',
          'benchmarks': 'Benchmark Kayıtları',
          'benchmark_categories': 'Benchmark Kategorileri',
          'benchmark_items': 'Benchmark Alternatifleri',
          'benchmark_pros_cons': 'Avantaj/Dezavantajlar',
          'benchmark_criteria': 'Benchmark Kriterleri',
          'benchmark_scores': 'Benchmark Skorları',
          'benchmark_cost_analysis': 'Maliyet Analizleri',
          'benchmark_risk_analysis': 'Risk Analizleri',
          'benchmark_approvals': 'Benchmark Onayları',
          'benchmark_reports': 'Benchmark Raporları',
          'skill_categories': 'Yetkinlik Kategorileri',
          'skills': 'Yetkinlikler',
          'personnel_skills': 'Personel Yetkinlikleri',
          'skill_training_records': 'Eğitim Kayıtları',
          'skill_certification_records': 'Sertifika Kayıtları',
          'trainings': 'Eğitimler',
          'training_participants': 'Eğitim Katılımcıları',
          'wps_procedures': 'WPS Prosedürleri',
          'cost_settings': 'Maliyet Ayarları',
          'material_costs': 'Malzeme Maliyetleri',
          'characteristics': 'Karakteristikler',
          'measurement_equipment': 'Ölçüm Ekipmanları',
          'tolerance_standards': 'Tolerans Standartları',
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
                      <SelectItem value="benchmarks">Benchmark Yönetimi</SelectItem>
                      <SelectItem value="skills">Polivalans Yönetimi</SelectItem>
                      <SelectItem value="wps_procedures">WPS Yönetimi</SelectItem>
                      <SelectItem value="personnel">Personel</SelectItem>
                      <SelectItem value="cost_settings">Maliyet Ayarları</SelectItem>
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
                    <AnimatePresence>
                      {filteredLogs.map((log, index) => {
                        const humanMessage = getHumanReadableMessage(log);
                        
                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.02 }}
                            className="flex gap-4 p-4 bg-card border rounded-lg hover:shadow-md transition-all duration-200 group"
                          >
                            {/* İşlem İkonu */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                              log.action.startsWith('EKLEME') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              log.action.startsWith('GÜNCELLEME') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              log.action.startsWith('SİLME') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {humanMessage.actionIcon}
                            </div>
                            
                            {/* Ana İçerik */}
                            <div className="flex-1 min-w-0">
                              {/* Başlık ve Badge */}
                              <div className="flex items-start gap-2 mb-1">
                                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                  {humanMessage.message}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {getReadableTableName(log.table_name)}
                                </Badge>
                              </div>
                              
                              {/* Ek Bilgi */}
                              {humanMessage.extraInfo && (
                                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                  <ChevronRight className="h-3 w-3" />
                                  {humanMessage.extraInfo}
                                </p>
                              )}
                              
                              {/* Kullanıcı ve Zaman */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {log.user_full_name || 'Sistem'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                                </span>
                                <span className="text-muted-foreground/60">
                                  {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                </span>
                              </div>
                            </div>
                            
                            {/* Sağ taraf - İşlem Badge'i */}
                            <div className="flex-shrink-0 self-start">
                              {getActionBadge(log.action)}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
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
        </motion.div>
      );
    };

    export default AuditLogModule;