# 📄 Tedarikçi Doküman Yönetimi Modülü

## ✅ Tamamlandı!

Supplier Quality modülüne profesyonel bir **Dokümanlar** sekmesi eklendi.

## 🎯 Özellikler

### 📋 Doküman Yönetimi
- ✅ Tedarikçi bazlı doküman yükleme
- ✅ Çoklu dosya desteği
- ✅ 11 farklı doküman tipi:
  - Aksiyon Planı
  - Kalite Belgesi
  - Test Raporu
  - Denetim Raporu
  - 8D Raporu
  - İyileştirme Planı
  - Görsel
  - Video
  - Email
  - Sertifika
  - Diğer

### 🔍 Gelişmiş Özellikler
- ✅ Arama (doküman adı, açıklama, etiketler)
- ✅ Filtreleme (tip, durum)
- ✅ Etiket sistemi
- ✅ Geçerlilik tarihi takibi
- ✅ İlgili kayıtlar (NC, Denetim) bağlantısı
- ✅ Görüntüleme, indirme, silme
- ✅ Dosya boyutu gösterimi
- ✅ Yükleme tarihi

### 📊 Doküman Bilgileri
- Doküman adı
- Doküman tipi
- Açıklama
- Geçerlilik tarihi
- Etiketler
- İlgili NC kaydı
- İlgili Denetim kaydı
- Durum (Aktif, Arşiv, İptal)
- Dosya boyutu
- Yükleme tarihi

## 🚀 Kurulum

### 1. Veritabanı Migration

Supabase Dashboard'da SQL Editor'ü açın ve şu dosyayı çalıştırın:
```
scripts/create-supplier-documents-complete.sql
```

**Adımlar:**
1. https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql adresine gidin
2. SQL Editor'ü açın
3. `scripts/create-supplier-documents-complete.sql` dosyasının içeriğini yapıştırın
4. Run butonuna tıklayın

### 2. Storage Bucket Oluşturma

Supabase Dashboard'da Storage bucket oluşturun:

1. **Storage** → **Create Bucket**
2. **Bucket name:** `supplier_documents`
3. **Public:** `false` (sadece authenticated users)
4. **File size limit:** `50 MB`
5. **Allowed MIME types:**
   - `image/*`
   - `video/*`
   - `application/pdf`
   - `application/msword`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - `application/vnd.ms-excel`
   - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
   - `application/vnd.ms-powerpoint`
   - `application/vnd.openxmlformats-officedocument.presentationml.presentation`
   - `text/*`
   - `application/json`

### 3. Storage Policies

Bucket oluşturulduktan sonra, `create-supplier-documents-complete.sql` dosyasındaki Storage Policies kısmını çalıştırın.

## 📖 Kullanım

### Doküman Yükleme

1. **Supplier Quality** modülüne gidin
2. **Dokümanlar** sekmesine tıklayın
3. Bir **tedarikçi seçin**
4. **Dosya Yükle** butonuna tıklayın
5. Formu doldurun:
   - Doküman Tipi (zorunlu)
   - Dosya Seç (zorunlu)
   - Açıklama (opsiyonel)
   - Geçerlilik Tarihi (opsiyonel)
   - Etiketler (opsiyonel, virgülle ayırın)
   - İlgili NC (opsiyonel)
   - İlgili Denetim (opsiyonel)
6. **Yükle** butonuna tıklayın

### Doküman Yönetimi

- **Görüntüle:** Dokümanı yeni sekmede aç
- **İndir:** Dokümanı bilgisayara indir
- **Sil:** Dokümanı kalıcı olarak sil (onay gerekir)

### Arama ve Filtreleme

- **Arama:** Doküman adı, açıklama veya etiketlerde arama
- **Tip Filtresi:** Doküman tipine göre filtrele
- **Durum Filtresi:** Aktif, Arşiv, İptal durumuna göre filtrele

## 🗂️ Dosya Yapısı

```
src/components/supplier/
  ├── SupplierDocumentsTab.jsx      # Ana doküman yönetim bileşeni
  └── SupplierQualityModule.jsx     # Modül (güncellendi)

scripts/
  ├── create-supplier-documents-complete.sql    # Tam migration SQL
  ├── create-supplier-documents-table.sql       # Tablo oluşturma
  └── create-supplier-documents-storage.sql     # Storage policies
```

## 📊 Veritabanı Yapısı

### Tablo: `supplier_documents`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| supplier_id | UUID | Tedarikçi ID (FK) |
| document_type | VARCHAR(100) | Doküman tipi |
| document_name | VARCHAR(500) | Dosya adı |
| document_description | TEXT | Açıklama |
| file_path | TEXT | Storage yolu |
| file_type | VARCHAR(50) | Dosya uzantısı |
| file_size | BIGINT | Dosya boyutu (bytes) |
| uploaded_by | UUID | Yükleyen kullanıcı |
| uploaded_at | TIMESTAMP | Yükleme tarihi |
| expiry_date | DATE | Geçerlilik tarihi |
| status | VARCHAR(50) | Durum (Aktif, Arşiv, İptal) |
| tags | TEXT[] | Etiketler |
| related_nc_id | UUID | İlgili NC kaydı |
| related_audit_id | UUID | İlgili denetim kaydı |
| metadata | JSONB | Ek bilgiler |

## 🔒 Güvenlik

- ✅ RLS (Row Level Security) aktif
- ✅ Authenticated users: Tüm işlemler
- ✅ Storage policies: Güvenli dosya erişimi
- ✅ Dosya sanitizasyonu: Türkçe karakter ve özel karakter desteği

## 🎨 UI/UX Özellikleri

- ✅ Modern kart tasarımı
- ✅ Responsive grid layout
- ✅ Dosya tipine göre renkli ikonlar
- ✅ Badge'ler ile durum gösterimi
- ✅ Hover efektleri
- ✅ Loading states
- ✅ Toast bildirimleri

## 📝 Notlar

- Dosya boyutu limiti: 50 MB
- Desteklenen formatlar: Resim, Video, PDF, Office belgeleri, Metin dosyaları
- Dosya adları otomatik sanitize edilir (Türkçe karakter desteği)
- İlgili kayıtlar (NC, Denetim) otomatik filtrelenir (seçili tedarikçiye göre)

## ✅ Test Edilmesi Gerekenler

1. ✅ Doküman yükleme
2. ✅ Doküman görüntüleme
3. ✅ Doküman indirme
4. ✅ Doküman silme
5. ✅ Arama ve filtreleme
6. ✅ Etiket sistemi
7. ✅ İlgili kayıt bağlantıları
8. ✅ Geçerlilik tarihi takibi

## 🎉 Tamamlandı!

Modül hazır ve kullanıma uygun. Migration'ı çalıştırdıktan sonra kullanabilirsiniz!

