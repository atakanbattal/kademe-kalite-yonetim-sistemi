-- Ural Son Kontrol Formu — PDF: Ural_Son_Kontol_Formu.pdf
-- Idempotent: aynı isimde şablon varsa atlanır.
DO $$
DECLARE
    v_tid uuid;
    v_sid uuid;
    v_ural uuid := '0f18d543-26b3-4e75-94e9-2a872aa2b889'::uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.control_form_templates
        WHERE name = 'Ural Son Kontrol Formu'
    ) THEN
        RAISE NOTICE 'Ural son kontrol şablonu zaten mevcut, atlanıyor.';
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
        'Ural Son Kontrol Formu',
        'Ural araç son kontrol formu. 75 görsel kontrol maddesi PDF (KDM.FRM.047 / KAL-FR-2025-0062) sırasıyla eşleştirilmiştir.',
        '2019-12-05',
        14,
        '2026-02-16',
        'Form referansı: KDM.FRM.047, KAL-FR-2025-0062 (Ural Son Kontrol Formu).',
        ARRAY[v_ural],
        '[
          {"key":"musteri","label":"Müşteri"},
          {"key":"seri_no","label":"Seri No"},
          {"key":"motor_no","label":"Motor Numarası"},
          {"key":"motor_voltaji","label":"Motor Voltajı"},
          {"key":"imal_yili","label":"İmalat Tarihi (Araç)"},
          {"key":"marka","label":"Markası"},
          {"key":"tipi","label":"Tipi"},
          {"key":"modeli","label":"Modeli"}
        ]'::jsonb,
        true
    ) RETURNING id INTO v_tid;

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Ural Son Kontrol — Sayfa 1 (Madde 1–38)', 'PDF 1. sayfa maddeleri.', 0) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'KONVEYÖR BANT GERGİSİ İYİ Mİ ?', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'KONVEYÖR BANT HİDROMOTOR BALANSLI MI ? YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'KONVEYÖR SIYIRICI TAM AYAR MI ?', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'KONVEYÖR GRADE ZİNCİRİ BAĞLI MI ? BAĞALANTI CİVATALARI ÇELİK Mİ ?', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'KONVEYÖR SİLİKON İPLER BAĞLI MI ?', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'ELEVATÖR HİDROMOTOR BALANSLI MI ? YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'ELEVATÖR HİDROMOTOR GERGİ AYARI YAPILMIŞ MI ?', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'ÖN KRİKO İNİP KALKIYOR MU ?', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'ÖN KRİKO SABİTLEME ZİNCİRİ BAĞLI MI ?', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'FREN EL KRİKO ÇALIŞIYOR MU ? YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'SULAMA SİSTEMİ AKTİF Mİ ?', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'FIRÇALAR BALANSLI MI DÖNÜYOR ?', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'FIRÇA İNDİRME HALATI TAKILI MI ?', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'BAR SAATİ AYARLI MI ? 100/150 BAR MI ?', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'WALFLERDE YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'GRESÖRLÜKLER TAM MI ? YAĞLANMIŞ MI ? SAĞ VE SOL DOLAP İÇİ', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'ETİKETLER TAM  MI ? CE ETİKETİ VB.', 'visual', NULL, NULL, NULL, true, 16),
    (v_sid, 'KRİKO KOLU VAR MI? SAĞ DOLAPTA', 'visual', NULL, NULL, NULL, true, 17),
    (v_sid, 'SU DOLUM KAPAĞI ÜZERİNDE Mİ ? VE ZİNCİRLİ Mİ ?', 'visual', NULL, NULL, NULL, true, 18),
    (v_sid, 'SU DOLUM FİLTRE ÜSTÜNDE Mİ ?', 'visual', NULL, NULL, NULL, true, 19),
    (v_sid, 'YAĞ KONULMUŞ MU YETERLİ Mİ ? ( 68 NUMARA OLACAK )', 'visual', NULL, NULL, NULL, true, 20),
    (v_sid, 'FIRÇA AYAR PİMİ TAKILI MI ( ARKA FIRÇA )', 'visual', NULL, NULL, NULL, true, 21),
    (v_sid, 'ARKA FIRÇA YAN PASPASLAR TAKILI MI ?', 'visual', NULL, NULL, NULL, true, 22),
    (v_sid, 'ARKA FIRÇA HİDROMOTOR DA YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 23),
    (v_sid, 'ARKA TUTAMAK VE MERDİVENDE KAYDIRMAZLIK BANTLAR VAR MI ?', 'visual', NULL, NULL, NULL, true, 24),
    (v_sid, 'MOTOR TAKOZLARI SIKILI MI ?', 'visual', NULL, NULL, NULL, true, 25),
    (v_sid, 'RADYATÖR SU KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 26),
    (v_sid, 'RADYATÖR DAYAMA SAC VAR MI ?', 'visual', NULL, NULL, NULL, true, 27),
    (v_sid, 'ANTİFRİZ KONMUŞ MU ? GENLEŞME TANKINDA ?', 'visual', NULL, NULL, NULL, true, 28),
    (v_sid, 'AKÜ SABİTLENMİŞ Mİ ?', 'visual', NULL, NULL, NULL, true, 29),
    (v_sid, 'YÖN LAMBALARI ÇALIŞIYOR MU ?', 'visual', NULL, NULL, NULL, true, 30),
    (v_sid, 'YAĞ TANKI HAVALANDIRMA SACI SİLİKONLU MU ?', 'visual', NULL, NULL, NULL, true, 31),
    (v_sid, 'HAVA FİLTRE YAĞLI MI ?  İÇERİSİNDE YAĞ VAR MI ?', 'visual', NULL, NULL, NULL, true, 32),
    (v_sid, 'YAKIT GÖSTERGE ÇALIŞIYOR MU ?', 'visual', NULL, NULL, NULL, true, 33),
    (v_sid, 'YAKIT DOLUM KAPAĞI KİTLENİYOR MU ?', 'visual', NULL, NULL, NULL, true, 34),
    (v_sid, 'ELEVATÖR ÜST KAPAK KİLİTLERİ VAR MI ?', 'visual', NULL, NULL, NULL, true, 35),
    (v_sid, 'TABANCA DOLAP İÇİNDE Mİ SABİT Mİ ?', 'visual', NULL, NULL, NULL, true, 36),
    (v_sid, 'SU FİLTRE ANAHTARI VAR MI ?', 'visual', NULL, NULL, NULL, true, 37);

    INSERT INTO public.control_form_sections (template_id, name, description, order_index)
    VALUES (v_tid, 'Ural Son Kontrol — Sayfa 2 (Madde 39–75)', 'PDF 2. sayfa maddeleri.', 1) RETURNING id INTO v_sid;
    INSERT INTO public.control_form_items (section_id, text, item_type, reference_value, unit, measurement_equipment_name, is_required, order_index) VALUES
    (v_sid, 'ARKA FIRÇA MOTOR KORUMA LASTİĞİ VAR MI ?', 'visual', NULL, NULL, NULL, true, 0),
    (v_sid, 'MOTOR DEVİRİ 1500 AYARLANMIŞ MI ?', 'visual', NULL, NULL, NULL, true, 1),
    (v_sid, 'SU SEVİYE GÖSTERGESİ BAĞLI MI ?', 'visual', NULL, NULL, NULL, true, 2),
    (v_sid, 'OK LAMBALARI YANIYOR MU ?', 'visual', NULL, NULL, NULL, true, 3),
    (v_sid, 'TEPE LAMBASI ( DÖNER LAMBA ) YANIYOR MU ?', 'visual', NULL, NULL, NULL, true, 4),
    (v_sid, 'ARKA STOPLAR YANIYOR MU ?', 'visual', NULL, NULL, NULL, true, 5),
    (v_sid, 'ARKA KEDİ GÖZLERİ BAĞLI MI ? YANIYOR MU ?', 'visual', NULL, NULL, NULL, true, 6),
    (v_sid, 'ÖN FIRÇA AYDINLATMALARI YANIYOR MU ?', 'visual', NULL, NULL, NULL, true, 7),
    (v_sid, 'ARKA FIRCA AYDINLATMALARI YANIYOR MU ?', 'visual', NULL, NULL, NULL, true, 8),
    (v_sid, 'HİDROLİK SİSTEMDE YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 9),
    (v_sid, 'YAĞ TANKI ÇIKIŞI BORUSUNDA YAĞ KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 10),
    (v_sid, 'YAN ÇAMURLUKLARIN LASTİKLERİ SAĞLAM MI ?', 'visual', NULL, NULL, NULL, true, 11),
    (v_sid, 'TEKER BİJONLARI SIKILI MI ?', 'visual', NULL, NULL, NULL, true, 12),
    (v_sid, 'SULAMA BORULARININ MEMELERİNDE KAÇAK VAR MI ? TIKALI MI ?', 'visual', NULL, NULL, NULL, true, 13),
    (v_sid, 'ÖN ALÜMİNYUM SACLARI BAĞLI MI ?', 'visual', NULL, NULL, NULL, true, 14),
    (v_sid, 'ARKA FIRÇA ÖN SAĞ/SOL TOZ LASTİĞİ BAĞLI MI ?', 'visual', NULL, NULL, NULL, true, 15),
    (v_sid, 'FIRÇA SİLİNDİRLERİNİN CİVATALARI SOMUNLARDAN ÇIKMIŞ MI ?', 'visual', NULL, NULL, NULL, true, 16),
    (v_sid, 'ÖN KOLU KALDIRAN BUTON ÇALIŞIYOR MU ?', 'visual', NULL, NULL, NULL, true, 17),
    (v_sid, 'YAN DOLAP KAPAKLARI ALTINDA SÜNGER YAPIŞMIŞ MI ?', 'visual', NULL, NULL, NULL, true, 18),
    (v_sid, 'KONVEYÖR BAND DÜZGÜN MÜ ?', 'visual', NULL, NULL, NULL, true, 19),
    (v_sid, 'KONVEYÖR BAND YANLARA SÜRTÜYOR MU ?', 'visual', NULL, NULL, NULL, true, 20),
    (v_sid, 'KONVEYÖR BAND ÜST KAPAK MENTEŞELERİ KİTLENİYOR MU ?', 'visual', NULL, NULL, NULL, true, 21),
    (v_sid, 'ACİL STOP BUTONU ÇALIŞIYOR MU ?', 'visual', NULL, NULL, NULL, true, 22),
    (v_sid, 'KAYDIRMAZ BANDLAR YAPIŞMIŞ MI ?', 'visual', NULL, NULL, NULL, true, 23),
    (v_sid, 'ÜÇGEN REFLEKTÖRLER TAKILI MI ?', 'visual', NULL, NULL, NULL, true, 24),
    (v_sid, 'ÜST KONVEYÖR BAND BAĞLANTI MİLİN SARILARI SAĞ/SOL OTURMUŞ MU ?', 'visual', NULL, NULL, NULL, true, 25),
    (v_sid, 'FIRÇA AYAR KONTRA SOMUNLARI SIKILI MI ?', 'visual', NULL, NULL, NULL, true, 26),
    (v_sid, 'YÜKSEK BASINÇLI YIKAMA ÇALIŞIYOR MU ?', 'visual', NULL, NULL, NULL, true, 27),
    (v_sid, 'FIRÇA AYAR KOLLARI ÜZERİNDE Mİ ?', 'visual', NULL, NULL, NULL, true, 28),
    (v_sid, 'BASINÇLI YIKAMA POMPASINDA SU KAÇAĞI VAR MI ?', 'visual', NULL, NULL, NULL, true, 29),
    (v_sid, 'VANALAR SAĞLAM MI ? ÇALIŞMAYAN VAR MI ?', 'visual', NULL, NULL, NULL, true, 30),
    (v_sid, 'MOTOR ÜST KORUMA AYAKLARININ PİMLERİ TAKILI MI?', 'visual', NULL, NULL, NULL, true, 31),
    (v_sid, 'FIRÇA TABLALARI PLASTİK Mİ?', 'visual', NULL, NULL, NULL, true, 32),
    (v_sid, 'KONVEYUR BANT ZEMİN MESAFESİ 10 CM AYARLI MI?', 'visual', NULL, NULL, NULL, true, 33),
    (v_sid, 'KONVEYUR BANT DAYAMA TAKOZU AYARLANMIŞ VE SIKILMIŞ MI?', 'visual', NULL, NULL, NULL, true, 34),
    (v_sid, 'KONVEYUR 1 TAM TUR DÖNÜŞÜNÜ 3,50 SN DE TAMAMLIYOR MU?', 'visual', NULL, NULL, NULL, true, 35),
    (v_sid, 'MOTOR YAĞ SEVİYESİ UYGUN MU?', 'visual', NULL, NULL, NULL, true, 36);
END $$;