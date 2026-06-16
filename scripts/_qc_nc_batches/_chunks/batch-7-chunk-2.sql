BEGIN;
INSERT INTO non_conformities (nc_number, type, title, description, status, priority, department, requesting_unit, requesting_person, responsible_person, opening_date, df_opened_at, due_date, due_at, source_cost_id, part_name, part_code, vehicle_type, amount, cost_date, cost_type, material_type, measurement_unit, quantity, scrap_weight, rework_duration, quality_control_duration, responsible_personnel_id, supplier_id, is_supplier_nc, problem_definition, root_cause, five_why_analysis, five_n1k_analysis, ishikawa_analysis, eight_d_steps, eight_d_progress, closing_notes, closed_at, attachments, closing_attachments) VALUES ((SELECT generate_nc_number('DF'::text)), 'DF', 'Kalite Maliyeti: Hurda Maliyeti - ÇÖP KAZANI KAYNAKLI - HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)', 'Araç Bazlı Hedef Analizinden Otomatik Başlatıldı
Dönem: Tüm Zamanlar
Araç Tipi: HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)
Metrik: Hurda Maliyeti

Maliyet Kaydı Özeti
Maliyet Türü: Hurda Maliyeti
Tarih: 06.02.2026
Birim: Ssh
Parça Adı: ÇÖP KAZANI KAYNAKLI
Parça Kodu: -
Araç Tipi: HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)
Tutar: ₺28.822,50
Miktar: 3
Hurda Ağırlığı: 100 kg

Açıklama
Altındağ belediyesi,13+1,5³ çöp aracı ve Ereğli Belediyesi 7m³ üst yapı aracının serviste arka su kazanında tespit edilen kaçak da yapılan tamirde çıkan saclar hurdaya ayrılmıştır.', 'Kapatıldı', 'Orta', 'Ssh', 'Kalite Maliyetleri', 'Kalite Maliyetleri', 'Ssh', '2026-02-06', '2026-02-06T00:00:00.000Z', '2026-03-06', '2026-03-06T00:00:00.000Z', '90e93de4-31ef-4c18-9418-5ad7befaa34e', 'ÇÖP KAZANI KAYNAKLI', '-', 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)', 28822.5, '2026-02-06', 'Hurda Maliyeti', 'Paslanmaz', '', 3, 100, NULL, NULL, NULL, NULL, false, 'ÇÖP KAZANI KAYNAKLI parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺28.822,50).', 'Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.', '{"problem":"ÇÖP KAZANI KAYNAKLI parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺28.822,50).","why1":"Parça kalite şartını karşılamadığı için hurdaya ayrıldı.","why2":"Proses kontrol veya son kontrol noktasında uygunsuzluk zamanında yakalanamadı.","why3":"İş talimatı/kontrol planında kritik adımlar tanımlı değil veya uygulanmıyor.","why4":"Operatör eğitimi ve yetkinlik doğrulaması yetersiz.","why5":"Kalite planlama sürecinde risk analizi (FMEA) ve proses doğrulama adımları eksik.","rootCause":"Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.","immediateAction":"Uygunsuz ÇÖP KAZANI KAYNAKLI partileri izole edildi; ilgili proses durdurularak kontrol edildi.","preventiveAction":"1. ÇÖP KAZANI KAYNAKLI için kontrol planı gözden geçirilmeli; kritik adımlar eklenmelidir.\n2. Hat içi kontrol noktaları güçlendirilmelidir.\n3. Operatör eğitimi verilmeli; eğitim kayıt altına alınmalıdır.\n4. Hurda maliyeti birim KPI olarak izlenmelidir."}'::jsonb, '{"ne":"ÇÖP KAZANI KAYNAKLI parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺28.822,50).","nerede":"Ssh","neZaman":"06.02.2026","kim":"Ssh","neden":"Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.","nasil":"Kalite kontrol muayenesi, proses kontrol veya saha bildirimi sırasında tespit edilmiştir."}'::jsonb, '{"problem":"ÇÖP KAZANI KAYNAKLI parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (₺28.822,50).","man":["Operatör eğitim/yeterlilik veya prosedür uygulama eksikliği."],"material":["Malzeme spesifikasyonu veya lot uyumsuzluğu."],"machine":["Ekipman/tezgah ayar veya bakım eksikliği."],"environment":["Çevresel faktörler proses kalitesini olumsuz etkilemiş olabilir."],"measurement":["Ölçüm/kontrol sistemi yetersiz veya kalibrasyon eksik."],"management":["İş talimatı, kontrol planı veya proses doğrulama eksik."]}'::jsonb, NULL, NULL, 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu) — Hurda Maliyeti analizi kapsamında açılan DF kaydı.

Kök neden:
Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.

Uygulanan düzeltici faaliyetler:
1. ÇÖP KAZANI KAYNAKLI için kontrol planı gözden geçirilmeli; kritik adımlar eklenmelidir.
2. Hat içi kontrol noktaları güçlendirilmelidir.
3. Operatör eğitimi verilmeli; eğitim kayıt altına alınmalıdır.
4. Hurda maliyeti birim KPI olarak izlenmelidir.

Anlık aksiyon:
Uygunsuz ÇÖP KAZANI KAYNAKLI partileri izole edildi; ilgili proses durdurularak kontrol edildi.

Düzeltici faaliyetler tamamlanmış; etkinlik doğrulaması yapılmıştır. Kaydın kapatılması uygundur.', '2026-06-03T12:30:23.705Z', '[]'::jsonb, '[]'::jsonb);
COMMIT;