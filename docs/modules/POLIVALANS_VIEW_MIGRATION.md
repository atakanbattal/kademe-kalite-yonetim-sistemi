# Polivalans View Migration - ACİL!

## ⚠️ SORUN
Console'da şu hatalar görünüyor:
```
Could not find the table 'public.polyvalence_summary' in the schema cache
Could not find the table 'public.certification_expiry_alerts' in the schema cache
```

Analytics grafikleri boş çünkü **gerekli database view'leri eksik!**

---

## ✅ ÇÖZÜM: View'leri Oluşturun

### Adım 1: Supabase Dashboard'a Gidin
1. [Supabase Dashboard](https://app.supabase.com)
2. Projenizi seçin
3. **SQL Editor**'ü açın

### Adım 2: Aşağıdaki SQL'i Çalıştırın

```sql
-- 1. POLYVALENCE_SUMMARY VIEW
-- Personel polivalans skorlarını hesaplar
CREATE OR REPLACE VIEW polyvalence_summary AS
SELECT 
    p.id AS personnel_id,
    p.full_name,
    p.department,
    p.job_title,
    COUNT(ps.id) AS total_skills,
    COUNT(CASE WHEN ps.current_level >= 3 THEN 1 END) AS proficient_skills,
    CASE 
        WHEN COUNT(ps.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN ps.current_level >= 3 THEN 1 END)::NUMERIC / COUNT(ps.id)::NUMERIC) * 100, 1)
        ELSE 0
    END AS polyvalence_score,
    COUNT(CASE WHEN ps.training_required = true THEN 1 END) AS training_needs,
    MAX(ps.last_training_date) AS last_training_date,
    MAX(ps.last_assessment_date) AS last_assessment_date
FROM 
    personnel p
LEFT JOIN 
    personnel_skills ps ON p.id = ps.personnel_id
GROUP BY 
    p.id, p.full_name, p.department, p.job_title
ORDER BY 
    polyvalence_score DESC;

-- 2. CERTIFICATION_EXPIRY_ALERTS VIEW
-- Sertifika geçerlilik uyarılarını hesaplar
CREATE OR REPLACE VIEW certification_expiry_alerts AS
SELECT 
    ps.id,
    ps.personnel_id,
    p.full_name AS personnel_name,
    ps.skill_id,
    s.name AS skill_name,
    s.code AS skill_code,
    ps.certification_expiry_date,
    ps.is_certified,
    CASE 
        WHEN ps.certification_expiry_date IS NULL THEN NULL
        ELSE ps.certification_expiry_date - CURRENT_DATE
    END AS days_remaining,
    CASE 
        WHEN ps.certification_expiry_date IS NULL THEN 'Sertifika Yok'
        WHEN ps.certification_expiry_date < CURRENT_DATE THEN 'Süresi Dolmuş'
        WHEN ps.certification_expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Kritik (30 gün içinde)'
        WHEN ps.certification_expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'Uyarı (90 gün içinde)'
        ELSE 'Geçerli'
    END AS status
FROM 
    personnel_skills ps
INNER JOIN 
    personnel p ON ps.personnel_id = p.id
INNER JOIN 
    skills s ON ps.skill_id = s.id
WHERE 
    s.requires_certification = true
    AND ps.is_certified = true
ORDER BY 
    ps.certification_expiry_date ASC NULLS LAST;
```

### Adım 3: Run Butonuna Tıklayın

**Başarılı mesaj görmelisiniz:** ✅
```
Success. No rows returned
```

---

## 🧪 View'leri Test Edin

```sql
-- Polivalans skorlarını kontrol et
SELECT * FROM polyvalence_summary LIMIT 10;

-- Sertifika uyarılarını kontrol et
SELECT * FROM certification_expiry_alerts LIMIT 10;
```

---

## 📊 View'ler Ne İşe Yarar?

### 1. polyvalence_summary
- Her personelin toplam yetkinlik sayısı
- Yeterli seviyedeki yetkinlik sayısı (Level 3+)
- **Polivalans skoru:** (Yeterli yetkinlikler / Toplam yetkinlikler) × 100
- Eğitim ihtiyaçları
- Son eğitim ve değerlendirme tarihleri

**Kullanıldığı Yerler:**
- Analiz & Raporlar > Departman Polivalans Skorları grafiği
- Analiz & Raporlar > En Yüksek Polivalans Skorları listesi
- Dashboard KPI'ları

### 2. certification_expiry_alerts
- Sertifika gerektiren yetkinlikler
- Sertifika son geçerlilik tarihleri
- Kalan gün sayısı
- Durum (Geçerli, Uyarı, Kritik, Süresi Dolmuş)

**Kullanıldığı Yerler:**
- Eğitim İhtiyacı > Sertifika Geçerlilik Uyarıları
- Dashboard > Kritik Uyarılar
- Analiz & Raporlar > Sertifika Durumu pasta grafiği

---

## 🔍 Sorun Giderme

### Hata: "permission denied for schema public"
**Çözüm:** Supabase Dashboard'da Service Role key ile SQL Editor kullanın.

### Hata: "relation personnel does not exist"
**Çözüm:** Önce personnel tablosunun var olduğundan emin olun:
```sql
SELECT COUNT(*) FROM personnel;
```

### Hata: "column xyz does not exist"
**Çözüm:** Gerekli kolonlar eksik. personnel_skills tablosunu kontrol edin:
```sql
\d personnel_skills
```

Gerekli kolonlar:
- `current_level`
- `training_required`
- `certification_expiry_date`
- `is_certified`
- `last_training_date`
- `last_assessment_date`

---

## ✅ Başarılı Kurulum Kontrolü

View'ler oluşturulduktan sonra:

1. **Uygulamayı yenileyin** (F5)
2. **Polivalans Modülü**'ne gidin
3. **Analiz & Raporlar** sekmesine tıklayın
4. ✅ Grafikler artık görünmeli
5. ✅ Console'da hata olmamalı

---

## 📝 Notlar

- View'ler otomatik güncellenir (gerçek zamanlı)
- Personnel, personnel_skills, skills tablolarındaki değişiklikler view'lere yansır
- View'ler sadece okuma amaçlıdır (INSERT/UPDATE yapılamaz)
- RLS (Row Level Security) politikalarına tabidir

---

**View'leri oluşturduktan sonra uygulamayı yenileyin!** 🚀

