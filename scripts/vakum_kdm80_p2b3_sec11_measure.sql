DO $$
DECLARE
    v_tid uuid;
    v_sid uuid;
    n int;
BEGIN
    SELECT id INTO v_tid FROM public.control_form_templates
    WHERE name = 'Vakumlu Üstyapı Final Kontrol Formu (KDM 80)' LIMIT 1;
    IF v_tid IS NULL THEN RETURN; END IF;
    SELECT COUNT(*)::int INTO n FROM public.control_form_sections WHERE template_id = v_tid;
    IF n >= 12 THEN RETURN; END IF;
    IF n <> 11 THEN RAISE EXCEPTION 'Vakum KDM 80 p2b3: beklenen 11 bölüm, mevcut %', n; END IF;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Ölçüm Ve Değer Kontrolleri', NULL, 11) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Çöp kazanı açılma süresi', 'measurement', 'Max 25 sn', NULL, 'Kronometre', true, 0),
    (v_sid, 'Orta fırça boyutu', 'measurement', '400mm x 1300mm (Min)', NULL, 'Şeritmetre', true, 1),
    (v_sid, 'Anemometre ile vakum hızı ölçümü', 'measurement', '13.000 m³/saat (Min)', NULL, 'Anemometre', true, 2),
    (v_sid, 'Yan fırça devir kontrolü', 'measurement', '150 rpm', 'rpm', 'Devir ölçer', true, 3),
    (v_sid, 'Ses ölçümü kabin dışı', 'measurement', '85 desibel', 'dB', 'Desibelmetre', true, 4),
    (v_sid, 'Ses ölçümü kabin içi', 'measurement', '75 desibel', 'dB', 'Desibelmetre', true, 5),
    (v_sid, 'Pnömatik sistem basıncı', 'measurement', '1-6 Bar', 'bar', 'Basınç göstergesi', true, 6),
    (v_sid, 'Süpürme genişliği', 'measurement', '2200 mm', 'mm', 'Şeritmetre', true, 7),
    (v_sid, 'Yan fırça çapı', 'measurement', '32 cm', 'cm', 'Şeritmetre', true, 8),
    (v_sid, 'Su deposu hacmi', 'measurement', NULL, NULL, 'Şeritmetre', true, 9),
    (v_sid, 'Fırça pnömatik regülatör ayarı', 'measurement', '3 Bar', 'bar', 'Görsel / basınç kontrolü', true, 10),
    (v_sid, 'Hidrolik sistem basıncı', 'measurement', '1-8 Bar', 'bar', 'Basınç göstergesi', true, 11),
    (v_sid, 'Kasa kaldırma açısı', 'measurement', NULL, '°', 'Açı ölçer', true, 12),
    (v_sid, 'Çöp haznesi sac kalınlığı', 'measurement', '3 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 13),
    (v_sid, 'Su deposu sac kalınlığı', 'measurement', '3 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 14),
    (v_sid, 'Su püskürtme nozul sayısı', 'measurement', '12', NULL, 'Gözlem / sayım', true, 15),
    (v_sid, 'Y.B. su tamburu hortum boy ve çap', 'measurement', NULL, NULL, 'Şeritmetre', true, 16),
    (v_sid, 'Gezer hortum boyu', 'measurement', '10 m x 3/8 veya 8 mm', NULL, 'Şeritmetre', true, 17),
    (v_sid, 'Vakum hortumu boyu', 'measurement', '6 in x 5 m', NULL, 'Şeritmetre', true, 18),
    (v_sid, 'Pnömatik regülatör (yüksek basınç ayarı)', 'measurement', '160-180 Bar', 'bar', 'Barometre', true, 19),
    (v_sid, 'Motor rölanti devri', 'measurement', NULL, 'rpm', 'Takometre', true, 20),
    (v_sid, 'Elektrikli su pompası devir kontrolü', 'measurement', NULL, 'rpm', 'Takometre', true, 21),
    (v_sid, 'Vakum baca ayağı cıvata tork değeri', 'measurement', NULL, NULL, NULL, true, 22),
    (v_sid, 'Çöp haznesi hacmi / derinlik (şerit)', 'measurement', '1 M', 'm', 'Şeritmetre', true, 23),
    (v_sid, 'Baskı balatalı fan devreye girme süresi', 'measurement', '12-20 sn', NULL, 'Kronometre', true, 24);
END $$;
