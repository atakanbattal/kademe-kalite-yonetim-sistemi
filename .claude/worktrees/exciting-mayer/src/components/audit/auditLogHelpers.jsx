import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';

/** vehicle_timeline_events.event_type → kullanıcı dostu etiket */
const VEHICLE_TIMELINE_EVENT_LABELS = {
  quality_entry: 'Kaliteye giriş',
  control_start: 'Kontrol başladı',
  control_end: 'Kontrol bitti',
  rework_start: 'Yeniden işlem başladı',
  rework_end: 'Yeniden işlem bitti',
  waiting_for_shipping_info: 'Sevk bilgisi bekleniyor',
  ready_to_ship: 'Sevke hazır',
  shipped: 'Sevk edildi',
  arge_sent: 'Ar-Ge\'ye gönderildi',
  arge_returned: 'Ar-Ge\'den döndü',
};

const labelForUnknownTimelineEvent = (type) => {
  if (!type || typeof type !== 'string') return 'Bilinmeyen adım';
  return type
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ');
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
    'vehicle_timeline_events': 'Kaliteye verilen araç — süreç adımı',
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

const getActionBadge = (action) => {
  if (action.startsWith('EKLEME')) return <Badge className="bg-green-600 hover:bg-green-700 text-white">EKLEME</Badge>;
  if (action.startsWith('GÜNCELLEME')) return <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white">GÜNCELLEME</Badge>;
  if (action.startsWith('SİLME')) return <Badge variant="destructive">SİLME</Badge>;
  return <Badge variant="secondary">{action}</Badge>;
};

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
  
  // Kayıt referansı (zaman çizelgesi: olay satırı UUID’si yerine muayene bağlantısı gösterilir)
  if (log.table_name !== 'vehicle_timeline_events' && recordInfo.id) {
    recordIdentifier = `ID: ${String(recordInfo.id).substring(0, 8)}…`;
  }
  
  // Tablo bazlı özel mesajlar oluştur
  const tableNameLower = log.table_name.toLowerCase();

  // Kaliteye verilen araç — zaman çizelgesi adımları (audit’te anlamlı özet)
  if (tableNameLower === 'vehicle_timeline_events') {
    const details = log.details || {};
    const row = details.new || details.old || details;
    const eventType =
      recordInfo.timelineEventType || row.event_type || details.new?.event_type || details.old?.event_type;
    const eventLabel =
      VEHICLE_TIMELINE_EVENT_LABELS[eventType] || labelForUnknownTimelineEvent(eventType);
    const inspectionId =
      recordInfo.inspectionId || row.inspection_id || details.new?.inspection_id || details.old?.inspection_id;

    let timeLabel = '';
    const tsRaw =
      recordInfo.eventTimestamp || row.event_timestamp || details.new?.event_timestamp || details.old?.event_timestamp;
    if (tsRaw) {
      try {
        const d = parseISO(tsRaw);
        if (isValid(d)) timeLabel = format(d, 'dd.MM.yyyy HH:mm', { locale: tr });
      } catch (_) {
        /* ignore */
      }
    }

    if (action.startsWith('EKLEME')) {
      mainMessage = `Kalite sürecine adım eklendi: ${eventLabel}`;
    } else if (action.startsWith('SİLME')) {
      mainMessage = `Kalite süreci adımı silindi: ${eventLabel}`;
    } else {
      mainMessage = `Kalite süreci adımı güncellendi: ${eventLabel}`;
    }

    const parts = [];
    if (timeLabel) parts.push(`Olay zamanı: ${timeLabel}`);
    if (inspectionId) parts.push(`Kalite kaydı: ${String(inspectionId).slice(0, 8)}…`);
    const note = recordInfo.timelineNotes || row.notes;
    if (note && String(note).trim() && String(note).length <= 120) {
      parts.push(`Not: ${String(note).trim()}`);
    } else if (note && String(note).trim()) {
      parts.push(`Not: ${String(note).trim().slice(0, 117)}…`);
    }
    extraInfo = parts.length > 0 ? parts.join(' · ') : inspectionId
      ? `Kalite kaydı referansı: ${String(inspectionId).slice(0, 8)}…`
      : '';
    recordIdentifier = '';
  }
  // Tedarikçi Uygunsuzlukları için özel mesaj
  else if (tableNameLower === 'supplier_non_conformities') {
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
      'part_name': 'Parça Adı',
      'event_type': 'Olay türü',
      'event_timestamp': 'Olay zamanı',
      'inspection_id': 'Kalite kaydı',
      'notes': 'Not',
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

export { getReadableTableName, getActionBadge, getHumanReadableMessage };
