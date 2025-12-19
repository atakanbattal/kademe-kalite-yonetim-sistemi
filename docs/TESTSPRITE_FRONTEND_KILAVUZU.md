# TestSprite Frontend Test Kılavuzu

## 📋 Genel Bakış

Bu kılavuz, Kademe QMS uygulamasının frontend testlerini TestSprite ile çalıştırmak için gerekli bilgileri içerir.

## 🏗️ Proje Yapısı

### Teknoloji Stack
- **Framework:** React 18.x
- **Build Tool:** Vite 4.x
- **Routing:** React Router DOM 6.x
- **UI Library:** Radix UI + Tailwind CSS
- **State Management:** React Context API
- **Authentication:** Supabase Auth

### Port ve URL Bilgileri
- **Development Port:** 3001
- **Development URL:** `http://localhost:3001`
- **Host:** `::` (IPv6/IPv4)

## 🔐 Authentication Bilgileri

### Login Sistemi
- **Login Sayfası:** `/login`
- **Login Endpoint:** Supabase Auth API
- **Email Format:** `{username}@kademe.com` veya tam email
- **Test Kullanıcıları:**
  - Admin: `atakan.battal@kademe.com.tr` (tüm modüllere erişim)
  - Diğer kullanıcılar: `profiles` tablosundaki izinlere göre erişim

### Login Akışı
1. Kullanıcı `/login` sayfasına yönlendirilir
2. Email ve şifre girilir
3. Supabase Auth ile doğrulama yapılır
4. Başarılı girişte session oluşturulur
5. Kullanıcı ana sayfaya yönlendirilir

## 📱 Ana Modüller ve Route'lar

### Modül Listesi
- `/dashboard` - Ana Panel
- `/tasks` - Görev Yönetimi
- `/kpi` - KPI Modülü
- `/kaizen` - İyileştirme (Kaizen) Modülü
- `/quality-cost` - Kalitesizlik Maliyetleri
- `/quarantine` - Karantina Yönetimi
- `/df-8d` - DF ve 8D Yönetimi
- `/internal-audit` - İç Tetkik Yönetimi
- `/document` - Doküman Yönetimi
- `/supplier-quality` - Tedarikçi Kalite Yönetimi
- `/supplier-audit` - Tedarikçi Denetimi
- `/customer-complaints` - Müşteri Şikayetleri
- `/deviation` - Sapma Yönetimi
- `/equipment` - Ekipman & Kalibrasyon
- `/produced-vehicles` - Kaliteye Verilen Araçlar
- `/settings` - Ayarlar
- `/incoming-quality` - Girdi Kalite Kontrol
- `/wps` - WPS Yönetimi
- `/audit-logs` - Denetim Kayıtları
- `/training` - Eğitim Yönetimi
- `/polyvalence` - Polivalans Matrisi
- `/benchmark` - Benchmark Yönetimi
- `/process-control` - Proses Kontrol Yönetimi

### Özel Route'lar
- `/supplier-portal` - Tedarikçi Portalı (auth gerektirmez)
- `/print/report/:type/:id` - Yazdırılabilir Raporlar
- `/print/dashboard-report` - Dashboard Raporu
- `/print/internal-audit-dashboard` - İç Tetkik Dashboard Raporu

## 🧪 Test Senaryoları

### 1. Authentication Testleri
- ✅ Login sayfasına erişim
- ✅ Geçerli kullanıcı ile giriş
- ✅ Geçersiz kullanıcı ile giriş denemesi
- ✅ Session kontrolü
- ✅ Logout işlemi
- ✅ Yetkisiz sayfalara erişim engelleme

### 2. Navigation Testleri
- ✅ Sidebar navigasyonu
- ✅ Modül değiştirme
- ✅ Mobil menü açma/kapama
- ✅ Breadcrumb navigasyonu
- ✅ Geri butonu çalışması

### 3. Dashboard Testleri
- ✅ Dashboard yüklenmesi
- ✅ Widget'ların görüntülenmesi
- ✅ Grafiklerin render edilmesi
- ✅ Filtreleme işlemleri
- ✅ Tarih aralığı seçimi

