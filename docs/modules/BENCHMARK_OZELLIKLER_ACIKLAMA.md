# 📊 Benchmark Modülü - Özellikler Rehberi

## ✅ Tamamlanan Geliştirmeler (Son Güncelleme)

### 1. 💰 Kalitesizlik Maliyetlerinden Uygunsuzluk Oluşturma
**GÜNCELLEME YAPILDI** - Artık TÜM bilgiler şeffaf bir şekilde aktarılıyor:

✅ **Aktarılan Bilgiler:**
- 📋 Maliyet Türü
- 📅 Tarih
- 🏢 Birim (İlgili Departman otomatik doluyor)
- 🔧 Parça Adı/Kodu
- 🚗 Araç Tipi
- 📍 Parça Lokasyonu
- 💰 Tutar (TL olarak formatlanmış)
- 📦 Miktar ve Ölçüm Birimi
- ⚖️ Hurda Ağırlığı
- 🔩 Malzeme Tipi
- 📊 Etkilenen Birimler
- ⏱️ **Yeniden İşlem Süresi** (dakika, saat:dakika formatında)
- 🔍 **Kalite Kontrol Süresi** (dakika, saat:dakika formatında)
- 📝 Açıklama

**Örnek Açıklama Formatı:**
```
=== MALIYET KAYDI DETAYLARI ===

📋 Maliyet Türü: Yeniden İşlem Maliyeti
📅 Tarih: 06.11.2024
🏢 Birim: Üretim

🔧 Parça Adı: Motor Bloğu
🔢 Parça Kodu: MB-2024-001
🚗 Araç Tipi: Model X

=== MALİYET BİLGİLERİ ===
💰 Tutar: ₺15.000,00
📦 Miktar: 50 Adet

=== SÜRE BİLGİLERİ ===
⏱️ Yeniden İşlem Süresi: 3 saat 45 dakika (Toplam: 225 dakika)
🔍 Kalite Kontrol Süresi: 1 saat 30 dakika (Toplam: 90 dakika)
```

---

## 📁 Benchmark Dosya Yükleme Özelliği

### Nasıl Kullanılır?

1. **Benchmark Detay Sayfasını Açın**
   - Benchmark kartına tıklayın → "Detay" butonu

2. **Dokümanlar Sekmesine Gidin**
   - Üstteki sekme çubuğundan "Dokümanlar" sekmesini seçin

3. **Dosya Yükleyin**
   - "Doküman Yükle" butonuna tıklayın
   - Dosya türünü seçin (Teknik Şartname, Test Raporu, Sertifika, Fotoğraf, Sunum, vb.)
   - Doküman başlığı girin (zorunlu)
   - Açıklama ekleyin
   - Tarih ve doküman numarası girebilirsiniz
   - Etiketler ekleyebilirsiniz

### ✅ Desteklenen Dosya Formatları:
- 📄 **PDF** (.pdf)
- 📊 **Word** (.doc, .docx)
- 📈 **Excel** (.xls, .xlsx)
- 🎯 **PowerPoint** (.ppt, .pptx)
- 🖼️ **Resim** (.jpg, .jpeg, .png, .gif)

### 📏 Dosya Boyutu Limiti:
- Maksimum: **10 MB** per dosya

---

## 📊 Benchmark Tablo Oluşturma ve Karşılaştırma

### Nasıl Kullanılır?

1. **Karşılaştırma Sayfasını Açın**
   - Benchmark kartında "Karşılaştır" butonuna tıklayın

2. **Alternatifler Ekleme (Seçenekler)**
   - "Alternatifler" sekmesinde "Alternatif Ekle" butonuna tıklayın
   - Alternatif Adı: Örn: "Tedarikçi A", "Ürün X"
   - Kod, Açıklama, Birim Fiyat, Kalite Skoru girebilirsiniz

