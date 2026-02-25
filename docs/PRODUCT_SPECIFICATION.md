# Kademe Kalite Yönetim Sistemi (QMS)
## Product Specification Document

**Versiyon:** 1.0  
**Tarih:** 2026-02-13  
**Durum:** Aktif Geliştirme

---

## 1. Ürün Özeti

Kademe Kalite Yönetim Sistemi (Kademe QMS), Kademe A.Ş. için geliştirilmiş kurumsal bir kalite yönetim platformudur. Üretim, tedarik, müşteri ilişkileri ve denetim süreçlerini tek bir merkezden yönetmeyi sağlar. ISO 9001 ve otomotiv sektörü kalite standartlarına uyumlu çalışacak şekilde tasarlanmıştır.

---

## 2. Ürün Vizyonu ve Hedefler

### Vizyon
Tüm kalite süreçlerini dijitalleştirerek veri odaklı karar alma, şeffaf raporlama ve sürekli iyileştirme kültürünü destekleyen entegre bir kalite yönetim platformu sunmak.

### Hedefler
- **Merkezi Yönetim:** Uygunsuzluklar, maliyetler, şikayetler ve denetimler tek platformda
- **İzlenebilirlik:** Her kayıt için tam geçmiş ve ilişkili dokümanlar
- **Raporlama:** Anlık dashboard, grafikler ve PDF raporları
- **Yetkilendirme:** Rol ve modül bazlı erişim kontrolü
- **Mobil Uyum:** Responsive tasarım ile tablet ve mobil erişim

---

## 3. Hedef Kullanıcılar

| Rol | Açıklama | Tipik Kullanım |
|-----|----------|----------------|
| Kalite Müdürü | Tüm modüllere tam erişim, raporlama, stratejik kararlar | Dashboard, KPI, maliyet analizi, denetim onayları |
| Kalite Mühendisi | Uygunsuzluk, şikayet, DF/8D süreçleri | DF-8D, müşteri şikayetleri, karantina, sapma |
| Üretim Sorumlusu | Üretim kalite, araç takibi, proses kontrol | Üretilen araçlar, girdi kalite, proses kontrol |
| Tedarikçi Kalite | Tedarikçi değerlendirme, NC takibi | Tedarikçi kalite modülü |
| Denetçi | İç tetkik planlama ve uygulama | İç tetkik, denetim kayıtları |
| Sistem Yöneticisi | Kullanıcı, yetki ve maliyet hesap ayarları | Ayarlar, profil yönetimi |

---

## 4. Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18, Vite 4, React Router DOM 6 |
| UI | Tailwind CSS, Radix UI, Framer Motion, Lucide Icons |
| State | React Context (Auth, Data, NCForm) |
| Backend / Veritabanı | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Grafik / Raporlama | Recharts, jsPDF, jsPDF-AutoTable, html2canvas |
| Dosya İşlemleri | file-saver, react-dropzone, xlsx |
| Tarih | date-fns |
| Diğer | @dnd-kit (sürükle-bırak), uuid |

---

## 5. Ana Modüller ve Özellikler

### 5.1 Ana Panel (Dashboard)
- **Amaç:** Tüm kalite süreçlerine genel bakış
- **Özellikler:**
  - İstatistik kartları (DF/8D, maliyet, karantina, tetkik vb.)
  - Grafikler (bar, pie, trend)
  - Son işlemler listesi
  - Kritik uygunsuzluklar
  - Bugünkü görevler
  - Kalite duvarı (Quality Wall)
  - Kök neden ısı haritası
  - AI kök neden tahmini
  - Bildirim merkezi
  - Rapor oluşturma modalı
- **Drill-down:** Kartlara tıklayarak ilgili modüle detaylı filtre ile geçiş

### 5.2 KPI Modülü
- KPI tanımlama, takip ve hedef yönetimi
- Grafik ve trend analizi

### 5.3 DF ve 8D Yönetimi
- Uygunsuzluk (NC) kayıtları: DF, 8D, MDI tipleri
- 8D adımları: D1–D8 (ekip, problem tanımı, geçici önlem, kök neden, kalıcı faaliyetler vb.)
- Kök neden analizleri: 5N1K, 5 Why, Ishikawa, FTA
- Dosya ekleri (Supabase Storage)
- PDF rapor çıktısı
- Tetkik, maliyet, karantina, tedarikçi NC ile ilişkilendirme

