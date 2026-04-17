-- =============================================================================
-- Üretilen Araçlar modülü: fault_categories tablosuna discipline kolonu eklendi
-- =============================================================================
-- Amaç: Proses kontrol modülündeki buildCategoryOptions yaklaşımına benzer
-- şekilde, üretilen araç hatalarını Elektrik, Mekanik Montaj, Hidrolik,
-- Pnömatik, Boya, Kaynak, Ölçü ve Geometri, Yüzey, Dokümantasyon, Lojistik,
-- Kalite Kontrol, Tasarım ve AR-GE, Fonksiyonel Test ve Genel disiplinlerine
-- göre gruplayabilmek için discipline alanı eklenir ve mevcut kategoriler
-- backfill edilir. Ek olarak, Hidrolik ve Pnömatik gibi disiplinler için
-- eksik detay kategorileri (üretim üst yapı ve kabin hattı için) eklenir.
-- =============================================================================

ALTER TABLE public.fault_categories
    ADD COLUMN IF NOT EXISTS discipline TEXT;

CREATE INDEX IF NOT EXISTS idx_fault_categories_discipline
    ON public.fault_categories(discipline);

COMMENT ON COLUMN public.fault_categories.discipline IS
    'Üretilen Araçlar modülünde hatayı gruplamak için kullanılan disiplin (Elektrik, Mekanik Montaj, Hidrolik, Pnömatik, Boya, Kaynak, Ölçü ve Geometri, Yüzey, Dokümantasyon, Lojistik, Kalite Kontrol, Tasarım ve AR-GE, Fonksiyonel Test, Genel).';

-- Ad bazında mutlak unique kısıtlaması kaldırılır. (name, department_id)
-- bileşik anahtarı zaten var ve bu yeterlidir; aynı kategori adının farklı
-- bölümlerde tekrarlanmasına izin verir (ör. "Hidrolik Valf Arızası" hem
-- Üst Yapı hem de Kabin Hattı için ayrı ayrı tutulabilir).
ALTER TABLE public.fault_categories
    DROP CONSTRAINT IF EXISTS unique_fault_category_name;

DROP INDEX IF EXISTS public.unique_fault_category_name;

-- Mevcut kategorilerin disiplinlerini sınıflandır.
UPDATE public.fault_categories SET discipline = 'Elektrik'
WHERE name IN (
    'Eksik Elektrik Montajı','Hatalı Elektrik Montajı',
    'İzolasyon Problemi','Kablo Bağlantı Hatası','Yanlış Program Kullanımı'
);

UPDATE public.fault_categories SET discipline = 'Mekanik Montaj'
WHERE name IN (
    'Hatalı Torklama','Montaj Sırası Hatası','Parça Eksikliği',
    'Bağlantı Elemanı Eksiği','Eksik Montaj Uygulaması','Hatalı Montaj Uygulaması',
    'Hatalı Parça Montajı','Tork Değeri Uyumsuzluğu','Yanlış Komponent Montajı'
);

UPDATE public.fault_categories SET discipline = 'Boya'
WHERE name IN (
    'Boya Akıntısı','Eksik Boya Uygulaması','Hatalı Boya Uygulaması',
    'Portakal Kabuğu Görünümü','Renk Tonu Farklılığı','Yapışma Sorunu'
);

UPDATE public.fault_categories SET discipline = 'Kaynak'
WHERE name IN (
    'Çatlak Oluşumu','Hatalı Kaynak Parametresi','Kaynak Gözenekleri',
    'Kaynak Nüfuziyetsizliği','Kaynak Sıçrantısı'
);

UPDATE public.fault_categories SET discipline = 'Ölçü ve Geometri'
WHERE name IN (
    'Açı Hatası','Çarpılma ve Deformasyon','Hizalama Sorunu',
    'Ölçü Hatası','Ölçü Tolerans Dışı'
);

UPDATE public.fault_categories SET discipline = 'Yüzey'
WHERE name IN (
    'Çizik veya Hasar','Çapak Problemi','Çizik ve Darbe',
    'Toz ve Kir','Yüzey Deformasyonu','Yüzey Kalitesi Sorunu','Yüzey Pürüzlülüğü'
);

UPDATE public.fault_categories SET discipline = 'Dokümantasyon'
WHERE name IN (
    'Dokümantasyon Eksiği','Evrak Eksiği','Raporlama Hatası','Süreç Takip Hatası',
    'Hatalı Raporlama','Sertifika Eksikliği','Etiket Hataları','Etiketleme Eksiği',
    'Hatalı İş Emri','Markalama Hatası','Müşteri Talebi Yanlış Anlaşılması',
    'Rota Yanlışlığı','Sipariş Bilgileri Eksiği','Termin Planlama Hatası',
    'Test Prosedür Hatası','Müşteri Geri Bildirim Yönetim Zafiyeti',
    'Yedek Parça Uyumsuzluğu','Servis Prosedür Hatası'
);

UPDATE public.fault_categories SET discipline = 'Lojistik'
WHERE name IN (
    'Eksik Malzeme','Hasarlı Malzeme','Paketleme Hatası','Stok Kayıt Hatası',
    'Yanlış Malzeme Sevkiyatı','Geç Teslimat','Tedarikçi Malzeme Hatası'
);

UPDATE public.fault_categories SET discipline = 'Kalite Kontrol'
WHERE name IN (
    'Görsel Muayene Gözden Kaçırma','Kontrol Prosedürü Atlanması',
    'Ölçüm Cihazı Hatası','Standart Dışı Değerlendirme'
);

