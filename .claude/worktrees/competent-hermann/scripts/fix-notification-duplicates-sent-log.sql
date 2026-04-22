-- ============================================================================
-- MÜKERRER BİLDİRİM DÜZELTMESİ - SENT LOG
-- Kullanıcı bildirimi sildiğinde bile tekrar oluşturulmasını önler
-- ============================================================================

-- 1. Gönderilen bildirimleri takip eden log tablosu (silme işleminden etkilenmez)
CREATE TABLE IF NOT EXISTS public.notification_sent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    related_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_sent_log_dedup 
ON public.notification_sent_log (user_id, notification_type, COALESCE(related_id::text, title));

CREATE INDEX IF NOT EXISTS idx_notification_sent_log_created 
ON public.notification_sent_log (created_at DESC);

-- 2. create_notification fonksiyonunu güncelle - sent_log kontrolü ekle
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
    v_existing_in_log BOOLEAN;
BEGIN
    -- related_id varsa ona göre, yoksa title'a göre son 7 gün içinde gönderilmiş mi kontrol et
    IF p_related_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM notification_sent_log
            WHERE user_id = p_user_id
              AND notification_type = p_notification_type
              AND related_id = p_related_id
              AND created_at > NOW() - INTERVAL '7 days'
        ) INTO v_existing_in_log;
    ELSE
        SELECT EXISTS(
            SELECT 1 FROM notification_sent_log
            WHERE user_id = p_user_id
              AND notification_type = p_notification_type
              AND title = p_title
              AND related_id IS NULL
              AND created_at > NOW() - INTERVAL '7 days'
        ) INTO v_existing_in_log;
    END IF;
    
    -- Son 7 günde aynı bildirim gönderilmişse tekrar oluşturma (kullanıcı silmiş olsa bile)
    IF v_existing_in_log THEN
        RETURN NULL;
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
    
    -- Gönderim loguna ekle (silme işleminden etkilenmez)
    INSERT INTO notification_sent_log (user_id, notification_type, title, related_id)
    VALUES (p_user_id, p_notification_type, p_title, p_related_id);
    
    RETURN v_notification_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Bildirim oluşturulamadı: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE notification_sent_log IS 'Gönderilen bildirimlerin logu - aynı bildirimin 7 gün içinde tekrar oluşturulmasını önler';
COMMENT ON FUNCTION create_notification IS 'Bildirim oluşturur. Aynı bildirimin 7 gün içinde tekrar oluşturulmasını önler (kullanıcı silmiş olsa bile).';
