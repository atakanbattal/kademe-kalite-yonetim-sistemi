// =====================================================
// KPI Birim Seçenekleri - Hata önleme için select ile seçim
// =====================================================
export const KPI_UNIT_OPTIONS = [
    { value: '%', label: '%' },
    { value: 'adet', label: 'adet' },
    { value: 'gün', label: 'gün' },
    { value: 'puan', label: 'puan' },
    { value: 'TRY', label: 'TRY' },
    { value: 'TRY/Araç', label: 'TRY / araç' },
    { value: 'Kg', label: 'Kg' },
    { value: 'saat', label: 'saat' },
];

// =====================================================
// KPI Kategorileri - Her kategorinin renk ve icon bilgisi
// =====================================================
export const KPI_CATEGORIES = [
    { id: 'all', label: 'Tümü', color: 'gray', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', icon: 'LayoutGrid' },
    { id: 'quality', label: 'Kalite & Uygunsuzluk', color: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', icon: 'ShieldAlert' },
    { id: 'production', label: 'Üretim & Kontrol', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400', icon: 'Factory' },
    { id: 'supplier', label: 'Tedarikçi', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400', icon: 'Truck' },
    { id: 'customer', label: 'Müşteri & Satış Sonrası', color: 'purple', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400', icon: 'Users' },
    { id: 'document', label: 'Doküman & Tetkik', color: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400', icon: 'FileText' },
    { id: 'equipment', label: 'Ekipman & Altyapı', color: 'slate', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-400', icon: 'Wrench' },
    { id: 'hr', label: 'İnsan Kaynakları', color: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', icon: 'GraduationCap' },
    { id: 'improvement', label: 'İyileştirme', color: 'teal', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-400', icon: 'TrendingUp' },
    { id: 'management', label: 'Yönetim & Maliyet', color: 'violet', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-400', icon: 'BarChart3' },
];

// =====================================================
// Predefined KPI'lar - Tüm gerçek modülleri kapsar
// =====================================================
export const predefinedKpis = [

    // =============================================================
    // KALİTE & UYGUNSUZLUK
    // =============================================================
    {
        id: 'open_non_conformities_count',
        name: 'Açık DF/8D Sayısı',
        description: 'Henüz kapatılmamış tüm DF ve 8D kayıtlarının toplam sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_open_non_conformities_count',
        category: 'quality',
    },
    {
        id: 'open_8d_count',
        name: 'Açık 8D Sayısı',
        description: 'Henüz kapatılmamış 8D kayıtlarının toplam sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_open_8d_count',
        category: 'quality',
    },
    {
        id: 'df_closure_rate',
        name: 'DF Kapatma Oranı',
        description: 'Kapatılan DF\'lerin toplam DF sayısına oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_df_closure_rate',
        category: 'quality',
    },
    {
        id: 'avg_quality_nc_closure_time',
        name: 'DF/8D Kapatma Süresi',
        description: 'Kalite departmanının aksiyonları ortalama kapatma süresi.',
        unit: ' gün', target_direction: 'decrease',
        data_source: 'DF ve 8D Yönetimi', rpc_name: 'get_avg_quality_nc_closure_time',
        category: 'quality',
    },
    // Uygunsuzluk Yönetimi
    {
        id: 'open_nonconformity_count',
        name: 'Açık Uygunsuzluk Sayısı',
        description: 'Henüz kapatılmamış uygunsuzluk kayıtlarının sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Uygunsuzluk Yönetimi', rpc_name: 'get_open_nonconformity_count',
        category: 'quality',
    },
    {
        id: 'nonconformity_closure_rate',
        name: 'Uygunsuzluk Kapatma Oranı',
        description: 'Kapatılan uygunsuzlukların toplam uygunsuzluklara oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Uygunsuzluk Yönetimi', rpc_name: 'get_nonconformity_closure_rate',
        category: 'quality',
    },
    {
        id: 'nonconformity_30d_count',
        name: 'Uygunsuzluk (30 Gün)',
        description: 'Son 30 günde kayıt edilen uygunsuzluk sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Uygunsuzluk Yönetimi', rpc_name: 'get_nonconformity_30d_count',
        category: 'quality',
    },
    {
        id: 'critical_nonconformity_count',
        name: 'Kritik Uygunsuzluk Sayısı',
        description: 'Kapatılmamış kritik seviyedeki uygunsuzluk sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Uygunsuzluk Yönetimi', rpc_name: 'get_critical_nonconformity_count',
        category: 'quality',
    },
    {
        id: 'nonconformity_df_8d_conversion_rate',
        name: 'DF/8D Dönüşüm Oranı',
        description: 'DF veya 8D\'ye dönüştürülen uygunsuzlukların oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Uygunsuzluk Yönetimi', rpc_name: 'get_nonconformity_df_8d_conversion_rate',
        category: 'quality',
    },
    {
        id: 'quarantine_count',
        name: 'Karantinadaki Ürün Sayısı',
        description: 'Aktif olarak karantinada bulunan ürünlerin toplam sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Karantina Yönetimi', rpc_name: 'get_quarantine_count',
        category: 'quality',
    },

    // =============================================================
    // ÜRETİM & KONTROL
    // =============================================================
    {
        id: 'produced_vehicles_count',
        name: 'Üretilen Araç (30 Gün)',
        description: 'Son 30 günde üretilen araç sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Kaliteye Verilen Araçlar', rpc_name: 'get_produced_vehicles_count',
        category: 'production',
    },
    {
        id: 'quality_inspection_pass_rate',
        name: 'Kalite Kontrol Geçiş Oranı',
        description: 'Kalite kontrolünden geçen araçların oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Kaliteye Verilen Araçlar', rpc_name: 'get_quality_inspection_pass_rate',
        category: 'production',
    },
    {
        id: 'avg_quality_process_time',
        name: 'Ortalama Araç Kalite Süresi',
        description: 'Kaliteye giren araçların ortalama onaylanma süresi.',
        unit: ' gün', target_direction: 'decrease',
        data_source: 'Kaliteye Verilen Araçlar', rpc_name: 'get_avg_quality_process_time',
        category: 'production',
    },
    {
        id: 'avg_quality_inspection_time',
        name: 'Ortalama Muayene Süresi',
        description: 'Kalite kontrol işleminin ortalama süresi.',
        unit: ' gün', target_direction: 'decrease',
        data_source: 'Kaliteye Verilen Araçlar', rpc_name: 'get_avg_quality_inspection_time',
        category: 'production',
    },
    // Proses Kontrol
    {
        id: 'process_inkr_30d_count',
        name: 'Proses INKR (30 Gün)',
        description: 'Son 30 günde gerçekleştirilen proses muayene raporu sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Proses Kontrol', rpc_name: 'get_process_inkr_30d_count',
        category: 'production',
    },
    {
        id: 'process_inkr_total_count',
        name: 'Toplam Proses INKR Sayısı',
        description: 'Sistemde kayıtlı toplam proses muayene raporu sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Proses Kontrol', rpc_name: 'get_process_inkr_total_count',
        category: 'production',
    },
    // Sızdırmazlık
    {
        id: 'leak_test_pass_rate',
        name: 'Sızdırmazlık Kabul Oranı',
        description: 'Son 30 günde sızdırmazlık testinden kabul oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Sızdırmazlık Kontrol', rpc_name: 'get_leak_test_pass_rate',
        category: 'production',
    },
    {
        id: 'leak_test_30d_count',
        name: 'Sızdırmazlık Testi (30 Gün)',
        description: 'Son 30 günde gerçekleştirilen sızdırmazlık testi sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Sızdırmazlık Kontrol', rpc_name: 'get_leak_test_30d_count',
        category: 'production',
    },
    {
        id: 'leak_test_rejection_30d_count',
        name: 'Sızdırmazlık Red (30 Gün)',
        description: 'Son 30 günde sızdırmazlık testinde ret sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Sızdırmazlık Kontrol', rpc_name: 'get_leak_test_rejection_30d_count',
        category: 'production',
    },

    // =============================================================
    // TEDARİKÇİ YÖNETİMİ
    // =============================================================
    {
        id: 'open_supplier_nc_count',
        name: 'Açık Tedarikçi Uygunsuzluğu',
        description: 'Henüz kapatılmamış tedarikçi uygunsuzluklarının sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_open_supplier_nc_count',
        category: 'supplier',
    },
    {
        id: 'active_suppliers_count',
        name: 'Aktif Tedarikçi Sayısı',
        description: 'Sistemde kayıtlı aktif tedarikçi sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_active_suppliers_count',
        category: 'supplier',
    },
    {
        id: 'avg_supplier_score',
        name: 'Ortalama Tedarikçi Skoru',
        description: 'Onaylı tedarikçiler için tamamlanan denetimlerin (denetim planı skoru) ortalaması.',
        unit: ' puan', target_direction: 'increase',
        data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_avg_supplier_score',
        category: 'supplier',
    },
    {
        id: 'supplier_nc_rate',
        name: 'Tedarikçi Uygunsuzluk Oranı',
        description: 'Uygunsuzluk bulunan tedarikçilerin oranı.',
        unit: '%', target_direction: 'decrease',
        data_source: 'Tedarikçi Kalite Yönetimi', rpc_name: 'get_supplier_nc_rate',
        category: 'supplier',
    },
    {
        id: 'incoming_rejection_rate',
        name: 'Girdi Kalite Red Oranı',
        description: 'Girdi kalite kontrolünde reddedilen malzemelerin oranı.',
        unit: '%', target_direction: 'decrease',
        data_source: 'Girdi Kalite Kontrol', rpc_name: 'get_incoming_rejection_rate',
        category: 'supplier',
    },
    {
        id: 'active_supplier_development_plans_count',
        name: 'Tedarikçi Geliştirme Planı',
        description: 'Tamamlanmamış tedarikçi geliştirme planı sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Tedarikçi Geliştirme', rpc_name: 'get_active_supplier_development_plans_count',
        category: 'supplier',
    },

    // =============================================================
    // MÜŞTERİ & SATIŞ SONRASI
    // =============================================================
    {
        id: 'open_customer_complaints_count',
        name: 'Açık Şikayet/Talep Sayısı',
        description: 'Kapatılmamış müşteri şikayeti ve satış sonrası talep sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Satış Sonrası Hizmetler', rpc_name: 'get_open_customer_complaints_count',
        category: 'customer',
    },
    {
        id: 'after_sales_open_count',
        name: 'Açık Satış Sonrası Talep',
        description: 'Kapatılmamış satış sonrası hizmet kayıtlarının sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Satış Sonrası Hizmetler', rpc_name: 'get_after_sales_open_count',
        category: 'customer',
    },
    {
        id: 'after_sales_30d_count',
        name: 'Satış Sonrası Talep (30 Gün)',
        description: 'Son 30 günde açılan satış sonrası hizmet kayıtları.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Satış Sonrası Hizmetler', rpc_name: 'get_after_sales_30d_count',
        category: 'customer',
    },
    {
        id: 'avg_complaint_resolution_time',
        name: 'Ortalama Çözüm Süresi',
        description: 'Şikayetlerin ortalama çözüm süresi.',
        unit: ' gün', target_direction: 'decrease',
        data_source: 'Satış Sonrası Hizmetler', rpc_name: 'get_avg_complaint_resolution_time',
        category: 'customer',
    },
    {
        id: 'sla_compliant_complaints_rate',
        name: 'SLA Uyum Oranı',
        description: 'Belirlenen SLA süresi içinde çözülen şikayetlerin oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Satış Sonrası Hizmetler', rpc_name: 'get_sla_compliant_complaints_rate',
        category: 'customer',
    },

    // =============================================================
    // DOKÜMAN & TETKİK & SAPMA
    // =============================================================
    {
        id: 'expired_document_count',
        name: 'Süresi Dolmuş Doküman',
        description: 'Geçerlilik süresi dolmuş dokümanların sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Doküman Yönetimi', rpc_name: 'get_expired_document_count',
        category: 'document',
    },
    {
        id: 'completed_internal_audits_30d_count',
        name: 'Tamamlanan İç Tetkik (30 Gün)',
        description: 'Son 30 gün içinde tamamlanan iç tetkik sayısı (operasyonel performans).',
        unit: ' adet', target_direction: 'increase',
        data_source: 'İç Tetkik Yönetimi', rpc_name: 'get_completed_internal_audits_30d_count',
        category: 'document',
    },
    {
        id: 'open_deviation_count',
        name: 'Açık Sapma Sayısı',
        description: 'Henüz tamamlanmamış sapma taleplerinin sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Sapma Yönetimi', rpc_name: 'get_open_deviation_count',
        category: 'document',
    },

    // =============================================================
    // EKİPMAN & ALTYAPI
    // =============================================================
    {
        id: 'calibration_due_count',
        name: 'Kalibrasyonu Gecikmiş Ekipman',
        description: 'Aktif ekipmanlar için son geçerli kalibrasyon kaydına göre süresi dolmuş (gecikmiş) sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Ekipman & Kalibrasyon', rpc_name: 'get_calibration_due_count',
        category: 'equipment',
    },
    {
        id: 'active_fixture_count',
        name: 'Aktif Fikstür Sayısı',
        description: 'Sistemde aktif durumda olan fikstür sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Fikstür Takip', rpc_name: 'get_active_fixture_count',
        category: 'equipment',
    },
    {
        id: 'total_fixture_count',
        name: 'Toplam Fikstür Sayısı',
        description: 'Sistemde kayıtlı toplam fikstür sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Fikstür Takip', rpc_name: 'get_total_fixture_count',
        category: 'equipment',
    },
    {
        id: 'fixture_nonconformity_count',
        name: 'Açık Fikstür Uygunsuzluğu',
        description: 'Düzeltilmemiş fikstür uygunsuzluklarının sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Fikstür Takip', rpc_name: 'get_fixture_nonconformity_count',
        category: 'equipment',
    },
    {
        id: 'active_wps_procedures_count',
        name: 'Aktif WPS Prosedürü',
        description: 'Aktif olan WPS (Kaynak Prosedür Şartnamesi) sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'WPS Yönetimi', rpc_name: 'get_active_wps_procedures_count',
        category: 'equipment',
    },
    {
        id: 'pending_wps_approvals_count',
        name: 'Onay Bekleyen WPS Sayısı',
        description: 'Onay bekleyen WPS prosedürü sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'WPS Yönetimi', rpc_name: 'get_pending_wps_approvals_count',
        category: 'equipment',
    },

    // =============================================================
    // İNSAN KAYNAKLARI
    // =============================================================
    {
        id: 'planned_trainings_count',
        name: 'Planlanmış Eğitim Sayısı',
        description: 'Gelecekte gerçekleşecek planlanmış eğitim sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Eğitim Yönetimi', rpc_name: 'get_planned_trainings_count',
        category: 'hr',
    },
    {
        id: 'completed_trainings_count',
        name: 'Tamamlanmış Eğitim Sayısı',
        description: 'Durumu tamamlanmış eğitim kayıtlarının toplam sayısı (Türkçe/İngilizce durumlar dahil).',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Eğitim Yönetimi', rpc_name: 'get_completed_trainings_count',
        category: 'hr',
    },
    {
        id: 'training_participation_rate',
        name: 'Eğitim Katılım Oranı',
        description: 'Eğitimlere katılan personelin oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Eğitim Yönetimi', rpc_name: 'get_training_participation_rate',
        category: 'hr',
    },
    {
        id: 'avg_polyvalence_score',
        name: 'Ortalama Polivalans Skoru',
        description: 'Tüm personelin ortalama polivalans (çoklu yetkinlik) skoru.',
        unit: ' puan', target_direction: 'increase',
        data_source: 'Polivalans Matrisi', rpc_name: 'get_avg_polyvalence_score',
        category: 'hr',
    },
    {
        id: 'critical_skill_gaps_count',
        name: 'Kritik Yetkinlik Eksikliği',
        description: 'Hedef seviyenin altında kritik yetkinliği olan personel sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Polivalans Matrisi', rpc_name: 'get_critical_skill_gaps_count',
        category: 'hr',
    },
    {
        id: 'expired_certifications_count',
        name: 'Geçersiz Sertifika Sayısı',
        description: 'Geçerlilik tarihi geçmiş sertifika sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Polivalans Matrisi', rpc_name: 'get_expired_certifications_count',
        category: 'hr',
    },

    // =============================================================
    // İYİLEŞTİRME
    // =============================================================
    {
        id: 'active_kaizen_count',
        name: 'Aktif Kaizen Sayısı',
        description: 'Devam eden kaizen iyileştirme projelerinin sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'İyileştirme (Kaizen)', rpc_name: 'get_active_kaizen_count',
        category: 'improvement',
    },
    {
        id: 'completed_kaizen_count',
        name: 'Tamamlanmış Kaizen',
        description: 'Başarıyla tamamlanmış kaizen sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'İyileştirme (Kaizen)', rpc_name: 'get_completed_kaizen_count',
        category: 'improvement',
    },
    {
        id: 'kaizen_success_rate',
        name: 'Kaizen Başarı Oranı',
        description: 'Tamamlanmış kaizenlerin toplam kaizene oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'İyileştirme (Kaizen)', rpc_name: 'get_kaizen_success_rate',
        category: 'improvement',
    },
    {
        id: 'active_benchmarks_count',
        name: 'Aktif Benchmark Sayısı',
        description: 'Devam eden benchmark çalışmalarının sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Benchmark Yönetimi', rpc_name: 'get_active_benchmarks_count',
        category: 'improvement',
    },
    {
        id: 'completed_benchmarks_count',
        name: 'Tamamlanmış Benchmark',
        description: 'Tamamlanmış benchmark çalışmalarının sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Benchmark Yönetimi', rpc_name: 'get_completed_benchmarks_count',
        category: 'improvement',
    },

    // =============================================================
    // YÖNETİM & MALİYET
    // =============================================================
    {
        id: 'open_tasks_count',
        name: 'Açık Görev Sayısı',
        description: 'Tamamlanmamış görev sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Görev Yönetimi', rpc_name: 'get_open_tasks_count',
        category: 'management',
    },
    {
        id: 'overdue_tasks_count',
        name: 'Gecikmiş Görev Sayısı',
        description: 'Süresi geçmiş tamamlanmamış görev sayısı.',
        unit: ' adet', target_direction: 'decrease',
        data_source: 'Görev Yönetimi', rpc_name: 'get_overdue_tasks_count',
        category: 'management',
    },
    {
        id: 'task_completion_rate',
        name: 'Görev Tamamlanma Oranı',
        description: 'Tamamlanmış görevlerin toplam görevlere oranı.',
        unit: '%', target_direction: 'increase',
        data_source: 'Görev Yönetimi', rpc_name: 'get_task_completion_rate',
        category: 'management',
    },
    {
        id: 'completed_tasks_30d_count',
        name: 'Tamamlanan Görev (30 Gün)',
        description: 'Son 30 günde tamamlanan görev sayısı.',
        unit: ' adet', target_direction: 'increase',
        data_source: 'Görev Yönetimi', rpc_name: 'get_completed_tasks_30d_count',
        category: 'management',
    },
    {
        id: 'non_quality_cost',
        name: 'Toplam Kalite Maliyeti',
        description: 'Sistemdeki toplam kalite maliyeti (kayıp, önleme, değerlendirme).',
        unit: ' TL', target_direction: 'decrease',
        data_source: 'Kalite Maliyetleri', rpc_name: 'get_total_non_quality_cost',
        category: 'management',
    },
    {
        id: 'total_quality_cost',
        name: 'Tüm Zamanlar Kalite Maliyeti',
        description: 'Tüm dönemlerdeki toplam kalite maliyeti.',
        unit: ' TL', target_direction: 'decrease',
        data_source: 'Kalite Maliyetleri', rpc_name: 'get_total_quality_cost',
        category: 'management',
    },
];

/** Eski otomatik KPI id → güncel şablon id (DB satırı henüz migrate edilmediyse) */
const LEGACY_AUTO_KPI_ID_MAP = {
    open_internal_audit_count: 'completed_internal_audits_30d_count',
};

/** auto_kpi_id → şablon KPI (tek kaynak) */
const PREDEFINED_KPI_BY_AUTO_ID = Object.fromEntries(
    predefinedKpis.map((k) => [k.id, k])
);

/**
 * Otomatik KPI kartlarında DB’de kalmış eski/çift isimleri önlemek için
 * predefinedKpis ile ad, açıklama, veri kaynağı, kategori ve hedef yönünü eşitler.
 * (target_direction DB’de eski kaldığında En iyi/En kötü ay ve hedef karşılaştırması yanlış oluyordu.)
 */
export function getAutoKpiDisplayMeta(kpi) {
    const fallbackDir = kpi?.target_direction ?? 'decrease';
    if (!kpi?.is_auto || !kpi?.auto_kpi_id) {
        return {
            name: kpi?.name ?? '',
            description: kpi?.description,
            data_source: kpi?.data_source,
            category: kpi?.category,
            target_direction: fallbackDir,
        };
    }
    const templateId = LEGACY_AUTO_KPI_ID_MAP[kpi.auto_kpi_id] ?? kpi.auto_kpi_id;
    const def = PREDEFINED_KPI_BY_AUTO_ID[templateId];
    if (!def) {
        return {
            name: kpi.name,
            description: kpi.description,
            data_source: kpi.data_source,
            category: kpi.category,
            target_direction: fallbackDir,
        };
    }
    return {
        name: def.name,
        description: def.description,
        data_source: def.data_source,
        category: def.category ?? kpi.category,
        target_direction: def.target_direction ?? fallbackDir,
    };
}
