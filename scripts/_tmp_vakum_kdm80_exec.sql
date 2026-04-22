DO $$
DECLARE
    v_tid uuid;
    v_sid uuid;
    v_kdm80 uuid := 'a6588eb6-0475-4959-be3e-ca32521a42ca'::uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.control_form_templates
        WHERE name = 'Vakumlu Üstyapı Final Kontrol Formu (KDM 80)'
    ) THEN
        RAISE NOTICE 'KDM 80 vakumlu form şablonu zaten mevcut, atlanıyor.';
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
        'Vakumlu Üstyapı Final Kontrol Formu (KDM 80)',
        'KDM 80 vakumlu üstyapı final kontrol formu. Görsel kontroller ve ölçüm tablosu PDF ile uyumludur.',
        '2025-10-14',
        2,
        '2026-01-01',
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
    ) RETURNING id INTO v_tid;

    -- 0 Motor ve yardımcı ön kontroller
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

    -- 1 Elektronik
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

    -- 2 Pnömatik (kompresör / şartlandırıcı)
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Pnömatik Sistem Kontrolleri (Kompresör / Şartlandırıcı)', NULL, 2) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Kumanda valflerinde hava kaçağı tespit edilmez ve sistem sızdırmazdır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Kompresör, şartlandırıcı çıkışında stabil hava üretir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Şartlandırıcı yağ haznesinde nominal seviyede yağ bulunur.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Yan fırça pnömatik hortumları tüm bağlantı noktalarında doğru şekilde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Elek pnömatiğin iç silindirlerinde hava kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Kazan içi pnömatik klepeler fonksiyon testinden başarıyla geçmiştir.', 'visual', NULL, NULL, NULL, true, 5);

    -- 3 Motor ve mekanik
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

    -- 4 Su / yıkama
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

    -- 5 Vakum süpürme
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

    -- 6 Hidrolik
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

    -- 7 Emniyet uyarı
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

    -- 8 Etiket
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Etiket Kontrolleri', NULL, 8) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Şartlandırıcı etiketi araç üzerinde mevcuttur ve okunaklıdır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Etiket renkleri ilgili standartlara uygundur.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Eksoza yakın aksamlarda ısıl deformasyon veya şekil bozukluğu bulunmaz.', 'visual', NULL, NULL, NULL, true, 2);

    -- 9 Genel
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

    -- 10 Görsel
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

    -- 11 Ölçüm tablosu (PDF 25 satır)
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

    RAISE NOTICE 'KDM 80 vakumlu şablon oluşturuldu: %', v_tid;
END $$;
