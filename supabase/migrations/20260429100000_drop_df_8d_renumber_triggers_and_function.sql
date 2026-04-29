-- DF/8D renumber trigger'larını ve fonksiyonunu kaldır.
--
-- Neden:
-- fn_renumber_df_8d, INSERT/DELETE veya opening_date/df_opened_at UPDATE'inde
-- aynı yıl + aynı tipteki TÜM DF/8D kayıtlarının nc_number'ını ROW_NUMBER ile
-- yeniden hesaplıyordu. Bu, kullanıcılar ve Sistem job'larının nc_number
-- üzerinden tuttuğu eşlemeleri bozuyordu.
--
-- Somut vaka: 12 Şubat 2026'da DF-2026-088 olarak açılan ve 5 dosya yüklenen
-- bir kayıt; sonradan trigger çalıştığında nc_number'ı DF-2026-044'e kaydı.
-- 14 Nisan 2026'daki bir Sistem job'u (5N1K/Ishikawa şablonu otomatik dolduran)
-- nc_number üzerinden eşleştiği için başlık+analizleri yanlış row'a yazdı.
-- Dosyalar row id'sine bağlı olduğu için ortada kaldı: HSCK/Almaksan görselleri
-- başlığı sonradan "Saytek/Vakum" yapılan DF-2026-044'te göründü.
--
-- Karar: nc_number boşluğu kabul edilir, KAYMA asla. Trigger'lar kapatılır.

DROP TRIGGER IF EXISTS trg_renumber_df_8d_on_insert ON public.non_conformities;
DROP TRIGGER IF EXISTS trg_renumber_df_8d_on_delete ON public.non_conformities;
DROP TRIGGER IF EXISTS trg_renumber_df_8d_on_update ON public.non_conformities;
DROP FUNCTION IF EXISTS public.fn_renumber_df_8d() CASCADE;
