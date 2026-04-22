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
    IF n >= 6 THEN RETURN; END IF;
    IF n <> 4 THEN RAISE EXCEPTION 'Vakum KDM 80 p2a3: beklenen bölüm 4, mevcut %', n; END IF;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Su, Yıkama Ve Tambur Kontrolleri', NULL, 4) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Yıkama tabancası fonksiyon testinden başarıyla geçmiştir.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Yıkama tabancası araç üzerine doğru konumda monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Su tamburu sızdırmaz, su kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Su tamburu hortumu sorunsuz sarar ve geri toplar.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Su doldurma flanşı vidaları belirlenen torkta sıkılmıştır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Su deposu paslanmaz malzemeden imal edilmiştir.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Su deposu çıkışları (dirsek, vana, maşon, flanş bağlantıları) paslanmaz malzemeden imal edilmiştir.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Yüksek basınçlı su pompası 100 bar değerindedir.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Damper indirme esnasında, indirme basıncı Maks. 50 Bar ayarlanmıştır.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Perkins 55 KW araçlarda fırça hidromotor (pompa) 190''lık takılmıştır.', 'visual', NULL, NULL, NULL, true, 9);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Vakum Ve Süpürme Sistemi Kontrolleri', NULL, 5) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Vakum ağzı doğru yönde konumlandırılmıştır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Sistem çalışırken hiçbir noktada yağ sızıntısı gözlenmez.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Yağ dolum tapası monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Fırçalar süpürme sırasında taş gibi partikülleri sorunsuz süpürür.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Vakum ağız lastiği uygun şekilde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Kazan içi elek fonksiyonel ve çalışır durumdadır.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Orta fırça dönüş yönü tasarım yönüne uygundur.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Arka kapak açma silindiri üzerinde patlatma valfi mevcuttur ve fonksiyoneldir.', 'visual', NULL, NULL, NULL, true, 7);
END $$;
