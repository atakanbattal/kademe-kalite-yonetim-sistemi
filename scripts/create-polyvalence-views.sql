-- Polivalans Modülü için Gerekli View'leri Oluşturma
-- Migration: create-polyvalence-views
-- Tarih: 2025-11-05

-- 1. polyvalence_summary VIEW
-- Personel bazlı polivalans skorlarını hesaplar
CREATE OR REPLACE VIEW polyvalence_summary AS
SELECT 
    p.id AS personnel_id,
    p.full_name,
    p.department,
    p.job_title,
    COUNT(ps.id) AS total_skills,
    COUNT(CASE WHEN ps.current_level >= 3 THEN 1 END) AS proficient_skills,
    CASE 
        WHEN COUNT(ps.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN ps.current_level >= 3 THEN 1 END)::NUMERIC / COUNT(ps.id)::NUMERIC) * 100, 1)
        ELSE 0
    END AS polyvalence_score,
    COUNT(CASE WHEN ps.training_required = true THEN 1 END) AS training_needs,
    MAX(ps.last_training_date) AS last_training_date,
    MAX(ps.last_assessment_date) AS last_assessment_date
FROM 
    personnel p
LEFT JOIN 
    personnel_skills ps ON p.id = ps.personnel_id
GROUP BY 
    p.id, p.full_name, p.department, p.job_title
ORDER BY 
    polyvalence_score DESC;

-- 2. certification_expiry_alerts VIEW
-- Sertifika geçerlilik uyarılarını hesaplar
CREATE OR REPLACE VIEW certification_expiry_alerts AS
SELECT 
    ps.id,
    ps.personnel_id,
    p.full_name AS personnel_name,
    ps.skill_id,
    s.name AS skill_name,
    s.code AS skill_code,
    ps.certification_expiry_date,
    ps.is_certified,
    CASE 
        WHEN ps.certification_expiry_date IS NULL THEN NULL
        ELSE ps.certification_expiry_date - CURRENT_DATE
    END AS days_remaining,
    CASE 
        WHEN ps.certification_expiry_date IS NULL THEN 'Sertifika Yok'
        WHEN ps.certification_expiry_date < CURRENT_DATE THEN 'Süresi Dolmuş'
        WHEN ps.certification_expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Kritik (30 gün içinde)'
        WHEN ps.certification_expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'Uyarı (90 gün içinde)'
        ELSE 'Geçerli'
    END AS status
FROM 
    personnel_skills ps
INNER JOIN 
    personnel p ON ps.personnel_id = p.id
INNER JOIN 
    skills s ON ps.skill_id = s.id
WHERE 
    s.requires_certification = true
    AND ps.is_certified = true
ORDER BY 
    ps.certification_expiry_date ASC NULLS LAST;

-- View'lerin oluşturulduğunu doğrula
DO $$
BEGIN
    RAISE NOTICE 'Polivalans view''leri başarıyla oluşturuldu:';
    RAISE NOTICE '  ✓ polyvalence_summary - Personel polivalans skorları';
    RAISE NOTICE '  ✓ certification_expiry_alerts - Sertifika geçerlilik uyarıları';
    RAISE NOTICE '';
    RAISE NOTICE 'View''leri test etmek için:';
    RAISE NOTICE '  SELECT * FROM polyvalence_summary LIMIT 5;';
    RAISE NOTICE '  SELECT * FROM certification_expiry_alerts LIMIT 5;';
END $$;

