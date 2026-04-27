-- Ural Final Kontrol Formu: elevatörlü çekilir tip yol temizleme aracı için profesyonel kontrol maddeleri.
-- Mevcut şablon kullanılmış kayıt içermediği için bölümler ve maddeler yeniden oluşturulur.
DO $$
DECLARE
    v_tid uuid;
    v_sid uuid;
    v_section jsonb;
    v_item jsonb;
    v_section_order integer := 0;
    v_item_order integer;
    v_sections jsonb := $json$
[
  {
    "name": "1. Kimlik, Dokümantasyon ve Genel Uygunluk",
    "description": "Araç kimliği, teknik dokümanlar, etiketler ve teslimata esas genel uygunluk kontrolleri.",
    "items": [
      {"text":"Şablon, ürün modeli ve seri numarası araç üzerindeki tanımlama bilgileriyle uyumludur.","item_type":"visual"},
      {"text":"İmalat etiketi, CE/uyarı etiketleri ve güvenlik piktogramları eksiksiz, okunabilir ve doğru konumdadır.","item_type":"visual"},
      {"text":"Kullanım-bakım dokümanları, garanti/teslim evrakları ve ekipman listesi teslim dosyasında mevcuttur.","item_type":"visual"},
      {"text":"Boyahane sonrası yüzeylerde çizik, darbe, kabarma, akma, pas veya kaplama hatası bulunmamaktadır.","item_type":"visual"},
      {"text":"Tüm kapak, dolap, muhafaza ve menteşeler boşluksuz çalışmakta; kilitleme elemanları emniyetli kapanmaktadır.","item_type":"visual"},
      {"text":"Araç üzerinde gevşek parça, yabancı cisim, üretim artığı veya teslimata engel temizlik uygunsuzluğu yoktur.","item_type":"visual"}
    ]
  },
  {
    "name": "2. Çekme Tertibatı, Şasi ve Taşıyıcı Grup",
    "description": "Çekilir tip aracın yol emniyeti, şasi bağlantıları, destek ayakları, teker ve fren kontrolleri.",
    "items": [
      {"text":"Çeki oku, kaplin/pim, emniyet zinciri ve kilitleme tertibatı deformasyonsuz ve emniyetli çalışır durumdadır.","item_type":"visual"},
      {"text":"Şasi, traversler ve kaynaklı bağlantılarda çatlak, eksik kaynak, deformasyon veya kaplama hasarı bulunmamaktadır.","item_type":"visual"},
      {"text":"Ön destek krikosu ve park destek ayakları yük altında boşluksuz çalışmakta, sabitleme pimleri eksiksizdir.","item_type":"visual"},
      {"text":"Park freni/el freni mekanizması aracı sabitleyecek şekilde çalışmakta; kumanda kolu ve bağlantıları sağlamdır.","item_type":"visual"},
      {"text":"Tekerlek bijonları, jantlar, lastikler ve çamurluk bağlantıları sıkı, hasarsız ve yol kullanımına uygundur.","item_type":"visual"},
      {"text":"Lastik basınçları ve diş durumu teknik doküman limitlerine uygundur.","item_type":"visual"},
      {"text":"Reflektörler, arka koruyucular, çamurluk lastikleri ve yol emniyet ekipmanları eksiksiz takılmıştır.","item_type":"visual"},
      {"text":"Şasi altı hidrolik/su/elektrik hatları sürtme, ezilme ve taş darbesi riskine karşı korumalı sabitlenmiştir.","item_type":"visual"}
    ]
  },
  {
    "name": "3. Elevatör ve Konveyör Aktarma Sistemi",
    "description": "Malzeme toplama ve elevatörlü aktarma hattının mekanik ayar, güvenlik ve performans kontrolleri.",
    "items": [
      {"text":"Konveyör/elevatör bandı merkezlenmiş, yüzey hasarsız ve çalışma boyunca yanlara sürtmeden dönmektedir.","item_type":"visual"},
      {"text":"Konveyör bant gerginliği ve iz ayarı teknik dokümana uygun yapılmıştır.","item_type":"visual"},
      {"text":"Konveyör bandı yerden çalışma mesafesi ayarlanmış ve doğrulanmıştır.","item_type":"measurement","reference_value":"10","unit":"cm"},
      {"text":"Konveyör bir tam tur çalışma süresi uygun aralıkta doğrulanmıştır.","item_type":"measurement","reference_value":"3,50","unit":"sn"},
      {"text":"Elevatör zincirleri, paletleri, sıyırıcıları ve bağlantı cıvataları eksiksiz, sıkı ve doğru malzeme sınıfındadır.","item_type":"visual"},
      {"text":"Elevatör/konveyör hidromotorları balanssız çalışma, anormal ses, titreşim veya yağ kaçağı oluşturmamaktadır.","item_type":"visual"},
      {"text":"Gergi mekanizmaları, dayama takozları, rulman yatakları ve bağlantı milleri doğru ayarlanmış ve emniyete alınmıştır.","item_type":"visual"},
      {"text":"Üst kapaklar, menteşeler, kilitler ve bakım erişim noktaları emniyetli şekilde açılıp kapanmaktadır.","item_type":"visual"},
      {"text":"Konveyör sıyırıcıları, silikon fitiller ve sızdırmazlık elemanları doğru konumda, aşırı boşluk bırakmadan temas etmektedir.","item_type":"visual"},
      {"text":"Elevatör çalışma testi sırasında malzeme aktarım hattında takılma, sürtme, taşma veya korumasız hareketli parça riski yoktur.","item_type":"visual"}
    ]
  },
  {
    "name": "4. Fırça ve Süpürme Ünitesi",
    "description": "Ön/arka fırça grupları, ayar mekanizmaları, paspas ve toz kontrol elemanları.",
    "items": [
      {"text":"Ana fırça ve yan fırçalar doğru yönde, balanslı, anormal ses/titreşim oluşturmadan dönmektedir.","item_type":"visual"},
      {"text":"Fırça indirme/kaldırma mekanizmaları, halatlar, pimler ve emniyet elemanları eksiksiz ve fonksiyoneldir.","item_type":"visual"},
      {"text":"Fırça baskı ayarı, yer temas izi ve çalışma yüksekliği teknik dokümanına uygun ayarlanmıştır.","item_type":"visual"},
      {"text":"Fırça tabla, göbek, mil, rulman ve kontra somun bağlantıları sıkı ve hasarsızdır.","item_type":"visual"},
      {"text":"Arka fırça hidromotoru ve koruma lastikleri hasarsız; motor çevresinde yağ kaçağı bulunmamaktadır.","item_type":"visual"},
      {"text":"Yan paspaslar, toz lastikleri ve fırça muhafazaları eksiksiz, doğru açıklıkla ve zemine uygun temasla monte edilmiştir.","item_type":"visual"},
      {"text":"Fırça bölgesi aydınlatmaları ve bakım erişim alanları çalışma sırasında operatör güvenliğini sağlayacak durumdadır.","item_type":"visual"},
      {"text":"Süpürme denemesinde fırçalar malzemeyi elevatör girişine düzenli yönlendirmekte, kaçak/toz yayılımı kabul edilebilir seviyededir.","item_type":"visual"}
    ]
  },
  {
    "name": "5. Hidrolik Sistem ve Yağlama",
    "description": "Hidrolik güç aktarımı, kaçak, basınç, hortum güzergahı ve yağlama kontrolleri.",
    "items": [
      {"text":"Hidrolik tank yağ seviyesi uygun, kullanılan yağ tipi teknik şartnameye uygundur.","item_type":"visual","reference_value":"ISO VG 68"},
      {"text":"Hidrolik çalışma basıncı fonksiyon testi sırasında uygun aralıkta doğrulanmıştır.","item_type":"measurement","reference_value":"100-150","unit":"bar"},
      {"text":"Pompa, valf bloğu, hidromotor, silindir ve bağlantı elemanlarında yağ kaçağı veya terleme bulunmamaktadır.","item_type":"visual"},
      {"text":"Hidrolik hortumlar kıvrılma, ezilme, sürtme, keskin kenar teması ve ısı kaynağına yakınlık açısından uygundur.","item_type":"visual"},
      {"text":"Valf kumandaları, debi ayarları ve fonksiyon sıralaması operatör panelindeki işaretlemelerle uyumludur.","item_type":"visual"},
      {"text":"Filtre, havalandırma tapası, seviye göstergesi ve dolum kapağı temiz, sabit ve sızdırmaz durumdadır.","item_type":"visual"},
      {"text":"Gresörlükler eksiksiz; mafsal, rulman ve hareketli bağlantı noktaları yağlanmıştır.","item_type":"visual"},
      {"text":"Hidrolik sistem ısınma ve yük testi sonrası anormal ses, titreşim, basınç dalgalanması veya kaçak göstermemektedir.","item_type":"visual"}
    ]
  },
  {
    "name": "6. Su, Sulama ve Yüksek Basınçlı Yıkama Sistemi",
    "description": "Su tankı, dolum, filtreleme, nozullar, sulama hattı ve yüksek basınç yıkama ekipmanı.",
    "items": [
      {"text":"Su tankı, dolum ağzı, kapak, zincir, taşma ve tahliye bağlantıları sızdırmaz ve eksiksizdir.","item_type":"visual"},
      {"text":"Su seviye göstergesi doğru çalışmakta ve operatör tarafından okunabilir durumdadır.","item_type":"visual"},
      {"text":"Su dolum filtresi, emiş filtresi ve filtre anahtarı teslim ekipmanı olarak mevcuttur.","item_type":"visual"},
      {"text":"Sulama pompası ve hatları devreye alındığında kaçak, hava yapma veya basınç kaybı oluşturmamaktadır.","item_type":"visual"},
      {"text":"Nozullar/memeler tıkalı değildir; püskürtme deseni eşit ve çalışma bölgesini yeterli şekilde ıslatmaktadır.","item_type":"visual"},
      {"text":"Vana, rekor, kelepçe ve hızlı bağlantılar yön/hat etiketleriyle uyumlu ve fonksiyoneldir.","item_type":"visual"},
      {"text":"Yüksek basınçlı yıkama pompası, tabanca, hortum ve dolap içi sabitleme ekipmanı eksiksiz ve kaçaksızdır.","item_type":"visual"},
      {"text":"Yıkama sistemi testinde basınç stabil, tabanca emniyeti çalışır ve hortum güzergahı operatör güvenliğine uygundur.","item_type":"visual"}
    ]
  },
  {
    "name": "7. Güç Ünitesi, Motor ve Yakıt Sistemi",
    "description": "Motor, soğutma, yakıt, akü ve güç ünitesi yardımcı sistem kontrolleri.",
    "items": [
      {"text":"Motor devri çalışma modunda teknik doküman değerine ayarlanmıştır.","item_type":"measurement","reference_value":"1500","unit":"rpm"},
      {"text":"Motor yağ seviyesi, yakıt seviyesi ve yakıt göstergesi çalışması uygundur.","item_type":"visual"},
      {"text":"Motor takozları, bağlantı ayakları, koruma sacları ve pimleri sıkı ve emniyetlidir.","item_type":"visual"},
      {"text":"Radyatör, genleşme tankı, hortumlar ve kelepçelerde su/antifriz kaçağı yoktur; antifriz seviyesi uygundur.","item_type":"visual"},
      {"text":"Hava filtresi, emiş hattı ve motor havalandırma elemanları temiz, doğru monte edilmiş ve sızdırmazdır.","item_type":"visual"},
      {"text":"Yakıt dolum kapağı kilitlenmekte; yakıt hattı ve depo bağlantılarında kaçak bulunmamaktadır.","item_type":"visual"},
      {"text":"Akü sabitlemesi, kutup başı korumaları ve kablo güzergahı gevşeklik/kısa devre riski oluşturmayacak durumdadır.","item_type":"visual"},
      {"text":"Soğuk çalıştırma, rölanti, yük altında çalışma ve stop fonksiyonları anormal duman, ses veya titreşim oluşturmadan tamamlanmıştır.","item_type":"visual"}
    ]
  },
  {
    "name": "8. Elektrik, Aydınlatma ve Emniyet Donanımları",
    "description": "Yol aydınlatmaları, ikaz ekipmanları, acil stop ve elektrik tesisatı güvenlik kontrolleri.",
    "items": [
      {"text":"Sinyal, stop, park, geri vites ve plaka/arka aydınlatma lambaları eksiksiz ve doğru renkte çalışmaktadır.","item_type":"visual"},
      {"text":"Tepe lambası, ok lambaları ve çalışma alanı aydınlatmaları tüm modlarda çalışmaktadır.","item_type":"visual"},
      {"text":"Ön/arka fırça aydınlatmaları ve bakım bölgesi lambaları doğru konumlandırılmış ve fonksiyoneldir.","item_type":"visual"},
      {"text":"Acil stop butonu tüm hareketli fonksiyonları güvenli şekilde durdurmakta ve reset sonrası sistem kontrollü devreye girmektedir.","item_type":"visual"},
      {"text":"Kumanda paneli butonları, göstergeleri, etiketleri ve yön işaretleri gerçek fonksiyonlarla birebir uyumludur.","item_type":"visual"},
      {"text":"Kablo demetleri spiral/kanal içinde korunmuş, keskin kenarlardan uzak, soketleri kilitli ve su girişine karşı emniyetlidir.","item_type":"visual"},
      {"text":"Sigorta, röle ve bağlantı kutuları kapaklı, etiketli ve bakım erişimine uygun durumdadır.","item_type":"visual"},
      {"text":"Elektrik sistemi fonksiyon testi sonrası ısınma, gevşek bağlantı, sigorta atması veya kesintili çalışma göstermemektedir.","item_type":"visual"}
    ]
  },
  {
    "name": "9. Fonksiyonel Test, Yol Emniyeti ve Teslim Onayı",
    "description": "Sistem bütünlüğü, operatör güvenliği, son temizlik ve teslim öncesi final doğrulama.",
    "items": [
      {"text":"Tüm mekanik, hidrolik, elektrik ve su fonksiyonları sıralı final test planına göre birlikte çalıştırılmıştır.","item_type":"visual"},
      {"text":"Çalışma sırasında operatör, bakım personeli ve çevre için açıkta dönen/ezme/sıkışma riski oluşturacak nokta bulunmamaktadır.","item_type":"visual"},
      {"text":"Koruyucu kapaklar, kaydırmaz bantlar, tutamaklar, merdiven/basamaklar ve erişim noktaları güvenli kullanıma uygundur.","item_type":"visual"},
      {"text":"Sızdırmazlık ve kaçak kontrolü final test sonrası tekrar yapılmış; hidrolik yağ, yakıt, su veya antifriz kaçağı görülmemiştir.","item_type":"visual"},
      {"text":"Araç çekme konumuna alındığında hatlar, kapaklar, krikolar, fırçalar ve elevatör sistemi taşıma emniyetinde sabitlenmektedir.","item_type":"visual"},
      {"text":"Deneme süpürmesi/yıkaması sonrası toplama, aktarma, sulama ve yıkama performansı müşteri teslim kriterlerini karşılamaktadır.","item_type":"visual"},
      {"text":"Eksik ekipman, uygunsuzluk veya şartlı kabul gerektiren konu varsa kayıt altına alınmış ve sorumlusu belirlenmiştir.","item_type":"visual"},
      {"text":"Son temizlik, boya rötuşu, etiket kontrolü ve teslim öncesi genel görünüm onayı tamamlanmıştır.","item_type":"visual"}
    ]
  }
]
$json$::jsonb;
BEGIN
    SELECT id
    INTO v_tid
    FROM public.control_form_templates
    WHERE name ILIKE '%ural%'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_tid IS NULL THEN
        RAISE EXCEPTION 'Ural kontrol formu şablonu bulunamadı.';
    END IF;

    UPDATE public.control_form_templates
    SET
        name = 'Ural Final Kontrol Formu',
        description = 'Elevatörlü çekilir tip yol temizleme aracı için profesyonel final kontrol formu. Kontroller; çekme tertibatı, elevatör-konveyör, fırça, hidrolik, su/yıkama, güç ünitesi, elektrik-emniyet ve fonksiyonel test başlıklarında yapılandırılmıştır.',
        revision_no = COALESCE(revision_no, 0) + 1,
        revision_date = CURRENT_DATE,
        references_text = 'Ural elevatörlü çekilir tip yol temizleme aracı final kontrol kriterleri.',
        header_fields = '[
          {"key":"musteri","label":"Müşteri"},
          {"key":"seri_no","label":"Seri No"},
          {"key":"sasi_no","label":"Şasi No"},
          {"key":"motor_no","label":"Motor Numarası"},
          {"key":"imal_yili","label":"İmalat Yılı"},
          {"key":"marka","label":"Marka"},
          {"key":"tipi","label":"Tip"},
          {"key":"modeli","label":"Model"}
        ]'::jsonb,
        updated_at = now()
    WHERE id = v_tid;

    DELETE FROM public.control_form_sections
    WHERE template_id = v_tid;

    FOR v_section IN SELECT value FROM jsonb_array_elements(v_sections)
    LOOP
        INSERT INTO public.control_form_sections (template_id, name, description, order_index)
        VALUES (
            v_tid,
            v_section->>'name',
            v_section->>'description',
            v_section_order
        )
        RETURNING id INTO v_sid;

        v_item_order := 0;
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_section->'items')
        LOOP
            INSERT INTO public.control_form_items (
                section_id,
                text,
                item_type,
                reference_value,
                unit,
                measurement_equipment_name,
                is_required,
                order_index
            )
            VALUES (
                v_sid,
                v_item->>'text',
                COALESCE(v_item->>'item_type', 'visual'),
                v_item->>'reference_value',
                v_item->>'unit',
                NULL,
                true,
                v_item_order
            );

            v_item_order := v_item_order + 1;
        END LOOP;

        v_section_order := v_section_order + 1;
    END LOOP;
END $$;
