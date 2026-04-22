-- 8+1 HSCK Final Kontrol Formu — PDF (Hsck 8+1 Son Kontrol Formu) ile uyumlu şablon
-- Idempotent: aynı isimde şablon varsa atlanır.

DO $$
DECLARE
    v_tid uuid;
    v_sid uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.control_form_templates
        WHERE name = '8+1 HSCK Final Kontrol Formu'
    ) THEN
        RAISE NOTICE 'HSCK şablonu zaten mevcut, atlanıyor.';
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
        '8+1 HSCK Final Kontrol Formu',
        'HSCK (Hariç Sızdırmazlık Çöp Kamyonu) 8+1 son kontrol formu. Görsel kontroller ve ölçüm/değer tablosu PDF ile eşleştirilmiştir.',
        '2019-12-05',
        10,
        '2026-04-01',
        NULL,
        '{}'::uuid[],
        '[
          {"key":"marka","label":"Markası"},
          {"key":"tipi","label":"Tipi"},
          {"key":"modeli","label":"Modeli"},
          {"key":"imal_yili","label":"İmal Yılı"},
          {"key":"motor_no","label":"Motor No"},
          {"key":"sps_no","label":"SPS No"},
          {"key":"seri_no","label":"Seri Numarası"},
          {"key":"musteri","label":"Müşteri"},
          {"key":"emisyon_sinifi","label":"Emisyon Sınıfı"},
          {"key":"kapasite","label":"Kapasite"}
        ]'::jsonb,
        true
    ) RETURNING id INTO v_tid;

    -- 0 Elektrik ve aydınlatma
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Elektrik Ve Aydınlatma Kontrolleri', NULL, 0) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Projektör (çalışma farı) çalışır durumda ve aydınlatma seviyesi yeterlidir.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'İz lambaları yanar durumda; tüm ampuller eksiksiz çalışır.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Döner lamba çalışır durumda ve yeterli parlaklıkta uyarı ışığı verir.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Araç içi şoför ikaz sesi aktif olup düzgün şekilde uyarı verir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Arka basamak sensörleri doğru algılama yapar; fonksiyon testi başarılıdır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Tüm switch ve sensörler fonksiyon testinden geçirilmiş olup tasarım kriterlerine uygundur.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Arka kumanda kollarının tüm fonksiyonları eksiksiz çalışmaktadır.', 'visual', NULL, NULL, NULL, true, 6);

    -- 1 Mekanik
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Mekanik Kontroller', NULL, 1) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Pis su vanaları takılıdır; sağ ve sol zincirler güvenli şekilde sabitlenmiştir.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Pis su deposu ön kapağında sızdırmazlık silikonu düzgün şekilde uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Sağ ve sol kapak zincirleri takılmış ve güvenceye alınmıştır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Sağ ve sol silindir hortumları uygun hatvelerde sabitlenmiştir; sarkma yapmaz.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Sağ ve sol kapak fitilleri eksiksiz takılmıştır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Basamaklar uygun ve sağlam biçimde monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Stepne (yedek lastik) güvenli şekilde bağlanmıştır.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Aracın üst sacı monte edilmiştir.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Yağ tankı ile PTO''nun montajı tamamlanmıştır.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Şasi bağlantı plakalarının tümü güvenli biçimde bağlanmıştır.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Ön kumanda kolları uygun şekilde sıkılmıştır.', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'Arka kumanda kolları uygun şekilde sıkılmıştır.', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Kumanda kolu, arka hazneyi sorunsuz indirip kaldırır.', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Kumanda kolu, iç perdeyi ileri–geri hareket ettirir; fonksiyon testi başarılıdır.', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Arka kapak askı mili ile teleskopik silindir miline kopilya takılmıştır.', 'visual', NULL, NULL, NULL, true, 14);

    -- 2 Genel
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Genel Kontroller', NULL, 2) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Şasi bağlantı elemanlarının (braketler) boyası tamamlanmıştır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Şasi arka bölge kapama sacının boyası eksiksiz şekilde uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Sağ-sol üst yapı kurtarma butonu bölgelerinde kesilen sac yüzeyleri boyalıdır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Pis su tankı komple boyalıdır.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Sabit mesnet yan bölgelerinin boyası eksiksizdir.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Kazan iç yüzeyi tamamen boyalıdır; boyasız alan bulunmaz.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Araç gövdesinde paslı bölge bulunmaz.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Yan kapakların boyası eksiksizdir; boyasız alan bulunmaz.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Arka ve perde sızdırmazlık lastikleri eksiksiz olarak çekilmiştir.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Teleskobik silindirin açık ve kapalı boyu tasarım ölçülerine uygundur.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'Tüm yağlama noktalarına gresörlükler monte edilmiş ve yağlama tamamlanmıştır.', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'Çamurluklar, tekerler ve şasi hasarsızdır; çamurluklar zincir montajına uygundur.', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Kumanda tesisatına hidrolik basınç iletimi sağlanmakta, kaçak tespit edilmemektedir.', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Pis su deposu ve hortumu bağlanmış, kelepçeler uygun torka sıkılmıştır.', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Ön pencere kilidinde kontra somun mevcuttur ve kilit mekanizması düzgün çalışır.', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'Kazan üst yüzeyi tamamen boyalı ve pas-sızdır.', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'Çöp haznesi iç yüzeyi temiz ve yabancı maddeden arındırılmıştır.', 'visual', NULL, NULL, NULL, true, 16),
    (v_sid, 'Şasi alt yüzeyi ve arka bölge kapama sacı boyalıdır.', 'visual', NULL, NULL, NULL, true, 17),
    (v_sid, 'Tüm civatalar 10.9 kalite sınıfındadır.', 'visual', NULL, NULL, NULL, true, 18),
    (v_sid, 'İlgili civatalara Loctite uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 19);

    -- 3 Üst yapı
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Araç Üst Yapı Ve Kasa Kontrolleri', NULL, 3) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Elektrik bağlantıları izole edilerek muhafaza altına alınmış, tüm bağlantı noktaları standartlara uygundur.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Arka tesisat hattı sızdırmazdır; yağ kaçağı tespit edilmemiştir.', 'visual', NULL, NULL, NULL, true, 1);

    -- 4 Hidrolik
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Hidrolik Sistem Kontrolleri', NULL, 4) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Hidrolik sistem bar değeri kontrol edilmiş, nominal değerde sabitlenmiş ve gösterge epoksi boya ile mühürlenmiştir.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Yağ blokları sızdırmaz; yağ kaçağı bulunmaz.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Hidrolik yağ seviyesi seviye göstergesinin nominal aralığındadır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Silindirlerde sızdırmazlık kontrolü yapılmış, yağ kaçağı tespit edilmemiştir.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Çöp toplama düzeni, kurtarma butonu, stop fonksiyonu, gaz verme ve ikaz butonları dâhil tüm araç fonksiyonları düzgün çalışmaktadır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Arka kumanda kolu sızdırmaz; yağ kaçağı tespit edilmemiştir.', 'visual', NULL, NULL, NULL, true, 5);

    -- 5 Güvenlik
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Güvenlik Kontrolleri', NULL, 5) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Acil stop ve kurtarma butonlarının fonksiyon testi başarılıdır; her ikisi de çalışır durumda.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Kumanda kolu emniyet kilidi standart prosedüre uygun şekilde mühürlenmiştir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Emniyet ayağı doğru pozisyona oturur ve emniyet pimi takılıdır.', 'visual', NULL, NULL, NULL, true, 2);

    -- 6 Etiketleme
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Etiketleme Ve İşaretleme', NULL, 6) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'CE işareti, DMO etiketi, Kademe etiketi ve diğer zorunlu etiketler eksiksiz olarak uygulanmıştır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Kademe krom yazısı araca doğru konumda ve sağlam biçimde takılmıştır.', 'visual', NULL, NULL, NULL, true, 1);

    -- 7 Kapak ve basamak
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Kapak Ve Basamak Kontrolleri', NULL, 7) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Arka basamaklar çalışma konumunda herhangi bir yüzeye sürtme veya temas yapmaz.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Tüm hareketli parçalar birbirine müdahale etmez; koordinasyon doğru ve güvenlidir.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Yan kapak kilitleri güvenli şekilde kilitlenir ve tüm kontra somunları takılıdır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Arka basamaklar kullanım konumunda şasiyle 90° açı yapacak şekilde hizalanmıştır.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Sağ ve sol kapak fitilleri eksiksiz olarak takılmıştır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Basamaklar açık konumdayken arka kapak güvenli şekilde kaldırılabilir.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Yan kapakta deformasyon bulunmaz; kapak kumanda tesisatına temas etmez.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Basamaklar açık konumdayken araç geri hareket emniyet sistemi devrededir; geri viteste hareket engellenir.', 'visual', NULL, NULL, NULL, true, 7);

    -- 8 Fonksiyonel testler
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Fonksiyonel Testler', NULL, 8) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Performans testi sonuçları teknik şartnamede verilen limitler içinde kalır.', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'Fonksiyonlar sırasında anormal gürültü veya titreşim gözlenmez.', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'Arka kumanda panelinin tüm fonksiyonları doğru çalışır.', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'Ön pencere açık konumdayken iç perde tam olarak geri dönmez.', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'Araç yol testinde 30 km/s hıza ulaşır ve hız stabil kalır.', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'Gaz verme komutunda motor devri belirlenen oranda yükselir.', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'Start komutu ile kepçe mekanizması fonksiyonel çalışır.', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'Araç ekranında gösterilen motor devri, harici takometre ölçümüyle doğrulanmıştır.', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'Emniyet ayağı konumlandırılırken herhangi bir yüzeye sürtmez.', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'Reflektör ve kedi gözü bağlantıları standart montaj kriterlerine uygundur.', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'PTO komutu verildiğinde sistem sorunsuz devreye girer.', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'İç perde mekanizması çalışır durumda olup hareket yönleri doğru ayarlanmıştır.', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'Hazne komutu verildiğinde istenilen konuma kadar tam olarak iner; ara konumda duraksama olmaz.', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'Geri görüş kamerası açılır ve net görüntü iletir.', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'Perde ileri-geri hareketini kesintisiz gerçekleştirir.', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'Hazne indirme-kaldırma fonksiyonları tam strokta sorunsuz çalışır.', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'Konteyner kaldırma tertibatı fonksiyon testinden başarıyla geçmiştir; çalışma karakteristikleri tasarım kriterlerine uygundur.', 'visual', NULL, NULL, NULL, true, 16),
    (v_sid, 'Sağ ve sol bisikletlikler plastik tapalarıyla birlikte monte edilmiştir ve fonksiyon testi sorunsuzdur.', 'visual', NULL, NULL, NULL, true, 17),
    (v_sid, 'Bisikletlik bağlantı ayaklarının kaynakları sağlamdır; çatlak, gözenek veya eksik penetrasyon bulunmaz.', 'visual', NULL, NULL, NULL, true, 18),
    (v_sid, 'Araç ekranında hata veya uyarı kodu görüntülenmez.', 'visual', NULL, NULL, NULL, true, 19);

    -- 9 Ölçüm ve değer (PDF tablosu)
    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Ölçüm Ve Değer Kontrolleri', NULL, 9) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'Perde hareketi basıncı / süre kontrolü', 'measurement', 'Max 25 sn', NULL, 'Kronometre', true, 0),
    (v_sid, 'Çöp kazanı açılma süresi', 'measurement', 'Max 25 sn', NULL, 'Kronometre', true, 1),
    (v_sid, 'Perde sac kalınlığı', 'measurement', '6 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 2),
    (v_sid, 'Kepçe sac kalınlığı', 'measurement', '4 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 3),
    (v_sid, 'Arka kapak hazne sac kalınlığı', 'measurement', '3 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 4),
    (v_sid, 'Arka kapak yan duvar sac kalınlığı', 'measurement', '3 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 5),
    (v_sid, 'Hidrolik sistem basıncı', 'measurement', '6 Bar', 'bar', 'Basınç göstergesi', true, 6),
    (v_sid, 'Gövde taban sacı kalınlığı', 'measurement', '3 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 7),
    (v_sid, 'Gövde yan sac kalınlığı', 'measurement', '5 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 8),
    (v_sid, 'Gövde tavan sacı kalınlığı', 'measurement', '5 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 9),
    (v_sid, 'Yardımcı şasi sac kalınlığı', 'measurement', '3 mm', 'mm', 'Ultrasonik kalınlık ölçer', true, 10),
    (v_sid, 'Pis su haznesi kapasitesi', 'measurement', '80 lt', 'lt', 'Şeritmetre', true, 11),
    (v_sid, 'Pnömatik regülatör ayarı', 'measurement', '180 bar', 'bar', 'Barometre', true, 12),
    (v_sid, 'Lifter kaldırma/boşaltma süresi veya çöp kazanı kapanma süresi', 'measurement', NULL, NULL, 'Kronometre', true, 13),
    (v_sid, 'Arka kapak açılma açısı', 'measurement', NULL, '°', 'Açı ölçer', true, 14),
    (v_sid, 'Pnömatik hat basıncı (kontrol değeri)', 'measurement', '40 bar', 'bar', 'Barometre', true, 15);

    RAISE NOTICE 'HSCK şablonu oluşturuldu: %', v_tid;
END $$;
