-- ============================================================================
-- TEDARİKÇİ OTOMATİK ONAY SİSTEMİ
-- Kurallar:
-- 1. Denetim yok + puan yok olan Askıya Alınmış/Red tedarikçiler → Değerlendirilmemiş
-- 2. 6 ay ticaret + hata yok + denetim yok → Otomatik Onaylı
-- 3. Denetim yapılmış tedarikçilere DOKUNULMAZ - denetim puanı esas
-- ============================================================================

-- Ana fonksiyon: Tüm uygun tedarikçileri kontrol eder ve günceller
CREATE OR REPLACE FUNCTION auto_approve_suppliers_without_audit()
RETURNS TABLE (
    supplier_id UUID,
    supplier_name TEXT,
    action TEXT,
    reason TEXT
) AS $$
DECLARE
    v_six_months_ago DATE := CURRENT_DATE - INTERVAL '6 months';
    v_to_approve_ids UUID[];
BEGIN
    -- 0. Denetim puanı 75+ olan (A/B sınıfı) Askıya Alınmış tedarikçileri Onaylı yap
    UPDATE suppliers s
    SET status = 'Onaylı', updated_at = NOW()
    WHERE s.status = 'Askıya Alınmış'
      AND EXISTS (
        SELECT 1 FROM supplier_audit_plans sap 
        WHERE sap.supplier_id = s.id AND sap.status = 'Tamamlandı' AND sap.score >= 75
      );

    -- 1. Denetim yok + puan yok olan Askıya Alınmış/Red tedarikçileri Değerlendirilmemiş yap
    UPDATE suppliers s
    SET status = 'Değerlendirilmemiş', updated_at = NOW(),
        grade_reason = NULL
    WHERE s.status IN ('Askıya Alınmış', 'Red')
      AND s.supplier_grade IS NULL
      AND NOT EXISTS (SELECT 1 FROM supplier_audit_plans sap WHERE sap.supplier_id = s.id AND sap.status = 'Tamamlandı');

    -- 2. Onaylanacak tedarikçiler: 6 ay ticaret + hata yok + denetim yok → Onaylı
    SELECT array_agg(s.id) INTO v_to_approve_ids
    FROM suppliers s
    WHERE s.status IN ('Değerlendirilmemiş', 'Askıya Alınmış', 'Alternatif')
      AND NOT EXISTS (SELECT 1 FROM supplier_audit_plans sap WHERE sap.supplier_id = s.id AND sap.status = 'Tamamlandı')
      AND (SELECT COUNT(*) FROM incoming_inspections ii WHERE ii.supplier_id = s.id AND ii.inspection_date >= v_six_months_ago AND ii.decision IS NOT NULL) > 0
      AND (SELECT COUNT(*) FROM incoming_inspections ii WHERE ii.supplier_id = s.id AND ii.inspection_date >= v_six_months_ago AND ii.decision IN ('Ret', 'Şartlı Kabul')) = 0
      AND (SELECT COUNT(*) FROM non_conformities nc WHERE nc.supplier_id = s.id AND (nc.opening_date >= v_six_months_ago OR nc.created_at >= v_six_months_ago)) = 0;

    UPDATE suppliers s
    SET status = 'Onaylı', updated_at = NOW(),
        grade_reason = COALESCE(grade_reason, '') || CASE WHEN COALESCE(grade_reason, '') != '' THEN ' | ' ELSE '' END || 'Otomatik onay: 6 ay ticaret, hata yok (denetim yapılmadı)'
    WHERE s.id = ANY(COALESCE(v_to_approve_ids, ARRAY[]::UUID[]));

    RETURN QUERY
    WITH supplier_check AS (
        SELECT s.id, s.name, s.status,
            EXISTS (SELECT 1 FROM supplier_audit_plans sap WHERE sap.supplier_id = s.id AND sap.status = 'Tamamlandı') AS has_audit,
            (SELECT COUNT(*) FROM incoming_inspections ii WHERE ii.supplier_id = s.id AND ii.inspection_date >= v_six_months_ago AND ii.decision IS NOT NULL)::INT AS inspection_count_6m,
            (SELECT COUNT(*) FROM incoming_inspections ii WHERE ii.supplier_id = s.id AND ii.inspection_date >= v_six_months_ago AND ii.decision IN ('Ret', 'Şartlı Kabul'))::INT AS defect_count_incoming,
            (SELECT COUNT(*) FROM non_conformities nc WHERE nc.supplier_id = s.id AND (nc.opening_date >= v_six_months_ago OR nc.created_at >= v_six_months_ago))::INT AS nc_count_6m
        FROM suppliers s
        WHERE s.status IN ('Değerlendirilmemiş', 'Askıya Alınmış', 'Alternatif', 'Onaylı')
    )
    SELECT sc.id, sc.name,
        CASE 
            WHEN sc.id = ANY(COALESCE(v_to_approve_ids, ARRAY[]::UUID[])) THEN 'APPROVED'
            WHEN sc.has_audit THEN 'SKIP_DENETIM_VAR'
            WHEN sc.inspection_count_6m = 0 THEN 'SKIP_TICARET_YOK'
            WHEN sc.defect_count_incoming > 0 OR sc.nc_count_6m > 0 THEN 'SKIP_HATA_VAR'
            WHEN sc.status = 'Onaylı' THEN 'ZATEN_ONAYLI'
            ELSE 'SKIP_DIGER'
        END,
        CASE 
            WHEN sc.id = ANY(COALESCE(v_to_approve_ids, ARRAY[]::UUID[])) THEN '6 ay ticaret, hata yok - otomatik onaylandı'
            WHEN sc.has_audit THEN 'Denetim yapılmış - denetim puanı esas'
            WHEN sc.inspection_count_6m = 0 THEN 'Son 6 ayda giriş kontrolü yok (ticaret yok)'
            WHEN sc.defect_count_incoming > 0 THEN format('Son 6 ayda %s ret/şartlı kabul kaydı var', sc.defect_count_incoming)
            WHEN sc.nc_count_6m > 0 THEN format('Son 6 ayda %s DF/8D kaydı açılmış', sc.nc_count_6m)
            WHEN sc.status = 'Onaylı' THEN 'Zaten onaylı'
            ELSE 'Diğer neden'
        END
    FROM supplier_check sc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_approve_suppliers_without_audit IS 'Denetim yapılmamış tedarikçileri kontrol eder: 6 ay ticaret + hata yok = Otomatik Onaylı. Denetim yapılmış tedarikçilere dokunmaz.';
