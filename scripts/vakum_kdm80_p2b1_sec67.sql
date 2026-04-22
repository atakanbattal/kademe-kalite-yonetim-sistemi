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
    IF n >= 8 THEN RETURN; END IF;
    IF n <> 6 THEN RAISE EXCEPTION 'Vakum KDM 80 p2b1: beklenen 6 bölüm, mevcut %', n; END IF;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Hidrolik Sistem Kontrolleri', NULL, 6) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Yağ deposu nominal seviyede yağ içerir ve yağ kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Teleskobik silindir sızdırmaz, yağ kaçağı yoktur.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Emniyet direği halatı boyu tasarım ölçüsüne uygundur.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Yağ deposu alt çıkış vanası monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Yağ tankı sızdırmazdır, yağ kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Teleskobik silindir hortumu kazan yüzeyine temas etmez.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Şasi içi çelik borularda yağ kaçağı tespit edilmemiştir.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Yağ kazan filtresi monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Emniyet valfleri tasarım basınç değerine uygun şekilde ayarlanmıştır.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Yağ radyatörünün bulunduğu ve dönüş yolunun doğruluğu kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 9);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Emniyet Ve Uyarı Sistemleri Kontrolleri', NULL, 7) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'CE ve imalatçı etiketleri eksiksiz olarak uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Hareketli parçalara yönelik uyarı etiketleri yerlerine yerleştirilmiştir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Damper indirme basınç ayarlama valfi mühür macunu ile mühürlenmiştir.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Vakum ağız koruma sacı monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Vakum ağzı fitili eksiksiz takılmıştır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Orta fırça şaftı egzoz sistemiyle temas etmez.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Emniyet direği etiketi kontrol edilmiş ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Su deposu ve tesisat kaçak kontrolünden geçirilmiş ve sızdırmazdır.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Vakum ağzı ayarı kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Yangın söndürme tüpü ve ilgili donanım araç üzerinde eksiksiz mevcuttur; tüp tarihi ve doluluğu kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Emiş hortum kelepçeleri kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'Vakum ağız tekerleri serbestçe döner ve gerekli noktalar yağlanmıştır.', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Arka kapak dayama emniyet dayaması monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Arka kapak fitiline sızdırmazlık silikonu uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Tüm hareketli parçalarda uyarı etiketleri eksiksizdir.', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'Dış kumanda dolabında gerekli uyarı yazıları eksiksiz bulunur.', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'Ok lambaları doğru yönde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 16),
    (v_sid, 'Orta fırça tabla yönü doğru montajlanmıştır.', 'visual', NULL, NULL, NULL, true, 17);
END $$;