UPDATE public.fault_categories SET discipline = 'Tasarım ve AR-GE'
WHERE name IN ('Malzeme Seçim Hatası','Prototip Uyumsuzluğu','Tasarım Hatası');

UPDATE public.fault_categories SET discipline = 'Fonksiyonel Test'
WHERE name IN ('Fonksiyonel Bozukluk','Fonksiyonel Test Hatası');

UPDATE public.fault_categories SET discipline = 'Hidrolik'
WHERE name IN ('Sızdırmazlık Problemi');

UPDATE public.fault_categories SET discipline = 'Genel'
WHERE discipline IS NULL;

-- Üretim Üst Yapı için Hidrolik detay kategorileri
INSERT INTO public.fault_categories (department_id, name, discipline)
SELECT 'e86e0de8-b2bf-4044-b87c-13bb2b5e2471'::uuid, cat_name, 'Hidrolik'
FROM (VALUES
    ('Hidrolik Hortum Hasarı'),
    ('Hidrolik Bağlantı/Rekor Sızdırması'),
    ('Hidrolik Valf Arızası'),
    ('Hidrolik Silindir Kaçağı'),
    ('Hidrolik Pompa Hatası'),
    ('Hidrolik Basınç Uygunsuzluğu'),
    ('Hidrolik Yağ Kaçağı')
) AS t(cat_name)
ON CONFLICT (name, department_id) DO UPDATE SET discipline = EXCLUDED.discipline;

-- Üretim Üst Yapı için Pnömatik detay kategorileri
INSERT INTO public.fault_categories (department_id, name, discipline)
SELECT 'e86e0de8-b2bf-4044-b87c-13bb2b5e2471'::uuid, cat_name, 'Pnömatik'
FROM (VALUES
    ('Pnömatik Hava Kaçağı'),
    ('Pnömatik Hat/Hortum Hatası'),
    ('Pnömatik Valf Arızası'),
    ('Pnömatik Silindir Hatası'),
    ('Pnömatik Regülatör Hatası'),
    ('Pnömatik Basınç Uygunsuzluğu'),
    ('Pnömatik Bağlantı/Rekor Hatası')
) AS t(cat_name)
ON CONFLICT (name, department_id) DO UPDATE SET discipline = EXCLUDED.discipline;

-- Üretim Kabin Hattı için Hidrolik detay kategorileri
INSERT INTO public.fault_categories (department_id, name, discipline)
SELECT '19c0e285-5773-4098-9913-e9913f43011c'::uuid, cat_name, 'Hidrolik'
FROM (VALUES
    ('Hidrolik Hortum Hasarı'),
    ('Hidrolik Bağlantı/Rekor Sızdırması'),
    ('Hidrolik Valf Arızası'),
    ('Hidrolik Silindir Kaçağı'),
    ('Hidrolik Yağ Kaçağı')
) AS t(cat_name)
ON CONFLICT (name, department_id) DO UPDATE SET discipline = EXCLUDED.discipline;

-- Üretim Kabin Hattı için Pnömatik detay kategorileri
INSERT INTO public.fault_categories (department_id, name, discipline)
SELECT '19c0e285-5773-4098-9913-e9913f43011c'::uuid, cat_name, 'Pnömatik'
FROM (VALUES
    ('Pnömatik Hava Kaçağı'),
    ('Pnömatik Hat/Hortum Hatası'),
    ('Pnömatik Valf Arızası'),
    ('Pnömatik Basınç Uygunsuzluğu')
) AS t(cat_name)
ON CONFLICT (name, department_id) DO UPDATE SET discipline = EXCLUDED.discipline;

-- Üretim Kabin Hattı için Elektrik/Boya/Kaynak/Montaj/Ölçü/Yüzey detay kategorileri
INSERT INTO public.fault_categories (department_id, name, discipline)
SELECT '19c0e285-5773-4098-9913-e9913f43011c'::uuid, cat_name, discip
FROM (VALUES
    ('Kabin Elektrik Kablaj Hatası', 'Elektrik'),
    ('Kabin İç Aydınlatma Arızası', 'Elektrik'),
    ('Kabin Sigorta/Röle Hatası', 'Elektrik'),
    ('Kabin Sensör Bağlantı Hatası', 'Elektrik'),
    ('Kabin Gösterge Panel Hatası', 'Elektrik'),
    ('Kabin İç Boya Hatası', 'Boya'),
    ('Kabin Dış Boya Akıntısı', 'Boya'),
    ('Kabin Boya Ton Farkı', 'Boya'),
    ('Kabin Kaynak Dikiş Hatası', 'Kaynak'),
    ('Kabin Şasi Kaynak Çatlağı', 'Kaynak'),
    ('Kabin Kapı Montaj Hatası', 'Mekanik Montaj'),
    ('Kabin Koltuk Bağlantı Hatası', 'Mekanik Montaj'),
    ('Kabin Cam Montaj Hatası', 'Mekanik Montaj'),
    ('Kabin Bağlantı Elemanı Eksiği', 'Mekanik Montaj'),
    ('Kabin Kapı Boşluğu Uygunsuz', 'Ölçü ve Geometri'),
    ('Kabin Hizalama Sorunu', 'Ölçü ve Geometri'),
    ('Kabin İç Döşeme Hasarı', 'Yüzey'),
    ('Kabin Toz/Kir Kalıntısı', 'Yüzey')
) AS t(cat_name, discip)
ON CONFLICT (name, department_id) DO UPDATE SET discipline = EXCLUDED.discipline;
