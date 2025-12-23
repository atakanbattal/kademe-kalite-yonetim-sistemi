-- ============================================================================
-- AKILLI BİLDİRİM SİSTEMİ - DUPLICATE KONTROLÜ DÜZELTMESİ
-- Aynı bildirimlerin tekrar oluşturulmasını önler
-- ============================================================================

-- create_notification fonksiyonunu güncelle - duplicate kontrolü ekle
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_module TEXT DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'NORMAL',
    p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_existing_id UUID;
    v_hours_since_last INTEGER;
BEGIN
    -- Aynı title ve notification_type'a sahip okunmamış bildirim var mı kontrol et
    SELECT id, EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600::INTEGER INTO v_existing_id, v_hours_since_last
    FROM notifications
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND title = p_title
      AND is_read = false
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Eğer okunmamış bildirim varsa ve 24 saatten az geçmişse yeni bildirim oluşturma
    IF v_existing_id IS NOT NULL AND v_hours_since_last < 24 THEN
        RETURN v_existing_id; -- Mevcut bildirimin ID'sini döndür
    END IF;
    
    -- Eğer okunmuş bildirim varsa ve 24 saatten az geçmişse yeni bildirim oluşturma
    IF v_existing_id IS NULL THEN
        SELECT id INTO v_existing_id
        FROM notifications
        WHERE user_id = p_user_id
          AND notification_type = p_notification_type
          AND title = p_title
          AND is_read = true
          AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 < 24
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id; -- Mevcut bildirimin ID'sini döndür
        END IF;
    END IF;
    
    -- Yeni bildirim oluştur
    INSERT INTO notifications (
        user_id,
        notification_type,
        title,
        message,
        related_module,
        related_id,
        priority,
        action_url
    ) VALUES (
        p_user_id,
        p_notification_type,
        p_title,
        p_message,
        p_related_module,
        p_related_id,
        p_priority,
        p_action_url
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Bildirim oluşturulamadı: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mevcut duplicate bildirimleri temizle (son 24 saat içinde)
-- Aynı title ve notification_type'a sahip bildirimlerden sadece en yenisini tut
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, notification_type, title 
            ORDER BY created_at DESC
        ) as rn
    FROM notifications
    WHERE created_at >= NOW() - INTERVAL '24 hours'
)
DELETE FROM notifications
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

COMMENT ON FUNCTION create_notification IS 'Bildirim oluşturur. Aynı bildirimlerin 24 saat içinde tekrar oluşturulmasını önler.';

