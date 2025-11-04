# 🔗 Sapma Onayı - Kaynak Kayıt Entegrasyonu

## 📋 Genel Bakış

Sapma onayı oluştururken artık **mevcut kayıtlardan** (Girdi Kalite Kontrol, Karantina, Kalitesizlik Maliyetleri) seçim yapabilir veya **manuel** olarak oluşturabilirsiniz.

---

## ✨ Özellikler

### 1️⃣ **Kaynak Kayıt Seçimi**

Sapma onayı oluştururken 2 mod arasından seçim yapabilirsiniz:

#### 📝 Manuel Oluştur
- Klasik yöntem
- Tüm alanları manuel olarak doldurun
- Hiçbir kayıt ile ilişkilendirilmez

#### 🔗 Mevcut Kayıttan
Şu kaynaklardan seçim yapabilirsiniz:

1. **📦 Girdi Kalite Kontrol**
   - Şartlı kabul edilmiş kayıtlar
   - Red edilmiş kayıtlar
   - Otomatik doldurulur: Parça kodu, hatalı miktar, tedarikçi, hata tipi

2. **⚠️ Karantina**
   - Karantinada bekleyen kayıtlar
   - Otomatik doldurulur: Parça kodu, miktar, karantina sebebi, konum

3. **💰 Kalitesizlik Maliyetleri**
   - Tüm maliyet kayıtları
   - Otomatik doldurulur: Parça kodu, maliyet türü, birim, tutar

### 2️⃣ **Otomatik Veri Doldurma**

Kaynak kayıt seçildiğinde şu alanlar otomatik doldurulur:
- ✅ Parça Kodu
- ✅ Açıklama (kaynak kayıt bilgisi ile)
- ✅ Kaynak kayıt detayları (JSON)

### 3️⃣ **Kaynak Kayıt Takibi**

- Her sapma kaydı hangi kaynak kayıttan geldiğini gösterir
- Detay modalında kaynak kayıt bilgisi görüntülenir
- Tedarikçi, miktar, hata tipi gibi ek bilgiler saklanır

---

## 🚀 Kullanım

### Adım 1: SQL Migration'ı Çalıştırın

**scripts/add-source-records-to-deviations.sql** dosyasını Supabase SQL Editor'de çalıştırın:

```bash
# Supabase Dashboard > SQL Editor > New Query
# Dosya içeriğini yapıştırın ve Run
```

**Eklenen kolonlar:**
- `source_type` - Kaynak tipi (incoming_inspection, quarantine, quality_cost, manual)
- `source_record_id` - Kaynak kayıt ID'si (UUID)
- `source_record_details` - Kaynak kayıt detayları (JSONB)

### Adım 2: Sapma Onayı Oluşturun

1. **Sapma Yönetimi** modülüne gidin
2. **"Yeni Sapma Kaydı"** butonuna tıklayın
3. İki seçenekten birini seçin:
   - **"Manuel Oluştur"** - Klasik yöntem
   - **"Mevcut Kayıttan"** - Kaynak kayıt seçimi

#### Mevcut Kayıttan Oluşturma:

1. **Tab seçin**: Girdi Kontrol / Karantina / Kalite Maliyeti
2. **Arama yapın**: Parça kodu, tedarikçi, kayıt no ile filtreleyin
3. **Kayıt seçin**: İlgili kartı tıklayın
4. **Otomatik doldurulur**: Form alanları kaynak kayıt ile doldurulur
5. **Tamamlayın**: Eksik alanları doldurun ve kaydedin

### Adım 3: Kaynak Kayıt Takibi

Detay modalinde kaynak kayıt bilgilerini görüntüleyin:
- 📍 Kaynak kayıt tipi (Girdi Kontrol, Karantina, vb.)
- 📦 Parça kodu ve miktar
- 🏭 Tedarikçi bilgisi (varsa)
- 📝 Ek detaylar (hata tipi, konum, maliyet türü, vb.)

---

## 📊 Veri Yapısı

### source_type Değerleri

```sql
'incoming_inspection' -- Girdi Kalite Kontrol
'quarantine'          -- Karantina
'quality_cost'        -- Kalitesizlik Maliyeti
'manual'              -- Manuel (varsayılan)
```

### source_record_details Örneği

```json
{
  "part_code": "12345-ABC",
  "quantity": 100,
  "supplier": "XYZ Tedarikçi A.Ş.",
  "inspection_number": "INC-2025-001",
  "status": "Şartlı Kabul",
  "defect_type": "Boyut Hatası"
}
```

---

## 🔍 Filtreleme ve Arama

### SourceRecordSelector Özellikleri

- ✅ Gerçek zamanlı arama
- ✅ Tab bazlı kategori seçimi
- ✅ Durum badge'leri (Şartlı Kabul, Red, Karantinada, vb.)
- ✅ Detaylı kayıt kartları
- ✅ Seçili kayıt vurgulama
- ✅ Temizleme butonu

### Arama Kriterleri

| Kaynak Tipi | Arama Alanları |
|------------|----------------|
| Girdi Kontrol | Parça kodu, Tedarikçi, Muayene numarası |
| Karantina | Parça kodu, Karantina numarası, Sebep |
| Kalite Maliyeti | Parça kodu, Birim, Maliyet türü |

---

## 🎨 UI/UX Özellikleri

