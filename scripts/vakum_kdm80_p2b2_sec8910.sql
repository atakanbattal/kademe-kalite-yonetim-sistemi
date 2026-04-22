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
    IF n >= 11 THEN RETURN; END IF;
    IF n <> 8 THEN RAISE EXCEPTION 'Vakum KDM 80 p2b2: beklenen 8 bölüm, mevcut %', n; END IF;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Etiket Kontrolleri', NULL, 8) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Şartlandırıcı etiketi araç üzerinde mevcuttur ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Etiket renkleri ilgili standartlara uygundur.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Eksoza yakın aksamlarda ısıl deformasyon veya şekil bozukluğu bulunmaz.', 'visual', NULL, NULL, NULL, true, 2);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Genel Kontroller', NULL, 9) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Döner lamba araç çalışınca çalışır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Tüm kapak kilitleri sorunsuz çalışır.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Kriko fonksiyon testinden başarıyla geçer.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Boya uygulaması ile reklam/markalama kontrolleri tamamlanmış ve uygunluğu onaylanmıştır.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Kapalı alanlar (motor odası, dolap) temizdir ve yabancı madde bulunmaz.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Motor etiketi araç üzerinde mevcuttur ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Tüm etiketlerdeki yazılar silinmemiş, net ve kolay okunabilir durumdadır.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'DMO için üst yapı ses izolasyonu eksiksiz uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Tüm gresörlükler eksiksiz olarak monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Sistem çalışırken zemine olan mesafe tasarım limitlerindedir.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Yükseklik limit uyarısı kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'Orta fırça hidromotor hortumu yay korumalıdır.', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Sevkiyat için malzeme listelerinin doğru şekilde doldurulduğu kontrol edilmiştir.', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Sağ ve sol dolap kapağı fitilleri eksiksiz olarak yapıştırılmıştır.', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Dolap üstü fitilleri eksiksiz ve düzgün biçimde yapıştırılmıştır.', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'Güvenlik vanası doğru konumda monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'Sürüş esnasında fırçaların düşmemesi için emniyet kilitlerinin olduğu doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 16);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Görsel Kontroller', NULL, 10) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Araç üst yapı estetik kontrolünden geçmiştir; boya homojen ve yüzey hatası yoktur.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Dolap iç yüzeyleri tamamen silikonlanmıştır; açık veya sızdırmazsız alan bulunmaz.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Orta fırça etiketi standartlara uygundur ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Lastik basınçları üretici spesifikasyonuna uygundur (taşıyıcı araç üreticisi dokümanına göre).', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Aracın çöp haznesinde sızdırmazlık problemi olmadığı doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Araç lastiklerinin tarihlerinin uygun olduğu doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Egzoz bağlantıları uygun konumda, sağlam ve sızdırmazdır.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Egzoz hattı kazana temas etmez.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Şanzıman yağı nominal seviyede doldurulmuştur.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Sağ yan fırça etiketi standartlara uygundur ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Sol yan fırça etiketi standartlara uygundur ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 10);
END $$;
