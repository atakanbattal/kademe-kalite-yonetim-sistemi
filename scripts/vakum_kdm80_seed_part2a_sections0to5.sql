-- KDM 80 vakumlu form — Parça 2a: bölümler 0–5
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
    IF n <> 0 THEN
        RAISE EXCEPTION 'Vakum KDM 80 şablonu: bölüm sayısı beklenmeyen (%, beklenen 0 veya 6+)', n;
    END IF;

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
