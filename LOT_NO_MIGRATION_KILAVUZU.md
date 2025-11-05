# Lot No Alanı Migration Kılavuzu

## 🎯 Amaç
`sheet_metal_items` tablosuna `lot_no` (Lot Numarası) alanı eklemek için veritabanı güncellemesi yapılması gerekiyor.

## 📋 Sorun
Sac Malzemeler modülünde Lot No alanı eklendi ancak veritabanında bu sütun henüz yok. Bu nedenle kayıt eklerken veya düzenlerken hata alıyorsunuz.

## ✅ Çözüm: Manuel Migration

### Adım 1: Supabase Dashboard'a Giriş
1. [Supabase Dashboard](https://app.supabase.com) adresine gidin
2. Projenizi seçin
3. Sol menüden **SQL Editor**'ü tıklayın

### Adım 2: SQL Komutunu Çalıştırın
Aşağıdaki SQL komutunu SQL Editor'e kopyalayın ve **Run** butonuna tıklayın:

```sql
-- Sac malzemeler tablosuna lot_no alanı ekleme
ALTER TABLE sheet_metal_items 
ADD COLUMN IF NOT EXISTS lot_no TEXT;

-- Index oluştur (arama performansı için)
CREATE INDEX IF NOT EXISTS idx_sheet_metal_items_lot_no 
ON sheet_metal_items(lot_no);

-- Mevcut kayıtlar için comment ekle
COMMENT ON COLUMN sheet_metal_items.lot_no IS 'Malzeme lot numarası - üretim partisi takibi için kullanılır';
```

### Adım 3: Doğrulama
Migration başarılı olduyunda şu mesajı görmelisiniz:
```
Success. No rows returned
```

## 🧪 Test
1. Uygulamayı yenileyin (F5)
2. **Girdi Kalite Kontrol** > **Sac Malzemeler** sekmesine gidin
3. **Yeni Giriş** butonuna tıklayın veya mevcut bir kaydı düzenleyin
4. **Lot No** alanını doldurun
5. **Kaydet** butonuna tıklayın
6. Kayıt başarıyla kaydedilmelidir

## 📊 Yapılan Değişiklikler

### Veritabanı
- ✅ `sheet_metal_items` tablosuna `lot_no` kolonu eklendi
- ✅ Kolon tipi: `TEXT`
- ✅ Index oluşturuldu: `idx_sheet_metal_items_lot_no`
- ✅ NULL değerler kabul ediliyor (opsiyonel alan)

### Uygulama
- ✅ Düzenleme formuna Lot No alanı eklendi
- ✅ Tablo görünümüne Lot No sütunu eklendi
- ✅ Görüntüleme modalında zaten mevcuttu

## ❓ Sorun Giderme

### Hata: "column lot_no does not exist"
- Migration henüz çalıştırılmadı
- Yukarıdaki SQL komutunu Supabase Dashboard'da çalıştırın

### Hata: "permission denied for table sheet_metal_items"
- Kullandığınız Supabase key'inin yeterli yetkisi yok
- Service Role Key ile SQL Editor'de çalıştırın

### Hala sorun yaşıyorsanız
- Tarayıcı cache'ini temizleyin (Ctrl+Shift+Delete)
- Uygulamayı hard refresh yapın (Ctrl+F5)
- Supabase Dashboard'da Tables > sheet_metal_items sekmesinde lot_no kolonunun var olduğunu kontrol edin

## 📞 Destek
Sorun devam ederse:
1. Supabase Dashboard'da SQL Editor'de şu komutu çalıştırın:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'sheet_metal_items';
   ```
2. Sonuçta `lot_no` kolonunu görüyor musunuz kontrol edin

---

**Not:** Bu migration geriye dönük uyumludur. Mevcut kayıtlarda `lot_no` alanı boş olacaktır, yeni kayıtlarda veya düzenlemelerde doldurabilirsiniz.

