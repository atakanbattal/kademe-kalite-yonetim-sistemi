# 🔐 Environment Variables - Nereden Alınacağı Rehberi

## 📋 3 Tane Environment Variable Var

```
1. VITE_SUPABASE_URL      → Supabase URL'i
2. VITE_SUPABASE_ANON_KEY → Supabase Anahtarı
3. VITE_APP_URL           → Production URL'i
```

---

## 📍 VITE_SUPABASE_URL Nereden Alınır?

### Başlangıç: Supabase Dashboard'ı Aç
1. **https://app.supabase.com/projects** adresine git
2. Senin proje'yi bul ve tıkla: **"rqnvoatirfczpklaamhf"**

### Adım Adım:
1. Sol menüde **"Project Settings"** tıkla (alt tarafta)
2. **"API"** tab'ına tıkla
3. **"Project URL"** bölümünü bul

**Burada göreceksin:**
```
https://rqnvoatirfczpklaamhf.supabase.co
```

### Kopyala:
```
VITE_SUPABASE_URL=https://rqnvoatirfczpklaamhf.supabase.co
```

✅ **Bunu Netlify'de kullanacaksın!**

---

## 🔑 VITE_SUPABASE_ANON_KEY Nereden Alınır?

### Başlangıç: Supabase Dashboard (Aynı Sayfada Kal)
1. Hala **Project Settings → API** tab'ında olmalısın
2. **"API Keys"** bölümüne scroll down et

### Adım Adım:
1. **"anon"** (public) key'i bul
2. Yanında bir icon göreceksin
3. **Copy** butonuna tıkla (kopyalandı!)

**Göreceksin:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM
```

### Kopyala:
```
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM
```

⚠️ **ÖNEMLİ:**
- **service_role** key'i ASLA kullanma (private!)
- **anon** key'i kullan (public)

✅ **Bunu Netlify'de kullanacaksın!**

---

## 🌐 VITE_APP_URL Nereden Alınır?

### Bu En Kolay Kısmı!

Netlify deploy ettikten sonra otomatik oluşacak. Şu anda tahmin etmen gerek:

**Örnek:**
```
https://your-app-name.netlify.app
```

### Gerçek Değer:
1. Netlify'de deploy et
2. Tamamlandıktan sonra URL göreceksin, örn:
   ```
   https://kademe-kalite-yonetim-sistemi.netlify.app
   ```
3. Bunu VITE_APP_URL olarak set et

**Şimdilik şunu yazabilirsin:**
```
VITE_APP_URL=https://your-app-name.netlify.app
```

(Sonra deploy URL'sini aldıktan sonra güncelleyebilirsin)

✅ **Netlify'de otomatik güncellenebilir!**

---

## 📸 Supabase'de Nereler Tıklanacağı (Görselle)

```
Supabase Dashboard
    │
    ├─ Top Right: Projects
    │
    └─ Proje Seç: rqnvoatirfczpklaamhf
       │
       ├─ Sol Menü: Project Settings (alt tarafta)
       │   │
       │   └─ API Tab
       │      │
       │      ├─ Project URL (VITE_SUPABASE_URL)
       │      │   └─ https://rqnvoatirfczpklaamhf.supabase.co
       │      │
       │      └─ API Keys (VITE_SUPABASE_ANON_KEY)
       │          │
       │          ├─ anon (public) ← BU'NU KUT
       │          │   └─ eyJhbGciO...
       │          │
       │          └─ service_role ← BU'NU KULLANMA!
```

---

## ✅ 3 Variable Özeti

| Variable | Değer | Nereden |
|----------|-------|---------|
| **VITE_SUPABASE_URL** | `https://rqnvoatirfczpklaamhf.supabase.co` | Supabase → Project Settings → API → Project URL |
| **VITE_SUPABASE_ANON_KEY** | `eyJhbGciO...` (uzun string) | Supabase → Project Settings → API → API Keys → anon |
| **VITE_APP_URL** | `https://your-app.netlify.app` | Netlify deploy URL'i |

