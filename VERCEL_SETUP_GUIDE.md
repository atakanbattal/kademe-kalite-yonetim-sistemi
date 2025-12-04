# 🚀 Vercel Setup & Domain Configuration - Detaylı Rehber

## 📝 Adım 3: Vercel'de Setup

### 3.1 Vercel Hesabı Oluştur

1. **https://vercel.com/signup** adresine git
2. GitHub ile sign up et (önerilen):
   - "Continue with GitHub" butonuna tıkla
   - GitHub hesapla authorize et
   - ✅ Vercel hesabı oluştu

### 3.2 GitHub Repository'yi Vercel'e Bağla

1. **Vercel Dashboard'a Git**: https://vercel.com/dashboard
2. **"Add New..."** butonuna tıkla → **"Project"**
3. **"Import Git Repository"** seçeneğini seç
4. GitHub account'ı seç ve authorize et
5. Senin repository'ni ("kademe-kalite-yonetim-sistemi") bul ve seç
6. **"Import"** butonuna tıkla

### 3.3 Project Konfigürasyonu

Vercel otomatik olarak ayarları tanıyacak, ama kontrol et:

**Build Settings (Otomatik Olarak Doldurulacak):**
```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

✅ Bunların hepsi doğru görünüyorsa değiştirme.

### 3.4 Environment Variables Ekle

**ÇOK ÖNEMLİ! Bu adımı atlamayın!**

1. **Environment Variables** bölümünü bul
2. **"Add Environment Variable"** butonuna tıkla
3. Aşağıdaki 3 değişkeni ekle:

**Variable 1:**
```
Name: VITE_SUPABASE_URL
Value: https://rqnvoatirfczpklaamhf.supabase.co
```
→ **Add** butonuna tıkla

**Variable 2:**
```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM
```
→ **Add** butonuna tıkla

**Variable 3:**
```
Name: VITE_APP_URL
Value: https://your-deployment.vercel.app
```
→ **Add** butonuna tıkla
(Bu URL Deployment sonra otomatik oluşacak, şimdilik bu şekilde yazabilirsin)

### 3.5 Deploy Et

1. **"Deploy"** butonuna tıkla
2. Vercel otomatik olarak deploy başlatacak
3. ~2-3 dakika bekle

**Build Tamamlandı Mesajı Göreceksin:**
```
✅ Production Build Ready
```

### 3.6 Deployment Sonrası

Build tamamlandıktan sonra:

1. **Deployments** tab'ına tıkla
2. Yeşil ✅ işareti göreceksin = Başarılı
3. **"Visit"** butonuna tıklayarak production URL'ni test et
4. URL'i not et (Adım 4'te kullanacaksın):
   ```
   https://your-app-name.vercel.app
   ```

---

## 📱 Adım 4: Domain Bağla (kademekalite.online)

### 4.1 Vercel'de Domain Setup

1. **Vercel Dashboard** → Senin project'ini aç
2. **Settings** tab'ına tıkla
3. Sol menüden **"Domains"** seçeneğini tıkla
4. **"Add Domain"** butonuna tıkla

### 4.2 Domain Adını Gir

1. **Domain Input** alanına yazı:
   ```
   kademekalite.online
   ```
2. **"Add"** butonuna tıkla

### 4.3 DNS Konfigürasyonu

Vercel sana DNS ayarlarını gösterecek:

```
Type: CNAME
Name: @ (veya boş bırak)
Value: cname.vercel-dns.com
```

**Bu ayarı Domain Provider'ında (örneğin GoDaddy, Namecheap) yapman gerekiyor.**

---

## 🔧 DNS Ayarlarını Domain Provider'ında Yap

### Eğer Godaddy Kullanıyorsan:

1. **GoDaddy.com** → **My Products** → Domains
2. Senin domain'i ("kademekalite.online") bul
3. **"Manage"** butonuna tıkla
4. **DNS** tab'ına git
5. **CNAME Records** bölümü bul
6. **"Add"** butonuna tıkla
7. Aşağıdaki bilgileri gir:
   ```
   Name: @ (veya www olabilir)
   Points to: cname.vercel-dns.com
   TTL: 3600 (default)
   ```
8. **Save** butonuna tıkla

### Eğer Namecheap Kullanıyorsan:

1. **Namecheap.com** → **Account** → Manage Domains
2. Senin domain'i bul ve **"Manage"** tıkla
3. **Advanced DNS** tab'ına git
4. **Add New Record** butonuna tıkla
5. Aşağıdaki bilgileri gir:
   ```
   Type: CNAME Record
   Host: @
   Value: cname.vercel-dns.com
   TTL: Auto
   ```
6. **Save Changes** butonuna tıkla

### Eğer başka provider kullanıyorsan:

1. DNS ayarlarına gidip CNAME record ekle
2. Host: `@` (or root)
3. Value: `cname.vercel-dns.com`

---

## ⏳ DNS Propagation (Bekleme)

DNS değişiklikleri 5-10 dakika alabilir (bazen 24 saate kadar).

**Kontrol etmek için:**

```bash
# Terminal'de
nslookup kademekalite.online
# veya
dig kademekalite.online

