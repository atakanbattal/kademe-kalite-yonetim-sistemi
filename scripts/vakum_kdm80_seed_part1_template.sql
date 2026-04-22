-- KDM 80 vakumlu form — Parça 1: sadece şablon kaydı
DO $$
DECLARE
    v_kdm80 uuid := 'a6588eb6-0475-4959-be3e-ca32521a42ca'::uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.control_form_templates
        WHERE name = 'Vakumlu Üstyapı Final Kontrol Formu (KDM 80)'
    ) THEN
        RETURN;
    END IF;
    INSERT INTO public.control_form_templates (
        name, description, publish_date, revision_no, revision_date,
        references_text, product_ids, header_fields, is_active
    ) VALUES (
        'Vakumlu Üstyapı Final Kontrol Formu (KDM 80)',
        'KDM 80 vakumlu üstyapı final kontrol formu. Görsel kontroller ve ölçüm tablosu PDF ile uyumludur.',
        '2025-10-14', 2, '2026-01-01',
        'Form referansı: KDM.FRM.315 (Vakumlu Son Kontrol Formu).',
        ARRAY[v_kdm80],
        '[
          {"key":"motor_markasi","label":"Motor Markası"},
          {"key":"emisyon_sinifi","label":"Emisyon Sınıfı"},
          {"key":"sps_no","label":"SPS No"},
          {"key":"seri_no","label":"Seri Numarası"},
          {"key":"musteri","label":"Müşteri"},
          {"key":"motor_sanziman_aktarma","label":"Motor-Şanzıman Aktarma Tipi"},
          {"key":"marka","label":"Markası"},
          {"key":"tipi","label":"Tipi"},
          {"key":"modeli","label":"Modeli"},
          {"key":"imal_yili","label":"İmal Yılı"},
          {"key":"motor_no","label":"Motor No"},
          {"key":"kapasite","label":"Kapasite"}
        ]'::jsonb,
        true
    );
END $$;
