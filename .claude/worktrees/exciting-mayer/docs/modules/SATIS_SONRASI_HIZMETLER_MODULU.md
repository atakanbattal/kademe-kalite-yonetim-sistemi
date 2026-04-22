# Satış Sonrası Hizmetler Modülü

## Amaç

Bu modül, mevcut müşteri şikayet yapısını genişleterek servis, garanti, teknik destek, yedek parça, dokümantasyon ve müşteri geri bildirimlerini tek merkezde yönetmek için tasarlanmıştır.

## Ana Kurgusu

- Ana kayıt tipi: `Satış Sonrası Vaka`
- Vaka tipleri: müşteri şikayeti, servis talebi, garanti talebi, teknik destek, yedek parça talebi, bakım talebi, saha servisi, revizyon takibi
- Her vaka üzerinde araç, müşteri, servis lokasyonu, garanti, doküman uygunluğu, yedek parça, kök neden, tekrar sayısı ve anket bilgileri tutulur
- Ayrı araç arşivi sekmesi ile araç kimlik dosyaları ve logbook taramaları seri no / şasi / müşteri bazında saklanır

## Denetim Maddeleri Eşleştirmesi

### 5.1 Satış Sonrası Organizasyon

- `service_location_type`, `service_country`, `service_city`, `service_partner_name`
- Yurt içi / yurt dışı servis kayıtları analitiklerde ayrıştırılır
- `spare_part_required`, `spare_part_status`, `spare_part_eta_days`, `spare_part_shipped_by_company`

### 5.2 Help Desk ve Telefon Desteği

- `helpdesk_supported`
- `conversation_recorded`
- İletişim geçmişi sekmesi ile tüm temaslar kayıt altına alınır

### 5.3 Kullanıcı Kitapçığı ve Kataloglar

- `user_manual_available`
- `maintenance_catalog_available`
- `spare_parts_catalog_available`
- `multilingual_docs_available`
- `documents_archived_by_work_order`
- Araç arşivi sekmesi ile dosyalar şasi/seri bazında saklanır

### 5.4 Garanti Yönetimi

- `warranty_status`
- `warranty_start_date`, `warranty_end_date`
- `warranty_document_no`
- `warranty_terms_explained`
- `out_of_warranty_explained`

### 5.5 Problem, Top 10 ve Garanti Analizi

- Analiz ekranında:
  - top problem frekansı
  - top problem maliyeti
  - vaka tipine göre çözüm süreleri
  - garanti dağılımı
  - müşteri yoğunluğu

### 5.6 Kök Neden Metotları

- `root_cause_methodology`
- Analiz sekmesinde 5N1K, 5 Neden, Ishikawa kayıtları

### 5.7 Revizyonların Sonraki Tasarımda Kullanımı

- `design_revision_applied`
- `design_revision_reference`

### 5.8 ve 5.9 Memnuniyet Anketleri ve İyileştirme

- `survey_sent`
- `survey_score`
- `survey_notes`
- Analitikte anket gönderim ve ortalama skor izlenir

### 5.10 Web / Portal Kullanımı

- Bu madde uygulama dışı kurumsal sistem gerektirir; modül içinde vaka kaynak kanalı ve portal kaydı izlenebilir

## Araç Dosya Arşivi

Yeni tablo: `after_sales_vehicle_files`

Saklanan ana alanlar:

- müşteri
- ilişkili vaka
- araç seri no
- şasi no
- plaka
- araç modeli
- teslim tarihi
- doküman tipi
- revizyon no
- dosya yolu

Desteklenen doküman tipleri:

- Araç Kimlik Dosyası
- Logbook
- Garanti Belgesi
- Kullanıcı Kitapçığı
- Bakım Kataloğu
- Yedek Parça Kataloğu
- Servis Raporu

## Teknik Not

Veritabanı genişletmesi için migration dosyası:

- `supabase/migrations/20260313130000_expand_customer_complaints_to_after_sales.sql`
