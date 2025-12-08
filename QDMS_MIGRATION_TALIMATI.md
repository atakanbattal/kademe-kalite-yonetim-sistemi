# 🚀 QDMS Migration Talimatı

## ✅ SQL Hazır!

Profesyonel QDMS sistemi için gerekli SQL migration script'i hazırlandı.

## 📋 Çalıştırma Yöntemleri

### Yöntem 1: Supabase Dashboard (ÖNERİLEN - En Kolay)

1. **Supabase Dashboard'a gidin:**
   ```
   https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql
   ```

2. **"New query" butonuna tıklayın**

3. **SQL'i kopyalayın:**
   - `scripts/create-professional-qdms-system.sql` dosyasını açın
   - VEYA `scripts/qdms-migration-ready.sql` dosyasını açın
   - Tüm içeriği kopyalayın (Ctrl+A, Ctrl+C)

4. **SQL Editor'e yapıştırın** (Ctrl+V)

5. **"Run" butonuna tıklayın** (veya Ctrl+Enter)

6. ✅ **Başarılı mesajını bekleyin!**

---

### Yöntem 2: Doğrudan PostgreSQL Bağlantısı (Gelişmiş)

**Gereksinimler:**
- PostgreSQL client (`psql`) kurulu olmalı
- Database password bilinmeli

**Komut:**
```bash
# Password'ü environment variable olarak ayarlayın
export SUPABASE_DB_PASSWORD="your-password"

# SQL'i çalıştırın
psql "postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.rqnvoatirfczpklaamhf.supabase.co:5432/postgres?sslmode=require" \
  -f scripts/create-professional-qdms-system.sql
```

**VEYA Node.js script ile:**
```bash
export SUPABASE_DB_PASSWORD="your-password"
node scripts/execute-sql-direct.js
```

---

### Yöntem 3: Supabase CLI (Eğer kuruluysa)

```bash
# Supabase CLI kurulumu
npm install -g supabase

# Login
supabase login

# Projeyi link et
supabase link --project-ref rqnvoatirfczpklaamhf

# SQL'i çalıştır
supabase db execute -f scripts/create-professional-qdms-system.sql
```

---

## 📄 SQL Dosyaları

1. **`scripts/create-professional-qdms-system.sql`**
   - Ana migration script'i
   - Tüm tablolar, kolonlar, fonksiyonlar, trigger'lar, view'lar

2. **`scripts/qdms-migration-ready.sql`**
   - Kopyala-yapıştır için hazır dosya
   - Aynı içerik, sadece kolay erişim için

---

## ✅ Migration Sonrası Kontrol

Migration başarılı olduktan sonra:

1. **Sayfayı yenileyin** (F5)
2. **Document modülüne gidin:** https://kademekalite.online/document
3. **Yeni özellikleri test edin:**
   - Dashboard görünümü
   - Birim bazlı doküman görünümü
   - Revizyon geçmişi
   - Tedarikçi dokümanları

---

## 🔍 Migration İçeriği

Bu migration şunları yapar:

✅ **Documents tablosuna yeni kolonlar ekler:**
- `department_id` - Birim ID
- `supplier_id` - Tedarikçi ID
- `document_category` - Doküman kategorisi
- `document_subcategory` - Alt kategori
- `document_number` - Otomatik doküman numarası
- `classification` - Sınıflandırma
- `keywords` - Anahtar kelimeler
- `tags` - Etiketler
- `approval_status` - Onay durumu
- `review_frequency_months` - Revizyon sıklığı
- `next_review_date` - Sonraki revizyon tarihi
- Ve daha fazlası...

✅ **Yeni tablolar oluşturur:**
- `document_approvals` - Onay akışı
- `document_access_logs` - Erişim logları
- `document_comments` - Yorumlar
- `document_notifications` - Bildirimler
- `supplier_documents` - Tedarikçi dokümanları

✅ **Fonksiyonlar ve trigger'lar ekler:**
- Otomatik doküman numarası oluşturma
- Sonraki revizyon tarihi hesaplama
- Revizyon oluşturma fonksiyonu

✅ **View'lar oluşturur:**
- `documents_by_department` - Birim bazlı görünüm
- `supplier_documents_view` - Tedarikçi dokümanları görünümü
- `document_revision_history` - Revizyon geçmişi
- `documents_expiring_soon` - Süresi yaklaşan dokümanlar

---

## ⚠️ Önemli Notlar

- Migration **idempotent** olarak tasarlandı (birden fazla kez çalıştırılabilir)
- Mevcut veriler korunur
- `IF NOT EXISTS` kontrolleri kullanıldı
- Hata durumunda migration durur ve hata mesajı gösterilir

---

## 🆘 Sorun Giderme

**Hata: "relation already exists"**
- Bu normal, bazı objeler zaten mevcut olabilir
- Migration devam eder

**Hata: "permission denied"**
- Service role key kullanmanız gerekebilir
- Supabase Dashboard'dan çalıştırmayı deneyin

**Hata: "connection refused"**
- İnternet bağlantınızı kontrol edin
- Supabase servisinin çalıştığından emin olun

---

## 📞 Destek

Sorun yaşarsanız:
1. Hata mesajını kopyalayın
2. Supabase Dashboard > Logs bölümünü kontrol edin
3. SQL Editor'de tek tek statement'ları çalıştırmayı deneyin

---

**🎉 Migration başarılı olduktan sonra sistem kullanıma hazır!**

