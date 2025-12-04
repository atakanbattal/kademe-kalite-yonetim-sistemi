# 🚨 ACİL: Veritabanı Güncelleme Gerekli

## Hata Mesajı
```
Could not find the 'is_supplier_nc' column of 'quality_costs' in the schema cache
```

Bu hata, veritabanında `is_supplier_nc` kolonunun henüz oluşturulmadığını gösteriyor.

## ✅ ÇÖZÜM - Aşağıdaki Adımları İzleyin

### 1. Supabase Dashboard'a Giriş Yapın
- https://supabase.com adresine gidin
- Projenizi açın (rqnvoatirfczpklaamhf)

### 2. SQL Editor'ü Açın
- Sol menüden **"SQL Editor"** seçeneğine tıklayın
- Veya direkt: https://supabase.com/dashboard/project/rqnvoatirfczpklaamhf/sql

### 3. Aşağıdaki SQL Komutlarını Çalıştırın

```sql
-- Quality Costs tablosuna tedarikçi ilişkisi ve eksik kolonlar ekleme

-- 1. Tedarikçi ID kolonu ekle (Foreign Key)
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- 2. Tedarikçi uygunsuzluğu flag'i ekle
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS is_supplier_nc BOOLEAN DEFAULT false;

-- 3. Sorumlu personel ID kolonu ekle (eğer yoksa)
ALTER TABLE quality_costs 
ADD COLUMN IF NOT EXISTS responsible_personnel_id UUID REFERENCES personnel(id) ON DELETE SET NULL;

-- 4. İndeksler ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_quality_costs_supplier_id ON quality_costs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quality_costs_responsible_personnel_id ON quality_costs(responsible_personnel_id);

-- 5. Mevcut kayıtları güncelle (varsayılan değerler)
UPDATE quality_costs 
SET is_supplier_nc = false 
WHERE is_supplier_nc IS NULL;

-- 6. Yorumlar ekle
COMMENT ON COLUMN quality_costs.supplier_id IS 'Tedarikçi kaynaklı maliyet ise tedarikçi ID referansı';
COMMENT ON COLUMN quality_costs.is_supplier_nc IS 'Bu maliyet kaydı tedarikçi hatasından mı kaynaklanıyor?';
COMMENT ON COLUMN quality_costs.responsible_personnel_id IS 'Yeniden işlem için sorumlu personel referansı';
```

### 4. "RUN" Butonuna Tıklayın

SQL komutları çalıştıktan sonra **"Success. No rows returned"** mesajını görmelisiniz.

### 5. Sayfayı Yenileyin

Supabase Dashboard'da değişikliklerin yansıması için sayfayı yenileyin veya birkaç saniye bekleyin.

### 6. Uygulamanızı Test Edin

Artık tedarikçi kaynaklı maliyet kaydı oluşturabilirsiniz!

---

## 📋 Yapılan Değişiklikler Özeti

### Veritabanı
- ✅ `quality_costs.supplier_id` kolonu eklendi (UUID, Foreign Key)
- ✅ `quality_costs.is_supplier_nc` kolonu eklendi (Boolean, default: false)
- ✅ `quality_costs.responsible_personnel_id` kolonu eklendi (UUID, Foreign Key)
- ✅ İndeksler oluşturuldu (performans için)

### Frontend
- ✅ Tedarikçi modunda **Birim (Kaynak) alanı artık zorunlu değil**
- ✅ Tedarikçi seçildiğinde maliyet tedarikçiye atanıyor
- ✅ Normal modda Birim (Kaynak) alanı zorunlu kalıyor

---

## ⚠️ Önemli Notlar

1. **Tedarikçi Modu AÇIK** → Birim (Kaynak) **İSTEĞE BAĞLI**
2. **Tedarikçi Modu KAPALI** → Birim (Kaynak) **ZORUNLU**
3. SQL migration'ı çalıştırmadan sistem çalışmayacaktır

---

## 📞 Sorun mu var?

Hata devam ederse:
1. Supabase SQL Editor'de şu sorguyu çalıştırın:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'quality_costs';
   ```
2. `supplier_id` ve `is_supplier_nc` kolonlarının listede olduğunu doğrulayın
3. Yoksa migration'ı tekrar çalıştırın

