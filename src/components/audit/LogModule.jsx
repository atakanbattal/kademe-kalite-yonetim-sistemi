import React, { useMemo, useState } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Badge } from '@/components/ui/badge';
    import { formatDistanceToNow, format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Input } from '@/components/ui/input';
    import { Search, Filter, Clock, User, FileText, Plus, Edit, Trash2, ChevronRight, Eye, ChevronDown, ChevronUp } from 'lucide-react';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { normalizeTurkishForSearch } from '@/lib/utils';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';

    const AuditLogModule = () => {
      const { auditLogs, loading } = useData();
      const [searchTerm, setSearchTerm] = useState('');
      const [tableFilter, setTableFilter] = useState('all');
      const [selectedLog, setSelectedLog] = useState(null);
      const [expandedLogs, setExpandedLogs] = useState(new Set());

      const filteredLogs = useMemo(() => {
        let logs = auditLogs;
        
        // Tablo filtresi
        if (tableFilter !== 'all') {
          logs = logs.filter(log => log.table_name === tableFilter);
        }
        
        // Arama filtresi
        if (searchTerm) {
          const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm);
          logs = logs.filter(log =>
            normalizeTurkishForSearch(log.action).includes(normalizedSearchTerm) ||
            normalizeTurkishForSearch(log.user_full_name).includes(normalizedSearchTerm) ||
            normalizeTurkishForSearch(log.table_name).includes(normalizedSearchTerm) ||
            (log.details && normalizeTurkishForSearch(JSON.stringify(log.details)).includes(normalizedSearchTerm))
          );
        }
        
        return logs;
      }, [auditLogs, searchTerm, tableFilter]);

      // Kayıt ID'sini bul (DB trigger: INSERT/UPDATE new/old, DELETE: details = kayıt)
      const getRecordId = (log) => {
        try {
          const details = log.details;
          if (!details) return null;
          
          if (details.new && details.new.id) return details.new.id;
          if (details.old && details.old.id) return details.old.id;
          if (details.id) return details.id;
          if (details.new && typeof details.new === 'object') {
            return details.new.id || details.new.record_id || details.new.record_no;
          }
          if (details.old && typeof details.old === 'object') {
            return details.old.id || details.old.record_id || details.old.record_no;
          }
        } catch (e) {
          console.error('Record ID parse hatası:', e);
        }
        return null;
      };

      // Kayıt bilgilerini çıkar - Tüm modüller için kapsamlı
      const getRecordInfo = (log) => {
        try {
          const details = log.details;
          if (!details) return {};
          
          const recordId = getRecordId(log);
          const info = { id: recordId };
          
          // Hem yeni hem eski kayıt bilgilerini çıkar (silme: details doğrudan OLD kayıt)
          const dataSource = details.new || details.old || details;
          const isDelete = log.action.startsWith('SİLME');
          
          if (dataSource && typeof dataSource === 'object') {
            // Genel alanlar
            if (dataSource.name) info.name = dataSource.name;
            if (dataSource.title) info.title = dataSource.title;
            if (dataSource.description) info.description = dataSource.description;
            
            // Uygunsuzluklar (NC/MDI)
            if (dataSource.nc_number) info.ncNumber = dataSource.nc_number;
            if (dataSource.mdi_no) info.mdiNumber = dataSource.mdi_no;
            if (dataSource.type) info.ncType = dataSource.type;
            
            // Sapma Yönetimi
            if (dataSource.request_no) info.requestNumber = dataSource.request_no;
            if (dataSource.request_number) info.requestNumber = dataSource.request_number;
            
            // Tedarikçi Uygunsuzlukları
            if (dataSource.supplier_name) info.supplierName = dataSource.supplier_name;
            if (dataSource.supplier_id) info.supplierId = dataSource.supplier_id;
            
            // Parça/Malzeme bilgileri
            if (dataSource.part_code) info.partCode = dataSource.part_code;
            if (dataSource.part_name) info.partName = dataSource.part_name;
            if (dataSource.product_part) info.productPart = dataSource.product_part;
            
            // Girdi Kalite Kontrol
            if (dataSource.record_no) info.recordNo = dataSource.record_no;
            if (dataSource.inspection_number) info.inspectionNumber = dataSource.inspection_number;
            if (dataSource.delivery_note_number) info.deliveryNoteNumber = dataSource.delivery_note_number;
            
            // Araç bilgileri
            if (dataSource.chassis_no) info.chassisNo = dataSource.chassis_no;
            if (dataSource.vehicle_serial_no) info.vehicleSerialNo = dataSource.vehicle_serial_no;
            if (dataSource.serial_no) info.serialNo = dataSource.serial_no;
            if (dataSource.vehicle_type) info.vehicleType = dataSource.vehicle_type;
            
            // Müşteri Şikayetleri
            if (dataSource.complaint_number) info.complaintNumber = dataSource.complaint_number;
            if (dataSource.customer_name) info.customerName = dataSource.customer_name;
            
            // Tedarikçiler
            if (dataSource.supplier_code) info.supplierCode = dataSource.supplier_code;
            
            // Karantina
            if (dataSource.quarantine_no) info.quarantineNo = dataSource.quarantine_no;
            
            // Dokümanlar
            if (dataSource.document_code) info.documentCode = dataSource.document_code;
            if (dataSource.document_title) info.documentTitle = dataSource.document_title;
            
            // Ekipmanlar
            if (dataSource.equipment_code) info.equipmentCode = dataSource.equipment_code;
            if (dataSource.equipment_name) info.equipmentName = dataSource.equipment_name;
            
            // Görevler
            if (dataSource.task_title) info.taskTitle = dataSource.task_title;
            
            // Tetkikler
            if (dataSource.report_number) info.reportNumber = dataSource.report_number;
            if (dataSource.audit_type) info.auditType = dataSource.audit_type;
            
            // Kaizen
            if (dataSource.kaizen_number) info.kaizenNumber = dataSource.kaizen_number;
            
            // Benchmark
            if (dataSource.benchmark_name) info.benchmarkName = dataSource.benchmark_name;
            
            // Eğitim
            if (dataSource.training_title) info.trainingTitle = dataSource.training_title;
            
            // Durum bilgileri
            if (dataSource.status) info.status = dataSource.status;
            if (dataSource.decision) info.decision = dataSource.decision;
          }
          
          // Eski kayıt bilgileri (güncelleme işlemleri için)
          if (details.old && typeof details.old === 'object') {
            const oldData = details.old;
            if (oldData.name) info.oldName = oldData.name;
            if (oldData.title) info.oldTitle = oldData.title;
            if (oldData.supplier_name) info.oldSupplierName = oldData.supplier_name;
            if (oldData.part_code) info.oldPartCode = oldData.part_code;
            if (oldData.nc_number) info.oldNcNumber = oldData.nc_number;
            if (oldData.status) info.oldStatus = oldData.status;
          }
          
          // Değişen alanlar (DB: object, frontend: array)
          if (details.changed_fields) {
            info.changedFields = Array.isArray(details.changed_fields) 
              ? details.changed_fields 
              : Object.keys(details.changed_fields || {});
          }
          
          // Güncelleme için: frontend bazen details.changes kullanır
          if (details.changes && typeof details.changes === 'object') {
            info.changedFields = [...(info.changedFields || []), ...Object.keys(details.changes)];
          }
          
          return info;
        } catch (e) {
          console.error('Record info parse hatası:', e);
          return {};
        }
      };

      // Kullanıcı dostu mesaj oluştur - Daha açıklayıcı ve detaylı
      const getHumanReadableMessage = (log) => {
        const action = log.action;
        const tableName = getReadableTableName(log.table_name);
        const recordInfo = getRecordInfo(log);
        
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
        
        // Detaylardan önemli bilgileri çıkar - Tablo bazlı özel mesajlar
        let extraInfo = '';
        let recordIdentifier = '';
        let mainMessage = '';
        
        // Record ID
        if (recordInfo.id) {
          recordIdentifier = `ID: ${recordInfo.id.substring(0, 8)}...`;
        }
        
        // Tablo bazlı özel mesajlar oluştur
        const tableNameLower = log.table_name.toLowerCase();
        
        // Tedarikçi Uygunsuzlukları için özel mesaj
        if (tableNameLower === 'supplier_non_conformities') {
          const parts = [];
          if (recordInfo.supplierName) parts.push(`Tedarikçi: ${recordInfo.supplierName}`);
          if (recordInfo.ncNumber) parts.push(`Uygunsuzluk No: ${recordInfo.ncNumber}`);
          else if (recordInfo.mdiNumber) parts.push(`MDI No: ${recordInfo.mdiNumber}`);
          if (recordInfo.partCode) parts.push(`Parça: ${recordInfo.partCode}`);
          if (recordInfo.partName) parts.push(`Parça Adı: ${recordInfo.partName}`);
          if (recordInfo.description && recordInfo.description.length < 100) {
            parts.push(`Açıklama: ${recordInfo.description.substring(0, 80)}...`);
          }
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Uygunsuzluklar (NC/MDI)
        else if (tableNameLower === 'non_conformities') {
          const parts = [];
          if (recordInfo.ncNumber) parts.push(`Uygunsuzluk No: ${recordInfo.ncNumber}`);
          else if (recordInfo.mdiNumber) parts.push(`MDI No: ${recordInfo.mdiNumber}`);
          if (recordInfo.ncType) parts.push(`Tip: ${recordInfo.ncType}`);
          if (recordInfo.supplierName) parts.push(`Tedarikçi: ${recordInfo.supplierName}`);
          if (recordInfo.partCode) parts.push(`Parça: ${recordInfo.partCode}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Sapma Yönetimi
        else if (tableNameLower === 'deviations') {
          const parts = [];
          if (recordInfo.requestNumber) parts.push(`Talep No: ${recordInfo.requestNumber}`);
          if (recordInfo.partCode) parts.push(`Parça: ${recordInfo.partCode}`);
          if (recordInfo.description && recordInfo.description.length < 100) {
            parts.push(`Açıklama: ${recordInfo.description.substring(0, 80)}...`);
          }
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Girdi Kalite Kontrol
        else if (tableNameLower.includes('incoming')) {
          const parts = [];
          if (recordInfo.recordNo) parts.push(`Kayıt No: ${recordInfo.recordNo}`);
          if (recordInfo.inspectionNumber) parts.push(`Muayene No: ${recordInfo.inspectionNumber}`);
          if (recordInfo.deliveryNoteNumber) parts.push(`İrsaliye: ${recordInfo.deliveryNoteNumber}`);
          if (recordInfo.partCode) parts.push(`Parça: ${recordInfo.partCode}`);
          if (recordInfo.supplierName) parts.push(`Tedarikçi: ${recordInfo.supplierName}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Karantina
        else if (tableNameLower === 'quarantine_records') {
          const parts = [];
          if (recordInfo.quarantineNo) parts.push(`Karantina No: ${recordInfo.quarantineNo}`);
          if (recordInfo.partCode) parts.push(`Parça: ${recordInfo.partCode}`);
          if (recordInfo.supplierName) parts.push(`Tedarikçi: ${recordInfo.supplierName}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Müşteri Şikayetleri
        else if (tableNameLower === 'customer_complaints') {
          const parts = [];
          if (recordInfo.complaintNumber) parts.push(`Şikayet No: ${recordInfo.complaintNumber}`);
          if (recordInfo.customerName) parts.push(`Müşteri: ${recordInfo.customerName}`);
          if (recordInfo.chassisNo) parts.push(`Şasi: ${recordInfo.chassisNo}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Tedarikçiler
        else if (tableNameLower === 'suppliers') {
          const parts = [];
          if (recordInfo.name) parts.push(`Tedarikçi: ${recordInfo.name}`);
          if (recordInfo.supplierCode) parts.push(`Kod: ${recordInfo.supplierCode}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Dokümanlar
        else if (tableNameLower === 'documents') {
          const parts = [];
          if (recordInfo.documentCode) parts.push(`Doküman Kodu: ${recordInfo.documentCode}`);
          if (recordInfo.documentTitle) parts.push(`Başlık: ${recordInfo.documentTitle}`);
          else if (recordInfo.title) parts.push(`Başlık: ${recordInfo.title}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Kalite Kontrolleri / Üretilen Araçlar
        else if (tableNameLower === 'quality_inspections' || tableNameLower === 'produced_vehicles') {
          const parts = [];
          if (recordInfo.chassisNo) parts.push(`Şasi: ${recordInfo.chassisNo}`);
          if (recordInfo.serialNo) parts.push(`Seri: ${recordInfo.serialNo}`);
          if (recordInfo.vehicleSerialNo) parts.push(`Seri: ${recordInfo.vehicleSerialNo}`);
          if (recordInfo.vehicleType) parts.push(`Tip: ${recordInfo.vehicleType}`);
          if (recordInfo.customerName) parts.push(`Müşteri: ${recordInfo.customerName}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Ekipmanlar
        else if (tableNameLower.includes('equipment')) {
          const parts = [];
          if (recordInfo.equipmentCode) parts.push(`Ekipman Kodu: ${recordInfo.equipmentCode}`);
          if (recordInfo.equipmentName) parts.push(`Ekipman: ${recordInfo.equipmentName}`);
          else if (recordInfo.name) parts.push(`Ekipman: ${recordInfo.name}`);
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        // Genel durumlar için
        else {
          const parts = [];
          if (recordInfo.name) parts.push(recordInfo.name);
          else if (recordInfo.title) parts.push(recordInfo.title);
          else if (recordInfo.taskTitle) parts.push(recordInfo.taskTitle);
          else if (recordInfo.partCode) parts.push(`Parça: ${recordInfo.partCode}`);
          else if (recordInfo.ncNumber) parts.push(`Uygunsuzluk No: ${recordInfo.ncNumber}`);
          else if (recordInfo.requestNumber) parts.push(`Talep No: ${recordInfo.requestNumber}`);
          else if (recordInfo.recordNo) parts.push(`Kayıt No: ${recordInfo.recordNo}`);
          else if (recordInfo.inspectionNumber) parts.push(`Muayene No: ${recordInfo.inspectionNumber}`);
          else if (recordInfo.chassisNo) parts.push(`Şasi: ${recordInfo.chassisNo}`);
          else if (recordInfo.complaintNumber) parts.push(`Şikayet No: ${recordInfo.complaintNumber}`);
          
          extraInfo = parts.length > 0 ? parts.join(' | ') : '';
          mainMessage = extraInfo 
            ? `${tableName} kaydı ${actionType} - ${parts[0]}`
            : `${tableName} kaydı ${actionType}`;
        }
        
        // Güncelleme işlemleri için değişen alanları ekle
        if (recordInfo.changedFields && recordInfo.changedFields.length > 0 && actionType === 'güncellendi') {
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
            'due_date': 'Bitiş Tarihi',
            'supplier_name': 'Tedarikçi',
            'nc_number': 'Uygunsuzluk No',
            'part_name': 'Parça Adı'
          };
          
          const changedFieldsStr = recordInfo.changedFields
            .map(f => fieldNames[f] || f)
            .slice(0, 3)
            .join(', ');
          
          if (extraInfo) extraInfo += ` | Değişiklik: ${changedFieldsStr}`;
          else extraInfo = `Değişiklik: ${changedFieldsStr}`;
          
          if (recordInfo.changedFields.length > 3) {
            extraInfo += ` (+${recordInfo.changedFields.length - 3} alan daha)`;
          }
        }
        
        return {
          message: mainMessage || `${tableName} kaydı ${actionType}`,
          extraInfo,
          recordIdentifier,
          actionIcon,
          recordInfo
        };
      };

      const toggleExpand = (logId) => {
        setExpandedLogs(prev => {
          const newSet = new Set(prev);
          if (newSet.has(logId)) {
            newSet.delete(logId);
          } else {
            newSet.add(logId);
          }
          return newSet;
        });
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
          'task_attachments': 'Görev Ekleri',
          'task_tag_relations': 'Görev Etiketleri',
          'non_conformities': 'Uygunsuzluklar',
          'deviations': 'Sapmalar',
          'deviation_approvals': 'Sapma Onayları',
          'deviation_attachments': 'Sapma Ekleri',
          'deviation_vehicles': 'Sapma Araçları',
          'audits': 'Tetkikler',
          'audit_findings': 'Tetkik Bulguları',
          'audit_results': 'Tetkik Sonuçları',
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
          'supplier_documents': 'Tedarikçi Dokümanları',
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
          'document_folders': 'Doküman Klasörleri',
          'personnel': 'Personel',
          'kpis': 'KPI Kayıtları',
          'produced_vehicles': 'Üretilen Araçlar',
          'quality_inspections': 'Kalite Kontrolleri',
          'quality_inspection_faults': 'Kalite Hataları',
          'quality_inspection_history': 'Kalite Kontrol Geçmişi',
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
          'skill_assessments': 'Yetkinlik Değerlendirmeleri',
          'trainings': 'Eğitimler',
          'training_participants': 'Eğitim Katılımcıları',
          'wps_procedures': 'WPS Prosedürleri',
          'cost_settings': 'Maliyet Ayarları',
          'material_costs': 'Malzeme Maliyetleri',
          'characteristics': 'Karakteristikler',
          'measurement_equipment': 'Ölçüm Ekipmanları',
          'tolerance_standards': 'Tolerans Standartları',
          'process_control_plans': 'Proses Kontrol Planları',
          'process_control_documents': 'Proses Kontrol Dokümanları',
          'process_parameter_records': 'Proses Parametre Kayıtları',
          'production_departments': 'Üretim Departmanları',
          'supplier_development_plans': 'Tedarikçi Geliştirme Planları',
          'supplier_development_assessments': 'Tedarikçi Değerlendirmeleri',
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
                <span className="font-semibold text-foreground"> Son 500 kayıt</span> gösterilmektedir.
              </p>
               <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <div className="search-box flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="İşlem, kullanıcı, tablo veya detay ara..."
                        className="search-input"
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
                      <SelectItem value="produced_vehicles">Üretilen Araçlar</SelectItem>
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
                              
                              {/* Kayıt ID */}
                              {humanMessage.recordIdentifier && (
                                <p className="text-xs text-muted-foreground mb-1 font-mono">
                                  {humanMessage.recordIdentifier}
                                </p>
                              )}
                              
                              {/* Ek Bilgi */}
                              {humanMessage.extraInfo && (
                                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                  <ChevronRight className="h-3 w-3" />
                                  {humanMessage.extraInfo}
                                </p>
                              )}
                              
                              {/* Genişletilmiş Detaylar */}
                              {expandedLogs.has(log.id) && (
                                <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-2">
                                  <div className="font-semibold text-foreground mb-2">Detaylı Bilgiler:</div>
                                  {humanMessage.recordInfo.name && (
                                    <div><span className="font-medium">Ad:</span> {humanMessage.recordInfo.name}</div>
                                  )}
                                  {humanMessage.recordInfo.title && (
                                    <div><span className="font-medium">Başlık:</span> {humanMessage.recordInfo.title}</div>
                                  )}
                                  {humanMessage.recordInfo.changedFields && humanMessage.recordInfo.changedFields.length > 0 && (
                                    <div>
                                      <span className="font-medium">Değişen Alanlar:</span>{' '}
                                      {humanMessage.recordInfo.changedFields.join(', ')}
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => setSelectedLog(log)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Tüm Detayları Görüntüle
                                  </Button>
                                </div>
                              )}
                              
                              {/* Kullanıcı ve Zaman */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
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
                            
                            {/* Sağ taraf - İşlem Badge'i ve Genişlet Butonu */}
                            <div className="flex-shrink-0 self-start flex flex-col gap-2">
                              {getActionBadge(log.action)}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(log.id)}
                                className="h-6 w-6 p-0"
                              >
                                {expandedLogs.has(log.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
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
                      <div className="text-sm font-medium text-muted-foreground">Tarih</div>
                      <div className="text-sm">{format(new Date(selectedLog.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: tr })}</div>
                    </div>
                  </div>
                  
                  {selectedLog.details && (
                    <div className="mt-6">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Detaylar (JSON)</div>
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
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