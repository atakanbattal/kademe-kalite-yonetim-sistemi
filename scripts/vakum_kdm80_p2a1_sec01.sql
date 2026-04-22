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
    IF n >= 2 THEN RETURN; END IF;
    IF n <> 0 THEN RAISE EXCEPTION 'Vakum KDM 80 p2a1: beklenen bölüm 0, mevcut %', n; END IF;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Motor Ve Yardımcı Sistemler', NULL, 0) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Yardımcı üst motor koruma sistemleri (hararet ve yağ basıncı) kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Kriko vanası fonksiyon testinden başarılı şekilde geçmiştir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Motor yağ seviyesi nominal aralıktadır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Şantrifüj filtresi doğru konumda monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Baskı balatalı fan sistemlerinde, fanın devreye girme süresi ölçülerek formda belirtilmiştir.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Pnömatik sistem basıncı Maks 6 Bar ayarlanmıştır.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Pnömatik sistem basınç ayar valfi kırmızı KADEME mum mührüyle mühürlenmiştir.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Üst yapı vakum fanının şartnamede istenilen malzemeden imal edildiği doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 7);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Elektronik Sistem Kontrolleri', NULL, 1) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Alt ekipman aydınlatmaları aktif olup yeterli aydınlatma sağlar.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Kamera ve monitör sistemleri standartlara uygun şekilde monte edilmiş ve çalışır durumdadır.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Elektrik panosu iç kapağı sabitlenmiş ve titreşime karşı emniyete alınmıştır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Işıklı uyarı sistemleri tasarım kriterlerine uygun sırayla çalışır.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Araç fonksiyonel çalıştırıldığında, başlangıç-bitiş ve toplam çalışma süresi kontrol formuna kaydedilmiştir.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Su deposu boşaldığında sesli ikaz çalışır ve motor otomatik olarak rölanti devrine geçer.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Kumanda panosu tüm fonksiyonları çalışır durumda ve kabin içine uygun şekilde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Kabin içi ve dışında acil stop butonları yerleştirilmiş ve erişilebilir konumdadır.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Araç geri manevraya alındığında sistem otomatik olarak fırçaları toplar.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Damper veya arka kapak açık konumda ya da açılırken sesli ikaz devreye girer.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Pnömatik hortumlar düzenli güzergâhta çekilmiş ve mekanik koruma altındadır.', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'Pnömatik valflerde hava kaçağı tespit edilmemiştir ve sistem sızdırmazdır.', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Fırça pnömatik devresinde hava kaçağı yoktur.', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Vakum kelepçesi bağlantıyı güvenli şekilde sıkıştırır.', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Tepe lambalarının çakar veya döner tip olduğu doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'Fırçalar süpürme moduna alındığında fırça kameralarının otomatik olarak devreye girdiği doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 15);
END $$;
