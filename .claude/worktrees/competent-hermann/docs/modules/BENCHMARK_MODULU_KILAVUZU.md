# BENCHMARK MODÜLÜ KILAVUZU

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Veritabanı Kurulumu](#veritabanı-kurulumu)
3. [Özellikler](#özellikler)
4. [Kullanım Kılavuzu](#kullanım-kılavuzu)
5. [Veri Modeli](#veri-modeli)
6. [Sık Sorulan Sorular](#sık-sorulan-sorular)

---

## 🎯 Genel Bakış

Benchmark Modülü, ürün, süreç, teknoloji ve tedarikçi karşılaştırmalarını sistematik olarak yönetmenizi sağlayan kapsamlı bir analiz ve karar destek sistemidir.

### Temel Özellikler

✅ **Çoklu Alternatif Karşılaştırma**
- Sınırsız sayıda alternatif ekleyebilme
- Her alternatif için detaylı teknik ve finansal bilgiler
- Mevcut ve önerilen çözümleri işaretleme

✅ **Ağırlıklı Kriter Değerlendirme**
- Özelleştirilebilir değerlendirme kriterleri
- Her kritere ağırlık (%) atama
- Otomatik normalize edilmiş skorlama

✅ **Avantaj & Dezavantaj Analizi**
- Her alternatif için detaylı artı/eksi analizi
- Kategorize edilmiş avantaj/dezavantajlar
- Etki seviyesi tanımlama

✅ **Kanıt Doküman Yönetimi**
- Teknik şartnameler, teklifler, raporlar
- Sertifikalar ve test sonuçları
- Fotoğraf ve görsel kanıtlar

✅ **Onay Akış Sistemi**
- Çok seviyeli onay mekanizması
- Onaylayıcı rolleri ve yetkileri
- Onay geçmişi ve durum takibi

✅ **Detaylı Raporlama**
- Karşılaştırma matrisi görünümü
- Sıralama ve analiz sonuçları
- PDF export (yakında)

---

## 🗄️ Veritabanı Kurulumu

### Adım 1: SQL Script Çalıştırma

Supabase SQL Editor'ünde aşağıdaki script'i çalıştırın:

```bash
# Proje kök dizininde
cat scripts/create-benchmark-module.sql
```

veya Supabase Dashboard > SQL Editor > New Query'den aşağıdaki dosyayı yükleyin:
- `scripts/create-benchmark-module.sql`

### Adım 2: Storage Bucket Oluşturma

Supabase Dashboard > Storage bölümünden:

1. "Create a new bucket" butonuna tıklayın
2. Bucket adı: `benchmark_documents`
3. Public: `false` (özel)
4. "Create bucket" butonuna tıklayın

### Adım 3: Storage Politikaları

Storage > Policies bölümünden aşağıdaki politikaları ekleyin:

**Upload Politikası:**
```sql
CREATE POLICY "Authenticated users can upload benchmark documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'benchmark_documents');
```

**Read Politikası:**
```sql
CREATE POLICY "Authenticated users can read benchmark documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'benchmark_documents');
```

**Delete Politikası:**
```sql
CREATE POLICY "Authenticated users can delete benchmark documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'benchmark_documents');
```

### Adım 4: Doğrulama

SQL Editor'de aşağıdaki sorguları çalıştırarak kurulumu doğrulayın:

```sql
-- Tabloların varlığını kontrol et
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'benchmark%'
ORDER BY table_name;

-- Varsayılan kategorileri kontrol et
SELECT * FROM benchmark_categories ORDER BY order_index;

-- Fonksiyonları kontrol et
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%benchmark%';
```

Beklenen sonuç: 10 tablo, 6 kategori, 2 fonksiyon

---

## 🎨 Özellikler

### 1. Benchmark Oluşturma

**Başlangıç:**
1. Ana panelde "Yeni Benchmark" butonuna tıklayın
2. Form üzerinde 3 sekme bulunur:
   - **Temel Bilgiler:** Başlık, kategori, açıklama, durum
   - **Detaylar:** Amaç, kapsam, bütçe, notlar
   - **Ekip & Tarihler:** Sorumlu, ekip, tarihler

**Zorunlu Alanlar:**
- ✅ Kategori
- ✅ Başlık
- ✅ Açıklama

**Otomatik Oluşturulanlar:**
- `BMK-YYYY-####` formatında benzersiz numara
- Oluşturma tarihi ve kullanıcı
- Aktivite log kaydı

### 2. Alternatif Yönetimi

**Alternatif Ekleme:**
1. Benchmark detayında "Karşılaştır" butonuna tıklayın
2. "Alternatifler" sekmesinde "Alternatif Ekle"
3. Temel bilgileri girin:
   - Alternatif adı (zorunlu)
   - Ürün/parça kodu
   - Açıklama
   - Birim fiyat
   - Kalite skoru (0-100)
   - Tedarik süresi (gün)

**Alternatif Özellikleri:**
- ⭐ "Önerilen" olarak işaretleme
- 🔵 "Mevcut çözüm" olarak işaretleme
- 🔢 Sıralama numarası
- 💰 Maliyet bilgileri
- 📊 Performans skorları

### 3. Kriter Değerlendirme

**Kriter Oluşturma:**
1. "Kriterler" sekmesinde "Kriter Ekle"
2. Kriter bilgilerini doldurun:
   - Kriter adı (örn: Maliyet)
   - Kategori (örn: Finansal)
   - Ağırlık % (örn: 30)
   - Ölçüm birimi (TRY, Gün, Puan vb.)

**Kriter Kategorileri:**
- 💰 Maliyet
- ⚙️ Kalite
- 🔧 Teknik
- 🏭 Operasyonel
- 🌱 Çevresel
- 👥 Sosyal

**Ağırlıklandırma:**
- Her kriterin toplam içindeki önemi belirtilir
- Ağırlıklar toplamı 100 olmalıdır
- Otomatik normalize edilmiş skorlama

### 4. Karşılaştırma Matrisi

**Puan Verme:**
1. "Karşılaştırma Matrisi" sekmesini açın
2. Her alternatif için her kriterde 0-100 arası puan verin
3. Skorlar otomatik olarak kaydedilir

**Hesaplama:**
```
Ham Puan: Girilen değer (0-100)
Normalize Skor: Min-max normalizasyonu
Ağırlıklı Skor: (Normalize × Kriter Ağırlığı) / 100
Toplam Skor: Tüm ağırlıklı skorların toplamı
```

**Görünüm:**
- 📊 Tablo görünümü (matris)
- 📈 Sıralama listesi
- 🏆 En yüksek skorlu alternatif vurgulanır

### 5. Avantaj & Dezavantaj Analizi

**Ekleme:**
1. "Analiz & Sonuçlar" sekmesine gidin
2. Her alternatif için "+" butonuna tıklayın
3. Avantaj veya dezavantaj ekleyin

**Kategoriler:**
- 💰 Maliyet
- ⚙️ Kalite
- 🚚 Teslimat
- 🔧 Teknik
- 🏭 Operasyonel
- 👥 İnsan Kaynağı

**Etki Seviyeleri:**
- 🔴 Kritik
- 🟠 Yüksek
- 🟡 Orta
- 🟢 Düşük

### 6. Doküman Yönetimi

**Desteklenen Doküman Tipleri:**
- 📄 Teknik Şartname
- 💵 Teklif
- 🧪 Test Raporu
- 🎓 Sertifika
- 📸 Fotoğraf
- 📝 Diğer

**Yükleme:**
1. "Dokümanlar" sekmesinde "Doküman Ekle"
2. Dosya seçin (max 10 MB)
3. Doküman tipini belirleyin
4. Başlık ve açıklama ekleyin

**Metadata:**
- Doküman tarihi
- Doküman numarası
- Versiyon bilgisi
- Etiketler

### 7. Onay Akışı

**Onay Oluşturma:**
1. Benchmark detayında "Onaya Gönder"
2. Onaylayıcıları seçin
3. Onay seviyelerini belirleyin
4. Bildirim gönder

**Onay Durumları:**
- ⏳ Bekliyor
- ✅ Onaylandı
- ❌ Reddedildi
- 🔄 Revizyon İstendi

**Onaylayıcı İşlemleri:**
- Yorumlar ekleme
- Koşullar belirleme
- Karar verme (Onayla/Reddet)

### 8. Aktivite Geçmişi

**Takip Edilen İşlemler:**
- ✨ Oluşturuldu
- ✏️ Güncellendi
- 🔄 Durum Değişti
- ➕ Alternatif Eklendi
- ➕ Kriter Eklendi
- 📊 Skor Güncellendi
- 📤 Onaya Gönderildi
- ✅ Onaylandı

**Bilgiler:**
- İşlem tipi
- Açıklama
- Değişiklik detayları (eski/yeni değer)
- İşlemi yapan kullanıcı
- Tarih ve saat

---

## 📊 Veri Modeli

### Ana Tablolar

#### 1. `benchmark_categories`
Benchmark kategorileri (Ürün, Süreç, Teknoloji vb.)

#### 2. `benchmarks`
Ana benchmark kayıtları - proje bilgileri, durum, sorumluluk

**Önemli Alanlar:**
- `benchmark_number`: Otomatik oluşturulan benzersiz numara
- `status`: Taslak, Devam Ediyor, Analiz Aşamasında, Onay Bekliyor, Tamamlandı, İptal
- `priority`: Kritik, Yüksek, Normal, Düşük
- `approval_status`: Bekliyor, Onaylandı, Reddedildi, Revizyon Gerekli

#### 3. `benchmark_items`
Karşılaştırılan alternatifler

**Önemli Alanlar:**
- `specifications`: JSONB - esnek teknik özellikler
- `quality_score`, `performance_score`, `reliability_score`: 0-100 arası
- `is_recommended`, `is_current_solution`: Boolean bayraklar

#### 4. `benchmark_criteria`
Değerlendirme kriterleri ve ağırlıkları

**Skorlama Yöntemleri:**
- `Numerical`: Sayısal değer
- `Rating`: Derecelendirme (1-5 yıldız)
- `Binary`: Evet/Hayır
- `Text`: Metin açıklama

#### 5. `benchmark_scores`
Alternatif × Kriter skorları

**Hesaplanan Alanlar:**
- `raw_value`: Ham değer
- `normalized_score`: Normalize edilmiş (0-100)
- `weighted_score`: Ağırlıklı skor

#### 6. `benchmark_pros_cons`
Avantaj ve dezavantajlar

**Tip:**
- `Avantaj`
- `Dezavantaj`

#### 7. `benchmark_documents`
Kanıt dokümanları ve ekleri

**Storage:**
- Supabase Storage: `benchmark_documents` bucket
- Path format: `{benchmark_id}/{uuid}-{filename}`

#### 8. `benchmark_approvals`
Onay akış kayıtları

**Seviyeli Onay:**
- `approval_level`: 1, 2, 3... (sıralı onay)

#### 9. `benchmark_activity_log`
Aktivite geçmişi

**JSONB Alanlar:**
- `old_value`: Önceki değer
- `new_value`: Yeni değer

#### 10. `benchmark_reports`
Snapshot raporları (anlık durum kayıtları)

---

## 🔧 Kullanım Senaryoları

### Senaryo 1: Yeni Tedarikçi Seçimi

**Amaç:** 3 farklı tedarikçiyi karşılaştırarak en uygununu seçmek

**Adımlar:**
1. Yeni benchmark oluştur (Kategori: Tedarikçi Karşılaştırma)
2. 3 alternatif ekle (Tedarikçi A, B, C)
3. Kriterler belirle:
   - Fiyat (Ağırlık: %40)
   - Kalite (Ağırlık: %30)
   - Teslimat Süresi (Ağırlık: %20)
   - Referanslar (Ağırlık: %10)
4. Her tedarikçiye skor ver
5. Avantaj/dezavantajları ekle
6. Teklif dokümanlarını yükle
7. Karşılaştırma matrisini incele
8. En yüksek skoru alan tedarikçiyi seç
9. Onaya gönder

### Senaryo 2: Teknoloji Yatırım Kararı

**Amaç:** 2 farklı yazılım çözümünü karşılaştırmak

**Adımlar:**
1. Yeni benchmark (Kategori: Teknoloji Karşılaştırma)
2. Mevcut sistem + 2 yeni alternatif
3. Kriterler:
   - Maliyet (İlk yatırım + işletme)
   - Özellikler ve fonksiyonalite
   - Entegrasyon kolaylığı
   - Destek ve eğitim
   - Güvenlik
4. Demo raporlarını ekle
5. IT ekibinden skorlar al
6. Karar matrisi oluştur

### Senaryo 3: Süreç Optimizasyonu

**Amaç:** Üretim sürecinde 3 farklı metodu karşılaştırmak

**Adımlar:**
1. Benchmark oluştur (Kategori: Süreç Karşılaştırma)
2. Alternatifler: Mevcut + İyileştirme A + İyileştirme B
3. Kriterler:
   - Çevrim süresi
   - Hata oranı
   - Maliyet
   - İşçilik gereksinimi
   - Kalite seviyesi
4. Pilot test sonuçlarını kaydet
5. İş akış şemalarını ekle
6. ROI hesapla

---

## 📈 Best Practices

### Kriter Belirleme

✅ **DO:**
- Ölçülebilir kriterler kullanın
- Net tanımlar yapın
- Gerçekçi ağırlıklar verin
- İşletme hedefleriyle uyumlu olun

❌ **DON'T:**
- Çok fazla kriter eklemeyin (5-10 ideal)
- Örtüşen kriterler kullanmayın
- Tüm ağırlıkları eşit yapmayın
- Subjektif kriterlerden kaçının

### Skorlama

✅ **DO:**
- Tutarlı bir ölçek kullanın
- Referans noktaları belirleyin
- Birden fazla kişiden veri toplayın
- Kanıtlara dayandırın

❌ **DON'T:**
- Tahmine dayalı skorlama yapmayın
- Önyargılı olmayın
- Eksik veri ile skorlamayın

### Dokümentasyon

✅ **DO:**
- Tüm kanıtları saklayın
- Güncel teklifler kullanın
- Test raporlarını ekleyin
- Referansları not edin

❌ **DON'T:**
- Eski dokümanlar kullanmayın
- Kaynak belirtmeyin
- İsimsiz dosyalar yüklemeyin

---

## 🚀 Gelecek Özellikler

### Planlanan Geliştirmeler

- [ ] PDF Rapor Üretimi
  - Karşılaştırma matrisi
  - Grafik ve görselleştirmeler
  - Özet rapor
  
- [ ] Gelişmiş Görselleştirme
  - Radar chart
  - Bar chart karşılaştırma
  - Trend analizi
  
- [ ] ROI Hesaplayıcı
  - Yatırım geri dönüş süresi
  - NPV hesaplama
  - Break-even analizi
  
- [ ] Şablon Sistemi
  - Hazır benchmark şablonları
  - Sektöre özel kriterler
  - Hızlı başlangıç
  
- [ ] Bildirim Sistemi
  - Email bildirimleri
  - Onay talepleri
  - Durum güncellemeleri
  
- [ ] Dashboard Entegrasyonu
  - Ana panelde benchmark özeti
  - KPI entegrasyonu
  - Trend grafikleri

---

## ❓ Sık Sorulan Sorular

### S1: Kaç alternatif ekleyebilirim?
**C:** Sınırsız. Ancak yönetilebilirlik açısından 3-6 alternatif optimal sayıdır.

### S2: Skorları sonradan değiştirebilir miyim?
**C:** Evet. Karşılaştırma matrisinde istediğiniz zaman skorları güncelleyebilirsiniz.

### S3: Onay olmadan benchmark'ı tamamlayabilir miyim?
**C:** Evet. Onay akışı opsiyoneldir. İstediğinizde direkt "Tamamlandı" durumuna geçebilirsiniz.

### S4: Eski benchmark'ları silebilir miyim?
**C:** Evet. Ancak cascade delete nedeniyle tüm ilişkili veriler (alternatifler, skorlar, dokümanlar) de silinir. Yerine "İptal" durumuna geçirmeniz önerilir.

### S5: Benchmark numaraları nasıl oluşturuluyor?
**C:** Otomatik `BMK-YYYY-####` formatında (örn: BMK-2024-0001). Her yıl sıfırdan başlar.

### S6: Birden fazla kişi aynı benchmark üzerinde çalışabilir mi?
**C:** Evet. Ekip üyeleri özelliği ile birden fazla kişi atayabilirsiniz. Ancak eş zamanlı düzenleme kilidi yoktur.

### S7: Benchmark sonuçlarını nasıl paylaşabilirim?
**C:** Şu an için ekran görüntüsü veya doküman export ile. PDF rapor özelliği yakında eklenecek.

### S8: Kategorileri özelleştirebilir miyim?
**C:** Evet. `benchmark_categories` tablosuna yeni kayıt ekleyebilir veya mevcut olanları düzenleyebilirsiniz.

---

## 🛠️ Teknik Notlar

### Performans

- İndeksler tüm foreign key'lerde tanımlı
- JSONB kolonları için GIN index kullanılabilir
- Büyük dosyalar için Supabase Storage optimize edilmiş

### Güvenlik

- Row Level Security (RLS) tüm tablolarda aktif
- Authenticated kullanıcılar tüm işlemleri yapabilir
- Storage bucket private (kimliği doğrulanmış erişim)

### Ölçeklenebilirlik

- Partition için tarih bazlı indeksleme hazır
- Archive için `is_archived` alanı eklenebilir
- Soft delete için `deleted_at` eklenebilir

---

## 📞 Destek

Sorularınız için:
- 📧 Email: destek@kademe.com.tr
- 📱 Telefon: +90 XXX XXX XX XX
- 💬 Sistem içi destek talebi oluşturun

---

**Son Güncelleme:** 5 Kasım 2024  
**Versiyon:** 1.0.0  
**Hazırlayan:** Kademe Kalite Ekibi

