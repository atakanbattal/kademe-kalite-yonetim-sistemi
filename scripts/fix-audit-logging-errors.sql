-- Audit Logging Hata Düzeltmeleri
-- Bu script audit logging trigger'larının hata vermesini engelleyen güncellemeler içerir

-- ============================================================================
-- 1. Audit Logging Function'ı Güvenli Hale Getir
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_action TEXT;
    v_details JSONB;
    v_table_name TEXT;
BEGIN
    -- Hata durumunda trigger'ı sessizce başarısız yap
    BEGIN
        -- Current user bilgilerini al
        v_user_id := auth.uid();
        
        -- User full name'i profiles tablosundan çek
        SELECT full_name INTO v_user_name
        FROM public.profiles
        WHERE id = v_user_id;
        
        -- Eğer profiles'da yoksa auth.users'dan çek
        IF v_user_name IS NULL THEN
            SELECT raw_user_meta_data->>'full_name' INTO v_user_name
            FROM auth.users
            WHERE id = v_user_id;
        END IF;
        
        -- Tablo adını al (NULL olamaz)
        v_table_name := TG_TABLE_NAME;
        
        -- Eğer table_name NULL ise, default değer ata
        IF v_table_name IS NULL OR v_table_name = '' THEN
            v_table_name := 'unknown_table';
        END IF;
        
        -- İşlem tipine göre action ve details belirle
        IF (TG_OP = 'INSERT') THEN
            v_action := 'EKLEME: ' || v_table_name;
            v_details := to_jsonb(NEW);
            
        ELSIF (TG_OP = 'UPDATE') THEN
            v_action := 'GÜNCELLEME: ' || v_table_name;
            v_details := jsonb_build_object(
                'old', to_jsonb(OLD),
                'new', to_jsonb(NEW),
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(to_jsonb(NEW))
                    WHERE to_jsonb(NEW)->>key IS DISTINCT FROM to_jsonb(OLD)->>key
                )
            );
            
        ELSIF (TG_OP = 'DELETE') THEN
            v_action := 'SİLME: ' || v_table_name;
            v_details := to_jsonb(OLD);
        END IF;
        
        -- Audit kaydını ekle (tüm alanlar NOT NULL kontrolü yapılmış)
        INSERT INTO public.audit_log_entries (
            user_id,
            user_full_name,
            action,
            table_name,
            details,
            created_at
        ) VALUES (
            v_user_id,
            COALESCE(v_user_name, 'Sistem'),
            COALESCE(v_action, 'UNKNOWN: ' || v_table_name),
            COALESCE(v_table_name, 'unknown_table'),
            COALESCE(v_details, '{}'::jsonb),
            NOW()
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- Hata durumunda sessizce devam et (trigger'ı bloklamaz)
        -- Bu sayede audit logging hatası ana işlemi engellemez
        RAISE WARNING 'Audit log kaydedilemedi: % (Table: %)', SQLERRM, COALESCE(v_table_name, TG_TABLE_NAME);
    END;
    
    -- Trigger'ın normal akışını bozmamak için uygun değeri döndür
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_entry() IS 'Tüm kritik tablo işlemlerini otomatik olarak audit_log_entries tablosuna kaydeder (hata güvenli)';

-- ============================================================================
-- 2. Mevcut NULL table_name Kayıtlarını Temizle
-- ============================================================================
UPDATE audit_log_entries
SET table_name = 'unknown_table'
WHERE table_name IS NULL;

-- ============================================================================
-- 3. table_name NULL constraint'ini yeniden ekle (güvenli şekilde)
-- ============================================================================
ALTER TABLE audit_log_entries
ALTER COLUMN table_name SET NOT NULL;

-- ============================================================================
-- 4. Başarı Mesajı
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Audit logging hata düzeltmeleri başarıyla uygulandı!';
    RAISE NOTICE '📋 Function güvenli hale getirildi - artık hatalar ana işlemi engellemeyecek';
END $$;

