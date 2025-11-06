# Benchmark Department ID Hatası Düzeltildi ✅

## Sorun
```
invalid input syntax for type uuid:"dept_8"
```

## Neden
`BenchmarkForm.jsx` dosyasında, `cost_settings` tablosu boş olduğunda `personnel` tablosundan departmanlar alınıyor ve bu departmanlara `dept_0`, `dept_1` gibi geçici ID'ler atanıyordu. Ancak veritabanında `department_id` UUID tipinde olduğu için bu string değerler hata veriyordu.

## Çözüm

### 1. Kod Düzeltmesi
`BenchmarkForm.jsx` dosyasında `handleSubmit` fonksiyonuna şu kontrol eklendi:

```javascript
// department_id'yi temizle - eğer "dept_" ile başlıyorsa null yap
const cleanDepartmentId = formData.department_id && 
                         !formData.department_id.startsWith('dept_') 
                         ? formData.department_id 
                         : null;

const dataToSave = {
    ...formData,
    department_id: cleanDepartmentId,
    estimated_budget: formData.estimated_budget 
        ? parseFloat(formData.estimated_budget) 
        : null,
    created_by: user?.id
};
```

### 2. Kullanıcı Bildirimi
Departman seçiminde geçici ID kullanıldığında kullanıcıya uyarı gösteriliyor:

```
⚠️ Departman seçimi şu an devre dışı. Lütfen cost_settings tablosuna departman ekleyin.
```

## Veritabanı Durumu

`department_id` kolonu zaten nullable olarak tanımlı:
- **Tablo:** `benchmarks`
- **Kolon:** `department_id`
- **Tip:** `uuid`
- **Nullable:** `YES` ✅

## Sonuç

Artık:
- ✅ `cost_settings` tablosunda departman varsa → Gerçek UUID ile kaydedilir
- ✅ `cost_settings` tablosu boşsa → Departman `NULL` olarak kaydedilir
- ✅ Hata vermeden benchmark kaydı oluşturulabilir
- ✅ Kullanıcı departman eksikliği konusunda bilgilendirilir

## Öneriler

### Kalıcı Çözüm
`cost_settings` tablosuna departmanları ekleyin:

```sql
-- Örnek departman ekleme
INSERT INTO cost_settings (department_name, is_active) VALUES
    ('Üretim', true),
    ('Kalite', true),
    ('Satın Alma', true),
    ('Ar-Ge', true),
    ('Bakım', true);
```

Ya da Supabase Dashboard'dan:
1. Table Editor → cost_settings
2. Insert → Row
3. `department_name` alanını doldurun
4. `is_active` = true
5. Save

---
**Tarih:** 6 Kasım 2025  
**Durum:** ✅ Düzeltildi ve test edildi

