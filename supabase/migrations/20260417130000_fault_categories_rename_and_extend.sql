-- Üretilen Araçlar modülü: ilgili birim (cost_settings.unit_name) isimlerini
-- Title Case'e normalize eder ve eksik / zayıf disiplin kategorilerini tamamlar.
-- Hepsi idempotenttir; birden fazla çalıştırma güvenlidir.

BEGIN;

-- 1) Departman (cost_settings.unit_name) isimlerini Title Case'e çek.
UPDATE public.cost_settings SET unit_name = 'Ar-Ge Direktörlüğü'
  WHERE id = 'b5060575-e360-4414-875e-bd44802d95d6';
UPDATE public.cost_settings SET unit_name = 'İdari İşler Müdürlüğü'
  WHERE id = '4b12e28c-3dda-4eca-bcc2-68991618eebd';
UPDATE public.cost_settings SET unit_name = 'Kurumsal İletişim ve Dijital Pazarlama'
  WHERE id = '0fb2ab73-0c6b-4d73-b6d4-c491770d1437';
UPDATE public.cost_settings SET unit_name = 'Lojistik Yöneticiliği'
  WHERE id = '16db1c09-97e3-4a2d-b245-848c977d19f1';
UPDATE public.cost_settings SET unit_name = 'Satınalma Müdürlüğü'
  WHERE id = '7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b';
UPDATE public.cost_settings SET unit_name = 'Satış Sonrası Hizmetler Müdürlüğü'
  WHERE id = 'd46d5acc-4bdb-4cb2-9aee-af54220f052b';
UPDATE public.cost_settings SET unit_name = 'Üretim Müdürlüğü (Kabin Hattı)'
  WHERE id = '19c0e285-5773-4098-9913-e9913f43011c';
UPDATE public.cost_settings SET unit_name = 'Üretim Müdürlüğü (Üst Yapı)'
  WHERE id = 'e86e0de8-b2bf-4044-b87c-13bb2b5e2471';
UPDATE public.cost_settings SET unit_name = 'Üretim Planlama Müdürlüğü'
  WHERE id = 'bcf6529f-c7e3-40e6-bfd6-bfb848afa197';
UPDATE public.cost_settings SET unit_name = 'Yurt Dışı Satış Müdürlüğü'
  WHERE id = '89ea3a0d-81a6-4d34-92bf-3bdbd550608d';
UPDATE public.cost_settings SET unit_name = 'Yurt İçi Satış Müdürlüğü'
  WHERE id = '00981550-11e0-4d29-9d1d-7b09a50777cf';

-- 2) Eski kategori isimlerindeki Türkçe karakter eksiklerini düzelt.
UPDATE public.fault_categories SET name = 'Kabin Gösterge Panel Hatası'
  WHERE name = 'Kabin Gosterge Panel Hatası';
UPDATE public.fault_categories SET name = 'Kabin Kaynak Dikiş Hatası'
  WHERE name = 'Kabin Kaynak Dikis Hatası';
UPDATE public.fault_categories SET name = 'Kabin Şasi Kaynak Çatlağı'
  WHERE name = 'Kabin şasi Kaynak Çatlağı';

