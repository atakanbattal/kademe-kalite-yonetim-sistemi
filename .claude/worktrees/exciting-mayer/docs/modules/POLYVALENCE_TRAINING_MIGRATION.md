# 🔧 Polivalans-Eğitim Entegrasyonu Migration Kılavuzu

## 📋 Genel Bakış

Bu migration, **Polivalans Modülü** ve **Eğitim Yönetimi Modülü** entegrasyonu için gerekli veritabanı değişikliklerini yapar.

### 🎯 Amaç
- `trainings` tablosuna `polyvalence_skill_id` kolonu eklemek
- Polivalans modülünden oluşturulan eğitimleri ilgili yetkinlikle ilişkilendirmek
- Toplu eğitim oluşturma özelliğini desteklemek

---

## 🚀 Migration Adımları

### ⚡ HIZLI ÇÖZÜM (Supabase SQL Editor)

1. **Supabase Dashboard'a Giriş Yapın**
   - https://supabase.com/dashboard adresine gidin
   - Projenizi seçin: `Kademe-KYS`

2. **SQL Editor'ü Açın**
   - Sol menüden **SQL Editor** seçeneğine tıklayın
   - **New Query** butonuna basın

3. **Migration SQL'ini Yapıştırın**
   - Aşağıdaki SQL kodunu kopyalayıp yapıştırın:

```sql
-- Eğitim yönetimi ve polivalans modülü entegrasyonu için
-- trainings tablosuna polyvalence_skill_id kolonu ekleme

-- 1. polyvalence_skill_id kolonunu ekle
ALTER TABLE trainings 
ADD COLUMN IF NOT EXISTS polyvalence_skill_id UUID;

-- 2. Foreign key constraint ekle
ALTER TABLE trainings
ADD CONSTRAINT fk_trainings_polyvalence_skill
FOREIGN KEY (polyvalence_skill_id)
REFERENCES skills(id)
ON DELETE SET NULL;

-- 3. Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_trainings_polyvalence_skill_id 
ON trainings(polyvalence_skill_id);

-- 4. Açıklama ekle
COMMENT ON COLUMN trainings.polyvalence_skill_id IS 
'Polivalans modülünden oluşturulan eğitimler için ilgili yetkinlik ID''si. NULL ise genel eğitim.';

-- Migration başarılı oldu mu kontrol et
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trainings' 
        AND column_name = 'polyvalence_skill_id'
    ) THEN
        RAISE NOTICE '✅ Migration başarılı: polyvalence_skill_id kolonu eklendi';
    ELSE
        RAISE EXCEPTION '❌ Migration başarısız: polyvalence_skill_id kolonu eklenemedi';
    END IF;
END $$;
```

4. **SQL'i Çalıştırın**
   - **RUN** veya **Çalıştır** butonuna basın
   - Başarı mesajını bekleyin: `✅ Migration başarılı`

5. **Sonucu Doğrulayın**
   - Aşağıdaki kontrol sorgusunu çalıştırın:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'trainings' 
    AND column_name = 'polyvalence_skill_id';
```

**Beklenen Sonuç:**
```
column_name              | data_type | is_nullable
------------------------|-----------|------------
polyvalence_skill_id    | uuid      | YES
```

---

## 📊 Değişiklikler

### Yeni Kolon: `polyvalence_skill_id`

| Özellik | Değer |
|---------|-------|
| **Tablo** | `trainings` |
| **Kolon Adı** | `polyvalence_skill_id` |
| **Veri Tipi** | `UUID` |
| **Nullable** | `YES` |
| **Foreign Key** | `skills(id)` |
| **On Delete** | `SET NULL` |
| **Index** | `idx_trainings_polyvalence_skill_id` |

### 🔗 İlişki Diyagramı

```
┌─────────────────┐         ┌─────────────────┐
│    skills       │         │    trainings    │
├─────────────────┤         ├─────────────────┤
│ id (PK)         │◄────────┤ polyvalence_    │
│ name            │         │   skill_id (FK) │
│ code            │         │ title           │
│ department      │         │ category        │
│ ...             │         │ ...             │
└─────────────────┘         └─────────────────┘
```

---

## ✅ Doğrulama ve Test

### 1. Kolon Varlık Kontrolü
```sql
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trainings' 
    AND column_name = 'polyvalence_skill_id'
) AS kolon_var_mi;
```
**Beklenen:** `true`

### 2. Foreign Key Kontrolü
```sql
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'trainings'
    AND kcu.column_name = 'polyvalence_skill_id';
```
**Beklenen:** `fk_trainings_polyvalence_skill` constraint görünmeli

### 3. Index Kontrolü
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'trainings' 
    AND indexname = 'idx_trainings_polyvalence_skill_id';
```
**Beklenen:** `idx_trainings_polyvalence_skill_id` görünmeli

### 4. Test Verisi Ekle
```sql
-- Önce bir skill seç
SELECT id, name FROM skills LIMIT 1;

-- Ardından test eğitimi ekle (yukarıdaki skill id'yi kullan)
INSERT INTO trainings (
    title, 
    category, 
    polyvalence_skill_id
) VALUES (
    'Test Polivalans Eğitimi',
    'Polivalans',
    '<yukarıdaki_skill_id>'
) RETURNING *;
```