### Form Modunda
- 🔄 Tab bazlı mod seçimi (Manuel / Kayıttan)
- 🎯 Seçili kayıt vurgulama (Primary border)
- 📋 Kayıt kartları (hover efekti ile)
- 🔍 Anlık arama ve filtreleme
- ✅ Seçili kayıt özet kartı

### Detay Modalında
- 🔗 Kaynak kayıt bilgi kartı (Primary border)
- 📦 İkon bazlı kaynak tipi gösterimi
- 📊 Grid layout ile detay bilgileri
- 🏷️ Badge ile kategori gösterimi

---

## ⚠️ Önemli Notlar

### Veritabanı
1. **Migration zorunludur** - Çalıştırmadan özellik çalışmaz
2. **Geriye uyumlu** - Mevcut sapma kayıtları `source_type: 'manual'` olarak işaretlenir
3. **Cascade delete YOK** - Kaynak kayıt silinse bile sapma kaydı korunur

### Form Davranışı
1. **Düzenleme modunda** kaynak seçim tab'ı görünmez
2. **Manuel moddan** kayıttan moda geçiş yapılabilir
3. **Otomatik doldurma** mevcut değerleri ezlemez (sadece boş alanları doldurur)

### Performans
1. Her tab için **maksimum 100 kayıt** yüklenir
2. **Anlık arama** client-side filtreleme kullanır
3. **Lazy loading** - Tab değiştiğinde veri yüklenir

---

## 🧪 Test Senaryoları

### Senaryo 1: Girdi Kontrolden Sapma
1. Girdi Kontrol'de şartlı kabul kaydı oluşturun
2. Sapma modülüne gidin
3. "Mevcut Kayıttan" seçin
4. Girdi Kontrol tab'ında kaydı bulun ve seçin
5. Form otomatik doldurulsun
6. Eksik bilgileri tamamlayın
7. Kaydedin
8. Detay modalında kaynak kayıt bilgisini görüntüleyin

### Senaryo 2: Karantinadan Sapma
1. Karantinada bekleyen kayıt olsun
2. Sapma oluşturun - "Mevcut Kayıttan"
3. Karantina tab'ında seç
4. Kaydet
5. Kaynak bilgisi doğru gösterilsin

### Senaryo 3: Kalite Maliyetinden Sapma
1. Kalitesizlik maliyeti kaydı var
2. Sapma oluştur - kayıttan
3. Kalite Maliyeti tab'ı
4. Seç ve kaydet
5. Maliyet bilgileri görünsün

---

## 📚 Teknik Detaylar

### Bileşenler

```
src/components/deviation/
├── SourceRecordSelector.jsx      # Kaynak kayıt seçici
├── DeviationFormModal.jsx         # Güncellenmiş form (tab'lar ile)
└── DeviationDetailModal.jsx       # Güncellenmiş detay (kaynak bilgisi ile)
```

### State Yönetimi

```javascript
// DeviationFormModal
const [creationMode, setCreationMode] = useState('manual');
const [selectedSourceRecord, setSelectedSourceRecord] = useState(null);

// SourceRecordSelector
const [activeTab, setActiveTab] = useState('incoming_inspection');
const [selectedRecord, setSelectedRecord] = useState(null);
```

### Veri Akışı

```
SourceRecordSelector
  ↓ onSelect callback
DeviationFormModal (handleSourceRecordSelect)
  ↓ autoFillData + enrichedRecord
Form State (formData, selectedSourceRecord)
  ↓ handleSubmit
Supabase (deviations table)
```

---

## 🆘 Sorun Giderme

### SQL Migration Hatası
```
ERROR: column "source_type" already exists
```
**Çözüm:** Migration daha önce çalıştırılmış, sorun yok.

### Kayıt Seçilmiyor
- **Kontrol:** Kayıtların durumu uygun mu? (Şartlı Kabul, Red, Karantinada)
- **Kontrol:** Arama terimi doğru mu?
- **Kontrol:** Console'da hata var mı?

### Otomatik Doldurma Çalışmıyor
- **Kontrol:** `handleSourceRecordSelect` callback çalışıyor mu?
- **Kontrol:** `formData` state güncellenebiliyor mu?
- **Debug:** Console.log ekleyerek veri akışını kontrol edin

---

## 🎯 Gelecek Geliştirmeler

- [ ] Kaynak kayıt kartında "Detayları Gör" butonu
- [ ] Sapma listesinde kaynak kayıt filtresi
- [ ] Kaynak kayıt değişiklik geçmişi
- [ ] Toplu sapma oluşturma (birden fazla kayıttan)
- [ ] Excel'den kaynak kayıt import
- [ ] Kaynak kayıt bildirimleri
- [ ] Kaynak kayıt istatistikleri (hangi modülden en çok sapma gelir)

---

## ✅ Tamamlandı!

Sapma Onayı - Kaynak Kayıt Entegrasyonu başarıyla tamamlandı! 🎉

**Özellikler:**
- ✅ SQL Migration scriptleri
- ✅ SourceRecordSelector bileşeni
- ✅ DeviationFormModal güncellemesi
- ✅ DeviationDetailModal güncellemesi
- ✅ Otomatik veri doldurma
- ✅ Kaynak kayıt takibi
- ✅ UI/UX iyileştirmeleri

**Sonraki Adım:** SQL migration'ı çalıştırın ve test edin!

