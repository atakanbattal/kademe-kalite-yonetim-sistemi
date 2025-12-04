# Polivalans Modülü Geliştirmeleri Kılavuzu

## 🎯 Özet
Polivalans modülüne kapsamlı geliştirmeler yapıldı:
1. **Departman bazlı yetkinlik yönetimi**
2. **Analytics grafiklerinin düzeltilmesi**
3. **Eğitim modülü ile tam entegrasyon**

## 📋 Yapılması Gerekenler

### 1. Veritabanı Migration'ı Çalıştırın

**ÖNEMLI:** Bu özellikler için veritabanında yeni alanlar eklenmesi gerekiyor.

#### Supabase Dashboard'dan (ÖNERİLEN)
1. [Supabase Dashboard](https://app.supabase.com) adresine gidin
2. Projenizi seçin
3. Sol menüden **SQL Editor**'ü tıklayın
4. Aşağıdaki SQL komutunu kopyalayın ve **Run** butonuna tıklayın:

```sql
-- Polivalans modülüne departman bazlı yetkinlik yönetimi ekleme
ALTER TABLE skill_categories 
ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE skills 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Index oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_skill_categories_department 
ON skill_categories(department);

CREATE INDEX IF NOT EXISTS idx_skills_department 
ON skills(department);

-- Comment ekle
COMMENT ON COLUMN skill_categories.department IS 'Bu kategori hangi departmana ait (NULL ise tüm departmanlarda görünür)';
COMMENT ON COLUMN skills.department IS 'Bu yetkinlik hangi departmana ait (NULL ise tüm departmanlarda görünür)';
```

5. **"Success. No rows returned"** mesajını görmelisiniz ✅

#### Alternatif: Shell Script ile
```bash
cd "/Users/atakanbattal/Downloads/Kademe Code"
chmod +x scripts/add-department-to-polyvalence.sql
# Manuel olarak Supabase'de çalıştırın
```

---

## ✨ Yeni Özellikler

### 1. Departman Bazlı Yetkinlik Yönetimi

#### Nasıl Kullanılır?
1. **Polivalans Matrisi** > **Yetkinlik Yönetimi** sekmesine gidin
2. **Yeni Kategori** veya **Yeni Yetkinlik** butonuna tıklayın
3. **Departman** dropdown'ından seçim yapın:
   - **"Tüm Departmanlar (Genel)"**: Kategori/yetkinlik herkese görünür
   - **Belirli bir departman**: Sadece o departmandaki personele görünür

#### Avantajları
- Her departman kendi yetkinliklerini yönetebilir
- Üretim, Kalite, Mühendislik vb. farklı yetkinlik setleri
- Departman seçildiğinde sadece ilgili yetkinlikler görünür
- NULL department = Genel (tüm departmanlarda görünür)

#### Filtreleme
- Ana ekranda departman seçildiğinde:
  - Sadece o departmana ait kategoriler gösterilir
  - Sadece o departmana ait yetkinlikler gösterilir
  - Genel kategoriler/yetkinlikler her zaman görünür

---

### 2. Analytics Grafikleri Düzeltmeleri

#### Departman Polivalans Skorları
- Grafik artık doğru çalışıyor
- Her departmanın ortalama polivalans skoru gösteriliyor
- Filtreleme ile uyumlu

#### En Yüksek Polivalans Skorları
- Top 10 personel listesi düzeltildi
- Personnel bilgisi doğru şekilde gösteriliyor
- Departman ve ad bilgisi eksiksiz

---

### 3. Polivalans-Eğitim Modülü Entegrasyonu

#### 🎓 Eğitim Oluşturma Butonu

**Kullanım Senaryosu 1: Eğitim İhtiyacından**
1. **Polivalans Matrisi** > **Eğitim İhtiyacı** sekmesine gidin
2. Eğitim gerektiren yetkinliklerin listesini görün
3. İstediğiniz kayıt için **"Eğitim Oluştur"** butonuna tıklayın
4. **Otomatik olarak:**
   - Eğitim Yönetimi modülüne yönlendirilirsiniz
   - Eğitim formu açılır
   - **Eğitim Adı**: Yetkinlik adı otomatik doldurulur (örn: "TIG Kaynak Eğitimi")
   - **Kategori**: "Polivalans" olarak işaretlenir
   - **İlgili Yetkinlik**: Otomatik seçilir
   - **Katılımcılar**: Personel otomatik eklenir
   - **Hedefler**: Yetkinlik açıklaması otomatik yazılır

**Kullanım Senaryosu 2: Sertifika Yenileme**
1. **Eğitim İhtiyacı** sekmesinde **Sertifika Geçerlilik Uyarıları** kartına gidin
2. Süresi dolan/yaklaşan sertifikalar listelenir
3. **"Yenileme Eğitimi"** butonuna tıklayın
4. Eğitim formu otomatik doldurulur

#### 🔄 Entegrasyon Özellikleri

**Eğitim Formu Değişiklikleri:**
- **Yeni kategori**: "Polivalans" kategorisi eklendi
- **Yetkinlik Seçimi**: Polivalans eğitimlerinde yetkinlik dropdown'ı gösteriliyor
- **Opsiyonel Alan**: Yetkinlik seçimi zorunlu değil (genel eğitimler de yapılabilir)
- **Otomatik Doldurma**: Polivalans modülünden gelindiyse tüm alanlar otomatik

**Veri Akışı:**
```
Polivalans İhtiyacı → [Eğitim Oluştur] → Eğitim Modülü
    ↓                                          ↓
[Yetkinlik ID]                    [Form Otomatik Doldurulur]
[Personel ID]                     [Katılımcı Eklenir]
[Yetkinlik Adı]                   [Başlık: "{Yetkinlik} Eğitimi"]
```

---

## 🧪 Test Senaryoları

### Test 1: Departman Bazlı Yetkinlik Tanımlama
1. **Polivalans Matrisi** > **Yetkinlik Yönetimi** sekmesine gidin
2. **Yeni Kategori** oluşturun:
   - Ad: "Üretim Yetkinlikleri"
   - Departman: "Üretim"
   - Renk seçin
3. **Yeni Yetkinlik** oluşturun:
   - Ad: "Pres Operatörlüğü"
   - Kategori: "Üretim Yetkinlikleri"
   - Departman: "Üretim"
4. Ana filtreden **"Üretim"** seçin
5. ✅ Sadece Üretim yetkinlikleri gözükmeli

### Test 2: Genel Yetkinlik Tanımlama
1. **Yeni Yetkinlik** oluşturun:
   - Ad: "İSG Temel Eğitimi"
   - Departman: "Tüm Departmanlar (Genel)"
2. Farklı departmanlar seçin
3. ✅ Her departmanda bu yetkinlik gözükmeli

### Test 3: Eğitim İhtiyacından Eğitim Oluşturma
1. **Polivalans Matrisi** açın
2. Bir personele bir yetkinlik ekleyin ve **"Eğitim Gerekli"** işaretleyin
3. **Eğitim İhtiyacı** sekmesine gidin
4. **"Eğitim Oluştur"** butonuna tıklayın
5. ✅ Eğitim modülü açılmalı
6. ✅ Form otomatik doldurulmalı
7. ✅ Personel katılımcı olarak eklenmiş olmalı
8. ✅ Yetkinlik seçilmiş olmalı

### Test 4: Sertifika Yenileme Eğitimi
1. **Eğitim İhtiyacı** > **Sertifika Uyarıları**
2. **"Yenileme Eğitimi"** butonuna tıklayın
3. ✅ Eğitim formu açılmalı ve otomatik doldurulmalı

### Test 5: Analytics Grafikleri
1. **Analiz & Raporlar** sekmesine gidin
2. ✅ Departman Polivalans Skorları grafiği dolu olmalı
3. ✅ En Yüksek Polivalans Skorları listesi gösterilmeli
4. ✅ İsimler ve departmanlar doğru görünmeli

---

## 🗄️ Veritabanı Değişiklikleri

### Yeni Kolonlar

#### `skill_categories` Tablosu
```sql
department TEXT  -- NULL = Tüm departmanlar (genel)
```

#### `skills` Tablosu
```sql
department TEXT  -- NULL = Tüm departmanlar (genel)
```

#### `trainings` Tablosu (Mevcut)
```sql
polyvalence_skill_id UUID  -- İlgili polivalans yetkinliği (FK: skills.id)
```

### Indexler
- `idx_skill_categories_department` - Hızlı filtreleme
- `idx_skills_department` - Hızlı filtreleme

---

## 🐛 Sorun Giderme

### Hata: "column department does not exist"
- **Sebep:** Migration henüz çalıştırılmadı
- **Çözüm:** Yukarıdaki SQL komutunu Supabase Dashboard'da çalıştırın

### Kategori veya Yetkinlik Göremiyorum
- **Kontrol 1:** Doğru departman seçili mi?
- **Kontrol 2:** Kategori/yetkinlik o departmana mı ait?
- **Kontrol 3:** "Tüm Departmanlar" seçilmiş mi?

### Eğitim Formu Açılmıyor
- **Kontrol 1:** Tarayıcı console'da hata var mı? (F12)
- **Kontrol 2:** Eğitim modülüne yönlendirme yapıldı mı?
- **Kontrol 3:** Hard refresh yapın (Ctrl+F5)

### Grafikler Boş Görünüyor
- **Kontrol 1:** Polivalans verileri var mı?
- **Kontrol 2:** polyvalence_summary view'i dolu mu?
- **Kontrol 3:** Filtreleme çok dar mı? (Tüm Departmanlar'ı deneyin)

---

## 📊 Veri Akış Diyagramı

```
┌─────────────────────┐
│  Polivalans Modülü  │
└──────────┬──────────┘
           │
           │ 1. Eğitim Gereksinimi Tespit
           │
           ▼
┌─────────────────────┐
│ Eğitim İhtiyacı Tab │
│ - training_required │
│ - training_priority │
└──────────┬──────────┘
           │
           │ 2. "Eğitim Oluştur" Butonu
           │
           ▼
┌─────────────────────┐
│    navigate('/training', {
│      state: {
│        selectedPersonnel: [id],
│        selectedSkillId: skillId,
│        autoOpenModal: true
│      }
│    })
└──────────┬──────────┘
           │
           │ 3. Yönlendirme
           │
           ▼
┌─────────────────────┐
│  Eğitim Modülü      │
│  TrainingPlansTab   │
└──────────┬──────────┘
           │
           │ 4. location.state kontrolü
           │
           ▼
┌─────────────────────┐
│ TrainingFormModal   │
│ - Otomatik Doldurma │
│ - polyvalence_skill_id
│ - title, category   │
│ - participants      │
└─────────────────────┘
```

---

## 🎓 Eğitim-Polivalans Bağlantısı

Eğitim tamamlandığında:
1. **trainings** tablosuna kayıt eklenir
2. **polyvalence_skill_id** alanı doldurulur
3. Eğitim sonrası personel yetkinlik seviyesi güncellenebilir
4. **personnel_skills** tablosunda:
   - `last_training_date` güncellenir
   - `training_required` false yapılır
   - `current_level` artırılabilir

---

## 📝 Notlar

- **Geriye Dönük Uyumluluk:** Mevcut yetkinlikler etkilenmez (department NULL)
- **NULL Değer:** NULL department = Genel (tüm departmanlarda görünür)
- **Filtreleme Mantığı:** `!skill.department || skill.department === selectedDepartment`
- **Otomatik Başlık:** `{Yetkinlik Adı} Eğitimi` formatında oluşturulur

---

## ✅ Checklist

- [ ] Veritabanı migration'ı çalıştırıldı
- [ ] Yeni kategori oluşturulabildi (departman ile)
- [ ] Yeni yetkinlik oluşturulabildi (departman ile)
- [ ] Departman filtresi çalışıyor
- [ ] Analytics grafikleri düzgün görünüyor
- [ ] Eğitim İhtiyacı sekmesinde buton görünüyor
- [ ] "Eğitim Oluştur" butonu yönlendiriyor
- [ ] Eğitim formu otomatik dolduruluyor
- [ ] Yetkinlik dropdown'ı çalışıyor
- [ ] Polivalans kategorisi seçilebiliyor

---

**Başarılı testler! 🎉**

