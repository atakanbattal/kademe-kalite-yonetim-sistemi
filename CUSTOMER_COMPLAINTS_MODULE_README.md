# Müşteri Şikayetleri Yönetim Modülü

## 📋 Genel Bakış

Kademe A.Ş. Kalite Yönetim Sistemi'ne entegre edilmiş, kapsamlı bir müşteri şikayetleri yönetim modülü. Bu modül, müşteri şikayetlerinin kaydından çözümüne kadar olan tüm süreci yönetir ve 5N1K, Balık Kılçığı (Ishikawa), 5 Neden gibi analiz araçlarıyla kök neden analizlerini destekler.

## ✨ Özellikler

### 1. Müşteri Yönetimi (Ayarlar Modülü)
- ✅ Müşteri bilgilerini kaydetme ve düzenleme
- ✅ İletişim bilgileri yönetimi
- ✅ İş bilgileri ve sözleşme takibi
- ✅ Müşteri bazlı şikayet istatistikleri
- ✅ Aktif/Pasif müşteri durumu yönetimi

### 2. Şikayet Kaydı ve Yönetimi
- ✅ Detaylı şikayet formu (4 tab'lı yapı)
- ✅ Ürün/Parça bilgileri
- ✅ Sorumluluk ataması
- ✅ Durum takibi (6 farklı durum)
- ✅ Önem seviyesi (Kritik, Yüksek, Orta, Düşük)
- ✅ Finansal etki hesaplama
- ✅ İlişkili kayıtlar (NC, Sapma)

### 3. Kök Neden Analizleri
#### 5N1K Analizi
- Ne? Nerede? Ne Zaman? Kim? Neden? Nasıl? sorularına cevap

#### Balık Kılçığı (Ishikawa) Analizi
- 6M yaklaşımı:
  - İnsan (Man)
  - Makine (Machine)
  - Malzeme (Material)
  - Ölçüm (Measurement)
  - Çevre (Environment)
  - Yönetim (Management)

#### 5 Neden (5 Why) Analizi
- Adım adım neden zincirleri
- Kök neden tespiti
- Anlık ve önleyici aksiyon planları

### 4. Aksiyon Yönetimi
- ✅ 4 tip aksiyon (Anlık, Düzeltici, Önleyici, İyileştirme)
- ✅ Sorumluluk ataması
- ✅ Tarih ve süre takibi
- ✅ Tamamlanma yüzdesi
- ✅ Maliyet yönetimi (tahmini ve gerçekleşen)
- ✅ Etkinlik doğrulama sistemi
- ✅ Gecikme ve yakın deadline uyarıları

### 5. Doküman Yönetimi
- ✅ Çoklu dosya yükleme
- ✅ 7 farklı doküman tipi
- ✅ Dosya önizleme ve indirme
- ✅ Supabase Storage entegrasyonu
- ✅ Yükleyen ve tarih bilgisi

### 6. İletişim Geçmişi
- ✅ Müşteri iletişimlerini kaydetme
- ✅ 5 farklı iletişim tipi (Email, Telefon, Toplantı, Ziyaret, Diğer)
- ✅ Kronolojik sıralama
- ✅ Detaylı notlar

### 7. Gelişmiş Analiz ve Raporlama
- ✅ Önem seviyesi dağılımı
- ✅ Durum dağılımı
- ✅ Kategori bazlı analiz
- ✅ Müşteri bazlı şikayet sıralaması
- ✅ Aylık trend analizi
- ✅ Toplam finansal etki
- ✅ Ortalama çözüm süreleri
- ✅ Açık/Kapalı/Kritik şikayet sayıları

## 🗄️ Veritabanı Yapısı

### Tablolar

1. **customers** - Müşteri bilgileri
2. **customer_complaints** - Şikayet kayıtları
3. **complaint_analyses** - Kök neden analizleri
4. **complaint_actions** - Aksiyon planları
5. **complaint_documents** - Doküman kayıtları
6. **customer_communication_history** - İletişim geçmişi
7. **customer_scores** - Müşteri performans skorları

### Özellikler
- Otomatik şikayet numarası (CS-YYYY-0001 formatında)
- Row Level Security (RLS) politikaları
- Otomatik güncellenen `updated_at` alanları
- İlişkisel veri bütünlüğü
- İndekslenmiş alanlar (performans için)

## 📦 Kurulum

### 1. Supabase Tablolarını Oluşturma

```bash
# Supabase SQL Editor'da çalıştırın:
scripts/create-customer-complaints-tables.sql
```

### 2. Storage Bucket Oluşturma

Supabase Dashboard → Storage → Create Bucket:
- Bucket adı: `complaint_attachments`
- Public: No (Private)

### 3. Storage Policies Oluşturma

```sql
-- Supabase SQL Editor'da:
CREATE POLICY "Authenticated users can upload complaint attachments" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'complaint_attachments');

CREATE POLICY "Authenticated users can view complaint attachments" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'complaint_attachments');

CREATE POLICY "Authenticated users can update complaint attachments" 
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'complaint_attachments');

CREATE POLICY "Authenticated users can delete complaint attachments" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'complaint_attachments');
```

### 4. Bağımlılıklar

Tüm gerekli bağımlılıklar zaten mevcut:
- React & Vite
- Tailwind CSS
- Shadcn/ui components
- Supabase Client
- Lucide Icons
- Framer Motion

## 🚀 Kullanım

### Müşteri Ekleme

1. **Ayarlar** → **Müşteri Yönetimi** → **Yeni Müşteri**
2. 3 tab'ta bilgileri doldurun:
   - Temel Bilgiler
   - İletişim
   - İş Bilgileri
3. **Kaydet**

### Şikayet Oluşturma

1. **Müşteri Şikayetleri** → **Yeni Şikayet**
2. 4 tab'ta bilgileri doldurun:
   - Temel Bilgiler (Müşteri, Tarih, Başlık, Açıklama)
   - Ürün Bilgileri (Kod, Ad, Parti, Miktar)
   - Sorumluluk (Departman, Kişi, Durum)
   - Ek Bilgiler (İlişkili kayıtlar)
3. **Kaydet**

### Kök Neden Analizi Yapma

1. Şikayeti aç → **Analizler** tab
2. **Yeni Analiz** → Analiz tipini seç:
   - 5N1K
   - Balık Kılçığı
   - 5 Neden
3. İlgili alanları doldur
4. Özet ve aksiyonları ekle
5. **Kaydet**

### Aksiyon Ekleme

1. Şikayeti aç → **Aksiyonlar** tab
2. **Yeni Aksiyon**
3. Bilgileri doldur:
   - Tip, Başlık, Açıklama
   - Sorumlu kişi/departman
   - Tarihler ve maliyet
4. İlerleme takibi
5. Etkinlik doğrulama
6. **Kaydet**

### Doküman Yükleme

1. Şikayeti aç → **Dokümanlar** tab
2. **Dosya Yükle**
3. Doküman tipini seç
4. Dosyaları seç (çoklu)
5. Açıklama ekle
6. **Yükle**

## 📊 Analiz ve Raporlama

### Analiz Ekranı

**Müşteri Şikayetleri** → **Analiz ve Raporlar** sekmesi:

- **Önem Seviyesi Dağılımı**: Kritik, Yüksek, Orta, Düşük
- **Durum Dağılımı**: Tüm durumların grafiği
- **Kategori Analizi**: Hangi kategoride kaç şikayet
- **Top 10 Müşteri**: En çok şikayet eden müşteriler
- **Finansal Etki**: Toplam maliyet
- **Aylık Trend**: Son 12 ayın trendi

### Filtreler

- Metin araması (tüm alanlarda)
- Müşteri bazlı filtreleme
- Durum bazlı filtreleme
- Önem seviyesi bazlı filtreleme

## 🔐 Yetkilendirme

Modül mevcut yetkilendirme sistemiyle entegredir:
- Kullanıcı izinleri `profile.permissions` üzerinden kontrol edilir
- Super admin (atakan.battal@kademe.com.tr) tüm yetkilere sahiptir
- Diğer kullanıcılar sadece izin verilen modüllere erişebilir

## 🎨 UI/UX Özellikleri

- Modern ve temiz tasarım
- Responsive (mobil uyumlu)
- Dark mode desteği
- Animasyonlu geçişler
- Loading states
- Error handling
- Toast bildirimleri
- Onay dialogları
- Aranabilir select'ler
- Filtreleme ve arama

## 🔄 Entegrasyonlar

### Mevcut Modüllerle Entegrasyon

- **DF & 8D Yönetimi**: İlişkili NC kayıtları
- **Sapma Yönetimi**: İlişkili sapma kayıtları
- **Personel Yönetimi**: Sorumlu atama
- **Birim Maliyetleri**: Departman seçimi
- **Audit Logs**: Tüm işlemler loglanır

### DataContext Entegrasyonu

Tüm veriler merkezi `DataContext` üzerinden yönetilir:
- `customers`
- `customerComplaints`
- `complaintAnalyses`
- `complaintActions`
- `complaintDocuments`

## 🛠️ Teknik Detaylar

### Dosya Yapısı

```
src/
├── components/
│   ├── CustomerComplaintsModule.jsx (Ana modül)
│   ├── CostSettingsModule.jsx (Müşteri yönetimi içerir)
│   ├── Sidebar.jsx (Menü)
│   ├── cost-settings/
│   │   └── CustomerManager.jsx
│   └── customer-complaints/
│       ├── ComplaintFormModal.jsx
│       ├── ComplaintDetailModal.jsx
│       ├── ComplaintAnalytics.jsx
│       ├── AnalysisTab.jsx
│       ├── AnalysisFormModal.jsx
│       ├── ActionsTab.jsx
│       ├── ActionFormModal.jsx
│       ├── DocumentsTab.jsx
│       └── CommunicationTab.jsx
├── contexts/
│   └── DataContext.jsx (Güncellenmiş)
└── App.jsx (Rota eklendi)
```

### Önemli Fonksiyonlar

#### Şikayet Numarası Oluşturma
```sql
generate_complaint_number() -- CS-2024-0001 formatında
```

#### Veri Çekme
```javascript
customerComplaints // DataContext'ten erişim
customers // Müşteri listesi
```

## 📝 Notlar

### Önemli Hatırlatmalar

1. **Supabase SQL** script'ini mutlaka çalıştırın
2. **Storage bucket** oluşturmayı unutmayın
3. **Storage policies** ekleyin
4. İlk müşteriyi **Ayarlar → Müşteri Yönetimi**'nden ekleyin
5. Şikayet oluştururken müşteri seçimi **zorunludur**

### Bilinen Sınırlamalar

- Dokümanlar Supabase Storage'a yüklenir (limit: 5GB free plan)
- Çok büyük dosyalar yavaş yüklenebilir
- Grafik ve chart kütüphanesi şu an basit kartlar şeklinde (gelecekte recharts eklenebilir)

### Gelecek Geliştirmeler

- [ ] PDF rapor oluşturma
- [ ] Email bildirimleri
- [ ] Otomatik hatırlatıcılar
- [ ] Gelişmiş grafikler (recharts)
- [ ] Excel export
- [ ] Toplu işlemler
- [ ] Şablon sistemleri

## 🆘 Sorun Giderme

### Tablolar oluşturulamıyorsa
- SQL script'i adım adım çalıştırın
- Error mesajlarını kontrol edin
- Supabase project'inizin aktif olduğundan emin olun

### Doküman yüklenemiyorsa
- Storage bucket'ın oluşturulduğunu kontrol edin
- Policies'lerin eklendiğinden emin olun
- Dosya boyutunu kontrol edin

### Veri görünmüyorsa
- `refreshData()` fonksiyonu çağrılıyor mu kontrol edin
- Browser console'da hata var mı bakın
- Supabase RLS policies'lerini kontrol edin

## 📞 Destek

Herhangi bir sorun veya soru için:
- Email: atakan.battal@kademe.com.tr
- Sistem içi: Görev Yönetimi modülü

---

**Kademe A.Ş. Kalite Yönetim Sistemi**
*Müşteri Şikayetleri Yönetim Modülü v1.0*
*Oluşturulma Tarihi: 30 Ekim 2025*

