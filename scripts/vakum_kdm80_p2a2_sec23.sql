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
    IF n >= 4 THEN RETURN; END IF;
    IF n <> 2 THEN RAISE EXCEPTION 'Vakum KDM 80 p2a2: beklenen bölüm 2, mevcut %', n; END IF;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Pnömatik Sistem Kontrolleri (Kompresör / Şartlandırıcı)', NULL, 2) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Kumanda valflerinde hava kaçağı tespit edilmez ve sistem sızdırmazdır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Kompresör, şartlandırıcı çıkışında stabil hava üretir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Şartlandırıcı yağ haznesinde nominal seviyede yağ bulunur.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Yan fırça pnömatik hortumları tüm bağlantı noktalarında doğru şekilde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Elek pnömatiğin iç silindirlerinde hava kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Kazan içi pnömatik klepeler fonksiyon testinden başarıyla geçmiştir.', 'visual', NULL, NULL, NULL, true, 5);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Motor Ve Mekanik Sistem Kontrolleri', NULL, 3) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Motor seri no ile motor beyin seri no uyumluluğu kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Motor çalışmadığında çöp kazanının el krikosu ile çalıştırılabildiği doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Motor devir göstergesi (takometre) ile kontrol edilir ve doğru değer gösterir.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Çalışma saati (hour-meter) fonksiyoneldir; araç fonksiyonel çalıştırıldığında süreler formda kaydedilir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Kumanda panosu üzerindeki yön komutları doğru yönde işlev görür.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Teleskobik silindir armut civatası güvenli şekilde bağlanmıştır.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Dayama somunları monte edilmiş ve emniyetli şekilde sıkılmıştır.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Kazan emniyet dayağı tırnakları doğru pozisyona oturur.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Kazan içi çarpma lastikleri eksiksiz şekilde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Kriko mekanizmasında yağ kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 9);
END $$;
