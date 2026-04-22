-- =====================================================
-- KPI RPC Fonksiyonları - Yeni Modüller
-- Nonconformity, Leak Test, Fixture, Process Control, After Sales
-- =====================================================

-- =====================================================
-- UYGUNSUZLUK YÖNETİMİ (nonconformity_records)
-- =====================================================

CREATE OR REPLACE FUNCTION get_open_nonconformity_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM nonconformity_records WHERE status != 'Kapatıldı';
$$;

CREATE OR REPLACE FUNCTION get_nonconformity_closure_rate()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND((COUNT(*) FILTER (WHERE status = 'Kapatıldı'))::numeric / COUNT(*) * 100, 2)
  END FROM nonconformity_records;
$$;

CREATE OR REPLACE FUNCTION get_nonconformity_30d_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM nonconformity_records
  WHERE created_at >= NOW() - INTERVAL '30 days';
$$;

CREATE OR REPLACE FUNCTION get_critical_nonconformity_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM nonconformity_records
  WHERE severity = 'Kritik' AND status != 'Kapatıldı';
$$;

CREATE OR REPLACE FUNCTION get_nonconformity_df_8d_conversion_rate()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      COUNT(*) FILTER (WHERE status IN ('DF Açıldı', '8D Açıldı'))::numeric / COUNT(*) * 100,
    2)
  END FROM nonconformity_records;
$$;

-- =====================================================
-- SIZDIMAZLIK KONTROLLERİ (leak_test_records)
-- =====================================================

CREATE OR REPLACE FUNCTION get_leak_test_pass_rate()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      COUNT(*) FILTER (WHERE test_result = 'Kabul')::numeric / COUNT(*) * 100,
    2)
  END FROM leak_test_records
  WHERE created_at >= NOW() - INTERVAL '30 days';
$$;

CREATE OR REPLACE FUNCTION get_leak_test_30d_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM leak_test_records
  WHERE created_at >= NOW() - INTERVAL '30 days';
$$;

CREATE OR REPLACE FUNCTION get_leak_test_rejection_30d_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM leak_test_records
  WHERE test_result = 'Red' AND created_at >= NOW() - INTERVAL '30 days';
$$;

-- =====================================================
-- FİKSTÜR TAKİP (fixtures)
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_fixture_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM fixtures WHERE status = 'Aktif';
$$;

CREATE OR REPLACE FUNCTION get_fixture_nonconformity_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM fixture_nonconformities
  WHERE correction_status != 'Düzeltildi' OR correction_status IS NULL;
$$;

CREATE OR REPLACE FUNCTION get_total_fixture_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM fixtures;
$$;

-- =====================================================
-- PROSES KONTROL (process_inkr_reports)
-- =====================================================

CREATE OR REPLACE FUNCTION get_process_inkr_30d_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM process_inkr_reports
  WHERE created_at >= NOW() - INTERVAL '30 days';
$$;

CREATE OR REPLACE FUNCTION get_process_inkr_total_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM process_inkr_reports;
$$;

-- =====================================================
-- SATIN SONRASI HİZMETLER / MÜŞTERİ ŞİKAYETLERİ
-- =====================================================

CREATE OR REPLACE FUNCTION get_after_sales_open_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM customer_complaints
  WHERE status NOT IN ('Kapatıldı', 'Çözüldü', 'İptal');
$$;

CREATE OR REPLACE FUNCTION get_after_sales_30d_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM customer_complaints
  WHERE created_at >= NOW() - INTERVAL '30 days';
$$;

-- =====================================================
-- İÇ TETKİK - ek fonksiyonlar
-- =====================================================

CREATE OR REPLACE FUNCTION get_audit_finding_open_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM audit_findings
  WHERE status NOT IN ('Kapatıldı', 'Tamamlandı');
$$;

-- =====================================================
-- GÖREV YÖNETİMİ - ek fonksiyonlar
-- =====================================================

CREATE OR REPLACE FUNCTION get_completed_tasks_30d_count()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(*)::numeric FROM tasks
  WHERE status = 'Tamamlandı' AND updated_at >= NOW() - INTERVAL '30 days';
$$;

-- =====================================================
-- Mevcut fonksiyonların güncellenmesi (varsa güvenli)
-- =====================================================

CREATE OR REPLACE FUNCTION get_total_non_quality_cost()
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(cost_amount), 0)::numeric FROM quality_costs;
$$;
