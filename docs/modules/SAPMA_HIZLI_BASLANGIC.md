# 🚀 Sapma Onayı - Kaynak Kayıt Entegrasyonu | Hızlı Başlangıç

## 📝 Ne Değişti?

Artık sapma onayı oluştururken:
- ✅ **Girdi Kalite Kontrol** kayıtlarından seçim yapabilirsiniz
- ✅ **Karantina** kayıtlarından seçim yapabilirsiniz  
- ✅ **Kalitesizlik Maliyeti** kayıtlarından seçim yapabilirsiniz
- ✅ Veya **manuel** oluşturabilirsiniz

---

## ⚡ 3 Adımda Başlangıç

### 1️⃣ SQL Migration'ı Çalıştır

**Supabase Dashboard'a gidin:**
1. SQL Editor'ı açın
2. `scripts/add-source-records-to-deviations.sql` dosyasını açın
3. İçeriği kopyalayın ve çalıştırın (Run)

### 2️⃣ Sapma Oluştur

**Sapma Yönetimi > Yeni Sapma Kaydı:**

| Manuel Oluştur | Mevcut Kayıttan |
|---------------|----------------|
| Klasik yöntem | Kaynak kayıt seçimi |
| Tüm alanları doldur | Otomatik doldurulur |
| İlişki yok | Kaynak kayıt takibi |

### 3️⃣ Test Et

1. **Girdi Kontrol:** Şartlı kabul/Red kaydından sapma oluştur
2. **Karantina:** Karantinada bekleyen kayıttan sapma oluştur
3. **Kalite Maliyeti:** Maliyet kaydından sapma oluştur

---

## 🎯 Kullanım Örneği

### Senaryo: Şartlı Kabul Edilen Parçadan Sapma

```
1. Girdi Kontrol'de → Parça "Şartlı Kabul" edildi
2. Sapma Modülüne Git
3. "Yeni Sapma Kaydı" → "Mevcut Kayıttan"
4. "Girdi Kontrol" tab'ı → Kaydı bul ve seç
5. ✨ Form otomatik doldu:
   - Parça Kodu: ✅
   - Açıklama: ✅
   - Kaynak Detayları: ✅
6. Eksik alanları tamamla (Talep No, Birim, vb.)
7. Kaydet 🎉
8. Detay'da kaynak kayıt bilgisi görünsün
```

---

## 📦 Dosya Yapısı

```
scripts/
└── add-source-records-to-deviations.sql    # 🔧 SQL Migration

src/components/deviation/
├── SourceRecordSelector.jsx                # 🆕 Kaynak seçici
├── DeviationFormModal.jsx                  # 🔄 Güncellendi
└── DeviationDetailModal.jsx                # 🔄 Güncellendi
```

---

## 🔑 Temel Özellikler

### Kaynak Kayıt Seçici

| Özellik | Açıklama |
|---------|----------|
| 🔍 **Arama** | Parça kodu, tedarikçi, kayıt no ile ara |
| 📑 **Tab'lar** | Girdi Kontrol / Karantina / Kalite Maliyeti |
| 🎯 **Seçim** | Kartı tıkla → Form otomatik dolsun |
| 🧹 **Temizle** | Seçimi iptal et |
| 📊 **Filtreler** | Sadece ilgili kayıtlar (Şartlı Kabul, Red, vb.) |

### Otomatik Doldurma

```javascript
Seçilen Kayıt:
{
  part_code: "12345-ABC",
  quantity: 100,
  supplier_name: "XYZ Tedarikçi"
}

↓ Otomatik Doldurulur ↓

Form:
{
  part_code: "12345-ABC",          // ✅
  description: "Girdi Kontrol...", // ✅
  source_type: "incoming_...",     // ✅
  source_record_details: {...}     // ✅
}
```

---

## 🎨 UI Değişiklikleri

### Yeni Form

```
┌─────────────────────────────────────┐
│  📝 Manuel Oluştur | 🔗 Mevcut Kayıttan │ ← Tab'lar
├─────────────────────────────────────┤
│  [Mevcut Kayıttan seçiliyse]       │
│  ┌───────────────────────────────┐ │
│  │ 🔍 Ara... (parça kodu, vb.)   │ │
│  └───────────────────────────────┘ │
│                                     │
│  [📦 Girdi  ⚠️ Karantina  💰 Maliyet] │ ← Alt Tab'lar
│                                     │
│  ┌─────────────────────────┐       │
│  │ ✅ Seçili: 12345-ABC    │       │ ← Seçili kayıt
│  │    Miktar: 100          │       │
│  │    Tedarikçi: XYZ       │       │
│  └─────────────────────────┘       │
│                                     │
│  ┌─────────────────────────┐       │
│  │ 📦 12345-ABC            │       │ ← Kayıt kartları
│  │ INC-2025-001 • XYZ      │       │
│  │ Hatalı: 10 | Red        │       │
│  └─────────────────────────┘       │
│  ...                                │
└─────────────────────────────────────┘
```

### Detay Modal

```
┌─────────────────────────────────────┐
│  Sapma Detayı                       │
├─────────────────────────────────────┤
│  [Kaynak kayıt varsa gösterilir]    │
│  ┌─────────────────────────────┐   │
│  │ 🔗 Kaynak Kayıt Bilgisi     │   │ ← Özel kart
│  │ 📦 Girdi Kalite Kontrol     │   │
│  │ Parça: 12345-ABC            │   │
│  │ Miktar: 100                 │   │
│  │ Tedarikçi: XYZ Tedarikçi    │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Sapma Detayları]                  │
│  ...                                │
└─────────────────────────────────────┘
```

---

## ⚠️ Önemli!

### ✅ Yapılması Gerekenler
1. **SQL Migration** - Önce çalıştırın!
2. **Test Et** - Her 3 kaynak tipi ile
3. **Dokümantasyon** - `SAPMA_KAYNAK_KAYIT_ENTEGRASYONU.md` okuyun

### ❌ Dikkat Edilmesi Gerekenler
- Migration çalıştırılmadan özellik **çalışmaz**
- Düzenleme modunda kaynak seçim **görünmez**
- Kaynak kayıt silinse bile sapma kaydı **korunur**

---

## 🆘 Hata Çözümleri

| Hata | Çözüm |
|------|-------|
| "column does not exist" | SQL migration'ı çalıştırın |
| Kayıt görünmüyor | Durumu kontrol edin (Şartlı Kabul, Red, Karantinada) |
| Otomatik doldurma yok | Console'da hata kontrol edin |

---

## 📞 Destek

Daha fazla bilgi için:
- 📖 `SAPMA_KAYNAK_KAYIT_ENTEGRASYONU.md` - Detaylı döküman
- 🔧 `scripts/add-source-records-to-deviations.sql` - Migration dosyası
- 🎨 `src/components/deviation/SourceRecordSelector.jsx` - Kaynak kod

---

## ✨ Özet

```
Manuel Oluştur          Mevcut Kayıttan
      ↓                        ↓
  Elle doldur           Kayıt seç
      ↓                        ↓
   Kaydet               Otomatik dolsun
      ↓                        ↓
Kaynak yok              Kaynak takibi ✅
```

**Avantajlar:**
- ⚡ Hızlı sapma oluşturma
- 🔗 Kaynak kayıt takibi
- 🎯 Otomatik veri doldurma
- 📊 Tutarlı veri girişi

---

**Haydi başlayalım! 🚀**

