# 🚀 BENCHMARK MODÜLÜ - HIZLI BAŞLANGIÇ

## 3 Adımda Kurulum

### ✅ Adım 1: Veritabanı Kurulumu (5 dakika)

```bash
# 1. Supabase Dashboard'a gidin
# 2. SQL Editor'ü açın
# 3. Aşağıdaki dosyayı çalıştırın:
```

**Supabase SQL Editor'de çalıştırın:**
```sql
-- Dosya: scripts/create-benchmark-module.sql
-- Bu dosyanın tamamını kopyalayıp SQL Editor'e yapıştırın ve RUN
```

### ✅ Adım 2: Storage Bucket Oluşturma (2 dakika)

**Supabase Dashboard > Storage:**

1. "Create a new bucket" 
2. Name: `benchmark_documents`
3. Public: `false` ❌ (Private olacak)
4. "Create bucket"

**Politikalar (Policies):**

Storage > benchmark_documents > Policies > New Policy:

```sql
-- Upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'benchmark_documents');

-- Read
CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'benchmark_documents');

-- Delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'benchmark_documents');
```

### ✅ Adım 3: Kullanıcı İzinleri (1 dakika)

Kullanıcı hesaplarında `permissions` alanına benchmark modülü ekleyin:

```json
{
  "benchmark": "full"
}
```

veya admin kullanıcı için tüm yetkiler:
- Email: `atakan.battal@kademe.com.tr` → Otomatik tam yetki

---

## 🎯 İlk Benchmark'ınızı Oluşturun (5 dakika)

### Örnek: Tedarikçi Karşılaştırma

1. **Modüle Giriş:**
   - Sol menüden "Benchmark Yönetimi" 📈
   - "Yeni Benchmark" butonu

2. **Temel Bilgiler:**
   ```
   Kategori: Tedarikçi Karşılaştırma
   Başlık: "2024 Q4 Sac Tedarikçi Değerlendirme"
   Açıklama: "Sac malzeme tedarikçisi seçimi"
   Durum: Devam Ediyor
   Öncelik: Yüksek
   ```

3. **Alternatif Ekle:**
   - "Karşılaştır" → "Alternatifler" sekmesi
   - "Alternatif Ekle" butonu
   
   ```
   Alternatif 1:
   - Ad: "Tedarikçi A - Mevcut"
   - Fiyat: 150 TRY/kg
   - Kalite Skoru: 85
   - Tedarik Süresi: 15 gün
   
   Alternatif 2:
   - Ad: "Tedarikçi B - Yeni"
   - Fiyat: 140 TRY/kg
   - Kalite Skoru: 90
   - Tedarik Süresi: 20 gün
   
   Alternatif 3:
   - Ad: "Tedarikçi C - Yeni"
   - Fiyat: 145 TRY/kg
   - Kalite Skoru: 88
   - Tedarik Süresi: 18 gün
   ```

4. **Kriter Belirle:**
   - "Kriterler" sekmesi
   - "Kriter Ekle" butonu
   
   ```
   Kriter 1: Fiyat (Ağırlık: %40)
   Kriter 2: Kalite (Ağırlık: %35)
   Kriter 3: Teslimat (Ağırlık: %15)
   Kriter 4: Referanslar (Ağırlık: %10)
   ```

5. **Skorlama:**
   - "Karşılaştırma Matrisi" sekmesi
   - Her hücreye 0-100 arası puan verin
   
   | Alternatif | Fiyat | Kalite | Teslimat | Referans |
   |------------|-------|--------|----------|----------|
   | Tedarikçi A| 70    | 85     | 90       | 95       |
   | Tedarikçi B| 85    | 90     | 75       | 80       |
   | Tedarikçi C| 80    | 88     | 80       | 85       |

6. **Analiz:**
   - "Analiz & Sonuçlar" sekmesi
   - Otomatik sıralama göreceksiniz
   - Her alternatif için "+" ile avantaj/dezavantaj ekleyin

7. **Sonuç:**
   - En yüksek skorlu alternatif 🏆
   - Karar verin ve tamamlayın

---

## 📊 Hızlı İpuçları

### ⚡ Kısayollar

- **Hızlı Arama:** `Ctrl/Cmd + K` → "Benchmark" yazın
- **Filtre:** Durum, kategori, önceliğe göre filtreleyin
- **Sıralama:** Kolon başlıklarına tıklayın

### 💡 İyi Uygulamalar

✅ **Kriter Sayısı:** 5-10 arası (çok fazla kriter karmaşıklığa neden olur)

✅ **Ağırlıklar:** En önemli kriterler toplamda %60-70 ağırlık alsın

