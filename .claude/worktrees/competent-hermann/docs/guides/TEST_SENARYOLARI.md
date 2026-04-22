# 🧪 Otomasyon Test Senaryoları

Bu dokümanda otomasyonların nasıl test edileceği ve görünür hale geleceği açıklanmaktadır.

## 📍 Bildirim Merkezi Nerede?

Dashboard sayfasında en altta **"Bildirim Merkezi"** kartı görünür. Eğer bildirim yoksa "Bildirim bulunmuyor" mesajı görünecektir.

## ✅ Test Senaryoları

### 1. Yeni NC Oluşturma Bildirimi
**Ne yapmalısınız:**
- DF/8D modülüne gidin
- Yeni bir uygunsuzluk kaydı oluşturun
- Sorumlu personel olarak kendinizi seçin

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Yeni Uygunsuzluk: [NC No]" bildirimi görünür
- Bildirim tıklandığında ilgili NC kaydına yönlendirilir

---

### 2. 8D Gecikme Bildirimi
**Ne yapmalısınız:**
- DF/8D modülünde mevcut bir kaydı açın
- Vade tarihini (`due_at`) bugünden 30+ gün önceye ayarlayın
- Kaydı güncelleyin

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Geciken 8D Kaydı" bildirimi görünür
- Bildirim önceliği gecikme süresine göre değişir (30-45 gün: NORMAL, 45-60 gün: HIGH, 60+ gün: CRITICAL)

---

### 3. Görev Atama Bildirimi
**Ne yapmalısınız:**
- Görevler modülüne gidin
- Yeni bir görev oluşturun
- Görevi kendinize atayın

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Yeni Görev: [Görev Başlığı]" bildirimi görünür
- Bildirim tıklandığında görev detayına yönlendirilir

---

### 4. Kalibrasyon Bildirimi
**Ne yapmalısınız:**
- Ekipman modülüne gidin
- Bir ekipmanın kalibrasyon kaydını bulun veya yeni oluşturun
- `next_calibration_date` alanını bugünden 30 gün içinde bir tarihe ayarlayın
- Kaydı güncelleyin

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Kalibrasyon Yaklaşıyor: [Ekipman Adı]" bildirimi görünür
- Eğer tarih geçmişse "Kalibrasyon Gecikmiş" bildirimi görünür

---

### 5. Doküman Geçerlilik Bildirimi
**Ne yapmalısınız:**
- Doküman Yönetimi modülüne gidin
- Bir dokümanın `valid_until` alanını bugünden 30 gün içinde bir tarihe ayarlayın
- Kaydı güncelleyin

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Doküman Geçerliliği: [Doküman Adı]" bildirimi görünür
- Eğer tarih geçmişse "geçmiş" uyarısı görünür

---

### 6. Karantina Uzun Bekleme Bildirimi
**Ne yapmalısınız:**
- Karantina modülüne gidin
- Mevcut bir karantina kaydını bulun
- `quarantine_date` alanını bugünden 7+ gün önceye ayarlayın
- Durumu "Karantinada" veya "Onay Bekliyor" olarak ayarlayın
- Kaydı güncelleyin

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Uzun Bekleyen Karantina: [Parça Adı]" bildirimi görünür
- 14+ gün bekleyen kayıtlar için HIGH öncelikli bildirim görünür

---

### 7. Tedarikçi Red Bildirimi
**Ne yapmalısınız:**
- Gelen Kalite Kontrol modülüne gidin
- Yeni bir muayene kaydı oluşturun
- Karar olarak "Red" seçin
- Bir tedarikçi seçin
- Kaydı kaydedin

**Beklenen sonuç:**
- Admin kullanıcılarına "Tedarikçi Red Bildirimi" gönderilir
- Bildirim Merkezi'nde görünür

---

### 8. Şartlı Kabul Bildirimi
**Ne yapmalısınız:**
- Gelen Kalite Kontrol modülüne gidin
- Yeni bir muayene kaydı oluşturun
- Karar olarak "Şartlı Kabul" seçin
- Kaydı kaydedin

**Beklenen sonuç:**
- Kalite Kontrol personeline "Şartlı Kabul" bildirimi gönderilir
- Bildirim Merkezi'nde görünür

---

### 9. Maliyet Anomali Bildirimi
**Ne yapmalısınız:**
- Kalite Maliyeti modülüne gidin
- Yeni bir maliyet kaydı oluşturun
- Miktarı son 3 ayın ortalamasından %50+ fazla yapın
- Kaydı kaydedin

