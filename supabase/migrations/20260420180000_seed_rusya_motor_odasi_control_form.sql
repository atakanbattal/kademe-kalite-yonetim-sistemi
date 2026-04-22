-- Rusya Motor Odası Kontrol Formu — PDF: Rusya_Motor_Odasi_Kontrol_Formu.pdf
-- Idempotent: aynı isimde şablon varsa atlanır.

DO $$
DECLARE
    v_tid uuid;
    v_sid uuid;
    v_prod uuid := '339c0e13-0d50-4afb-a40f-c7cb5279b429'::uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.control_form_templates
        WHERE name = 'Rusya Motor Odası Kontrol Formu'
    ) THEN
        RAISE NOTICE 'Rusya motor odası şablonu zaten mevcut, atlanıyor.';
        RETURN;
    END IF;

    INSERT INTO public.control_form_templates (
        name,
        description,
        publish_date,
        revision_no,
        revision_date,
        references_text,
        product_ids,
        header_fields,
        is_active
    ) VALUES (
        'Rusya Motor Odası Kontrol Formu',
        'Rusya motor odası montaj sonrası kontrol formu. 30 görsel kontrol maddesi PDF (KAL-FR-2025-0017) ile eşleştirilmiştir.',
        '2025-09-26',
        3,
        '2026-01-26',
        'Form referansı: KAL-FR-2025-0017 (Rusya Motor Odası Kontrol Formu).',
        ARRAY[v_prod],
        '[
          {"key":"musteri","label":"Müşteri"},
          {"key":"seri_no","label":"Seri Numarası"},
          {"key":"motor_markasi","label":"Motor Markası"},
          {"key":"emisyon_sinifi","label":"Emisyon Sınıfı"},
          {"key":"sps_no","label":"SPS No"},
          {"key":"motor_sanziman_aktarma","label":"Motor-Şanzıman Aktarma Tipi"},
          {"key":"motor_no","label":"Motor No"},
          {"key":"motor_uretim_tarihi","label":"Motor Üretim Tarihi"}
        ]'::jsonb,
        true
    ) RETURNING id INTO v_tid;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Motor Odası Kontrolleri', 'PDF maddeleri 1–30.', 0) RETURNING id INTO v_sid;

    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Radyatör davlumbaz altında 2 mm sünger şerit var mı?', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Radyatör davlumbaz çevresinde slot kaynak üzerinde silikon çekilmiş mi?', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Yan dolap kapağındaki kilit kitleniyor mu? Ayarlı mı?', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'İnterkol radyatör bağlantı yeri düzgün mü?', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Yan dolap plastikleri kırık veya çatlak var mı?', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Yan dolap içi ince silikon çekilmiş mi? Delik var mı?', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Hava filtresi arka kapak toz lastiği aşağı bakıyor mu?', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Hava filtresi iç ve dış hava filtre takılı mı? Arka kapağı sökülüp takılıyor mu?', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Motor takozları üzerinde takılı mı?', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Fan salyongozları boğaz lastiği takılı mı? Sağlam mı?', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Fan salyongozları üst baca fitili takılı mı? Sağlam mı?', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'Dolap üstü fitilleri yerine oturuyor mu? (D FİTİL)', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Alüminyum bloklar ağızları kapalı mı?', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Yağ deposu fitilleri yönü doğru mu?', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Yağ dolum fitilleri var mı?', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'Cam şamandıraları var mı? Bağlı mı?', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'Kırmızı tutamaklar bağlı mı? Bağlı ise kırmızı mı?', 'visual', NULL, NULL, NULL, true, 16),
    (v_sid, 'Fan ayar sacının yayları var mı?', 'visual', NULL, NULL, NULL, true, 17),
    (v_sid, 'Su vanalarının başlıkları takılmış mı?', 'visual', NULL, NULL, NULL, true, 18),
    (v_sid, 'Kaydırma yapışkan var mı?', 'visual', NULL, NULL, NULL, true, 19),
    (v_sid, 'Pnömatik hava başlıkları bağlı mı?', 'visual', NULL, NULL, NULL, true, 20),
    (v_sid, 'Civatalarda fiberli somun kullanılmış mı?', 'visual', NULL, NULL, NULL, true, 21),
    (v_sid, 'Pnömatik başlıklar bağlı mı?', 'visual', NULL, NULL, NULL, true, 22),
    (v_sid, 'Civatalar gerekli tork değeri ile sıkılmış mı? İşaretleme yapılmış mı?', 'visual', NULL, NULL, NULL, true, 23),
    (v_sid, 'Koruyucu yağ ile fan göbekleri yağlanarak paslanma önlenmiş mi?', 'visual', NULL, NULL, NULL, true, 24),
    (v_sid, 'Fan üzerinde seri numara markalaması yapılmış mı?', 'visual', NULL, NULL, NULL, true, 25),
    (v_sid, 'Boya üzerinde herhangi bir görsel hata var mı?', 'visual', NULL, NULL, NULL, true, 26),
    (v_sid, 'Şanzımanların fan göbeklerine sıkı geçiyor mu?', 'visual', NULL, NULL, NULL, true, 27),
    (v_sid, 'Şanzıman miline gerekli civata ve pullar monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 28),
    (v_sid, 'Motor sehpalarının altındaki bağlantı civataları kasaya güvenli şekilde vidalanmıştır.', 'visual', NULL, NULL, NULL, true, 29);
END $$;