✅ **Dokümantasyon:** Her alternatif için en az 1 kanıt doküman yükleyin

✅ **Ekip Çalışması:** Birden fazla kişiden skorlama alın (objektiflik)

✅ **Periyodik İnceleme:** Benchmark'ları 6 ayda bir gözden geçirin

### 🎨 Durum Yönetimi

```
Taslak → Devam Ediyor → Analiz Aşamasında → Onay Bekliyor → Tamamlandı
```

**Ne zaman kullanılır?**
- **Taslak:** Yeni oluşturuldu, henüz çalışma başlamadı
- **Devam Ediyor:** Alternatifler ve kriterler ekleniyor
- **Analiz Aşamasında:** Skorlama yapılıyor, avantaj/dezavantaj ekleniyor
- **Onay Bekliyor:** Tüm analizler tamamlandı, onay süreci başladı
- **Tamamlandı:** Onaylandı ve karar alındı

### 🎯 Öncelik Seviyeleri

- 🔴 **Kritik:** Acil ihtiyaç, hemen karar gerekiyor (1-7 gün)
- 🟠 **Yüksek:** Önemli, 2 hafta içinde sonuçlanmalı
- 🔵 **Normal:** Standart süreç, 1 ay içinde
- ⚪ **Düşük:** Acil değil, uzun vadeli planlama

---

## 🔍 Örnek Senaryolar

### Senaryo 1: Hızlı Tedarikçi Kıyaslama (15 dk)

**Amaç:** Mevcut vs. Yeni tedarikçi

**Adımlar:**
1. Benchmark oluştur
2. 2 alternatif ekle (mevcut + yeni)
3. 3 kriter belirle (fiyat, kalite, teslimat)
4. Mevcut verileri skorla
5. Sonucu gör ve karar ver

### Senaryo 2: Teknoloji Yatırımı (30 dk)

**Amaç:** Yazılım seçimi

**Adımlar:**
1. Benchmark oluştur
2. 3-4 yazılım alternatifi ekle
3. 6-8 kriter belirle (maliyet, özellikler, entegrasyon, vb.)
4. Demo raporlarını yükle
5. IT ekibinden skorlar topla
6. Analiz yap ve sunum hazırla

### Senaryo 3: Kapsamlı Süreç Analizi (60 dk)

**Amaç:** Üretim süreç optimizasyonu

**Adımlar:**
1. Benchmark oluştur
2. Mevcut + 2 iyileştirme alternatifi
3. 10 kriter (çevrim, hata, maliyet, vb.)
4. Pilot test verilerini ekle
5. İş akış şemalarını yükle
6. ROI hesapla
7. Yönetim onayına sun

---

## 📚 Video Eğitimler (Yakında)

- [ ] Temel Kullanım (5 dk)
- [ ] Gelişmiş Özellikler (10 dk)
- [ ] Raporlama ve Analiz (8 dk)
- [ ] Onay Akışı (5 dk)

---

## ❓ Hızlı Yardım

### Sorun: Alternatif ekleyemiyorum
**Çözüm:** Önce benchmark'ı kaydedin, sonra "Karşılaştır" butonuna tıklayın.

### Sorun: Skorlar hesaplanmıyor
**Çözüm:** En az 1 kriter eklediğinizden emin olun ve ağırlık değerlerini kontrol edin.

### Sorun: Doküman yüklenmiyor
**Çözüm:** Storage bucket'ın oluşturulduğunu ve politikaların eklendiğini kontrol edin.

### Sorun: Modül görünmüyor
**Çözüm:** Kullanıcı izinlerinizi kontrol edin. Admin kullanıcı ile giriş yapmayı deneyin.

---

## 🎓 Eğitim Checklist

Yeni kullanıcılar için:

- [ ] Veritabanı kurulumu tamamlandı
- [ ] Storage bucket oluşturuldu
- [ ] İlk benchmark oluşturuldu
- [ ] Alternatif eklendi (min 2)
- [ ] Kriter belirlendi (min 3)
- [ ] Skorlama yapıldı
- [ ] Avantaj/dezavantaj eklendi
- [ ] Doküman yüklendi
- [ ] Sonuçlar incelendi
- [ ] Kılavuz okundu ✅

---

## 🚀 Sonraki Adımlar

1. ✅ İlk benchmark'ınızı tamamlayın
2. 📖 [Detaylı kılavuzu](BENCHMARK_MODULU_KILAVUZU.md) okuyun
3. 🎯 Gerçek bir proje için kullanın
4. 💬 Geri bildirim verin
5. 📈 Ekibinizi eğitin

---

**Başarılar! 🎉**

*Sorularınız için: destek@kademe.com.tr*

