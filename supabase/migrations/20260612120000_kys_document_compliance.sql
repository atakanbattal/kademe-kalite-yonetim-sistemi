-- KYS dokümantasyon uyumluluk iyileştirmeleri (12.06.2026)
-- A001/A005/A013: Ana liste desteği, kod eşleme tablosu, yıldan bağımsız sıra

CREATE TABLE IF NOT EXISTS public.document_code_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_code text NOT NULL,
  new_code text NOT NULL,
  folder text,
  old_source_file text,
  new_pdf text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_code_mappings_old_code_unique UNIQUE (old_code)
);

CREATE INDEX IF NOT EXISTS idx_document_code_mappings_new_code ON public.document_code_mappings(new_code);

COMMENT ON TABLE public.document_code_mappings IS 'KDM → BÖLÜM-TİP-YIL-SIRA resmi çapraz referans tablosu (KYS Kod Eşleme)';

CREATE OR REPLACE FUNCTION public.set_document_code_mappings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_code_mappings_updated_at ON public.document_code_mappings;
CREATE TRIGGER trg_document_code_mappings_updated_at
  BEFORE UPDATE ON public.document_code_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code_mappings_updated_at();

ALTER TABLE public.document_code_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_code_mappings_select ON public.document_code_mappings;
CREATE POLICY document_code_mappings_select ON public.document_code_mappings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS document_code_mappings_all ON public.document_code_mappings;
CREATE POLICY document_code_mappings_all ON public.document_code_mappings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.document_code_mappings (old_code, new_code, folder, old_source_file, new_pdf, notes)
VALUES
('KDM.FRM.007', 'SAT-FR-2026-0001', 'Satınalma Müdürlüğü/Formlar', '1-KDM.FRM.007 Tedarikçi Yetkinlik Değ. Formu (Rev.00).doc', 'SAT-FR-2026-0001 Tedarikçi Yetkinlik Değ. Formu.pdf', NULL),
('KDM.FRM.020', 'BAK-FR-2025-0001', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.020 Arızalı Kartı (Rev.00).doc', 'BAK-FR-2025-0001 Arızalı Kartı.pdf', NULL),
('KDM.FRM.021', 'BAK-FR-2025-0002', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.021 Bakımda Kartı (Rev.00).doc', 'BAK-FR-2025-0002 Bakımda Kartı.pdf', NULL),
('KDM.FRM.022', 'SAT-FR-2026-0002', 'Satınalma Müdürlüğü/Formlar', '1-KDM.FRM.022 Satınalma Talep Formu (Rev.00).xlsx', 'SAT-FR-2026-0002 Satınalma Talep Formu.pdf', NULL),
('KDM.FRM.025', 'BAK-FR-2025-0004', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.025 Arıza Bildirim Formu (Rev.00).doc', 'BAK-FR-2025-0004 Arıza Bildirim Formu.pdf', NULL),
('KDM.FRM.030', 'KAL-FR-2025-0007', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.030 Karantina Kartı (Rev.01).xlsx', 'KAL-FR-2025-0007 Karantina Kartı.pdf', NULL),
('KDM.FRM.035', 'PLA-FR-2026-0002', 'Üretim Planlama Müdürlüğü/Formlar', '1-KDM.FRM.035 Üretim Sipariş Formu (Rev.03).xlsx', 'PLA-FR-2026-0002 Üretim Sipariş Formu.pdf', NULL),
('KDM.FRM.037', 'SSH-FR-2025-0001', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.037 Tamir Talep Formu (Rev.00).xlsx', 'SSH-FR-2025-0001 Tamir Talep Formu.pdf', NULL),
('KDM.FRM.039', 'ÜRE-FR-2025-0005', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.039 Sac Kesim Üretim Takip Formu.xlsx', 'ÜRE-FR-2025-0005 Sac Kesim Üretim Takip Formu.pdf', NULL),
('KDM.FRM.040', 'KAL-FR-2025-0010', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.040 Kabin Üretim Ölçüsel Kontrol Formu (Rev.00).xlsx', 'KAL-FR-2025-0010 Kabin Üretim Ölçüsel Kontrol Formu.pdf', NULL),
('KDM.FRM.041', 'KAL-FR-2025-0011', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.041 Araç Tank Sızdırmazlık Testi Kontrol Formu (Rev.01).xlsx', 'KAL-FR-2025-0011 Araç Tank Sızdırmazlık Testi Kontrol Formu.pdf', NULL),
('KDM.FRM.046', 'KAL-FR-2025-0015', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.046 Civata Tork Kontrol Formu.xlsx', 'KAL-FR-2025-0015 Civata Tork Kontrol Formu.pdf', NULL),
('KDM.FRM.047', 'KAL-FR-2025-0062', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.047 URAL SON KONTROL FORMU.xlsx', 'KAL-FR-2025-0062 URAL SON KONTROL FORMU.pdf', NULL),
('KDM.FRM.053', 'SSH-FR-2025-0003', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.053 Servis Raporu( Rev.03).xls', 'SSH-FR-2025-0003 Servis Raporu.pdf', 'DİKKAT: SSH-FR-2025-0003 kodu iki formda çakışıyor'),
('KDM.FRM.054', 'SSH-FR-2025-0003', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.054 Müşteri Çözüm Desteği Kayıt Formu.XLSX', 'SSH-FR-2025-0003 Müşteri Çözüm Desteği Kayıt Formu.pdf', 'DİKKAT: SSH-FR-2025-0003 kodu iki formda çakışıyor'),
('KDM.FRM.058', 'SAT-FR-2025-0004', 'Satınalma Müdürlüğü/Formlar', '1-KDM.FRM.058 Yan Sanayi Ekipman Sipariş Formu.xls', 'SAT-FR-2025-0004 Yan Sanayi Ekipman Sipariş Formu.pdf', NULL),
('KDM.FRM.061', 'SSH-FR-2025-0006', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.061 Müşteri Görüşleri Soru Anketi.XLSX', 'SSH-FR-2025-0006 Müşteri Görüşleri Soru Anketi.pdf', NULL),
('KDM.FRM.068', 'DEP-FR-2025-0001', 'Depo Şefliği/Formlar', '1-KDM.FRM.068 Araç Bekletme Formu (Rev.01).docx', 'DEP-FR-2025-0001 Araç Bekletme Formu .pdf', NULL),
('KDM.FRM.075', 'KAL-FR-2025-0022', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.075 Boya Final Ölçüm Sonuçları Kayıt Formu (Rev.02).xlsx', 'KAL-FR-2025-0022 Boya Final Ölçüm Sonuçları Kayıt Formu.pdf', NULL),
('KDM.FRM.076', 'KAL-FR-2025-0023', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.076 Viskozite Takip Formu (Rev.01).xlsx', 'KAL-FR-2025-0023 Viskozite Takip Formu (Rev.01).pdf', NULL),
('KDM.FRM.083', 'KAL-FR-2025-0025', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.083 Hurda Tespit Tutanağı (Rev.03 ).xlsx', 'KAL-FR-2025-0025 Hurda Tespit Tutanağı.pdf', NULL),
('KDM.FRM.091', 'SSH-FR-2025-0009', 'Depo Şefliği/Formlar', '1-KDM.FRM.091 Araç Temizlik formu.xlsx', 'SSH-FR-2025-0009 Araç Temizlik formu.pdf', 'DİKKAT: SSH-FR-2025-0009 kodu iki formda çakışıyor'),
('KDM.FRM.100', 'KAL-FR-2025-0034', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.100 Sevk Onay Formu.xlsx', 'KAL-FR-2025-0034 Sevk Onay Formu.pdf', NULL),
('KDM.FRM.109', 'İDA-FR-2026-0009', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.109 Zimmet Tutanagı.xlsx', 'İDA-FR-2026-0009 Zimmet Tutanagı.pdf', NULL),
('KDM.FRM.110', 'KAL-FR-2025-0037', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.110 Damperli Kamyon Son Kontrol Formu.xlsx', 'KAL-FR-2025-0037 Damperli Kamyon Son Kontrol Formu.pdf', NULL),
('KDM.FRM.111', 'KAL-FR-2025-0038', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.111 Sepetli Platform Son Kontrol Formu.xlsx', 'KAL-FR-2025-0038 Sepetli Platform Son Kontrol Formu.pdf', NULL),
('KDM.FRM.112', 'SSH-FR-2025-0009', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.112 Teknik Servis Kontrol Formu.xlsx', 'SSH-FR-2025-0009 Teknik Servis Kontrol Formu.pdf', 'DİKKAT: SSH-FR-2025-0009 kodu iki formda çakışıyor'),
('KDM.FRM.113', 'SSH-FR-2025-0010', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.113 Teknik Servis Eğitim Formu.xlsx', 'SSH-FR-2025-0010 Teknik Servis Eğitim Formu.pdf', NULL),
('KDM.FRM.123', 'KAL-FR-2025-0044', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.123 Kombine Son Kontrol Formu.xlsx', 'KAL-FR-2025-0044 Kombine Son Kontrol Formu.pdf', NULL),
('KDM.FRM.124', 'KAL-FR-2025-0045', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.124 Çöp Sıkıştırma Son Kontrol Formu.xlsx', 'KAL-FR-2025-0045 Çöp Sıkıştırma Son Kontrol Formu.pdf', NULL),
('KDM.FRM.127', 'KAL-FR-2025-0048', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.127 Vidanjör Son Kontrol Formu.XLSX', 'KAL-FR-2025-0048 Vidanjör Son Kontrol Formu.pdf', NULL),
('KDM.FRM.128', 'KAL-FR-2025-0049', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.128 FTH240 Elektrikli Son Kontrol Formu.xlsx', 'KAL-FR-2025-0049 FTH240 Elektrikli Son Kontrol Formu.pdf', NULL),
('KDM.FRM.131', 'ÜRE-FR-2025-0015', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.131 Şasi Tadilat Kontrol Formu.xlsx', 'ÜRE-FR-2025-0015 Şasi Tadilat Kontrol Formu.pdf', NULL),
('KDM.FRM.133', 'İSG-FR-2025-0001', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.133 Rev_001 Kişisel Koruyucu Donanım Zimmet Formu.docx', 'İSG-FR-2025-0001 Kişisel Koruyucu Donanım Zimmet Formu.pdf', NULL),
('KDM.FRM.149', 'KAL-FR-2025-0055', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.149 Kompakt Elektrik Fonksiyonel Kontrol Formu (Rev.00).xlsx', 'KAL-FR-2025-0055 Kompakt Elektrik Fonksiyonel Kontrol Formu.pdf', NULL),
('KDM.FRM.158', 'KAL-FR-2025-0061', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.158 Cross Cut- Kaplama Kontrol Formu (Rev 01).xlsx', 'KAL-FR-2025-0061 Cross Cut- Kaplama Kontrol Formu .pdf', NULL),
('KDM.FRM.196', 'KAL-FR-2025-0086', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.196 Kabin Son Kontrol Formu.xlsx', 'KAL-FR-2025-0086 Kabin Son Kontrol Formu.pdf', NULL),
('KDM.FRM.222', 'MEK-FR-2025-0002', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.222 Çöp Montaj Takip Formu.xlsx', 'MEK-FR-2025-0002 Çöp Montaj Takip Formu.pdf', NULL),
('KDM.FRM.248', 'KAL-FR-2025-0103', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.248 Yeniden İşleme Formu.xlsx', 'KAL-FR-2025-0103 Yeniden İşleme Formu.pdf', NULL),
('KDM.FRM.249', 'KAL-FR-2025-0117', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.249 Kalite Etiketleri.xlsx', 'KAL-FR-2025-0117 Kalite Etiketleri.pdf', NULL),
('KDM.FRM.254', 'SAT-FR-2025-0009', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.254 Müşteri Talebi Değerlendirme Formu.XLSX', 'SAT-FR-2025-0009 Müşteri Talebi Değerlendirme Formu.pdf', NULL),
('KDM.FRM.257', 'SSH-FR-2025-0016', 'Satış Sonrası Hizmetler Müdürlüğü/Formlar', '1-KDM.FRM.257 Yedek Parça Sipariş Formu.xlsx', 'SSH-FR-2025-0016 Yedek Parça Sipariş Formu.pdf', NULL),
('KDM.FRM.260', 'ÜRE-FR-2025-0026', 'Üretim Planlama Müdürlüğü/Formlar', '1-KDM.FRM.260 İş Emri Formu.xlsx', 'ÜRE-FR-2025-0026 İş Emri Formu.pdf', NULL),
('KDM.FRM.261', 'ÜRE-FR-2025-0027', 'Üretim Planlama Müdürlüğü/Formlar', '1-KDM.FRM.261 Araç Kimlik Kartı Formu.xlsx', 'ÜRE-FR-2025-0027 Araç Kimlik Kartı Formu.pdf', NULL),
('KDM.FRM.263', 'İSG-FR-2025-0002', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.263 İSG Risk Analiz Formu.xlsx', 'İSG-FR-2025-0002 İSG Risk Analiz Formu.pdf', NULL),
('KDM.FRM.265', 'İSG-FR-2025-0003', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.265 İSG Tek Nokta Eğitim Katılım Formu.xlsx', 'İSG-FR-2025-0003 İSG Tek Nokta Eğitim Katılım Formu.pdf', NULL),
('KDM.FRM.267', 'İSG-FR-2025-0004', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.267 İSG Atama Tutanağı.xlsx', 'İSG-FR-2025-0004 İSG Atama Tutanağı.pdf', NULL),
('KDM.FRM.268', 'İSG-FR-2025-0005', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.268 İSG Eğitim Formu.xlsx', 'İSG-FR-2025-0005 İSG Eğitim Formu.pdf', NULL),
('KDM.FRM.276', 'MEK-FR-2025-0003', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.276 Makine Montaj Hattı Duruş Kayıt Formu.xlsx', 'MEK-FR-2025-0003 Makine Montaj Hattı Duruş Kayıt Formu.pdf', NULL),
('KDM.FRM.277', 'YUR-FR-2025-0006', 'Yurt İçi Satış Müdürlüğü/Formlar', '1-KDM.FRM.277 Yurtiçi Teklif Formu.xlsx', 'YUR-FR-2025-0006 Yurtiçi Teklif Formu.pdf', NULL),
('KDM.FRM.280', 'KAL-FR-2026-0026', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.280 Çay Toplama Elektrik Sistemi Fonksiyonel Kontrol Formu.xlsx', 'KAL-FR-2026-0026 Çay Toplama Elektrik Sistemi Fonksiyonel Kontrol Formu.pdf', NULL),
('KDM.FRM.281', 'KAY-FR-2025-0002', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.281 Kaynakhane Fikstür Formu.xlsx', 'KAY-FR-2025-0002 Kaynakhane Fikstür Formu.pdf', NULL),
('KDM.FRM.285', 'KAL-FR-2025-0115', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.285 Şanzıman Son Kontrol Formu.xlsx', 'KAL-FR-2025-0115 Şanzıman Son Kontrol Formu.pdf', NULL),
('KDM.FRM.299', 'İSG-FR-2025-0006', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.299 Su Sebili Form.xlsx', 'İSG-FR-2025-0006 Su Sebili Form.pdf', NULL),
('KDM.FRM.301', 'KAL-FR-2025-0116', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.301 HSCK Tedarikçi Son Kontrol Formu.docx', 'KAL-FR-2025-0116 HSCK Tedarikçi Son Kontrol Formu.pdf', NULL),
('KDM.FRM.305', 'İSG-FR-2025-0007', 'İdari İşler Müdürlüğü/Formlar', '1-KDM.FRM.305 İSG TALİMATI-FABRİKA-KADEME.doc', 'İSG-FR-2025-0007 İSG TALİMATI-FABRİKA-KADEME.pdf', NULL),
('KDM.FRM.309', 'ÜRE-FR-2025-0030', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.309 Üretim Takip Formu.xlsx', 'ÜRE-FR-2025-0030 Üretim Takip Formu.pdf', NULL),
('KDM.FRM.311', 'BOY-FR-2025-0004', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.311 Boya Öncesi Hazırlık Kontrol ve Kayıt Formu.xlsx', 'BOY-FR-2025-0004 Boya Öncesi Hazırlık Kontrol ve Kayıt Formu.pdf', NULL),
('KDM.FRM.313', 'BAK-FR-2025-0010', 'Üretim Müdürlüğü (Üst Yapı)/Formlar', '1-KDM.FRM.313 Boyahane Fırın 3 Aylık Dış Bakım Kontrol Formu.xlsx', 'BAK-FR-2025-0010 Boyahane Fırın 3 Aylık Dış Bakım Kontrol Formu.pdf', NULL),
('KDM.FRM.315', 'KAL-FR-2025-0043', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.315 Vakumlu Son Kontrol.xlsx', 'KAL-FR-2025-0043 Vakumlu Son Kontrol.pdf', NULL),
('KDM.FRM.316', 'KAL-FR-2026-0018', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.316 Kompakt Son Kontrol Formu AGA2100.xlsx', 'KAL-FR-2026-0018 Kompakt Son Kontrol Formu AGA2100.pdf', NULL),
('KDM.FRM.323', 'KAL-FR-2026-0029', 'Kalite Müdürlüğü/Formlar', '1-KDM.FRM.323 Kompakt Son Kontrol Formu AGA6000.xlsx', 'KAL-FR-2026-0029 Kompakt Son Kontrol Formu AGA6000.pdf', NULL),
('KDM.KEK.001', 'KAL-EK-2025-0001', 'Kalite Müdürlüğü/El Kitapları', '1-KDM.KEK.001 Kalite El Kitabı (Rev.00).docx', 'KAL-EK-2025-0001 Kalite El Kitabı (Rev.01).pdf', NULL),
('KDM.LST.022', 'KAL-LS-2025-0016', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.022 Paslanmaz Çelik Kaynak Parametreleri Listesi (Rev.00).xlsx', 'KAL-LS-2025-0016 Paslanmaz Çelik Kaynak Parametreleri Listesi.pdf', NULL),
('KDM.LST.024', 'KAL-LS-2025-0018', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.024 Siyah Çelik MIG-MAG Kaynak Parametreleri Listesi (Rev.00).xlsx', 'KAL-LS-2025-0018 Siyah Çelik MIG-MAG Kaynak Parametreleri Listesi.pdf', NULL),
('KDM.LST.031', 'KAL-LS-2025-0024', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.031 Vakumlu Yol Süpürge Aracı Şasi Tadilatı Takip Listesi.xlsx', 'KAL-LS-2025-0024 Vakumlu Yol Süpürge Aracı Şasi Tadilatı Takip Listesi.pdf', NULL),
('KDM.LST.064', 'ÜRE-LS-2026-0001', 'Üretim Planlama Müdürlüğü/Listeler', '1-KDM.LST.064 İş Emri-Malzeme Çekme Listesi.xlsx', 'ÜRE-LS-2026-0001 İş Emri-Malzeme Çekme Listesi.pdf', NULL),
('KDM.LST.07', 'KAL-LS-2025-0005', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.07 Makine-Teçhizat Listesi.xlsx', 'KAL-LS-2025-0005 Makine-Teçhizat Listesi.pdf', NULL),
('KDM.LST.09', 'KAL-LS-2025-0006', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.09 Kaliteyi Dogrudan Etkileyen Malzemeler Listesi.xlsx', 'KAL-LS-2025-0006 Kaliteyi Dogrudan Etkileyen Malzemeler Listesi.pdf', NULL),
('KDM.LST.20', 'KAL-LS-2025-0014', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.20 Yurt İçi Araç Teslim Evrak Listesi.xlsx', 'KAL-LS-2025-0014 Yurt İçi Araç Teslim Evrak Listesi.pdf', NULL),
('KDM.LST.29', 'KAL-LS-2025-0023', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.29 FMEA Kritik Hata Kodları Listesi.xlsx', 'KAL-LS-2025-0023 FMEA Kritik Hata Kodları Listesi.pdf', NULL),
('KDM.LST.48', 'KAL-LS-2025-0035', 'Kalite Müdürlüğü/Listeler', '1-KDM.LST.48 Kişisel Koruyucu Donanım Listesi.xlsx', 'KAL-LS-2025-0035 Kişisel Koruyucu Donanım Listesi.pdf', NULL),
('KDM.PRS.010', 'ÜRE-PR-2026-0006', 'Üretim Müdürlüğü (Üst Yapı)/Prosedürler', '1-KDM.PRS.010 Boya Ölçüm Prosedürü (Rev. 02).docx', 'ÜRE-PR-2026-0006 Boya Ölçüm Prosedürü.pdf', 'KAL.PR.2025.0010 ile kapsam çakışması var'),
('KDM.SÖZ.001', 'SAT-SZ-2025-0001', 'Satınalma Müdürlüğü/Sözleşmeler', '1-KDM.SÖZ.001 Genel Satınalma Sözleşmesi (Rev.00).docx', 'SAT.SZ.2025.0001 Genel Satın Alma Sözleşmesi.pdf', NULL),
('KDM.TL.071', 'DEP-TL-2025-0002', 'Depo Şefliği/Talimatlar', '1-KDM-TL-071 Araç Teslim Etme Talimatı.docx', 'DEP-TL-2025-0002 Araç Teslim Etme Talimatı.pdf', NULL),
('KDM.TL.073', 'DEP-TL-2025-0004', 'Depo Şefliği/Talimatlar', '1-KDM-TL-073 Mal Kabul Talimatı.docx', 'DEP-TL-2025-0004 Mal Kabul Talimatı.pdf', NULL),
('KDM.TL.096', 'ÜRE-TL-2025-0009', 'Üretim Planlama Müdürlüğü/Talimatlar', '1-KDM-TL-096 Depoya Malzeme Giriş ve Çıkış Talimatı.docx', 'ÜRE-TL-2025-0009 Depoya Malzeme Giriş ve Çıkış Talimatı.pdf', NULL),
('KDM.TL.113', 'KAL-TL-2026-0016', 'Kalite Müdürlüğü/Talimatlar', '1-KDM-TL-113 Tedarikçi Denetim Talimatı.docx', 'KAL-TL-2026-0016 Tedarikçi Denetim Talimatı.pdf', NULL),
('KDM.ŞRT.005', 'BOY-ST-2026-0001', 'Üretim Müdürlüğü (Üst Yapı)/Şartnameler', '1-KDM.ŞRT.005 Toz Boya Şartnamesi (Rev.01).doc', 'BOY-ST-2026-0001 Toz Boya Şartnamesi.pdf', NULL),
('KDM-TL-071', 'DEP-TL-2025-0002', 'Depo Şefliği/Talimatlar', NULL, NULL, 'Kaynak adından eşlendi'),
('KDM-TL-073', 'DEP-TL-2025-0004', 'Depo Şefliği/Talimatlar', NULL, NULL, 'Kaynak adından eşlendi'),
('KDM-TL-074', 'DEP-TL-2025-0005', 'Depo Şefliği/Talimatlar', NULL, NULL, 'Antetten eşlendi (dosya adı hâlâ eski)'),
('KDM-TL-075', 'YUR-TL-2025-0001', 'Yurt Dışı Satış Müdürlüğü/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-079', 'KAL-TL-2025-0025', 'SSH/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-083', 'AR-TL-2025-0004', 'Ar-Ge Direktörlüğü/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-087', 'KAL-TL-2025-0026', 'Kalite Müdürlüğü/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-093', 'SSH-TL-2025-0002', 'SSH/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-095', 'KAL-TL-2025-0028', 'Kalite Müdürlüğü/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-020', 'ÜRE-TL-2026-0028', 'Üretim Müdürlüğü/Talimatlar', NULL, NULL, 'DİKKAT: kod ''Kaynaklı Operasyon Talimatı'' ile çakışıyor'),
('KDM-TL-033', 'KAY-TL-2025-0003', 'Üretim Müdürlüğü/Talimatlar', NULL, NULL, 'Antetten eşlendi'),
('KDM-TL-096', 'ÜRE-TL-2026-0029', 'Üretim Müdürlüğü/Talimatlar', NULL, NULL, 'DİKKAT: eski kod iki talimatta kullanılmış'),
('KDM-TL-112', 'KAL-TL-2025-0033', 'Kalite Müdürlüğü/Talimatlar', NULL, NULL, 'Dosya adından eşlendi (antet hâlâ eski)'),
('KDM.ŞRT.006', 'BOY-ST-2026-0002', 'Üretim Müdürlüğü/Şartnameler', NULL, NULL, 'Antetten eşlendi'),
('KDM.LST.023', 'KAL-LS-2025-0017', 'Kalite Müdürlüğü/Listeler', NULL, NULL, 'Antetten eşlendi')
ON CONFLICT (old_code) DO UPDATE SET
  new_code = EXCLUDED.new_code,
  folder = EXCLUDED.folder,
  old_source_file = EXCLUDED.old_source_file,
  new_pdf = EXCLUDED.new_pdf,
  notes = EXCLUDED.notes,
  updated_at = now();

-- A013: Yıl ilk yayın yılı; sıra numarası bölüm+tip için yıldan bağımsız tek sayaç
CREATE OR REPLACE FUNCTION public.generate_document_number(
    p_department_id uuid,
    p_document_type text,
    p_document_subcategory text DEFAULT NULL::text
)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_dept_code VARCHAR(10);
    v_type_code VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_doc_number VARCHAR(100);
    v_prefix_pattern VARCHAR(50);
    v_attempt INTEGER := 0;
BEGIN
    SELECT COALESCE(
        unit_code,
        UPPER(REPLACE(REPLACE(REPLACE(REPLACE(SUBSTRING(unit_name, 1, 3), '-', ''), ' ', ''), 'ğ', 'G'), 'Ğ', 'G'))
    ) INTO v_dept_code
    FROM cost_settings
    WHERE id = p_department_id;

    IF v_dept_code IS NULL OR v_dept_code = '' THEN
        v_dept_code := 'GEN';
    END IF;

    CASE p_document_type
        WHEN 'Prosedürler' THEN v_type_code := 'PR';
        WHEN 'Talimatlar' THEN v_type_code := 'TL';
        WHEN 'Formlar' THEN v_type_code := 'FR';
        WHEN 'Kalite Sertifikaları' THEN v_type_code := 'KS';
        WHEN 'Personel Sertifikaları' THEN v_type_code := 'PS';
        WHEN 'El Kitapları' THEN v_type_code := 'EK';
        WHEN 'Şemalar' THEN v_type_code := 'SM';
        WHEN 'Görev Tanımları' THEN v_type_code := 'GT';
        WHEN 'Süreçler' THEN v_type_code := 'SC';
        WHEN 'Planlar' THEN v_type_code := 'PL';
        WHEN 'Listeler' THEN v_type_code := 'LS';
        WHEN 'Şartnameler' THEN v_type_code := 'ST';
        WHEN 'Politikalar' THEN v_type_code := 'PO';
        WHEN 'Tablolar' THEN v_type_code := 'TB';
        WHEN 'Antetler' THEN v_type_code := 'AT';
        WHEN 'Sözleşmeler' THEN v_type_code := 'SZ';
        WHEN 'Yönetmelikler' THEN v_type_code := 'YT';
        WHEN 'Kontrol Planları' THEN v_type_code := 'KP';
        WHEN 'FMEA Planları' THEN v_type_code := 'FP';
        WHEN 'Proses Kontrol Kartları' THEN v_type_code := 'PK';
        WHEN 'Görsel Yardımcılar' THEN v_type_code := 'GY';
        ELSE v_type_code := 'DG';
    END CASE;

    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_prefix_pattern := '^' || v_dept_code || '-' || v_type_code || '-[0-9]{4}-[0-9]{4}$';

    SELECT COALESCE(MAX(CAST(SUBSTRING(document_number FROM '([0-9]{4})$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM documents
    WHERE document_number ~ v_prefix_pattern;

    LOOP
        v_attempt := v_attempt + 1;
        v_doc_number := v_dept_code || '-' || v_type_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
        IF NOT EXISTS (SELECT 1 FROM documents WHERE document_number = v_doc_number) THEN
            RETURN v_doc_number;
        END IF;
        v_sequence := v_sequence + 1;
        IF v_attempt > 500 THEN
            RAISE EXCEPTION 'Doküman numarası üretilemedi: %', v_doc_number;
        END IF;
    END LOOP;
END;
$function$;

CREATE OR REPLACE VIEW public.document_number_conflicts AS
SELECT
  document_number,
  COUNT(*)::int AS conflict_count,
  array_agg(id ORDER BY created_at) AS document_ids,
  array_agg(title ORDER BY created_at) AS titles
FROM documents
WHERE document_number IS NOT NULL AND btrim(document_number) <> ''
GROUP BY document_number
HAVING COUNT(*) > 1;

COMMENT ON VIEW public.document_number_conflicts IS 'Aynı doküman numarasını paylaşan kayıtlar (KYS kod çakışması tespiti)';
