# 📚 Profesyonel QDMS (Quality Document Management System) Sistemi

## 🎯 Genel Bakış

Bu sistem, profesyonel bir doküman yönetim sistemi (QDMS) sağlar. Tüm dokümanlar birim bazında organize edilir, revizyonlar takip edilir ve tedarikçi dokümanları ayrı bir modülde yönetilir.

## ✨ Özellikler

### 1. Birim Bazlı Doküman Organizasyonu
- Her birim kendi dokümanlarını görüntüleyebilir
- Birim bazlı filtreleme ve arama
- Birim bazlı doküman istatistikleri
- Birim bazlı doküman ekleme

### 2. Revizyon Takip Sistemi
- Detaylı revizyon geçmişi
- Revizyon numarası takibi
- Revizyon nedeni ve değişiklik özeti
- Onay süreci takibi
- Yürürlük tarihi ve yürürlükten kalkma tarihi

### 3. Tedarikçi Dokümanları Yönetimi
- Tedarikçi bazlı doküman organizasyonu
- Tedarikçi doküman kategorileri (Kalite Sertifikası, Test Raporu, vb.)
- Geçerlilik tarihi takibi
- Tedarikçi doküman validasyonu

### 4. Profesyonel Özellikler
- Dashboard ile genel bakış
- Grid ve liste görünüm modları
- Gelişmiş arama (başlık, numara, anahtar kelime, etiket)
- Doküman sınıflandırması (Genel, İç Kullanım, Gizli, Çok Gizli)
- Otomatik doküman numarası oluşturma
- Revizyon sıklığı takibi
- Sonraki revizyon tarihi hesaplama
- Süresi yaklaşan dokümanlar uyarısı

## 📋 Veritabanı Şeması

### Yeni Kolonlar (documents tablosu)
- `department_id` - Birim ID
- `supplier_id` - Tedarikçi ID (tedarikçi dokümanları için)
- `document_category` - Doküman kategorisi (İç Doküman, Tedarikçi Dokümanı, vb.)
- `document_subcategory` - Alt kategori
- `document_number` - Otomatik oluşturulan doküman numarası
- `classification` - Sınıflandırma (Gizli, İç Kullanım, vb.)
- `keywords` - Anahtar kelimeler (array)
- `tags` - Etiketler (array)
- `approval_status` - Onay durumu
- `approval_required` - Onay gerektirir mi?
- `is_active` - Aktif mi?
- `is_archived` - Arşivlenmiş mi?
- `review_frequency_months` - Revizyon sıklığı (ay)
- `next_review_date` - Sonraki revizyon tarihi
- `owner_id` - Doküman sahibi

### Yeni Tablolar
- `document_approvals` - Doküman onay akışı
- `document_access_logs` - Erişim logları
- `document_comments` - Doküman yorumları
- `document_notifications` - Bildirimler
- `supplier_documents` - Tedarikçi dokümanları

### Yeni View'lar
- `documents_by_department` - Birim bazlı görünüm
- `supplier_documents_view` - Tedarikçi dokümanları görünümü
- `document_revision_history` - Revizyon geçmişi görünümü
- `documents_expiring_soon` - Süresi yaklaşan dokümanlar

## 🚀 Kurulum

### 1. Veritabanı Migration
```sql
-- Supabase SQL Editor'de çalıştırın
-- scripts/create-professional-qdms-system.sql
```

### 2. Bileşenler
Tüm bileşenler `src/components/document/` klasöründe:
- `DocumentModule.jsx` - Ana modül
- `DocumentDashboard.jsx` - Dashboard görünümü
- `DepartmentDocumentsView.jsx` - Birim bazlı görünüm
- `SupplierDocumentsView.jsx` - Tedarikçi dokümanları görünümü
- `RevisionHistoryModal.jsx` - Revizyon geçmişi modalı
- `UploadDocumentModal.jsx` - Geliştirilmiş yükleme modalı

## 📖 Kullanım

### Birim Bazlı Doküman Görüntüleme
1. "Birim Bazlı" tab'ına geçin
2. Birim seçin veya "Tüm Birimler" görünümünde kalın
3. Kategori ve arama filtrelerini kullanın

### Revizyon Geçmişi Görüntüleme
1. Herhangi bir dokümanın "Revizyon Geçmişi" butonuna tıklayın
2. Tüm revizyonları görüntüleyin
3. Her revizyonu görüntüleyin veya indirin

### Tedarikçi Dokümanları
1. "Tedarikçi Dokümanları" tab'ına geçin
2. Tedarikçi seçin
3. Kategori ve arama filtrelerini kullanın

### Yeni Doküman Ekleme
1. "Yeni Doküman" butonuna tıklayın
2. Genel Bilgiler, Detaylar ve Revizyon tab'larını doldurun
3. Dosya yükleyin
4. Kaydedin

## 🔧 Teknik Detaylar

### Dosya Adı Normalizasyonu
- Türkçe karakterler ASCII'ye çevriliyor
- Özel karakterler temizleniyor
- Güvenli dosya yolu oluşturuluyor

### Otomatik Doküman Numarası
Format: `{BIRIM_KODU}-{TIP_KODU}-{ALT_KATEGORI}-{YIL}-{SIRA}`
Örnek: `URE-PR-KK-2024-0001`

### Revizyon Takibi
- Her revizyon ayrı bir kayıt olarak saklanır
- Revizyon geçmişi tam olarak korunur
- Onay süreçleri takip edilir

## 📊 Dashboard Özellikleri

- Toplam doküman sayısı
- Onay bekleyen dokümanlar
- Süresi yaklaşan dokümanlar
- Birim bazlı dağılım
- Kategori bazlı dağılım
- Durum bazlı dağılım

## 🔐 Güvenlik

- RLS politikaları aktif
- Erişim logları tutuluyor
- Doküman sınıflandırması
- Onay süreçleri

## 📝 Notlar

- Tüm dokümanlar `documents` storage bucket'ında saklanır
- Doküman numaraları otomatik oluşturulur
- Revizyon sıklığı ayarlanabilir
- Sonraki revizyon tarihi otomatik hesaplanır

