# 🎯 Tedarikçi Kaynaklı Maliyet - İş Mantığı

## 📋 Genel Konsept

Tedarikçi kaynaklı maliyet kaydı oluştururken:

1. **Maliyet Hesaplaması** → Birim, süre, malzeme gibi tüm parametreler **normal şekilde** kullanılır
2. **Sorumluluk** → Hesaplanan maliyet **tedarikçiye atanır** ve takip edilir
3. **İzlenebilirlik** → DF/8D uygunsuzluğu oluşturulabilir ve tedarikçiye yansıtılabilir

## 🔄 İş Akışı

### Senaryo Örneği

**Durum:** Tedarikçi X'den gelen hatalı hammadde nedeniyle Kaynakhane'de hurda oluştu.

```
┌─────────────────────────────────────────────────────────┐
│ 1. Maliyet Kaydı Oluştur                                │
│    ├─ Tedarikçi Kaynaklı: ✅ AÇIK                       │
│    ├─ Tedarikçi: ABC Metal A.Ş.                         │
│    ├─ Maliyet Türü: Hurda Maliyeti                      │
│    ├─ Birim (Kaynak): Kaynakhane                        │
│    ├─ Malzeme Türü: AISI 304 Paslanmaz Çelik           │
│    ├─ Ağırlık: 50 kg                                    │
│    └─ Adet: 12                                          │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Otomatik Hesaplama                                   │
│    ├─ Malzeme Maliyeti = (Alış - Hurda) × Kg × Adet    │
│    ├─ Örnek: (150₺ - 30₺) × 50 × 12 = 72.000₺         │
│    └─ İşçilik %50 eklenirse: 72.000 × 1.5 = 108.000₺  │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Kayıt Detayları                                      │
│    ├─ Maliyet: 108.000₺                                 │
│    ├─ Birim: Kaynakhane (maliyet bu birime yüklenir)   │
│    ├─ Sorumluluk: ABC Metal A.Ş. (tedarikçi)           │
│    └─ Durum: Aktif                                      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Raporlama & Analiz                                   │
│    ├─ Kaynakhane'nin maliyetlerine +108.000₺ eklenir   │
│    ├─ ABC Metal A.Ş.'nin tedarikçi maliyetlerine +108k │
│    └─ KPI'lar her iki açıdan da güncellenir            │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 5. DF/8D Oluşturma (İsteğe Bağlı)                      │
│    ├─ Maliyet kaydından direkt DF/8D oluştur           │
│    ├─ Tüm bilgiler otomatik aktarılır                  │
│    ├─ Tedarikçi otomatik seçilir                       │
│    └─ Supplier_non_conformities'e kaydedilir           │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Ana Prensipler

### ✅ Maliyet Hesaplaması

**HER ZAMAN** aşağıdaki bilgiler kullanılır:

1. **Birim (Kaynak)** → ZORUNLU
   - Hangi departmanda maliyet oluştu?
   - Örnek: Kaynakhane, Kaynak Hattı, Ar-Ge, vb.
   
2. **Süre** (Yeniden İşlem için)
   - Ana işlem süresi + Etkilenen birim süreleri
   - Birim başına maliyet × Toplam süre × Adet

3. **Malzeme** (Hurda/Fire için)
   - (Alış fiyatı - Hurda fiyatı) × Ağırlık × Adet
   - İsteğe bağlı %50 işçilik eklenebilir

### 🏢 Sorumluluk Ataması

**Tedarikçi Modu AÇIK** ise:

- ✅ Maliyet **hesaplanır** (birim, süre, malzeme)
- ✅ Kayıt **birime atanır** (Kaynakhane'nin maliyetine girer)
- ✅ **Sorumluluk tedarikçiye** atanır (ABC Metal A.Ş.)
- ✅ Tedarikçi bazlı raporlarda görünür
- ✅ DF/8D uygunsuzluğu oluşturulabilir

**Tedarikçi Modu KAPALI** ise:

- ✅ Maliyet **hesaplanır** (birim, süre, malzeme)
- ✅ Kayıt **sadece birime atanır**
- ❌ Tedarikçi ilişkisi yok
- ❌ Tedarikçi raporlarında görünmez

## 📊 Raporlama Örnekleri

### Birim Bazlı Rapor (Kaynakhane)

```
Kaynakhane - Toplam Kalitesizlik Maliyeti: 250.000₺

├─ Hurda Maliyeti: 150.000₺
│  ├─ İç Kaynaklı: 42.000₺
│  └─ Tedarikçi Kaynaklı: 108.000₺ (ABC Metal A.Ş.)
│
└─ Yeniden İşlem: 100.000₺
   ├─ İç Kaynaklı: 60.000₺
   └─ Tedarikçi Kaynaklı: 40.000₺ (XYZ Ltd.)
```

### Tedarikçi Bazlı Rapor (ABC Metal A.Ş.)

```
ABC Metal A.Ş. - Kalite Performans Özeti