### 5.4 Kalite Maliyetleri
- COPQ (Cost of Poor Quality) hesaplama
- Maliyet tipleri: İç hata, dış hata, önleme, değerlendirme
- Birim maliyet dağılımı, trend analizi
- Maliyet liderleri (part/location bazlı)
- DF/8D ve diğer modüllerle entegrasyon

### 5.5 Müşteri Şikayetleri
- Şikayet kayıtları, SLA takibi
- Aksiyon planları, analiz formları
- Müşteri ile iletişim takibi

### 5.6 Girdi Kalite Kontrol
- Girdi muayeneleri, kontrol planları
- Sac metal girişleri, INKR, stok riskleri
- Uygunsuzluk ile ilişkilendirme

### 5.7 Tedarikçi Kalite
- Tedarikçi listesi ve değerlendirme
- Tedarikçi NC’leri, notlar
- PDF görüntüleme entegrasyonu

### 5.8 İç Tetkik Yönetimi
- Tetkik planlama ve uygulama
- Bulgular, uygunsuzluk açma
- Raporlama

### 5.9 Sapma Yönetimi
- Sapma talepleri, onay akışı
- Analitik ve raporlama

### 5.10 Ekipman & Kalibrasyon
- Ekipman kayıtları
- Kalibrasyon planlama ve durum takibi

### 5.11 Doküman Yönetimi
- Doküman yükleme, versiyonlama
- Kategorilere göre organizasyon

### 5.12 WPS Yönetimi
- Kaynak prosedür spesifikasyonları (WPS) yönetimi

### 5.13 Karantina Yönetimi
- Karantina kayıtları, durum geçişleri
- DF/8D ile entegrasyon

### 5.14 Görev Yönetimi
- Kanban board (sürükle-bırak)
- Proje ve görev oluşturma
- Filtreleme, durum yönetimi

### 5.15 Üretilen Araçlar
- Araç/chassis takibi
- Kalite verileri, hata analizi
- Dinamik balans kontrol entegrasyonu

### 5.16 İyileştirme (Kaizen)
- Kaizen kayıtları, süreç iyileştirme takibi

### 5.17 Eğitim Yönetimi
- Eğitim planlama, sınavlar
- PDF görüntüleme

### 5.18 Polivalans Matrisi
- Beceri matrisi, eğitim-kategori ilişkileri

### 5.19 Benchmark Yönetimi
- Benchmark kayıtları, karşılaştırmalı analiz

### 5.20 Proses Kontrol Yönetimi
- Kontrol planları, DF/8D entegrasyonu

### 5.21 Dinamik Balans Kontrol
- Balans kayıtları, fan ürün yönetimi

### 5.22 Denetim Kayıtları
- Sistem aktivite logları

### 5.23 Ayarlar
- Maliyet hesapları, hesap yönetimi
- Sistem parametreleri

### 5.24 Tedarikçi Portalı
- Harici tedarikçi erişimi (public route)
- Tedarikçiye özel arayüz

---

## 6. Kimlik Doğrulama ve Yetkilendirme

### 6.1 Kimlik Doğrulama
- **Sağlayıcı:** Supabase Auth
- **Yöntem:** E-posta + şifre
- **Session:** Otomatik yenileme, `onAuthStateChange` ile senkronizasyon
- **Korumalı rotalar:** `AuthProtected` HOC ile `/login` dışındaki tüm sayfalar

### 6.2 Yetkilendirme
- **Kaynak:** `profiles` tablosu veya `auth.users.raw_user_meta_data.permissions`
- **Model:** Modül bazlı (`dashboard`, `kpi`, `df-8d`, `quality-cost`, vb.)
- **Seviyeler:** `full`, `read`, `none` (modül bazında)
- **Admin bypass:** Belirli e-posta adresleri tüm modüllere tam erişim
- **Yetkisiz erişim:** Toast uyarısı + varsayılan modüle yönlendirme

---

## 7. Rotalar ve Erişim