# Çıktıda cname.vercel-dns.com görmelisin
```

---

## ✅ Kontrol Adımları (DNS Ayarı Bittikten Sonra)

### 1. Vercel'de Kontrol Et

1. Vercel Dashboard → Project → Domains
2. Domain'in yanında 🟢 (green status) görmelisin
3. "Valid Configuration" mesajı görmelisin

### 2. Browser'da Test Et

```
https://kademekalite.online
```

Açılmış olmalı ve production app'in görünmeliydi.

### 3. SSL Certificate (HTTPS)

Vercel otomatik olarak SSL certificate oluşturur.
5-10 dakika sonra:
```
https://kademekalite.online
```
Güvenli (🔒 işareti) görünmeliydi.

---

## 📋 Vercel Setup Checklist

### Environment Variables
- [ ] `VITE_SUPABASE_URL` eklendi
- [ ] `VITE_SUPABASE_ANON_KEY` eklendi
- [ ] `VITE_APP_URL` eklendi

### Deployment
- [ ] Build başarılı (✅ green status)
- [ ] Production URL çalışıyor
- [ ] Supabase bağlı (http://localhost:3000'de iken test et)

### Domain
- [ ] Domain Vercel'de eklendi
- [ ] DNS CNAME record eklendi (GoDaddy/Namecheap'de)
- [ ] DNS propagation bitti (~10 dakika)
- [ ] https://kademekalite.online açılıyor
- [ ] SSL certificate aktif (🔒 görünüyor)

---

## 🆘 Sorun Çözme

### "Cannot reach deployment"
```
Çözüm:
1. Build logs kontrol et (Vercel Dashboard → Deployments)
2. Environment vars kontrol et
3. 5 dakika bekle ve yeniden dene
```

### "DNS not resolving"
```
Çözüm:
1. DNS record'u domain provider'da kontrol et
2. TTL'i azalt (600 veya 300)
3. 15-30 dakika daha bekle
4. nslookup ile kontrol et: nslookup kademekalite.online
```

### "Domain already in use"
```
Çözüm:
1. Domain başka bir Vercel project'inde var mı kontrol et
2. Vercel Dashboard → Domains → Remove
3. Tekrar ekle
```

### "Supabase connection error in production"
```
Çözüm:
1. Environment vars doğru mu kontrol et
2. Vercel Logs kontrol et (Deployments → Logs)
3. Supabase'de CORS settings kontrol et
```

---

## 📊 İşlem Sırası (Özet)

```
1. GitHub'a push
   ↓
2. Vercel'de import et
   ↓
3. Environment vars ekle
   ↓
4. Deploy et (~3 dakika)
   ↓
5. URL not et
   ↓
6. Domain provider'da DNS ekle
   ↓
7. DNS propagation bekle (~10 dakika)
   ↓
8. https://kademekalite.online test et
   ↓
✅ BITTI!
```

**Toplam süre: ~15-20 dakika** ⚡

---

## 🔐 Sonra Kontrol Edilecekler

1. **Supabase Logs**
   - https://app.supabase.com/project/rqnvoatirfczpklaamhf/logs
   - Production API calls kontrol et

2. **Vercel Analytics**
   - https://vercel.com/dashboard/project-name/analytics
   - Performance metrics kontrol et

3. **SSL Certificate**
   - https://kademekalite.online
   - 🔒 işareti görmelisin

4. **Backup Al**
   - `npm run db:backup`
   - Production data'yı local'e kaydet

---

## 🎯 Kısaca

**Adım 3: Vercel Setup**
1. https://vercel.com/new
2. GitHub repo'yu seç
3. Build settings otomatik
4. **3 Environment Variable ekle** (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL)
5. Deploy et

**Adım 4: Domain**
1. Vercel → Settings → Domains
2. `kademekalite.online` ekle
3. Domain Provider'da DNS CNAME record ekle
4. 10 dakika bekle
5. Test et

✅ **BITTI!** 🎉
