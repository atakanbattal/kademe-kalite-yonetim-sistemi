-- KDM 80 vakumlu form — Parça 2b: bölümler 6–11
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
    IF n <> 6 THEN
        RAISE EXCEPTION 'Vakum KDM 80 şablonu: 2b öncesi bölüm sayısı 6 olmalı (mevcut %)', n;
    END IF;

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