├─ Toplam Maliyet: 108.000₺
│  └─ Hurda Maliyeti: 108.000₺
│
├─ Uygunsuzluk Sayısı: 2
│  ├─ DF-2025-001 (Kapalı)
│  └─ 8D-2025-003 (Açık)
│
└─ Etkilenen Birimler:
   ├─ Kaynakhane: 108.000₺
   └─ Kaynak Hattı: 0₺
```

## 🔑 Temel Kurallar

### 1. Birim Alanı Her Zaman Zorunlu
```
❌ YANLIŞ: "Tedarikçi seçtim, birim girmeye gerek yok"
✅ DOĞRU: "Tedarikçi seçtim VE maliyetin oluştuğu birimi girdim"
```

### 2. Maliyet Hesaplaması Değişmez
```
Tedarikçi modu açık/kapalı olması hesaplamayı ETKİLEMEZ.
Sadece SORUMLULUK ataması değişir.
```

### 3. Çift Taraflı İzlenebilirlik
```
Her maliyet kaydı:
- Birim raporlarında görünür (Kaynakhane)
- Tedarikçi modu açıksa, tedarikçi raporlarında da görünür (ABC Metal)
```

## 📝 Form Kullanım Kılavuzu

### Adım 1: Tedarikçi Modunu Aktif Et
- "Tedarikçi Kaynaklı Maliyet" switch'ini **AÇ**
- Bilgi mesajı görünecek: *"Maliyet hesaplaması: Birim, süre ve malzeme bilgilerine göre normal şekilde yapılacak. Sorumluluk: Bu maliyet seçilen tedarikçiye atanacak."*

### Adım 2: Tedarikçi Seç
- Tedarikçi listesinden seçim yap
- Tedarikçi durumu görüntülenir (Onaylı/Askıya Alınmış)

### Adım 3: Maliyet Bilgilerini Gir
- **Maliyet Türü**: Hurda, Yeniden İşlem, Fire, vb.
- **Birim (Kaynak)**: ZORUNLU - Maliyetin oluştuğu departman
  - ℹ️ Not: "Maliyet bu birime, sorumluluk tedarikçiye"
- **Diğer Bilgiler**: Süre, malzeme, adet, vb.

### Adım 4: Kaydet
- Maliyet hesaplanır
- Birime atanır
- Tedarikçiye bağlanır
- Raporlarda her iki tarafta da görünür

### Adım 5: DF/8D Oluştur (İsteğe Bağlı)
- Kayıt satırında ⋮ menüsünden
- "Tedarikçiye DF Oluştur" veya "Tedarikçiye 8D Oluştur"
- Tüm bilgiler otomatik aktarılır

## 💡 Pratik Örnekler

### Örnek 1: Tedarikçi Kaynaklı Hurda
```
Senaryo: Tedarikçi X'den gelen hatalı sac, Kaynakhane'de hurda oldu.

Form Girişi:
├─ Tedarikçi Kaynaklı: ✅
├─ Tedarikçi: X Sac Sanayi
├─ Maliyet Türü: Hurda Maliyeti
├─ Birim: Kaynakhane
├─ Malzeme: DKP Sac
├─ Ağırlık: 100 kg
├─ Adet: 5
└─ Tutar: 45.000₺ (otomatik hesaplanan)

Sonuç:
- Kaynakhane'nin maliyetlerine +45.000₺
- X Sac Sanayi'nin maliyetlerine +45.000₺
- Her iki raporda da görünür
```

### Örnek 2: Tedarikçi Kaynaklı Yeniden İşlem
```
Senaryo: Tedarikçi Y'den gelen hatalı boya, Boya Hattı'nda yeniden işleme sebep oldu.

Form Girişi:
├─ Tedarikçi Kaynaklı: ✅
├─ Tedarikçi: Y Boya A.Ş.
├─ Maliyet Türü: Yeniden İşlem Maliyeti
├─ Birim: Boya Hattı
├─ Ana İşlem Süresi: 120 dk
├─ Etkilenen Birim: Kalite Kontrol - 30 dk
├─ Adet: 10
└─ Tutar: 18.750₺ (otomatik hesaplanan)

Sonuç:
- Boya Hattı'nın maliyetlerine +18.750₺
- Y Boya A.Ş.'nin maliyetlerine +18.750₺
- Kalite Kontrol'ün süresi de maliyete dahil
```

## 🚀 Avantajlar

1. **Gerçek Maliyet İzleme**: Her birimin gerçek maliyeti görülür
2. **Tedarikçi Performans Takibi**: Hangi tedarikçi ne kadar maliyete sebep oldu?
3. **Doğru Faturalama**: Tedarikçiye yansıtılacak maliyet net
4. **İyileştirme Fırsatları**: Hem iç hem tedarikçi kaynaklı sorunlar görünür
5. **Entegre Sistem**: DF/8D ile direkt bağlantı

---

**Özet**: Tedarikçi modu, maliyetin **hesaplanmasını değil**, **sorumluluğunu** belirler. Maliyet her zaman doğru birime atanır, sorumluluk tedarikçiye gider.


