# 🔔 Bildirim Test Rehberi

## ✅ Test Bildirimleri Oluşturuldu

Veritabanında 2 test bildirimi oluşturuldu. Sayfayı yenilediğinizde Dashboard'da görünmelidir.

## 🧪 Otomatik Bildirimleri Test Etme

### 1. Yeni NC Bildirimi Testi (En Kolay)

**Adımlar:**
1. DF/8D modülüne gidin
2. "Yeni Kayıt" butonuna tıklayın
3. Formu doldurun:
   - **Başlık:** Test NC Kaydı
   - **Tip:** DF veya 8D
   - **Sorumlu Personel:** Kendinizi seçin (Atakan Battal)
   - **Durum:** Açık
4. Kaydedin

**Beklenen Sonuç:**
- Dashboard'a döndüğünüzde Bildirim Merkezi'nde "Yeni Uygunsuzluk: [NC No]" bildirimi görünür
- Bildirim gerçek zamanlı olarak gelir (sayfa yenilemeye gerek yok)

---

### 2. Görev Atama Bildirimi Testi

**Adımlar:**
1. Görevler modülüne gidin
2. Yeni görev oluşturun:
   - **Başlık:** Test Görevi
   - **Açıklama:** Bu bir test görevidir
   - **Atanan:** Kendinizi seçin
   - **Öncelik:** Orta
3. Kaydedin

**Beklenen Sonuç:**
- Bildirim Merkezi'nde "Yeni Görev: Test Görevi" bildirimi görünür

---

### 3. 8D Gecikme Bildirimi Testi

**Adımlar:**
1. DF/8D modülünde mevcut bir kaydı açın
2. Vade tarihini (`due_at`) bugünden 30+ gün önceye ayarlayın
   - Örnek: Bugün 23 Aralık ise, 20 Kasım gibi bir tarih seçin
3. Kaydı güncelleyin

**Beklenen Sonuç:**
- Bildirim Merkezi'nde "Geciken 8D Kaydı: [NC No]" bildirimi görünür

---

### 4. Kalibrasyon Bildirimi Testi

**Adımlar:**
1. Ekipman modülüne gidin
2. Bir ekipmanın kalibrasyon kaydını bulun veya yeni oluşturun
3. `next_calibration_date` alanını bugünden 30 gün içinde bir tarihe ayarlayın
   - Örnek: Bugün 23 Aralık ise, 10 Ocak gibi bir tarih seçin
4. `is_active` alanını `true` yapın
5. Kaydedin

**Beklenen Sonuç:**
- Bildirim Merkezi'nde "Kalibrasyon Yaklaşıyor: [Ekipman Adı]" bildirimi görünür
- Görevler modülünde otomatik görev oluşturulur

---

## 🔍 Sorun Giderme

### Bildirimler Görünmüyor?

1. **Sayfayı yenileyin** (F5 veya Cmd+R)
2. **Browser konsolunu kontrol edin** (F12 > Console)
   - Hata mesajı var mı?
3. **Kullanıcı bilgilerinizi kontrol edin:**
   - Giriş yaptığınız email: `atakan.battal@kademe.com.tr`
   - Personnel tablosunda bu email ile kayıt var mı?
4. **RLS Politikalarını kontrol edin:**
   - Bildirimler tablosunda RLS aktif mi?
   - Kendi bildirimlerinizi görebiliyor musunuz?

### Bildirimler Gerçek Zamanlı Güncellenmiyor?

1. **Supabase Realtime aktif mi?**
   - Supabase Dashboard > Database > Replication
   - `notifications` tablosu için replication aktif olmalı

2. **Browser konsolunda hata var mı?**
   - Realtime bağlantı hatası görüyor musunuz?

### Trigger'lar Çalışmıyor?

1. **Trigger'ların kurulu olduğunu kontrol edin:**
   ```sql
   SELECT trigger_name, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_schema = 'public' 
   AND trigger_name LIKE '%notify%';
   ```

2. **Manuel test edin:**
   - Bir NC kaydı oluşturun
   - Bildirim oluştu mu kontrol edin:
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
   ```

---

## 📊 Bildirim İstatistikleri

Mevcut bildirimleri görmek için:

```sql
-- Tüm bildirimler
SELECT 
    notification_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_read = false) as unread_count
FROM notifications
GROUP BY notification_type
ORDER BY count DESC;

-- Son bildirimler
SELECT 
    title,
    notification_type,
    priority,
    is_read,
    created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Hızlı Test Senaryosu

**En hızlı test (30 saniye):**

1. DF/8D modülüne gidin
2. Yeni bir NC kaydı oluşturun (kendinize atayın)
3. Dashboard'a dönün
4. Bildirim Merkezi'nde bildirimi görün ✅

Bu işlem otomasyonların çalıştığını doğrular!

---

## 💡 Önemli Notlar

- **Bildirimler sadece yeni kayıtlar oluşturulduğunda veya mevcut kayıtlar güncellendiğinde gelir**
- **Bazı bildirimler sadece belirli koşullarda gelir** (örn: 30+ gün gecikme)
- **Bildirimler gerçek zamanlı olarak güncellenir** (Supabase Realtime)
- **RLS politikaları nedeniyle sadece kendi bildirimlerinizi görürsünüz**

---

## 🆘 Destek

Eğer bildirimler hala gelmiyorsa:

1. Browser konsolunu kontrol edin
2. Supabase Dashboard'da bildirimler tablosunu kontrol edin
3. Trigger'ların çalışıp çalışmadığını kontrol edin
4. Kullanıcı bilgilerinizin doğru olduğundan emin olun