-- 3) Her departman için disiplin bazlı hata kategorilerini tamamla.
INSERT INTO public.fault_categories (name, department_id, discipline) VALUES
  -- İnsan Kaynakları Müdürlüğü
  ('Eğitim Kaydı Eksiği','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Dokümantasyon'),
  ('Özlük Dosyası Eksiği','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Dokümantasyon'),
  ('Sertifika Güncelliği Kaybı','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Dokümantasyon'),
  ('Personel Yetkinlik Kaydı Hatası','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Dokümantasyon'),
  ('KKD Uygunsuzluğu','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Genel'),
  ('Oryantasyon Tamamlanmamış','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Genel'),
  ('Vardiya Planlama Hatası','7dd3e06e-3904-4842-b86a-05cf1decd7c4','Genel'),
  -- Kademe Genel Müdürlüğü
  ('Strateji Sapması','6108bea4-4e56-4f36-aee8-f41cda4336ae','Genel'),
  ('Yönetim Karar Gecikmesi','6108bea4-4e56-4f36-aee8-f41cda4336ae','Genel'),
  ('Kaynak Tahsis Hatası','6108bea4-4e56-4f36-aee8-f41cda4336ae','Genel'),
  ('Prosedür İhlali','6108bea4-4e56-4f36-aee8-f41cda4336ae','Dokümantasyon'),
  ('Yönetim Gözden Geçirme Eksikliği','6108bea4-4e56-4f36-aee8-f41cda4336ae','Dokümantasyon'),
  -- Kurumsal İletişim ve Dijital Pazarlama
  ('Etkinlik İletişim Hatası','0fb2ab73-0c6b-4d73-b6d4-c491770d1437','Genel'),
  ('Kurumsal Kimlik Uyumsuzluğu','0fb2ab73-0c6b-4d73-b6d4-c491770d1437','Dokümantasyon'),
  ('Marka Kullanımı Hatası','0fb2ab73-0c6b-4d73-b6d4-c491770d1437','Dokümantasyon'),
  ('Sosyal Medya İçerik Hatası','0fb2ab73-0c6b-4d73-b6d4-c491770d1437','Dokümantasyon'),
  ('Web Sitesi İçerik Hatası','0fb2ab73-0c6b-4d73-b6d4-c491770d1437','Dokümantasyon'),
  ('Reklam Materyali Hatası','0fb2ab73-0c6b-4d73-b6d4-c491770d1437','Dokümantasyon'),
  -- Lojistik Yöneticiliği
  ('Etiket / Barkod Hatası','16db1c09-97e3-4a2d-b245-848c977d19f1','Lojistik'),
  ('Araç Yükleme Hatası','16db1c09-97e3-4a2d-b245-848c977d19f1','Lojistik'),
  ('Nakliye Hasarı','16db1c09-97e3-4a2d-b245-848c977d19f1','Lojistik'),
  ('Sevk İrsaliyesi Hatası','16db1c09-97e3-4a2d-b245-848c977d19f1','Dokümantasyon'),
  ('Gümrük Doküman Eksiği','16db1c09-97e3-4a2d-b245-848c977d19f1','Dokümantasyon'),
  ('Taşıma Planı Hatası','16db1c09-97e3-4a2d-b245-848c977d19f1','Lojistik'),
  ('Paketleme Standardı Dışı','16db1c09-97e3-4a2d-b245-848c977d19f1','Lojistik'),
  ('Sevkiyat Gecikmesi','16db1c09-97e3-4a2d-b245-848c977d19f1','Lojistik'),
  -- Mali İşler
  ('Fatura Hatası','74aa6e3e-709b-4a90-9639-38d43a6aa631','Dokümantasyon'),
  ('Muhasebe Kayıt Hatası','74aa6e3e-709b-4a90-9639-38d43a6aa631','Dokümantasyon'),
  ('Ödeme Gecikmesi','74aa6e3e-709b-4a90-9639-38d43a6aa631','Genel'),
  ('Bütçe Aşımı','74aa6e3e-709b-4a90-9639-38d43a6aa631','Genel'),
  ('Vergi Beyan Hatası','74aa6e3e-709b-4a90-9639-38d43a6aa631','Dokümantasyon'),
  ('Maliyet Hesaplama Hatası','74aa6e3e-709b-4a90-9639-38d43a6aa631','Dokümantasyon'),
  -- Satış Sonrası Hizmetler
  ('Garanti Kayıt Hatası','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Dokümantasyon'),
  ('Servis Raporu Eksiği','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Dokümantasyon'),
  ('Yedek Parça Temin Gecikmesi','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Lojistik'),
  ('Sahada Tekrarlayan Arıza','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Fonksiyonel Test'),
  ('Çağrı Yönlendirme Hatası','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Genel'),
  ('Servis Müdahale Gecikmesi','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Genel'),
  ('Müşteri Şikayeti Yanlış Sınıflandırması','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Dokümantasyon'),
  ('Tamir Sonrası Kontrol Eksiği','d46d5acc-4bdb-4cb2-9aee-af54220f052b','Kalite Kontrol'),
  -- Tedarikçi
  ('Uygunsuz Malzeme Gönderimi','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Lojistik'),
  ('Eksik Parça Gönderimi','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Lojistik'),
  ('Fazla Parça Gönderimi','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Lojistik'),
  ('Ambalaj Hasarı','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Lojistik'),
  ('Sertifika / Rapor Eksiği','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Dokümantasyon'),
  ('Malzeme Spesifikasyon Sapması','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Tasarım ve AR-GE'),
  ('Ölçü Tolerans Dışı Malzeme','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Ölçü ve Geometri'),
  ('Yüzey Kalitesi Uygunsuzluğu','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Yüzey'),
  ('Teslim Tarihi Gecikmesi','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Lojistik'),
  ('Yanlış Revizyon Gönderimi','f3e0f336-b989-4b7d-b723-5aed54dfcf6d','Dokümantasyon'),
  -- Üretim Planlama
  ('Üretim Planı Sapması','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Genel'),
  ('Seri No Atama Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  ('Malzeme İhtiyaç Hesaplama Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  ('İş Emri Yanlış Yönlendirme','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  ('Rota / Operasyon Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  ('Revizyon Güncelleme Gecikmesi','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  ('Termin Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Genel'),
  ('Kapasite Planlama Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Genel'),
  ('BOM (Ürün Ağacı) Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  ('Model / Varyasyon Seçim Hatası','bcf6529f-c7e3-40e6-bfd6-bfb848afa197','Dokümantasyon'),
  -- Yurt Dışı Satış
  ('Sipariş Giriş Hatası','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Dokümantasyon'),
  ('Müşteri Spesifikasyon Yanlış Aktarımı','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Dokümantasyon'),
  ('Teklif İçeriği Hatası','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Dokümantasyon'),
  ('Sözleşme Artı Maddesi Eksiği','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Dokümantasyon'),
  ('İhracat Evrakı Eksiği','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Dokümantasyon'),
  ('Yanlış Termin Taahhüdü','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Genel'),
  ('Müşteri Şikayeti Takip Hatası','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Dokümantasyon'),
  ('Ödeme Koşulu Uyumsuzluğu','89ea3a0d-81a6-4d34-92bf-3bdbd550608d','Genel'),
  -- Yurt İçi Satış
  ('Sipariş Giriş Hatası','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  ('Müşteri Talep Yanlış İletimi','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  ('Teklif Hatası','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  ('Sözleşme Eksiği','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  ('Teslim Tarihi Uyumsuzluğu','00981550-11e0-4d29-9d1d-7b09a50777cf','Genel'),
  ('Yanlış Ürün Konfigürasyonu','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  ('Müşteri Şikayeti Kayıt Hatası','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  ('Fatura / İrsaliye Hatası','00981550-11e0-4d29-9d1d-7b09a50777cf','Dokümantasyon'),
  -- Ar-Ge Direktörlüğü (ek)
  ('Teknik Resim Hatası','b5060575-e360-4414-875e-bd44802d95d6','Tasarım ve AR-GE'),
  ('CAD Model Güncelleme Gecikmesi','b5060575-e360-4414-875e-bd44802d95d6','Tasarım ve AR-GE'),
  ('Prototip Test Hatası','b5060575-e360-4414-875e-bd44802d95d6','Fonksiyonel Test'),
  ('Validasyon Eksiği','b5060575-e360-4414-875e-bd44802d95d6','Tasarım ve AR-GE'),
  ('Toleransların Yanlış Tanımlanması','b5060575-e360-4414-875e-bd44802d95d6','Ölçü ve Geometri'),
  ('Standart Uyumsuzluğu','b5060575-e360-4414-875e-bd44802d95d6','Tasarım ve AR-GE'),
  ('AR-GE Revizyon Kontrolsüz Değişiklik','b5060575-e360-4414-875e-bd44802d95d6','Dokümantasyon'),
  ('Patent / Sertifikasyon Eksiği','b5060575-e360-4414-875e-bd44802d95d6','Dokümantasyon'),
  -- Depo Şefliği (ek)
  ('Yanlış Yer Teşhis','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  ('FIFO / LIFO Uygunsuzluğu','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  ('Stok Sayım Sapması','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  ('Sevk Hasarı','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  ('Depo İçi Hasar','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  ('Geçiş / Transfer Kayıt Hatası','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Dokümantasyon'),
  ('Malzeme Etiketleme Hatası','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  ('Son Kullanma Tarihi Geçmiş Malzeme','2ccad30e-be6a-47ae-9ba5-04364391dc6d','Lojistik'),
  -- İdari İşler (ek)
  ('Arama Yönlendirme Hatası','4b12e28c-3dda-4eca-bcc2-68991618eebd','Genel'),
  ('Toplantı Koordinasyon Hatası','4b12e28c-3dda-4eca-bcc2-68991618eebd','Genel'),
  ('Ziyaretçi / Güvenlik Hatası','4b12e28c-3dda-4eca-bcc2-68991618eebd','Genel'),
  ('Tahsilat Hatası','4b12e28c-3dda-4eca-bcc2-68991618eebd','Dokümantasyon'),
  ('Satın Alma Talep Hatası','4b12e28c-3dda-4eca-bcc2-68991618eebd','Dokümantasyon'),
  -- Kalite Müdürlüğü (ek)
  ('Kalibrasyon Süresi Geçmiş Cihaz','71a5bccd-c764-45c5-9802-73199e3923a1','Kalite Kontrol'),
  ('Uygunsuzluk Açma Hatası','71a5bccd-c764-45c5-9802-73199e3923a1','Kalite Kontrol'),
  ('Numune Alma Hatası','71a5bccd-c764-45c5-9802-73199e3923a1','Kalite Kontrol'),
  ('PPAP / İlk Numune Eksiği','71a5bccd-c764-45c5-9802-73199e3923a1','Dokümantasyon'),
  ('İç Denetim Bulgusu Açık Kalması','71a5bccd-c764-45c5-9802-73199e3923a1','Kalite Kontrol'),
  ('CAPA Kapatma Gecikmesi','71a5bccd-c764-45c5-9802-73199e3923a1','Kalite Kontrol'),
  ('Kontrol Planı Uygulanmaması','71a5bccd-c764-45c5-9802-73199e3923a1','Kalite Kontrol'),
  ('FMEA Güncelleme Eksiği','71a5bccd-c764-45c5-9802-73199e3923a1','Dokümantasyon'),
  -- Satınalma (ek)
  ('Hatalı PO (Satın Alma Siparişi)','7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b','Dokümantasyon'),
  ('Teknik Şartname Uyumsuzluğu','7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b','Tasarım ve AR-GE'),
  ('Fiyat / Miktar Uyumsuzluğu','7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b','Dokümantasyon'),
  ('Tedarikçi Değişikliği Bildirilmedi','7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b','Dokümantasyon'),
  ('Onay Süreci Gecikmesi','7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b','Genel'),
  ('Numune Talep Edilmedi','7896e489-2f2d-4b8c-a8e4-ad71a83a7c0b','Kalite Kontrol'),
  -- Üretim Müdürlüğü (Üst Yapı) – ek detay kategoriler
  ('Aks / Dingil Hizalama Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Ölçü ve Geometri'),
  ('Damper Gövdesi Deformasyonu','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Ölçü ve Geometri'),
  ('Şasi Biçimlendirme Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Ölçü ve Geometri'),
  ('Damper Kaşa Açıklığı Uygunsuz','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Ölçü ve Geometri'),
  ('Hatalı Kaynak Pozisyonu','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Kaynak'),
  ('Kaynak Tümseme / Dolgu Fazlalığı','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Kaynak'),
  ('Kaynak Yanma Oyuğu','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Kaynak'),
  ('Kaynak Yakışmama / Cold Lap','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Kaynak'),
  ('Galvanik Korozyon','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Yüzey'),
  ('Pas / Oksidasyon','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Yüzey'),
  ('Darbe / Çökme Deformasyonu','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Yüzey'),
  ('Hatalı Astar Uygulaması','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Boya'),
  ('Boya Örtü Kalınlığı Uygunsuz','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Boya'),
  ('Kuruma / Pişirme Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Boya'),
  ('Fırça İzi / Yanlış Boya Yönü','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Boya'),
  ('ABS / EBS Arızası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Elektrik'),
  ('CAN Bus Haberleşme Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Elektrik'),
  ('Sinyal / Stop Lamba Arızası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Elektrik'),
  ('Telematik / GPS Modul Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Elektrik'),
  ('Topraklama Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Elektrik'),
  ('Devrilme / Kaldırma Fonksiyonu Test Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Fonksiyonel Test'),
  ('Frenleme Test Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Fonksiyonel Test'),
  ('Süspansiyon Test Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Fonksiyonel Test'),
  ('PTO (Güç Çıkışı) Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Fonksiyonel Test'),
  ('Hidrolik Filtre Tıkanıklığı','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Hidrolik'),
  ('Hidrolik Yağ Sıcaklığı Sapması','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Hidrolik'),
  ('Hidrolik Gürültü / Titreşim','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Hidrolik'),
  ('Manifold Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Hidrolik'),
  ('Kaplin / Rot Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Rulman / Yatak Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Cıvata Grade Uyumsuzluğu','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Contalar / Sızdırmazlık Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Uygunsuz Yağlama','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Kaput / Örtü Montaj Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Tente / Brandalama Hatası','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Mekanik Montaj'),
  ('Spray / Kumlama Eksikliği','e86e0de8-b2bf-4044-b87c-13bb2b5e2471','Yüzey'),
  -- Üretim Müdürlüğü (Kabin Hattı) – ek detay kategoriler
  ('Kabin Kapı Contası Hatası','19c0e285-5773-4098-9913-e9913f43011c','Mekanik Montaj'),
  ('Ayna / Kamera Montaj Hatası','19c0e285-5773-4098-9913-e9913f43011c','Mekanik Montaj'),
  ('Klima / Isıtma Montaj Hatası','19c0e285-5773-4098-9913-e9913f43011c','Mekanik Montaj'),
  ('Direksiyon Simidi Boşluk Hatası','19c0e285-5773-4098-9913-e9913f43011c','Mekanik Montaj'),
  ('Gösterge Panel Aydınlatma Hatası','19c0e285-5773-4098-9913-e9913f43011c','Elektrik'),
  ('Kabin Cam Yapıştırma Hatası','19c0e285-5773-4098-9913-e9913f43011c','Mekanik Montaj'),
  ('Kabin Gürültü / Titreşim Sorunu','19c0e285-5773-4098-9913-e9913f43011c','Fonksiyonel Test'),
  ('Kabin Sızdırmazlık Testi Hatası','19c0e285-5773-4098-9913-e9913f43011c','Fonksiyonel Test'),
  ('Kabin Klima Soğutma Hatası','19c0e285-5773-4098-9913-e9913f43011c','Fonksiyonel Test'),
  ('Cam Silecek / Yıkama Hatası','19c0e285-5773-4098-9913-e9913f43011c','Elektrik'),
  ('Aktüatör / Motor Arızası','19c0e285-5773-4098-9913-e9913f43011c','Elektrik'),
  ('Kabin Boya Örtü Kalınlığı','19c0e285-5773-4098-9913-e9913f43011c','Boya'),
  ('Kabin Katılık / Darbe Hasarı','19c0e285-5773-4098-9913-e9913f43011c','Yüzey'),
  ('Kabin İç Trim Boya Uygunsuzluğu','19c0e285-5773-4098-9913-e9913f43011c','Boya'),
  ('Kabin İş Emri / Etiket Hatası','19c0e285-5773-4098-9913-e9913f43011c','Dokümantasyon')
ON CONFLICT (name, department_id) DO UPDATE SET discipline = EXCLUDED.discipline;

COMMIT;