3. **Kriterler Tanımlama (Karşılaştırma Başlıkları)**
   - "Kriterler" sekmesinde "Kriter Ekle" butonuna tıklayın
   - Kriter Adı: Örn: "Maliyet", "Kalite", "Tedarik Süresi"
   - Ağırlık: %1-100 arası (önem derecesi)
   - Kategori ve açıklama ekleyebilirsiniz

4. **Karşılaştırma Matrisi (Tablo)**
   - "Karşılaştırma Matrisi" sekmesine gidin
   - Her alternatif için her kriterde **0-100 arası puan** verin
   - Sistem otomatik olarak ağırlıklı skorları hesaplar
   - Sonuçlar tabloda gerçek zamanlı görünür

5. **Analiz & Sonuçlar**
   - "Analiz & Sonuçlar" sekmesinde:
     - Genel sıralama (1., 2., 3.)
     - Avantaj/Dezavantaj ekleme
     - Her alternatif için artı/eksi listesi

### 📊 Örnek Karşılaştırma Tablosu:

| Alternatif | Maliyet (30%) | Kalite (40%) | Tedarik (30%) | Toplam Skor |
|------------|---------------|--------------|---------------|-------------|
| Alternatif A | 85 | 90 | 70 | **82.5** 🥇 |
| Alternatif B | 90 | 80 | 75 | **81.5** 🥈 |
| Alternatif C | 70 | 85 | 80 | **78.5** 🥉 |

---

## 📄 Rapor Alma Özelliği

### 2 Tip Rapor Var:

#### 1. **Benchmark Detay Raporu**
- Benchmark Detay sayfasında → "Rapor" butonu
- İçerik:
  - Temel bilgiler
  - Kategori, sorumlu, departman, bütçe
  - Açıklama, amaç, kapsam
  - Alternatifler listesi
  - Ekli dokümanlar

#### 2. **Karşılaştırma Raporu**
- Karşılaştırma sayfasında → "Rapor İndir" butonu
- İçerik:
  - Genel sıralama tablosu
  - Detaylı karşılaştırma matrisi (tüm skorlar)
  - Avantaj & Dezavantaj analizi
  - Renkli göstergeler (en iyi = sarı, 2. = mavi, 3. = pembe)

### 📥 Rapor Formatı:
- PDF olarak yazdırılabilir (Print to PDF)
- A4 formatında (Detay Raporu: Dikey, Karşılaştırma Raporu: Yatay)
- Profesyonel tasarım
- Türkçe tarih ve para formatları

---

## 🔧 Departman Seçimi Sorunu

**GÜNCELLEME YAPILDI:**
- Departmanlar artık 2 kaynaktan çekiliyor:
  1. `cost_settings` tablosu (birincil)
  2. `personnel` tablosu (yedek)
- Eğer departman boş gözüküyorsa:
  - Console loglarını kontrol edin (F12 → Console)
  - Veritabanında departman verisi olup olmadığını kontrol edin

---

## 🎯 Özet: Tüm Özellikler Hazır!

✅ Dosya Yükleme: **ÇALIŞIYOR**
✅ Tablo Oluşturma: **ÇALIŞIYOR** (Alternatif + Kriter + Matris)
✅ Karşılaştırma: **ÇALIŞIYOR** (Otomatik skorlama)
✅ Rapor Alma: **ÇALIŞIYOR** (2 tip rapor)
✅ Departman Seçimi: **DÜZELTİLDİ** (Yedek kaynak eklendi)
✅ Kalitesizlik Maliyeti → Uygunsuzluk: **GELİŞTİRİLDİ** (Tüm bilgiler şeffaf)

---

## 📞 Sorun mu Yaşıyorsunuz?

1. **Tarayıcı Console'u kontrol edin** (F12 → Console)
2. **Sayfayı yenileyin** (Ctrl+F5 veya Cmd+Shift+R)
3. **Tarayıcı cache'ini temizleyin**
4. Sorun devam ediyorsa ekran görüntüsü paylaşın

---

**Son Güncelleme:** 6 Kasım 2024
**Kademe QMS v1.0**