### 5. Test Verisini Sil (Cleanup)
```sql
DELETE FROM trainings 
WHERE title = 'Test Polivalans Eğitimi';
```

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Polivalans Modülünden Toplu Eğitim
```javascript
// Frontend: TrainingNeedsAnalysis.jsx
const handleCreateBulkTraining = async (skill, personnelList) => {
    const personnelIds = personnelList.map(p => p.id);
    
    navigate('/training', {
        state: {
            selectedPersonnel: personnelIds,
            selectedSkillId: skill.id,  // ✅ Bu skill_id polyvalence_skill_id olarak kaydedilecek
            fromPolyvalence: true
        }
    });
};
```

### Senaryo 2: Eğitim Formunda Otomatik Doldurma
```javascript
// Frontend: TrainingFormModal.jsx
if (polyvalenceData) {
    const selectedSkill = skills.find(s => s.id === polyvalenceData.selectedSkillId);
    setFormData(prev => ({
        ...prev,
        title: `${selectedSkill.name} Eğitimi`,
        category: 'Polivalans',
        polyvalence_skill_id: polyvalenceData.selectedSkillId  // ✅ Otomatik set
    }));
}
```

### Senaryo 3: Eğitim Kaydı Oluşturma
```javascript
// Backend: TrainingFormModal.jsx - handleSave
const trainingData = {
    title: formData.title,
    category: formData.category,
    polyvalence_skill_id: formData.polyvalence_skill_id || null,  // ✅ NULL ise genel eğitim
    // ... diğer alanlar
};

const { data, error } = await supabase
    .from('trainings')
    .insert(trainingData);
```

### Senaryo 4: Polivalans Eğitimlerini Filtreleme
```sql
-- Sadece polivalans eğitimlerini getir
SELECT * FROM trainings 
WHERE polyvalence_skill_id IS NOT NULL;

-- Belirli bir yetkinlik için eğitimleri getir
SELECT 
    t.*,
    s.name AS skill_name,
    s.code AS skill_code
FROM trainings t
INNER JOIN skills s ON t.polyvalence_skill_id = s.id
WHERE t.polyvalence_skill_id = '<skill_id>';
```

---

## 🐛 Sorun Giderme

### Hata 1: "column already exists"
**Neden:** Kolon zaten eklenmiş.
**Çözüm:** Normal, migration tekrar çalıştırılabilir (`IF NOT EXISTS` kullanılmış).

### Hata 2: "foreign key constraint fails"
**Neden:** `skills` tablosu bulunamıyor veya ilişki hatası.
**Çözüm:** 
```sql
-- skills tablosunun var olduğunu kontrol et
SELECT COUNT(*) FROM skills;
```

### Hata 3: "permission denied"
**Neden:** Yetersiz veritabanı yetkileri.
**Çözüm:** Supabase Dashboard'da **Admin** rolüyle SQL Editor kullanın.

### Hata 4: Migration sonrası uygulama hatası veriyor
**Neden:** RLS (Row Level Security) politikaları eksik olabilir.
**Çözüm:**
```sql
-- trainings tablosu için RLS kontrolü
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'trainings';

-- Eğer true ise, mevcut politikaları kontrol et
SELECT * FROM pg_policies WHERE tablename = 'trainings';
```

---

## 📚 Referans

### İlgili Dosyalar
- `src/components/polyvalence/TrainingNeedsAnalysis.jsx` - Toplu eğitim UI
- `src/components/training/TrainingFormModal.jsx` - Eğitim formu
- `src/components/training/TrainingPlansTab.jsx` - Eğitim listesi
- `scripts/add-polyvalence-skill-to-trainings.sql` - Migration SQL

### İlgili Migration'lar
1. `scripts/create-polyvalence-module.sql` - Polivalans modülü oluşturma
2. `scripts/add-department-to-polyvalence.sql` - Departman desteği
3. `scripts/create-polyvalence-views.sql` - Analitik view'ler
4. **`scripts/add-polyvalence-skill-to-trainings.sql`** ← **BU MİGRATİON**

---

## 🎉 Migration Sonrası

Migration başarılı olduktan sonra:

1. ✅ Uygulamayı yeniden başlatın
2. ✅ Polivalans > Eğitim İhtiyacı sekmesine gidin
3. ✅ "Toplu Eğitim Oluştur" butonuna tıklayın
4. ✅ Eğitim formunun otomatik dolduğunu doğrulayın
5. ✅ Eğitimi kaydedin ve `trainings` tablosunda `polyvalence_skill_id` dolu olduğunu kontrol edin

---

## 📝 Notlar

- Bu migration **geri alınabilir** (rollback mümkün)
- Mevcut eğitim kayıtlarına **zarar vermez** (NULL değer kabul ediyor)
- **Performans etkisi minimal** (index eklenmiş)
- **Foreign key cascade**: ON DELETE SET NULL (skill silinirse eğitim korunur, ilişki silinir)

---

## ⚠️ Önemli Uyarılar

1. Bu migration **production** ortamında çalıştırmadan önce **backup alın**.
2. Migration sırasında **downtime olmaz** (non-blocking ALTER TABLE).
3. Migration **idempotent** (tekrar çalıştırılabilir, hata vermez).

---

## 🆘 Yardım

Sorun yaşarsanız:
1. Supabase logs'u kontrol edin
2. Browser console'da hata var mı bakın
3. `POLYVALENCE_GELISTIRMELER_KILAVUZU.md` dosyasına bakın
4. Migration'u rollback edin (gerekirse):

```sql
-- Rollback (sadece gerekirse)
ALTER TABLE trainings DROP COLUMN IF EXISTS polyvalence_skill_id CASCADE;
```

---

**Son Güncelleme:** 5 Kasım 2025  
**Versiyon:** 1.0.0  
**Durum:** ✅ Test Edildi

