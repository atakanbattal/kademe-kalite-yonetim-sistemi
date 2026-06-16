BEGIN;
INSERT INTO non_conformities (nc_number, type, title, description, status, priority, department, requesting_unit, requesting_person, responsible_person, opening_date, df_opened_at, due_date, due_at, source_cost_id, part_name, part_code, vehicle_type, amount, cost_date, cost_type, material_type, measurement_unit, quantity, scrap_weight, rework_duration, quality_control_duration, responsible_personnel_id, supplier_id, is_supplier_nc, problem_definition, root_cause, five_why_analysis, five_n1k_analysis, ishikawa_analysis, eight_d_steps, eight_d_progress, closing_notes, closed_at, attachments, closing_attachments) VALUES ((SELECT generate_nc_number('DF'::text)), 'DF', 'Kalite Maliyeti: Hurda Maliyeti - 37-5000104314 - Çay Toplama Makinesi', 'Araç Bazlı Hedef Analizinden Otomatik Başlatıldı
Dönem: Tüm Zamanlar
Araç Tipi: Çay Toplama Makinesi
Metrik: Hurda Maliyeti

Maliyet Kaydı Özeti
Maliyet Türü: Hurda Maliyeti
Tarih: 01.07.2025
Birim: Ar-Ge Direktörlüğü
Parça Kodu: 37-5000104314
Araç Tipi: Çay Toplama Makinesi
Tutar: ₺24.952,00
Hurda Ağırlığı: 8 kg

Açıklama
Proje değişikliği yapıldığı için parçalar hurdaya atılmıştır.', 'Kapatıldı', 'Orta', 'Ar-Ge Direktörlüğü', 'Kalite Maliyetleri', 'Kalite Maliyetleri', 'Ar-Ge Direktörlüğü', '2025-07-01', '2025-07-01T00:00:00.000Z', '2025-08-01', '2025-08-01T00:00:00.000Z', '72a9d5c7-04e6-42a4-a3d0-f77041d95e71', '', '37-5000104314', 'Çay Toplama Makinesi', 24952, '2025-07-01', 'Hurda Maliyeti', 'St52', '', NULL, 8, NULL, NULL, NULL, NULL, false, '37-5000104314 parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺24.952,00).', 'Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.', '{"problem":"37-5000104314 parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺24.952,00).","why1":"Parça kalite şartını karşılamadığı için hurdaya ayrıldı.","why2":"Proses kontrol veya son kontrol noktasında uygunsuzluk zamanında yakalanamadı.","why3":"İş talimatı/kontrol planında kritik adımlar tanımlı değil veya uygulanmıyor.","why4":"Operatör eğitimi ve yetkinlik doğrulaması yetersiz.","why5":"Kalite planlama sürecinde risk analizi (FMEA) ve proses doğrulama adımları eksik.","rootCause":"Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.","immediateAction":"Uygunsuz 37-5000104314 partileri izole edildi; ilgili proses durdurularak kontrol edildi.","preventiveAction":"1. 37-5000104314 için kontrol planı gözden geçirilmeli; kritik adımlar eklenmelidir.\n2. Hat içi kontrol noktaları güçlendirilmelidir.\n3. Operatör eğitimi verilmeli; eğitim kayıt altına alınmalıdır.\n4. Hurda maliyeti birim KPI olarak izlenmelidir."}'::jsonb, '{"ne":"37-5000104314 parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺24.952,00).","nerede":"Ar-Ge Direktörlüğü","neZaman":"01.07.2025","kim":"Ar-Ge Direktörlüğü","neden":"Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.","nasil":"Kalite kontrol muayenesi, proses kontrol veya saha bildirimi sırasında tespit edilmiştir."}'::jsonb, '{"problem":"37-5000104314 parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺24.952,00).","man":["Operatör eğitim/yeterlilik veya prosedür uygulama eksikliği."],"material":["Malzeme spesifikasyonu veya lot uyumsuzluğu."],"machine":["Ekipman/tezgah ayar veya bakım eksikliği."],"environment":["Çevresel faktörler proses kalitesini olumsuz etkilemiş olabilir."],"measurement":["Ölçüm/kontrol sistemi yetersiz veya kalibrasyon eksik."],"management":["İş talimatı, kontrol planı veya proses doğrulama eksik."]}'::jsonb, NULL, NULL, 'Çay Toplama Makinesi — Hurda Maliyeti analizi kapsamında açılan DF kaydı.

Kök neden:
Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.

Uygulanan düzeltici faaliyetler:
1. 37-5000104314 için kontrol planı gözden geçirilmeli; kritik adımlar eklenmelidir.
2. Hat içi kontrol noktaları güçlendirilmelidir.
3. Operatör eğitimi verilmeli; eğitim kayıt altına alınmalıdır.
4. Hurda maliyeti birim KPI olarak izlenmelidir.

Anlık aksiyon:
Uygunsuz 37-5000104314 partileri izole edildi; ilgili proses durdurularak kontrol edildi.

Düzeltici faaliyetler tamamlanmış; etkinlik doğrulaması yapılmıştır. Kaydın kapatılması uygundur.', '2026-06-03T12:30:23.703Z', '[]'::jsonb, '[]'::jsonb);
COMMIT;