| Rota | Korumalı | Açıklama |
|------|----------|----------|
| `/login` | Hayır | Giriş sayfası |
| `/supplier-portal` | Hayır | Tedarikçi portalı |
| `/print/report/:type/:id` | Evet | PDF rapor görüntüleme |
| `/print/dashboard-report` | Evet | Dashboard PDF |
| `/print/internal-audit-dashboard` | Evet | İç tetkik dashboard PDF |
| `/*` (MainLayout) | Evet | Ana uygulama, modül bazlı routing |

### Modül Rotaları (örnek)
- `/dashboard`, `/kpi`, `/df-8d`, `/quality-cost`, `/customer-complaints`
- `/incoming-quality`, `/process-control`, `/produced-vehicles`, `/dynamic-balance`
- `/supplier-quality`, `/supplier-audit`, `/internal-audit`, `/deviation`
- `/equipment`, `/document`, `/wps`, `/quarantine`, `/tasks`
- `/kaizen`, `/training`, `/polyvalence`, `/benchmark`, `/audit-logs`, `/settings`

---

## 8. Veri Modeli (Özet)

- **Supabase tabloları:** `profiles`, `non_conformities`, `quality_costs`, `customer_complaints`, `audits`, `suppliers`, `equipment`, `documents`, `kaizen`, `quarantine`, `tasks`, `kpi`, vb.
- **Storage:** `df_attachments` bucket (DF/8D ekleri)
- **RPC:** `generate_nc_number` (NC numarası üretimi)
- **RLS:** Row Level Security ile tablo bazlı erişim kontrolü

---

## 9. Kullanıcı Akışları

### 9.1 Giriş Akışı
1. Kullanıcı `/login` sayfasına gider
2. E-posta ve şifre girer
3. `signInWithPassword` çağrılır
4. Başarılı ise session oluşur, `profiles` yüklenir
5. `from` state varsa o sayfaya, yoksa `/dashboard`’a yönlendirilir

### 9.2 Uygunsuzluk (NC) Açma Akışı
1. İlgili modülden (DF-8D, tetkik, maliyet, karantina vb.) “Yeni” veya “NC Aç” tıklanır
2. Global `NCFormModal` açılır
3. Form doldurulur (tip, başlık, sorumlu, tarihler, 8D adımları, analizler, ekler)
4. Kaydet → Supabase `non_conformities` insert/update
5. Dosya varsa `df_attachments` storage’a yüklenir
6. `refreshData` tetiklenir, modal kapanır

### 9.3 PDF Rapor Akışı
1. Kayıt detayında “PDF İndir” veya dashboard’dan rapor oluştur
2. `reportUtils.openPrintableReport` → `/print/report/:type/:id` veya benzeri
3. jsPDF ile PDF oluşturulur, indirilir veya yeni sekmede açılır

---

## 10. Non-Functional Requirements

| Kategori | Gereksinim |
|----------|------------|
| Performans | Lazy loading ile modül bazlı kod bölme; ilk yükleme süresinin minimize edilmesi |
| Responsive | Mobil-first, 375px+ viewport desteği |
| Erişilebilirlik | Radix UI bileşenleri, klavye navigasyonu, `sr-only` etiketleri |
| Güvenlik | RLS, JWT tabanlı auth, hassas verilerin client’ta saklanmaması |
| Lokalizasyon | Türkçe arayüz, `date-fns` `tr` locale |
| Tarayıcı | Chrome, Safari, Firefox, Edge (modern sürümler) |

---

## 11. Entegrasyonlar

- **Supabase:** Auth, Database, Storage, Realtime
- **Netlify:** Opsiyonel deployment
- **Harici sistemler:** Şu an doğrudan entegrasyon yok; ileride ERP/MES/PLM API’leri planlanabilir

---

## 12. Gelecek Özellikler (Backlog)

- Çoklu dil desteği (TR/EN)
- E-posta bildirimleri
- Mobil native uygulama (React Native / PWA)
- Gelişmiş analitik ve BI raporları
- Tedarikçi self-assessment portalı genişletmesi
- Offline-first modlar (PWA)

---

## 13. Doküman Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 1.0 | 2026-02-13 | İlk Product Specification sürümü |
