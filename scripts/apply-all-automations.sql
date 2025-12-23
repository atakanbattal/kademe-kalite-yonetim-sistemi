-- ============================================================================
-- TÜM OTOMASYONLARI UYGULA - MASTER SCRIPT
-- Bu script tüm modül iyileştirmelerini uygular
-- ============================================================================

-- ÖNEMLİ: Bu script'i çalıştırmadan önce yedek alın!
-- Supabase Dashboard > SQL Editor > Bu script'i çalıştırın

-- ============================================================================
-- 1. BİLDİRİM SİSTEMİ
-- ============================================================================
\echo '📢 Bildirim sistemi kuruluyor...';
\i scripts/create-notification-system.sql

-- ============================================================================
-- 2. DF/8D OTOMASYONLARI
-- ============================================================================
\echo '🔧 DF/8D otomasyonları uygulanıyor...';
\i scripts/create-8d-automation.sql

-- ============================================================================
-- 3. KALİTESİZLİK MALİYETİ OTOMASYONLARI
-- ============================================================================
\echo '💰 Kalitesizlik maliyeti otomasyonları uygulanıyor...';
\i scripts/create-quality-cost-automation.sql

-- ============================================================================
-- 4. KARANTİNA OTOMASYONLARI
-- ============================================================================
\echo '⚠️ Karantina otomasyonları uygulanıyor...';
\i scripts/create-quarantine-automation.sql

-- ============================================================================
-- 5. TEDARİKÇİ KALİTE OTOMASYONLARI
-- ============================================================================
\echo '🏭 Tedarikçi kalite otomasyonları uygulanıyor...';
\i scripts/create-supplier-quality-automation.sql

-- ============================================================================
-- 6. MÜŞTERİ ŞİKAYETLERİ SLA OTOMASYONLARI
-- ============================================================================
\echo '📞 Müşteri şikayetleri SLA otomasyonları uygulanıyor...';
\i scripts/create-customer-complaints-automation.sql

-- ============================================================================
-- 7. GİRDİ KALİTE KONTROL OTOMASYONLARI
-- ============================================================================
\echo '📦 Girdi kalite kontrol otomasyonları uygulanıyor...';
\i scripts/create-incoming-quality-automation.sql

-- ============================================================================
-- 8. EKİPMAN KALİBRASYON OTOMASYONLARI
-- ============================================================================
\echo '🔧 Ekipman kalibrasyon otomasyonları uygulanıyor...';
\i scripts/create-equipment-calibration-automation.sql

-- ============================================================================
-- 9. KPI OTOMASYONLARI
-- ============================================================================
\echo '📊 KPI otomasyonları uygulanıyor...';
\i scripts/create-kpi-automation.sql

-- ============================================================================
-- 10. DİĞER MODÜL OTOMASYONLARI
-- ============================================================================
\echo '🔄 Diğer modül otomasyonları uygulanıyor...';
\i scripts/create-remaining-modules-automation.sql

-- ============================================================================
-- TAMAMLANDI
-- ============================================================================
\echo '✅ Tüm otomasyonlar başarıyla uygulandı!';