**Beklenen sonuç:**
- Admin kullanıcılarına "Maliyet Anomalisi" bildirimi gönderilir
- Bildirim Merkezi'nde görünür

---

### 10. Müşteri Şikayeti SLA Bildirimi
**Ne yapmalısınız:**
- Müşteri Şikayetleri modülüne gidin
- Yeni bir şikayet oluşturun
- Şikayet tarihini (`complaint_date`) bugünden 48+ saat önceye ayarlayın (Yüksek öncelik için)
- Şikayeti kendinize atayın
- Kaydı kaydedin

**Beklenen sonuç:**
- Bildirim Merkezi'nde "Şikayet SLA Risk Altında" veya "Şikayet SLA Gecikmiş" bildirimi görünür
- SLA durumu `analysis_data` JSONB alanında saklanır

---

### 11. Kaizen Onay Bildirimi
**Ne yapmalısınız:**
- Kaizen modülüne gidin
- Yeni bir kaizen kaydı oluşturun
- Durumu "Onay Bekliyor" olarak ayarlayın
- Kaydı kaydedin

**Beklenen sonuç:**
- Admin kullanıcılarına "Kaizen Onay Bekliyor" bildirimi gönderilir
- Bildirim Merkezi'nde görünür

---

### 12. 8D Adımı Otomatik Görev Oluşturma
**Ne yapmalısınız:**
- DF/8D modülüne gidin
- Tipi "8D" olan bir kayıt oluşturun veya mevcut bir kaydı açın
- 8D İlerleme bölümünde D1 adımını tamamlayın
- D2 adımına sorumlu atayın
- Kaydı kaydedin

**Beklenen sonuç:**
- Görevler modülünde otomatik olarak "D2: Problemi Tanımlama" görevi oluşturulur
- Görev sorumluya atanır
- Bildirim Merkezi'nde görev atama bildirimi görünür

---

### 13. Tekrar Eden Problem Tespiti
**Ne yapmalısınız:**
- DF/8D modülüne gidin
- Aynı parça kodu veya kök nedene sahip 3+ kayıt oluşturun (son 6 ay içinde)
- Son kaydı oluştururken

**Beklenen sonuç:**
- Kayıt otomatik olarak "Yüksek" öncelikli olarak işaretlenir
- Notes alanına "[OTOMATIK] Bu problem son 6 ay içinde X kez tekrar etmiştir" mesajı eklenir

---

### 14. Kalibrasyon Otomatik Görev Oluşturma
**Ne yapmalısınız:**
- Ekipman modülüne gidin
- Bir ekipmanın kalibrasyon kaydını bulun veya yeni oluşturun
- `next_calibration_date` alanını bugünden 30 gün içinde bir tarihe ayarlayın
- `is_active` alanını `true` yapın
- Kaydı kaydedin

**Beklenen sonuç:**
- Görevler modülünde otomatik olarak "Kalibrasyon: [Ekipman Adı]" görevi oluşturulur
- Görev sorumluya atanır
- Bildirim Merkezi'nde görev atama bildirimi görünür

---

## 🔍 Bildirimleri Kontrol Etme

1. **Dashboard'a gidin** - En altta "Bildirim Merkezi" kartını görürsünüz
2. **Bildirim sayısını kontrol edin** - Okunmamış bildirimler için kırmızı badge görünür
3. **Bildirime tıklayın** - İlgili modüle yönlendirilirsiniz
4. **Tümünü okundu işaretle** - Tüm bildirimleri tek seferde okundu olarak işaretleyebilirsiniz

## ⚠️ Önemli Notlar

- **Otomasyonlar sadece yeni kayıtlar oluşturulduğunda veya mevcut kayıtlar güncellendiğinde çalışır**
- **Bildirimler gerçek zamanlı olarak güncellenir** (Supabase Realtime kullanılıyor)
- **Bazı bildirimler sadece belirli kullanıcılara gönderilir** (örn: Admin, sorumlu personel)
- **Eğer bildirim görmüyorsanız:**
  - Kullanıcı bilgilerinizi kontrol edin (personnel tablosunda email eşleşmesi olmalı)
  - Bildirimler tablosunun oluşturulduğundan emin olun
  - Browser konsolunda hata mesajı olup olmadığını kontrol edin

## 🎯 Hızlı Test

En hızlı test için:
1. **DF/8D modülüne gidin**
2. **Yeni bir NC kaydı oluşturun** (kendinize atayın)
3. **Dashboard'a dönün**
4. **Bildirim Merkezi'nde bildirimi görün**

Bu işlem 30 saniyeden az sürer ve otomasyonların çalıştığını doğrular!

