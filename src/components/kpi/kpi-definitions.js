import React from 'react';
export const predefinedKpis = [
    // DF ve 8D Yönetimi
    { id: 'open_non_conformities_count', name: 'Açık Uygunsuzluk Sayısı', description: 'Henüz kapatılmamış tüm uygunsuzluk kayıtlarının (DF, 8D, MDI) toplam sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_open_non_conformities_count' },
    { id: 'open_8d_count', name: 'Açık 8D Sayısı', description: 'Henüz kapatılmamış 8D kayıtlarının toplam sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_open_8d_count' },
    { id: 'df_closure_rate', name: 'DF Kapatma Oranı', description: 'Kapatılan DF\'lerin toplam DF sayısına oranı.', unit: '%', target_direction: 'increase', data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_df_closure_rate' },
    { id: 'avg_quality_nc_closure_time', name: 'Kalite Birimi Aksiyon Kapatma Süresi', description: 'Kalite departmanının açtığı aksiyonları ortalama kapatma süresi.', unit: ' gün', target_direction: 'decrease', data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_avg_quality_nc_closure_time' },
    
    // Üretilen Araçlar
    { id: 'avg_quality_process_time', name: 'Ortalama Kalite Süresi', description: 'Kaliteye giren araçların ortalama onaylanma süresi.', unit: ' gün', target_direction: 'decrease', data_source: 'Kaliteye Verilen Araçlar', rpc_name: 'get_avg_quality_process_time' },
    { id: 'produced_vehicles_count', name: 'Üretilen Araç Sayısı (30 gün)', description: 'Son 30 günde üretilen araç sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Üretilen Araçlar', rpc_name: 'get_produced_vehicles_count' },
    { id: 'quality_inspection_pass_rate', name: 'Kalite Kontrol Geçiş Oranı', description: 'Kalite kontrolünden geçen araçların oranı.', unit: '%', target_direction: 'increase', data_source: 'Üretilen Araçlar', rpc_name: 'get_quality_inspection_pass_rate' },
    { id: 'avg_quality_inspection_time', name: 'Ortalama Kalite Kontrol Süresi', description: 'Kalite kontrol işleminin ortalama süresi.', unit: ' gün', target_direction: 'decrease', data_source: 'Üretilen Araçlar', rpc_name: 'get_avg_quality_inspection_time' },
    
    // Karantina Yönetimi
    { id: 'quarantine_count', name: 'Karantinadaki Ürün Sayısı', description: 'Aktif olarak karantinada bulunan ürünlerin toplam sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Karantina Yönetimi', rpc_name: 'get_quarantine_count' },
    
    // Kalite Maliyetleri
    { id: 'non_quality_cost', name: 'Toplam Kalite Maliyeti', description: 'Belirli bir periyottaki toplam kalite maliyeti (iç/dış hata + önleme).', unit: ' TL', target_direction: 'decrease', data_source: 'Kalite Maliyetleri', rpc_name: 'get_total_non_quality_cost' },
    
    // Doküman Yönetimi
    { id: 'expired_document_count', name: 'Süresi Dolmuş Doküman Sayısı', description: 'Geçerlilik süresi dolmuş dokümanların sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Doküman Yönetimi', rpc_name: 'get_expired_document_count' },
    
    // Sapma Yönetimi
    { id: 'open_deviation_count', name: 'Açık Sapma Sayısı', description: 'Henüz tamamlanmamış sapma taleplerinin sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Sapma Yönetimi', rpc_name: 'get_open_deviation_count' },
    
    // Ekipman & Kalibrasyon
    { id: 'calibration_due_count', name: 'Kalibrasyonu Gecikmiş Ekipman Sayısı', description: 'Kalibrasyon tarihi geçmiş ekipmanların sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Ekipman & Kalibrasyon', rpc_name: 'get_calibration_due_count' },
    
    // İç Tetkik Yönetimi
    { id: 'open_internal_audit_count', name: 'Açık İç Tetkik Sayısı', description: 'Henüz tamamlanmamış iç tetkiklerin sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'İç Tetkik Yönetimi', rpc_name: 'get_open_internal_audit_count' },
    
    // Tedarikçi Kalite
    { id: 'open_supplier_nc_count', name: 'Açık Tedarikçi Uygunsuzluk Sayısı', description: 'Henüz kapatılmamış tedarikçi uygunsuzluklarının sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_open_supplier_nc_count' },
    { id: 'active_suppliers_count', name: 'Aktif Tedarikçi Sayısı', description: 'Sistemde aktif olan tedarikçi sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_active_suppliers_count' },
    { id: 'avg_supplier_score', name: 'Ortalama Tedarikçi Skoru', description: 'Tüm tedarikçilerin ortalama kalite skoru.', unit: ' puan', target_direction: 'increase', data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_avg_supplier_score' },
    { id: 'supplier_nc_rate', name: 'Tedarikçi Uygunsuzluk Oranı', description: 'Uygunsuzluk bulunan tedarikçilerin oranı.', unit: '%', target_direction: 'decrease', data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_supplier_nc_rate' },
    
    // Girdi Kalite Kontrol
    { id: 'incoming_rejection_rate', name: 'Girdi Kalite Red Oranı', description: 'Gelen malzemelerdeki toplam red oranı.', unit: '%', target_direction: 'decrease', data_source: 'Girdi Kalite Kontrol', rpc_name: 'get_incoming_rejection_rate' },
    
    // SPC Modülü
    { id: 'active_spc_characteristics_count', name: 'Aktif SPC Karakteristik Sayısı', description: 'SPC takibi yapılan aktif karakteristik sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'SPC (İstatistiksel Kontrol)', rpc_name: 'get_active_spc_characteristics_count' },
    { id: 'out_of_control_processes_count', name: 'Kontrol Dışı Proses Sayısı', description: 'Kontrol limitlerinin dışına çıkan proses sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'SPC (İstatistiksel Kontrol)', rpc_name: 'get_out_of_control_processes_count' },
    { id: 'capable_processes_rate', name: 'Proses Yetenekli Oranı', description: 'Cp/Cpk değeri 1.33\'ün üzerinde olan proseslerin oranı.', unit: '%', target_direction: 'increase', data_source: 'SPC (İstatistiksel Kontrol)', rpc_name: 'get_capable_processes_rate' },
    { id: 'msa_studies_count', name: 'MSA Çalışması Sayısı', description: 'Tamamlanmış MSA (Measurement System Analysis) çalışması sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'SPC (İstatistiksel Kontrol)', rpc_name: 'get_msa_studies_count' },
    
    // MPC Modülü
    { id: 'active_production_plans_count', name: 'Aktif Üretim Planı Sayısı', description: 'Planlanmış veya devam eden üretim planı sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Üretim Planlama', rpc_name: 'get_active_production_plans_count' },
    { id: 'critical_characteristics_count', name: 'Kritik Karakteristik Sayısı', description: 'CC/SC olarak tanımlanmış kritik karakteristik sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Üretim Planlama', rpc_name: 'get_critical_characteristics_count' },
    { id: 'process_parameter_records_count', name: 'Proses Parametresi Kayıt Sayısı', description: 'Son 30 günde kaydedilen proses parametresi sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Üretim Planlama', rpc_name: 'get_process_parameter_records_count' },
    
    // Process Validation Modülü
    { id: 'active_validation_plans_count', name: 'Aktif Validasyon Planı Sayısı', description: 'Planlanmış veya devam eden proses validasyon planı sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Proses Validasyonu', rpc_name: 'get_active_validation_plans_count' },
    { id: 'completed_validations_rate', name: 'Tamamlanmış Validasyon Oranı', description: 'Tamamlanmış validasyon planlarının oranı.', unit: '%', target_direction: 'increase', data_source: 'Proses Validasyonu', rpc_name: 'get_completed_validations_rate' },
    
    // FMEA Modülü
    { id: 'active_fmea_projects_count', name: 'Aktif FMEA Proje Sayısı', description: 'Aktif veya inceleme aşamasındaki FMEA proje sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'FMEA Yönetimi', rpc_name: 'get_active_fmea_projects_count' },
    { id: 'high_rpn_count', name: 'Yüksek RPN Sayısı', description: 'RPN değeri 100\'ün üzerinde olan risk sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'FMEA Yönetimi', rpc_name: 'get_high_rpn_count' },
    { id: 'completed_fmea_actions_rate', name: 'Tamamlanmış FMEA Aksiyon Oranı', description: 'Tamamlanmış FMEA aksiyon planlarının oranı.', unit: '%', target_direction: 'increase', data_source: 'FMEA Yönetimi', rpc_name: 'get_completed_fmea_actions_rate' },
    
    // PPAP/APQP Modülü
    { id: 'active_apqp_projects_count', name: 'Aktif APQP Proje Sayısı', description: 'Onaylanmamış veya reddedilmemiş APQP proje sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'PPAP/APQP', rpc_name: 'get_active_apqp_projects_count' },
    { id: 'pending_ppap_approvals_count', name: 'PPAP Onay Bekleyen Sayısı', description: 'Onay bekleyen PPAP başvuru sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'PPAP/APQP', rpc_name: 'get_pending_ppap_approvals_count' },
    { id: 'run_at_rate_completion_rate', name: 'Run-at-Rate Tamamlanma Oranı', description: 'Tamamlanmış Run-at-Rate çalışmalarının oranı.', unit: '%', target_direction: 'increase', data_source: 'PPAP/APQP', rpc_name: 'get_run_at_rate_completion_rate' },
    
    // DMAIC Modülü
    { id: 'active_dmaic_projects_count', name: 'Aktif DMAIC Proje Sayısı', description: 'Tamamlanmamış DMAIC proje sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'DMAIC Projeleri', rpc_name: 'get_active_dmaic_projects_count' },
    { id: 'completed_dmaic_projects_count', name: 'Tamamlanmış DMAIC Proje Sayısı', description: 'Başarıyla tamamlanmış DMAIC proje sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'DMAIC Projeleri', rpc_name: 'get_completed_dmaic_projects_count' },
    { id: 'dmaic_success_rate', name: 'DMAIC Başarı Oranı', description: 'Tamamlanmış DMAIC projelerinin oranı.', unit: '%', target_direction: 'increase', data_source: 'DMAIC Projeleri', rpc_name: 'get_dmaic_success_rate' },
    
    // Müşteri Şikayetleri
    { id: 'open_customer_complaints_count', name: 'Açık Müşteri Şikayeti Sayısı', description: 'Kapatılmamış veya çözülmemiş müşteri şikayeti sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Müşteri Şikayetleri', rpc_name: 'get_open_customer_complaints_count' },
    { id: 'sla_compliant_complaints_rate', name: 'SLA İçinde Çözülen Şikayet Oranı', description: 'SLA süresi içinde çözülen şikayetlerin oranı.', unit: '%', target_direction: 'increase', data_source: 'Müşteri Şikayetleri', rpc_name: 'get_sla_compliant_complaints_rate' },
    { id: 'avg_complaint_resolution_time', name: 'Ortalama Şikayet Çözüm Süresi', description: 'Şikayetlerin ortalama çözüm süresi.', unit: ' gün', target_direction: 'decrease', data_source: 'Müşteri Şikayetleri', rpc_name: 'get_avg_complaint_resolution_time' },
    
    // Kaizen Modülü
    { id: 'active_kaizen_count', name: 'Aktif Kaizen Sayısı', description: 'Tamamlanmamış veya iptal edilmemiş kaizen sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'İyileştirme (Kaizen)', rpc_name: 'get_active_kaizen_count' },
    { id: 'completed_kaizen_count', name: 'Tamamlanmış Kaizen Sayısı', description: 'Başarıyla tamamlanmış kaizen sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'İyileştirme (Kaizen)', rpc_name: 'get_completed_kaizen_count' },
    { id: 'kaizen_success_rate', name: 'Kaizen Başarı Oranı', description: 'Tamamlanmış kaizenlerin oranı.', unit: '%', target_direction: 'increase', data_source: 'İyileştirme (Kaizen)', rpc_name: 'get_kaizen_success_rate' },
    
    // Eğitim Yönetimi
    { id: 'planned_trainings_count', name: 'Planlanmış Eğitim Sayısı', description: 'Gelecekte planlanmış eğitim sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Eğitim Yönetimi', rpc_name: 'get_planned_trainings_count' },
    { id: 'completed_trainings_count', name: 'Tamamlanmış Eğitim Sayısı', description: 'Tamamlanmış eğitim sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Eğitim Yönetimi', rpc_name: 'get_completed_trainings_count' },
    { id: 'training_participation_rate', name: 'Eğitim Katılım Oranı', description: 'Eğitimlere katılan personelin oranı.', unit: '%', target_direction: 'increase', data_source: 'Eğitim Yönetimi', rpc_name: 'get_training_participation_rate' },
    
    // Polivalans Modülü
    { id: 'avg_polyvalence_score', name: 'Ortalama Polivalans Skoru', description: 'Tüm personelin ortalama polivalans (çoklu yetkinlik) skoru.', unit: ' puan', target_direction: 'increase', data_source: 'Polivalans Matrisi', rpc_name: 'get_avg_polyvalence_score' },
    { id: 'critical_skill_gaps_count', name: 'Kritik Yetkinlik Eksikliği Sayısı', description: 'Hedef seviyenin altında kritik yetkinliği olan personel sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Polivalans Matrisi', rpc_name: 'get_critical_skill_gaps_count' },
    { id: 'expired_certifications_count', name: 'Geçersiz Sertifika Sayısı', description: 'Geçerlilik tarihi geçmiş sertifika sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Polivalans Matrisi', rpc_name: 'get_expired_certifications_count' },
    
    // Benchmark Modülü
    { id: 'active_benchmarks_count', name: 'Aktif Benchmark Sayısı', description: 'Tamamlanmamış veya iptal edilmemiş benchmark sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Benchmark Yönetimi', rpc_name: 'get_active_benchmarks_count' },
    { id: 'completed_benchmarks_count', name: 'Tamamlanmış Benchmark Sayısı', description: 'Tamamlanmış benchmark sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Benchmark Yönetimi', rpc_name: 'get_completed_benchmarks_count' },
    
    // WPS Modülü
    { id: 'active_wps_procedures_count', name: 'Aktif WPS Prosedürü Sayısı', description: 'Aktif olan WPS (Welding Procedure Specification) prosedürü sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'WPS Yönetimi', rpc_name: 'get_active_wps_procedures_count' },
    { id: 'pending_wps_approvals_count', name: 'Onay Bekleyen WPS Sayısı', description: 'Onay bekleyen WPS prosedürü sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'WPS Yönetimi', rpc_name: 'get_pending_wps_approvals_count' },
    
    // Görev Yönetimi
    { id: 'open_tasks_count', name: 'Açık Görev Sayısı', description: 'Tamamlanmamış veya iptal edilmemiş görev sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Görev Yönetimi', rpc_name: 'get_open_tasks_count' },
    { id: 'overdue_tasks_count', name: 'Gecikmiş Görev Sayısı', description: 'Süresi geçmiş görev sayısı.', unit: ' adet', target_direction: 'decrease', data_source: 'Görev Yönetimi', rpc_name: 'get_overdue_tasks_count' },
    { id: 'task_completion_rate', name: 'Görev Tamamlanma Oranı', description: 'Tamamlanmış görevlerin oranı.', unit: '%', target_direction: 'increase', data_source: 'Görev Yönetimi', rpc_name: 'get_task_completion_rate' },
    
    // Müşteri Memnuniyeti
    { id: 'nps_score', name: 'NPS Skoru', description: 'Net Promoter Score - Müşteri sadakat skoru.', unit: ' puan', target_direction: 'increase', data_source: 'Müşteri Memnuniyeti', rpc_name: 'get_nps_score' },
    { id: 'satisfaction_surveys_count', name: 'Memnuniyet Anketi Sayısı', description: 'Tamamlanmış müşteri memnuniyet anketi sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Müşteri Memnuniyeti', rpc_name: 'get_satisfaction_surveys_count' },
    { id: 'avg_customer_satisfaction_score', name: 'Ortalama Müşteri Memnuniyet Skoru', description: 'Tüm müşterilerin ortalama memnuniyet skoru.', unit: ' puan', target_direction: 'increase', data_source: 'Müşteri Memnuniyeti', rpc_name: 'get_avg_customer_satisfaction_score' },
    
    // Tedarikçi Geliştirme
    { id: 'active_supplier_development_plans_count', name: 'Aktif Tedarikçi Geliştirme Planı Sayısı', description: 'Tamamlanmamış tedarikçi geliştirme planı sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Tedarikçi Geliştirme', rpc_name: 'get_active_supplier_development_plans_count' },
    { id: 'completed_supplier_development_plans_count', name: 'Tamamlanmış Tedarikçi Geliştirme Planı Sayısı', description: 'Tamamlanmış tedarikçi geliştirme planı sayısı.', unit: ' adet', target_direction: 'increase', data_source: 'Tedarikçi Geliştirme', rpc_name: 'get_completed_supplier_development_plans_count' },
];