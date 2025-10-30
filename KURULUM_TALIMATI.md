# 🚀 MÜŞTERİ ŞİKAYETLERİ MODÜLÜ - HIZLI KURULUM

## ⚠️ ÖNEMLİ: İLK ÖNCE BU ADIMLARI TAMAMLAYIN!

### 1️⃣ SUPABASE SQL SCRIPT'İNİ ÇALIŞTIRIN

**ADIM 1:** Supabase Dashboard'unuza gidin:
```
https://supabase.com/dashboard
```

**ADIM 2:** Projenizi seçin → **SQL Editor** → **New Query**

**ADIM 3:** `scripts/create-customer-complaints-tables.sql` dosyasının TAMAMINI kopyalayın ve yapıştırın

**ADIM 4:** **RUN** butonuna basın

✅ **Başarı Mesajı Görmelisiniz:**
```
Müşteri Şikayetleri Yönetim Sistemi tabloları başarıyla oluşturuldu!
```

### 2️⃣ STORAGE BUCKET OLUŞTURUN

**ADIM 1:** Supabase Dashboard → **Storage** → **Create a new bucket**

**ADIM 2:** Bucket ayarları:
- **Name:** `complaint_attachments`
- **Public:** ❌ NO (Private)
- **File size limit:** 50MB
- **Allowed MIME types:** Hepsine izin ver

**ADIM 3:** **Create bucket**

### 3️⃣ STORAGE POLICIES EKLEYIN

**ADIM 1:** Supabase Dashboard → **SQL Editor** → **New Query**

**ADIM 2:** Aşağıdaki SQL'i yapıştırın:

```sql
-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload complaint attachments" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'complaint_attachments');

-- Authenticated users can view
CREATE POLICY "Authenticated users can view complaint attachments" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'complaint_attachments');

-- Authenticated users can update
CREATE POLICY "Authenticated users can update complaint attachments" 
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'complaint_attachments');

-- Authenticated users can delete
CREATE POLICY "Authenticated users can delete complaint attachments" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'complaint_attachments');
```

**ADIM 3:** **RUN**

---

## 🎯 ARTIK SİSTEM HAZIR!

### Test İçin:

1. **Uygulamaya giriş yapın**
2. **Ayarlar → Müşteri Yönetimi** → **Yeni Müşteri Ekle**
   - Müşteri Kodu: `TEST-001`
   - Müşteri Adı: `Test Müşterisi A.Ş.`
   - Kaydet

3. **Müşteri Şikayetleri** menüsüne tıklayın
4. **Yeni Şikayet** → Test şikayeti oluşturun

---

## 🔍 SORUN GİDERME

### "Could not find the 'customers' table" Hatası?
➡️ **Çözüm:** Adım 1'deki SQL script'i çalıştırmadınız. Yukarıdaki 1️⃣ adımı tekrar yapın.

### "Storage bucket not found" Hatası?
➡️ **Çözüm:** Storage bucket oluşturmadınız. Yukarıdaki 2️⃣ adımı yapın.

### Personel Listesi Boş Görünüyor?
➡️ **Çözüm:** 
1. **Ayarlar → Personel Yönetimi** → Personel ekleyin
2. **Ayarlar → Birim Maliyetleri** → Birim ekleyin (personel için gerekli)

### Müşteri Eklerken Hata?
➡️ **Kontrol:**
```sql
-- Supabase SQL Editor'da:
SELECT * FROM customers LIMIT 1;
```
Eğer hata alıyorsanız, tabloları tekrar oluşturun (Adım 1).

---

## 📊 TABLOLARIN OLUŞTUĞUNU KONTROL

Supabase Dashboard → **Database** → **Tables**

Görmeli olduğunuz tablolar:
- ✅ `customers`
- ✅ `customer_complaints`
- ✅ `complaint_analyses`
- ✅ `complaint_actions`  
- ✅ `complaint_documents`
- ✅ `customer_communication_history`
- ✅ `customer_scores`

---

## 💡 HIZLI İPUÇLARI

1. **İlk önce müşteri ekleyin**, sonra şikayet oluşturun
2. **Personel yoksa** şikayet atama yapamazsınız - önce personel ekleyin
3. **Doküman yüklemeden önce** Storage bucket'ın oluşturulduğundan emin olun
4. **Analizler** için şikayet detay sayfasında "Analizler" sekmesini kullanın

---

## 📞 DESTEK

Sorun devam ederse:
1. Browser console'u açın (F12)
2. Hata mesajlarını kontrol edin
3. Supabase Dashboard → Logs'u kontrol edin

**Yaygın Hatalar:**
- `relation "customers" does not exist` → SQL script çalıştırılmamış
- `permission denied for table` → RLS policies yanlış
- `bucket not found` → Storage bucket oluşturulmamış

---

✅ **KURULUM TAMAMLANDI!**

Artık müşteri şikayetleri modülünü kullanabilirsiniz! 🎉

