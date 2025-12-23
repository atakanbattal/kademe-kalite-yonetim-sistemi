# Otomasyon Uygulama Kılavuzu

Bu doküman, Kademe QMS sistemine eklenen tüm otomasyonların nasıl uygulanacağını açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Uygulama Adımları](#uygulama-adımları)
3. [Modül Bazlı Otomasyonlar](#modül-bazlı-otomasyonlar)
4. [Test ve Doğrulama](#test-ve-doğrulama)
5. [Sorun Giderme](#sorun-giderme)

## 🎯 Genel Bakış

Bu iyileştirme paketi şunları içerir:

- ✅ Bildirim sistemi altyapısı
- ✅ Dashboard otomasyonları
- ✅ DF/8D otomatik adım kontrolü ve görev oluşturma
- ✅ Kalitesizlik maliyeti otomasyonları
- ✅ Karantina otomasyonları
- ✅ Tedarikçi kalite otomasyonları
- ✅ Müşteri şikayetleri SLA otomasyonları
- ✅ Girdi kalite kontrol otomasyonları
- ✅ Ekipman kalibrasyon otomasyonları
- ✅ KPI otomasyonları
- ✅ Diğer modül otomasyonları (Kaizen, İç Tetkik, Doküman, Eğitim, vb.)

## 🚀 Uygulama Adımları

### 1. Veritabanı Yedeği Alın

**ÖNEMLİ:** Tüm SQL scriptlerini uygulamadan önce mutlaka veritabanı yedeği alın!

```sql
-- Supabase Dashboard > Database > Backups
-- Veya pg_dump kullanarak manuel yedek alın
```

### 2. SQL Scriptlerini Uygulayın

#### Yöntem 1: Master Script (Önerilen)

Supabase Dashboard > SQL Editor'de şu script'i çalıştırın:

```sql
-- scripts/apply-all-automations.sql dosyasını Supabase SQL Editor'de çalıştırın
```

**Not:** `\i` komutları Supabase SQL Editor'de çalışmayabilir. Bu durumda her script'i tek tek çalıştırın.

#### Yöntem 2: Tek Tek Uygulama

Her script'i sırasıyla çalıştırın:

1. `scripts/create-notification-system.sql`
2. `scripts/create-8d-automation.sql`
3. `scripts/create-quality-cost-automation.sql`
4. `scripts/create-quarantine-automation.sql`
5. `scripts/create-supplier-quality-automation.sql`
6. `scripts/create-customer-complaints-automation.sql`
7. `scripts/create-incoming-quality-automation.sql`
8. `scripts/create-equipment-calibration-automation.sql`
9. `scripts/create-kpi-automation.sql`
10. `scripts/create-remaining-modules-automation.sql`

### 3. Frontend Güncellemeleri

Frontend tarafında yapılan güncellemeler:

- ✅ `NotificationCenter.jsx` - Gerçek zamanlı bildirim desteği
- ✅ `Dashboard.jsx` - Otomatik yenileme (5 dakika)
- ✅ `useDashboardData.js` - Refresh fonksiyonu eklendi

Bu değişiklikler zaten uygulanmış durumda.

## 📦 Modül Bazlı Otomasyonlar

### 1. Bildirim Sistemi

**Özellikler:**
- Tüm modüllerden otomatik bildirim oluşturma
- Gerçek zamanlı bildirim güncellemeleri
- Öncelik bazlı bildirimler (LOW, NORMAL, HIGH, CRITICAL)
- Modül bazlı filtreleme

**Kullanım:**
- Bildirimler Dashboard'da `NotificationCenter` bileşeninde görüntülenir
- Bildirimlere tıklayarak ilgili modüle yönlendirilirsiniz

### 2. DF/8D Otomasyonları

**Özellikler:**
- 8D adımları için otomatik görev oluşturma
- Adım tamamlandığında sonraki adımı açma
- Tekrar eden problemleri otomatik "Major" olarak işaretleme
- 30+ gün gecikmiş kayıtlar için bildirim

**Kullanım:**
- 8D kaydı oluşturulduğunda her adım için otomatik görev oluşturulur
- Adım tamamlandığında sonraki adım otomatik açılır
- Tekrar eden problemler otomatik olarak yüksek öncelikli olarak işaretlenir

### 3. Kalitesizlik Maliyeti Otomasyonları

**Özellikler:**
- Maliyet anomalisi tespiti (%50+ artış)
- COPQ otomatik hesaplama
- Aylık COPQ raporu otomatik oluşturma

**Kullanım:**
- Yeni maliyet kaydı eklendiğinde otomatik anomali kontrolü yapılır
- `calculate_copq()` fonksiyonu ile COPQ hesaplanabilir
- Aylık raporlar otomatik oluşturulur (Cron job gerekli)

### 4. Karantina Otomasyonları

**Özellikler:**
- Kritik karantina kayıtlarından otomatik NC oluşturma
- 7+ gün bekleyen kayıtlar için bildirim
- Girdi kalite red kayıtlarından otomatik karantina oluşturma

**Kriterler:**
- 14+ gün karantinada bekliyor
- 100+ adet miktar
- Kritik parça işaretli

### 5. Tedarikçi Kalite Otomasyonları

**Özellikler:**
- PPM (Parts Per Million) otomatik hesaplama
- OTD (On-Time Delivery) otomatik hesaplama
- Performans düşüşü bildirimleri
- Girdi kalite red kayıtlarından otomatik tedarikçi NC oluşturma

**Kullanım:**
- Girdi kalite kontrol kaydı eklendiğinde/güncellendiğinde otomatik hesaplanır
- Performans %20+ düştüğünde bildirim gönderilir

### 6. Müşteri Şikayetleri SLA Otomasyonları

**Özellikler:**
- SLA durumu otomatik hesaplama ve güncelleme
- SLA yaklaştığında/geçtiğinde bildirim
- Şikayet açıldığında otomatik görev oluşturma
- Çözüm tamamlandığında kapatma önerisi

**SLA Süreleri:**
- Kritik: İlk yanıt 24 saat, Çözüm 72 saat
- Yüksek: İlk yanıt 48 saat, Çözüm 120 saat
- Orta: İlk yanıt 72 saat, Çözüm 168 saat
- Düşük: İlk yanıt 120 saat, Çözüm 240 saat

### 7. Ekipman Kalibrasyon Otomasyonları

**Özellikler:**
- Kalibrasyon tarihi yaklaşan ekipmanlar için otomatik görev
- Gecikmiş kalibrasyonlar için bildirim
- Geçmiş kalibrasyonlar için ekipman durumu güncelleme

**Kullanım:**
- Kalibrasyon tarihi 30 gün kala otomatik görev oluşturulur
- Geçmiş kalibrasyonlar için ekipman "Kalibrasyon Gerekli" olarak işaretlenir

### 8. KPI Otomasyonları

**Özellikler:**
- KPI hedef tutmadığında bildirim (%10+ sapma)
- Otomatik KPI güncelleme fonksiyonu

**Kullanım:**
- KPI değeri güncellendiğinde otomatik hedef kontrolü yapılır
- `update_all_auto_kpis()` fonksiyonu ile tüm KPI'lar güncellenebilir

## 🧪 Test ve Doğrulama

### Bildirim Sistemi Testi

1. Yeni bir NC kaydı oluşturun
2. Bildirim merkezinde bildirimin göründüğünü kontrol edin
3. Bildirime tıklayarak ilgili modüle yönlendirildiğinizi kontrol edin

### DF/8D Otomasyon Testi

1. Yeni bir 8D kaydı oluşturun
2. D1 adımına sorumlu atayın
3. Görev modülünde görevin oluşturulduğunu kontrol edin
4. D1 adımını tamamlayın
5. D2 adımının otomatik açıldığını kontrol edin

### Karantina Otomasyon Testi

1. 14+ gün bekleyen bir karantina kaydı oluşturun
2. Otomatik NC oluşturulduğunu kontrol edin
3. Bildirim merkezinde bildirimin göründüğünü kontrol edin

### Tedarikçi Kalite Testi

1. Girdi kalite kontrol kaydı ekleyin/güncelleyin
2. Tedarikçi performansının otomatik güncellendiğini kontrol edin
3. PPM ve OTD değerlerinin doğru hesaplandığını kontrol edin

## 🔧 Sorun Giderme

### Bildirimler Görünmüyor

1. `notifications` tablosunun oluşturulduğunu kontrol edin:
```sql
SELECT * FROM notifications LIMIT 1;
```

2. RLS politikalarının doğru ayarlandığını kontrol edin:
```sql
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

### Trigger'lar Çalışmıyor

1. Trigger'ların oluşturulduğunu kontrol edin:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%trigger%';
```

2. Fonksiyonların doğru çalıştığını test edin:
```sql
SELECT create_notification(
    'user-uuid-here',
    'NC_CREATED',
    'Test Bildirimi',
    'Bu bir test bildirimidir',
    'df-8d',
    NULL,
    'NORMAL',
    NULL
);
```

### Görevler Oluşturulmuyor

1. `tasks` ve `task_assignees` tablolarının mevcut olduğunu kontrol edin
2. Personnel ID'lerinin doğru olduğunu kontrol edin
3. Trigger loglarını kontrol edin:
```sql
SELECT * FROM pg_stat_user_functions WHERE funcname LIKE '%task%';
```

## 📝 Notlar

- Tüm otomasyonlar geriye dönük uyumludur
- Mevcut özellikler bozulmaz
- Hata durumlarında sistem sessizce devam eder (WARNING seviyesinde log)
- Kritik işlemler için manuel kontrol önerilir

## 🔄 Güncelleme

Yeni otomasyonlar eklendiğinde:

1. İlgili script'i çalıştırın
2. Test edin
3. Dokümantasyonu güncelleyin

## 📞 Destek

Sorun yaşarsanız:

1. Supabase Logs'u kontrol edin
2. Browser Console'u kontrol edin
3. SQL fonksiyonlarını manuel test edin

---

**Son Güncelleme:** 2024
**Versiyon:** 1.0.0

