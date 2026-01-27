-- ============================================================================
-- DF Kapatma Oranı RPC Fonksiyonu
-- ============================================================================
-- Reddedilenleri hesaba katmadan DF kapatma oranını hesaplar

CREATE OR REPLACE FUNCTION get_df_closure_rate()
RETURNS NUMERIC AS $$
DECLARE
    v_total INTEGER;
    v_closed INTEGER;
BEGIN
    -- Reddedilenleri hariç tutarak toplam DF sayısını hesapla
    SELECT COUNT(*) INTO v_total 
    FROM non_conformities 
    WHERE type = 'DF' 
    AND status != 'Reddedildi';
    
    -- Kapatılan DF sayısını hesapla
    SELECT COUNT(*) INTO v_closed 
    FROM non_conformities 
    WHERE type = 'DF' 
    AND status = 'Kapatıldı';
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_closed::NUMERIC / v_total::NUMERIC * 100), 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_df_closure_rate() IS 'DF kapatma oranını hesaplar. Reddedilenler hesaba katılmaz.';