### 4. Form Testleri
- ✅ Form validasyonu
- ✅ Zorunlu alan kontrolü
- ✅ Dosya yükleme
- ✅ Form gönderimi
- ✅ Hata mesajları
- ✅ Başarı mesajları

### 5. CRUD İşlemleri
- ✅ Liste görüntüleme
- ✅ Yeni kayıt oluşturma
- ✅ Kayıt düzenleme
- ✅ Kayıt silme
- ✅ Arama ve filtreleme
- ✅ Sayfalama

### 6. Modal ve Dialog Testleri
- ✅ Modal açılması
- ✅ Modal kapanması
- ✅ Overlay tıklaması
- ✅ ESC tuşu ile kapanma
- ✅ Form modal'ları

### 7. PDF ve Rapor Testleri
- ✅ PDF görüntüleme
- ✅ PDF indirme
- ✅ Rapor oluşturma
- ✅ Yazdırma işlemleri

### 8. Responsive Testleri
- ✅ Mobil görünüm
- ✅ Tablet görünüm
- ✅ Desktop görünüm
- ✅ Sidebar responsive davranışı

## 🎯 TestSprite Konfigürasyonu

### Bootstrap Parametreleri
```javascript
{
  localPort: 3001,
  type: "frontend",
  projectPath: "/Users/atakanbattal/Desktop/Cursor Uygulamalar/Kademe QMS",
  testScope: "codebase", // veya "diff"
  pathname: "" // Test edilecek sayfa path'i
}
```

### Test Senaryoları İçin Gerekli Bilgiler

#### Login Bilgileri
- **Test Email:** Test için geçerli bir Supabase kullanıcı email'i
- **Test Password:** Test kullanıcısının şifresi
- **Not:** Gerçek test kullanıcısı bilgileri environment variable'lardan alınmalı

#### Test Verileri
- Modüller için test verileri Supabase'de mevcut olmalı
- Her modül için en az 1-2 test kaydı bulunmalı
- Test verileri production verilerini etkilememeli

## 🚀 Test Çalıştırma

### Adımlar
1. Development server'ı başlat: `npm run dev`
2. TestSprite bootstrap'ı çalıştır
3. Frontend test planını oluştur
4. Testleri generate et ve çalıştır
5. Sonuçları analiz et

### Önemli Notlar
- TestSprite çalıştırılmadan önce uygulama çalışır durumda olmalı
- Supabase bağlantısı aktif olmalı
- Test kullanıcısı için geçerli session olmalı
- Test verileri hazır olmalı

## 📊 Beklenen Test Sonuçları

### Başarı Kriterleri
- ✅ Tüm sayfalar yüklenmeli
- ✅ Form validasyonları çalışmalı
- ✅ CRUD işlemleri başarılı olmalı
- ✅ Navigation sorunsuz çalışmalı
- ✅ Responsive tasarım doğru görünmeli
- ✅ Hata durumları doğru handle edilmeli

### Bilinen Sorunlar
- TestSprite ile ilgili bilinen sorunlar buraya eklenebilir
- Workaround'lar belirtilebilir

## 🔧 Troubleshooting

### Yaygın Sorunlar
1. **Port 3001 kullanımda:** Farklı bir port kullan veya mevcut process'i durdur
2. **Supabase bağlantı hatası:** Environment variable'ları kontrol et
3. **Login başarısız:** Test kullanıcı bilgilerini kontrol et
4. **Sayfa yüklenmiyor:** Console hatalarını kontrol et

### Debug İpuçları
- Browser console'u açık tut
- Network tab'ını izle
- Supabase dashboard'u kontrol et
- TestSprite log'larını incele

## 📝 Test Raporu Formatı

TestSprite otomatik olarak test raporu oluşturur. Rapor şunları içerir:
- Test senaryoları
- Başarılı/başarısız testler
- Hata mesajları
- Ekran görüntüleri (varsa)
- Performans metrikleri

---

**Son Güncelleme:** 2025-01-27  
**Versiyon:** 1.0