---

## 🚀 Netlify'de Nasıl Ekleyeceğin

### Adım Adım:

1. **https://netlify.com/new** → GitHub repo'yu seç
2. **"Environment Variables"** bölümünü bul (sayfanın aşağısında)
3. **"Add Environment Variable"** butonuna tıkla

### İlk Variable (VITE_SUPABASE_URL):
```
Name alanına yazı:    VITE_SUPABASE_URL
Value alanına yazı:   https://rqnvoatirfczpklaamhf.supabase.co
```
→ **Add** butonuna tıkla

### İkinci Variable (VITE_SUPABASE_ANON_KEY):
```
Name alanına yazı:    VITE_SUPABASE_ANON_KEY
Value alanına yapıştır: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
→ **Add** butonuna tıkla

### Üçüncü Variable (VITE_APP_URL):
```
Name alanına yazı:    VITE_APP_URL
Value alanına yazı:   https://your-app-name.netlify.app
```
→ **Add** butonuna tıkla

### Sonra:
→ **Deploy** butonuna tıkla

---

## 🔍 Emin Misin Diye Kontrol Et

### Supabase'de Kontrol:

**URL'i kopyala:**
1. Supabase → Project Settings → API
2. "Project URL" bölümünde
3. Başı: `https://`
4. Sonu: `.supabase.co`
5. Ortada: `rqnvoatirfczpklaamhf`

**Ankey'i kopyala:**
1. Supabase → Project Settings → API
2. "API Keys" bölümünde
3. **anon** key'i seç (yeşildir genelde)
4. Copy simgesine tıkla
5. Çok uzun bir string (başında `eyJ...` gibi)

### Netlify'de Kontrol:

**Deploy ettikten sonra:**
1. Netlify Dashboard → Project → Deployments
2. En son deployment'ı tıkla
3. URL göreceksin üstte
4. Bu URL'i VITE_APP_URL olarak set edebilirsin (opsiyonel)

---

## ⚠️ Yaygın Hatalar

### ❌ HATA 1: Service Role Key Kullanmak
```
VITE_SUPABASE_ANON_KEY=sb_service_key_...
```
**YANLIŞ!** Anon key (public) kullan!

### ❌ HATA 2: URL'nin Sonunu Kapatmak
```
https://rqnvoatirfczpklaamhf.supabase.co/
```
**YANLIŞ!** Son slash olmasın (`.co` ile bitsin)

### ❌ HATA 3: Boşluk Bırakmak
```
VITE_SUPABASE_URL = https://...
```
**YANLIŞ!** `=` işaretinin etrafında boşluk olmasın!

### ✅ DOĞRU:
```
VITE_SUPABASE_URL=https://rqnvoatirfczpklaamhf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_APP_URL=https://your-app-name.netlify.app
```

---

## 🎯 Özet

**3 tane değişken var, bunları ekleyeceksin Netlify'de:**

1. ✅ **VITE_SUPABASE_URL**
   - Supabase'den kopyala
   - `https://rqnvoatirfczpklaamhf.supabase.co`

2. ✅ **VITE_SUPABASE_ANON_KEY**
   - Supabase'den kopyala (anon key)
   - `eyJhbGciO...` (uzun string)

3. ✅ **VITE_APP_URL**
   - Netlify'de deploy URL'i
   - `https://your-app-name.netlify.app`

**Bittikten sonra:**
- Deploy et
- ~3 dakika bekle
- Production canlı olur! 🎉

---

## 📞 Hala Kafan Karışık mı?

**Supabase'i aç şimdi:**
- https://app.supabase.com/project/rqnvoatirfczpklaamhf
- Project Settings → API
- İlk 2 değişkeni gör ve kopyala!

**Netlify'i aç:**
- https://netlify.com/new
- Repo'yu seç
- Environment Variables bölümüne ekle!

**Hepsi bu kadar!** ✅
