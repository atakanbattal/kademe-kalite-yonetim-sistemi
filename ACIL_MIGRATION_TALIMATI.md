# 🚨 ACİL: Migration Scripti Çalıştırılmalı!

## ❌ Aldığınız Hata

```
Hata
Denetim kaydedilemedi: Could not find the 'supplier_attendees' column of 
'supplier_audit_plans' in the schema cache
```

## ✅ ÇÖZÜM

Bu hata, veritabanında `supplier_attendees` kolonunun henüz eklenmediğini gösteriyor. 
**Migration scriptini çalıştırmanız gerekiyor!**

---

## 📋 Adım Adım Çözüm

### 1️⃣ Supabase Dashboard'a Giriş Yapın

1. Tarayıcınızda https://app.supabase.com adresine gidin
2. Giriş yapın
3. **Projenizi seçin** (Kademe Quality Systems projesi)

### 2️⃣ SQL Editor'e Gidin

1. Sol menüden **"SQL Editor"** seçeneğine tıklayın
2. **"New query"** butonuna tıklayın

### 3️⃣ Migration SQL'ini Yapıştırın

Aşağıdaki SQL kodunu kopyalayın ve SQL Editor'e yapıştırın:

```sql
-- supplier_audit_plans tablosuna supplier_attendees kolonu ekle
ALTER TABLE supplier_audit_plans
ADD COLUMN IF NOT EXISTS supplier_attendees TEXT[] DEFAULT '{}';

-- Kolon açıklaması ekle
COMMENT ON COLUMN supplier_audit_plans.supplier_attendees IS 'Denetlenen firmadan denetime katılan kişilerin isimleri (Array olarak saklanır)';

COMMENT ON COLUMN supplier_audit_plans.participants IS 'Denetimi yapan denetçilerin isimleri (Array olarak saklanır)';
```

### 4️⃣ SQL'i Çalıştırın

1. **"Run"** veya **"Execute"** butonuna tıklayın (genellikle Ctrl+Enter)
2. Başarılı mesajını bekleyin
3. ✅ "Success. No rows returned" göreceksiniz

### 5️⃣ Sayfayı Yenileyin

1. Tarayıcınızdaki denetim düzenleme sayfasını **yenileyin** (F5)
2. Artık düzenleme yapabilirsiniz!

---

## 🎯 Ne Yaptık?

Migration scripti şu değişiklikleri yaptı:
- ✅ `supplier_audit_plans` tablosuna `supplier_attendees` kolonu eklendi
- ✅ Bu kolon TEXT[] tipinde (string array)
- ✅ Varsayılan değer boş array: `'{}'`

Bu kolon sayesinde artık:
- Denetçileri (bizim firma) ekleyebilirsiniz
- **Denetlenen firmadan katılanları** ekleyebilirsiniz
- Her iki grup da ayrı ayrı kaydedilir
- Raporlarda görünürler

---

## ⚠️ Alternatif: Terminal Kullanımı

Eğer terminale erişiminiz varsa:

```bash
# Supabase CLI ile (yüklüyse)
cd "/Users/atakanbattal/Downloads/Kademe Code"
supabase db push --file scripts/add-supplier-attendees-to-audit.sql

# veya psql ile (connection string'iniz varsa)
psql "YOUR_DATABASE_URL" -f scripts/add-supplier-attendees-to-audit.sql
```

---

## 🔍 Doğrulama

Migration başarılı olduysa:
1. ✅ Denetim düzenleme sayfası hatasız açılır
2. ✅ "Denetlenen Firmadan Katılanlar" bölümünü görebilirsiniz
3. ✅ İsim ekleyip kaydedebilirsiniz
4. ✅ Raporda bu isimler görünür

---

## 💡 İpucu

Migration'ı bir kere çalıştırmanız yeterli. `IF NOT EXISTS` kullanıldığı için 
tekrar çalıştırsanız bile hata vermez.

---

## 📞 Sorun Devam Ederse

Eğer migration'ı çalıştırdınız ama hala hata alıyorsanız:

1. Tarayıcı cache'ini temizleyin (Ctrl+Shift+Delete)
2. Supabase Dashboard'da Tables sekmesinden `supplier_audit_plans` tablosunu açın
3. Kolonlar listesinde `supplier_attendees` olduğunu doğrulayın
4. Yoksa migration tekrar çalıştırın

---

**Not**: Bu migration'ı çalıştırmadan sistem çalışmaya devam edecek, 
ama "Denetlenen Firmadan Katılanlar" özelliğini kullanamazsınız.

