# Profesyonel QDMS (Quality Document Management System) Kurulum Kılavuzu

## Özet

Bu kılavuz, Kademe QMS uygulamasına profesyonel bir doküman yönetim sistemi (QDMS) eklemek için gerekli adımları içerir.

## Özellikler

✅ **Birim Bazlı Organizasyon**: Her birim kendi dokümanlarını yönetebilir
✅ **Klasör Yapısı**: Hiyerarşik klasör organizasyonu
✅ **Revizyon Takibi**: Detaylı revizyon geçmişi ve versiyon kontrolü
✅ **Tedarikçi Dokümanları**: Tedarikçilerden gelen dokümanları yönetme
✅ **Gelişmiş Arama**: Etiket, anahtar kelime ve filtreleme ile arama
✅ **Onay Süreçleri**: Doküman onay akışları
✅ **Erişim Logları**: Tüm erişimlerin kaydı
✅ **Mevcut Verileri Koruma**: Mevcut dokümanlar otomatik olarak yeni yapıya taşınır

## Kurulum Adımları

### 1. Supabase SQL Scriptini Çalıştırma

1. Supabase Dashboard'a giriş yapın: https://app.supabase.com
2. Projenizi seçin
3. Sol menüden **SQL Editor**'e tıklayın
4. **New Query** butonuna tıklayın
5. `scripts/create-professional-qdms-system.sql` dosyasının içeriğini kopyalayın
6. SQL Editor'e yapıştırın
7. **Run** butonuna tıklayın
8. Script başarıyla çalıştığında "Success" mesajını göreceksiniz

### 2. Storage Bucket Kontrolü

Storage bucket'ı zaten mevcut olmalı (`documents`). Eğer yoksa:

1. Supabase Dashboard'da **Storage** sekmesine gidin
2. **New bucket** butonuna tıklayın
3. Bucket adı: `documents`
4. **Public bucket** seçeneğini işaretleyin (opsiyonel, güvenlik gereksinimlerinize göre)
5. **Create bucket** butonuna tıklayın

### 3. Frontend Güncellemeleri

Frontend kodları zaten güncellenmiştir. Uygulamayı yeniden başlatmanız gerekebilir:

```bash
npm run dev
```

## Kullanım

### Klasör Oluşturma

1. Document modülüne gidin: `/document`
2. Sol tarafta **"Yeni Klasör"** butonuna tıklayın
3. Klasör adını girin
4. İsterseniz üst klasör seçin
5. Kategori ve açıklama ekleyin
6. **Oluştur** butonuna tıklayın

### Doküman Yükleme

1. **"Yeni Doküman"** butonuna tıklayın
2. Doküman bilgilerini doldurun:
   - Doküman adı (zorunlu)
   - Kategori (zorunlu)
   - Birim seçimi
   - Klasör seçimi
   - Alt kategori, sınıflandırma, etiketler, anahtar kelimeler
3. PDF dosyasını yükleyin
4. Revizyon bilgilerini girin
5. **Kaydet** butonuna tıklayın

### Doküman Arama ve Filtreleme

1. Üst kısımdaki arama kutusuna doküman adı, numara veya içerik yazın
2. **"Gelişmiş Filtreler"** butonuna tıklayarak:
   - Birim filtresi
   - Doküman tipi
   - Onay durumu
   - Sınıflandırma
   - Etiketler ve anahtar kelimeler
   ile filtreleme yapabilirsiniz

### Revizyon Geçmişi

1. Bir dokümana tıklayın
2. **"Revizyon Geçmişi"** sekmesine gidin
3. Tüm revizyonları görüntüleyin
4. Her revizyonu görüntüleyebilir veya indirebilirsiniz

### Birim Bazlı Görünüm

1. Sol tarafta **"Birimler"** sekmesine tıklayın
2. Bir birim seçin
3. O birime ait tüm dokümanları görüntüleyin
4. Birim bazlı klasör yapısını kullanın

### Tedarikçi Dokümanları

1. Sol tarafta **"Tedarikçiler"** sekmesine tıklayın
2. Bir tedarikçi seçin
3. O tedarikçiye ait dokümanları görüntüleyin
4. Tedarikçi dokümanlarını klasörler halinde organize edin

## Veritabanı Yapısı

### Yeni Tablolar

- `document_folders`: Klasör yapısı
- `document_approvals`: Onay akışları
- `document_access_logs`: Erişim logları
- `document_comments`: Yorumlar
- `document_notifications`: Bildirimler
- `supplier_documents`: Tedarikçi dokümanları

### Genişletilmiş Tablolar

- `documents`: Yeni kolonlar eklendi (folder_id, department_id, keywords, tags, vb.)
- `document_revisions`: Revizyon durumu ve onay bilgileri eklendi

## Önemli Notlar

1. **Mevcut Veriler**: Mevcut dokümanlarınız otomatik olarak yeni yapıya taşınır
2. **Doküman Numaraları**: Otomatik olarak oluşturulur (örn: ÜRT-PR-2024-0001)
3. **Revizyon Takibi**: Her revizyon ayrı bir kayıt olarak saklanır
4. **Erişim Logları**: Tüm görüntüleme ve indirme işlemleri loglanır
5. **Onay Süreçleri**: Dokümanlar için onay akışları tanımlanabilir

## Sorun Giderme

### SQL Script Hataları

Eğer SQL scriptinde hata alırsanız:
1. Hata mesajını kontrol edin
2. Mevcut tabloların yapısını kontrol edin
3. Gerekirse scripti adım adım çalıştırın

### Klasörler Görünmüyor

1. `document_folders` tablosunun oluşturulduğundan emin olun
2. Browser console'da hata olup olmadığını kontrol edin
3. DataContext'in `documentFolders` verisini yüklediğinden emin olun

### Dokümanlar Yüklenmiyor

1. Storage bucket'ının (`documents`) mevcut olduğundan emin olun
2. RLS politikalarını kontrol edin
3. Browser console'da hata mesajlarını kontrol edin

## Destek

Sorun yaşarsanız veya özellik istekleriniz varsa, lütfen geliştirici ekibiyle iletişime geçin.

---

**Son Güncelleme**: 2024
**Versiyon**: 1.0.0

