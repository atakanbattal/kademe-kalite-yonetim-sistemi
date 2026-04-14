# Kademe QMS - Frontend Modernizasyon Promptu (Stitch İçin)

---

## PROMPT BAŞLANGIÇ

Sana mevcut bir Kalite Yönetim Sistemi (QMS) uygulamasının yapısını detaylıca anlatacağım. Amacım **hiçbir fonksiyonelliği, iş mantığını, state yönetimini, veri akışını, API çağrısını veya bileşen davranışını değiştirmeden** sadece **görsel tasarımı (CSS, Tailwind sınıfları, renk paleti, layout düzeni, animasyonlar, spacing, tipografi, ikonografi, kart tasarımları, tablo stilleri, modal görünümleri, sidebar yapısı, genel UI/UX hissi)** tamamen yeniden tasarlayıp modernize etmeni istiyorum.

---

## KRİTİK KURALLAR

1. **HİÇBİR FONKSİYON DEĞİŞMEYECEK** — onClick handler'lar, form submit'ler, useEffect'ler, state değişkenleri, API çağrıları, route yapısı, context provider'lar, custom hook'lar, iş mantığı, koşullu render'lar (conditional rendering), veri dönüşümleri — bunların hiçbirine dokunma.
2. **SADECE GÖRSEL KATMAN DEĞİŞECEK** — Tailwind class'ları, CSS değişkenleri (`index.css`), renk paleti, gradient'ler, gölgeler, border-radius'lar, spacing, font boyutları/ağırlıkları, animasyon parametreleri, hover/active efektleri, layout oranları.
3. **BİLEŞEN YAPISI KORUNACAK** — Yeni bileşen ekleme, mevcut bileşenleri silme veya birleştirme yapma. Sadece mevcut bileşenlerin `className` prop'larını ve stil dosyalarını değiştir.
4. **RADIX UI PRİMİTİFLERİ KORUNACAK** — Dialog, Tabs, Select, DropdownMenu gibi Radix bileşenlerinin kullanımı aynı kalacak.
5. **RESPONSIVE YAPI KORUNACAK** — Mobil uyumlu yapı (xs, sm, md, lg, xl breakpoint'ler) korunacak, ama daha iyi mobil deneyim için iyileştirilebilir.

---

## TEKNOLOJİ YIĞINI

- **Framework:** React 18.2 + React Router 6 + Vite
- **Styling:** Tailwind CSS 3.3 (utility-first) + CSS Variables (HSL formatında)
- **UI Kütüphanesi:** shadcn/ui tarzı bileşenler (`/src/components/ui/`) — Radix UI primitifleri üzerine kurulu
- **İkonlar:** Lucide React 0.292.0
- **Animasyon:** Framer Motion 10.16.4
- **Grafikler:** Recharts 2.10.3
- **Font:** Inter (sans-serif)
- **Diğer:** class-variance-authority, clsx, tailwind-merge

---

## MEVCUT RENK SİSTEMİ (index.css :root)

```css
:root {
  --background: 0 0% 100%;          /* Beyaz */
  --foreground: 222.2 47.4% 11.2%;  /* Koyu Mavi/Siyah */
  --card: 0 0% 100%;                /* Beyaz */
  --card-foreground: 222.2 47.4% 11.2%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 47.4% 11.2%;
  --primary: 217 91% 60%;           /* Canlı Mavi */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;       /* Açık Gri */
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;     /* Kırmızı */
  --destructive-foreground: 210 40% 98%;
  --border: 210 40% 90%;
  --input: 210 40% 90%;
  --ring: 217 91% 60%;
  --radius: 0.75rem;
}
```

Bu renk sistemi `hsl(var(--xxx))` formatıyla Tailwind config'de kullanılıyor. Yeni tasarımda da aynı CSS variable yapısını koru ama renk değerlerini değiştir.

---

## UYGULAMA MİMARİSİ (DOKUNMA)

### Giriş Noktası: App.jsx
```
HelmetProvider > ErrorBoundary > AuthProvider > DataProvider > NCFormProvider > Routes
```
- `/login` → Login sayfası
- `/supplier-portal` → Tedarikçi portali
- `/print/*` → Yazdırılabilir raporlar
- `/*` → AuthProtected > MainLayout (ana uygulama)

### Context'ler (DOKUNMA):
- `SupabaseAuthContext` — Kimlik doğrulama
- `DataContext` (53KB) — Tüm uygulama verileri
- `NCFormContext` (20KB) — Uygunsuzluk form state'i

---

## MEVCUT SAYFA VE BİLEŞEN HARİTASI

### 1. Login Sayfası (`/src/pages/Login.jsx`)
**Mevcut Tasarım:**
- Ortalanmış tek kart (max-w-md)
- `bg-background` tam ekran
- Beyaz kart: `bg-card border border-border rounded-2xl shadow-2xl p-8`
- "Kademe QMS" başlık (text-3xl font-bold)
- Email + şifre input'ları
- Tam genişlik mavi buton
- Framer Motion fade-in animasyonu

**Modernize edilecek alanlar:** Kart tasarımı, arka plan (gradient veya pattern olabilir), logo alanı, input stil, buton hover efekti, genel sayfa kompozisyonu.

---

### 2. Sidebar Navigasyon (`/src/components/layout/Sidebar.jsx`)
**Mevcut Tasarım:**
- Sol tarafta sabit sidebar: `bg-card border-r border-border`
- Üst kısım: ShieldCheck ikonu + "Kademe A.Ş." yazısı + aktif modül göstergesi
- 9 grup navigasyon (Separator ile ayrılmış):
  - Ana Paneller, Kalite Yönetimi, Girdi ve Üretim Kalite, Tedarikçi Yönetimi, Denetim ve Uyumluluk, Ekipman ve Dokümantasyon, İyileştirme ve Eğitim, Operasyonel, Sistem
- Her menü öğesi: Lucide ikon + label, aktif item `bg-primary text-primary-foreground` rengiyle vurgulanıyor
- Alt kısım: Kullanıcı bilgisi (avatar + isim + email) + çıkış butonu
- Mobilde overlay + slide-in davranışı
- ScrollArea ile kaydırılabilir nav

**Modernize edilecek alanlar:** Sidebar genişliği, grup başlıkları stili, menü item hover/active efektleri, aktif modül göstergesi, kullanıcı profil alanı, genel sidebar estetiği, collapsible/mini sidebar modu düşünülebilir.

---

### 3. Dashboard (`/src/components/dashboard/`) — 22 Bileşen
**Mevcut Tasarım:**
- StatCard'lar: `dashboard-widget` class'ı (bg-card, rounded-xl, shadow-sm, hover:shadow-lg)
- Widget başlıkları: `text-sm font-medium text-muted-foreground`
- Widget değerleri: `text-3xl font-bold text-foreground`
- Recharts grafikleri (AreaChart, BarChart, PieChart)
- Günlük görevler, kritik uygunsuzluklar, kalite duvarı, kök neden ısı haritası
- Drill-down modal'lar, detay modal'lar
- Bildirim merkezi, dashboard uyarıları

**Modernize edilecek alanlar:** Kart tasarımları (glassmorphism, subtle gradient'ler), grafik renk paleti, spacing, grid düzeni, stat card görünümü, trend göstergeleri.

---

### 4. Modaller — ModernModalLayout (`/src/components/shared/ModernModalLayout.jsx`)
**Mevcut Tasarım:**
- Tam ekran dialog (95vw, 95vh)
- Gradient header: `bg-gradient-to-r from-primary to-blue-700` — beyaz metin
- İkon + başlık + badge
- İki sütunlu veya tek sütunlu body
- Footer: İptal + Kaydet butonları
- ModalSectionHeader: Uppercase label + divider çizgi
- ModalField: Küçük uppercase label + input

**Modernize edilecek alanlar:** Header gradient renkleri, buton stilleri, section header tasarımı, form field spacing, footer düzeni, modal açılış animasyonu.

---

### 5. Tablolar (data-table class'ları)
**Mevcut Tasarım:**
- `data-table` class'ı: border-collapse, hover:bg-secondary
- Thead: `bg-secondary/50`, uppercase tracking-wider
- Td: `whitespace-nowrap text-sm border-b`
- Mobilde card view'a dönüşüm (`mobile-card-view`, `mobile-card-item`)
- Responsive scroll wrapper (`table-responsive`)

**Modernize edilecek alanlar:** Tablo header rengi, satır alternating colors, hover efekti, mobil kart tasarımı, sıralama göstergeleri.

---

### 6. Form Bileşenleri
**Mevcut Tasarım (shadcn/ui):**
- Input: border, rounded-md, focus:ring-2
- Select: Radix UI Select primitifi
- Textarea: border, rounded-md
- Checkbox/Switch: Radix primitifleri
- Button variants: default (primary mavi), destructive (kırmızı), outline, ghost
- Label: text-sm font-medium
- Badge: rounded-full, çeşitli renk varyantları

**Modernize edilecek alanlar:** Input focus efektleri, buton hover animasyonları, badge tasarımı, form group spacing.

---

### 7. Diğer Önemli Modüller

| Modül | Bileşen Sayısı | Özellikler |
|-------|----------------|------------|
| **DF/8D Yönetimi** | 14 | Multi-step form, evidence uploader, revision history |
| **Kalite Maliyetleri** | 20 | Maliyet grafikleri, forecaster, anomaly detector |
| **Girdi Kalite** | 22 | Kontrol planları, risk değerlendirme, INKR takip |
| **Proses Kontrol** | 15 | Proses izleme, kontrol planları |
| **Tedarikçi Kalite** | 21 | Tedarikçi değerlendirme, audit, OTD/PPM |
| **İç Tetkik** | 12 | Audit planlama, bulgular, soru bankası |
| **Müşteri Şikayetleri** | 22 | Şikayet takip, SLA dashboard, servis planlama |
| **Ekipman** | 12 | Kalibrasyon, atama, hurda yönetimi |
| **Eğitim** | 10 | Eğitim planları, sınav, sertifika |
| **Polivalans** | 10 | Yetkinlik matrisi, eğitim ihtiyaç analizi |
| **Karantina** | 8 | Karantina kaydı, karar, analitik |
| **Sapma Yönetimi** | 11 | Sapma talep, onay, analitik |
| **Görev Yönetimi** | 10 | Kanban board, proje, filtreler |
| **Sızdırmazlık Testi** | 5 | Test kayıt, dashboard |
| **Dinamik Balans** | 5 | Balans kayıt, fan ürünleri |
| **Fikstür** | 8 | Takip, revizyon, doğrulama |
| **Doküman** | 5 | Versiyon kontrol, PDF görüntüleyici |
| **KPI** | 7 | KPI kartları, detay modal |
| **Benchmark** | 6 | Karşılaştırma, raporlama |
| **WPS** | 3 | Kaynak prosedürleri |

---

### 8. Paylaşılan UI Bileşenleri (`/src/components/ui/`) — 35 Bileşen

Tamamı shadcn/ui tabanlı, Radix primitifleri üzerine kurulu:
- **Form:** Input, Textarea, Label, Checkbox, RadioGroup, Select, Combobox, Switch, MultiSelect, MultiSelectPopover, SearchableSelectDialog, DateRangePicker, Calendar
- **Dialog & Overlay:** Dialog, AlertDialog, Popover, Accordion, Tooltip
- **Feedback:** Toast, Toaster, Progress, Skeleton
- **Navigation:** Tabs, DropdownMenu
- **Veri Gösterimi:** Table, Badge, Avatar, Card, InfoCard
- **Layout:** Separator, ScrollArea, Alert

---

### 9. Paylaşılan Yardımcı Bileşenler (`/src/components/shared/`)
- LoadingSpinner, PageLoader
- FileUploader (drag & drop)
- StatusBadge (durum renkleri)
- EmptyState (boş sayfa görseli)
- ViewModalLayout (salt okunur modal)
- ConfirmDialog (onay dialogu)
- ModernModalLayout (form modal'lar)

---

## MODERNİZASYON HEDEFLERİ

Aşağıdaki görsel iyileştirmeleri yap:

### A. Renk Paleti Yenileme
- Daha sofistike ve modern bir renk paleti oluştur (mevcut mavi temel kalabilir ama daha zarif tonlar)
- Daha iyi kontrast oranları
- Accent renk olarak tamamlayıcı bir renk ekle (örn: amber, teal, violet)
- Grafik renkleri için uyumlu palette
- Status renkleri (success, warning, error, info) daha tutarlı ve modern

### B. Tipografi İyileştirme
- Font ağırlık hiyerarşisi daha belirgin
- Başlık boyutları daha tutarlı
- Line-height ve letter-spacing optimizasyonu
- Muted text okunabilirliği artırılmalı

### C. Kart ve Container Tasarımı
- Daha modern kart stilleri (subtle shadow, gradient border, glassmorphism seçenekleri)
- Dashboard widget'ları daha dikkat çekici
- Hover ve focus efektleri daha zengin
- Stat card'larda ikon arka plan tasarımı

### D. Sidebar Modernizasyonu
- Daha şık sidebar tasarımı
- Grup başlıkları daha belirgin
- Aktif menü item efekti geliştirilmeli
- Hover animasyonları daha smooth
- Mini/collapsed sidebar modu (opsiyonel)

### E. Modal ve Dialog İyileştirme
- Modal header gradient daha modern
- Form alanları arası spacing iyileştirilmeli
- Section divider'lar daha zarif
- Modal açılış/kapanış animasyonu geliştirilmeli

### F. Tablo Modernizasyonu
- Daha modern tablo stili
- Satır hover efekti geliştirilmeli
- Header stili daha dikkat çekici
- Zebra striping (alternating row colors)
- Mobil kart görünümü daha şık

### G. Form ve Input İyileştirme
- Input focus ring daha belirgin ve estetik
- Buton hover/active animasyonları
- Select, checkbox, switch bileşenlerinin görünümü
- Form validation mesajları daha görünür

### H. Animasyon ve Geçiş Efektleri
- Sayfa geçiş animasyonları (Framer Motion mevcut, parametreleri güncelle)
- Hover micro-interactions
- Loading skeleton animasyonları
- Toast bildirimleri animasyonu

### I. Genel Layout İyileştirme
- Daha iyi whitespace kullanımı
- Grid gap'ler tutarlı
- Section header'lar daha belirgin
- Empty state görselleri daha modern
- Scroll davranışı ve scrollbar stilleri

---

## YAPILMAYACAK ŞEYLER (TEKRAR)

- ❌ Yeni sayfa veya route ekleme
- ❌ State management değiştirme
- ❌ API çağrıları değiştirme
- ❌ Bileşen prop'larını değiştirme
- ❌ Conditional rendering mantığını değiştirme
- ❌ Event handler'ları değiştirme
- ❌ Custom hook'ları değiştirme
- ❌ Supabase query'leri değiştirme
- ❌ Import/export yapısını değiştirme
- ❌ Yeni npm paketi ekleme (mevcut paketleri kullan)
- ❌ TypeScript'e geçiş
- ❌ Bileşen isimlerini değiştirme

---

## ÇALIŞMA SIRASI ÖNERİSİ

1. **index.css** — CSS variables (renk paleti) güncelle, global stiller
2. **tailwind.config.js** — Tema uzantıları, font, keyframe'ler
3. **`/src/components/ui/`** — Temel UI bileşenleri (button, card, input, badge, table vb.)
4. **`/src/components/shared/`** — ModernModalLayout, StatusBadge, LoadingSpinner vb.
5. **`/src/components/layout/Sidebar.jsx`** — Sidebar yeniden stillendirme
6. **`/src/pages/Login.jsx`** — Login sayfası (sadece className'ler)
7. **`/src/components/dashboard/`** — Dashboard bileşenleri (StatCard, widget'lar)
8. **Modül bileşenleri** — Her modüldeki tablo, form, modal stilleri

Her dosyada sadece `className` prop'larını ve Tailwind class'larını değiştir. JSX yapısını, state'leri, effect'leri, handler'ları olduğu gibi bırak.

---

## PROMPT SONU

Yukarıdaki bilgiler ışığında, bu uygulamanın frontend görselliğini 2025 modern SaaS standartlarında yeniden tasarla. Sade, profesyonel, yetişkin bir kurumsal uygulama havası olsun. Gereksiz süslemelerden kaçın ama sıkıcı da olmasın. Her değişikliğin sadece CSS/Tailwind katmanında olduğundan emin ol.
