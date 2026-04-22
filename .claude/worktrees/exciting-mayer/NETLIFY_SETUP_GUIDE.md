# 🚀 Netlify Setup & Domain Configuration - Detaylı Rehber

## 📝 Adım 3: Netlify'da Setup

### 3.1 Netlify Hesabı Oluştur

1. **https://app.netlify.com/signup** adresine git
2. GitHub ile sign up et (önerilen):
   - "Sign up with GitHub" butonuna tıkla
   - GitHub hesapla authorize et
   - ✅ Netlify hesabı oluştu

### 3.2 GitHub Repository'yi Netlify'a Bağla

1. **Netlify Dashboard'a Git**: https://app.netlify.com
2. **"Add new site"** → **"Import an existing project"**
3. **"Deploy with GitHub"** seçeneğini seç
4. GitHub account'ı seç ve authorize et
5. Senin repository'ni ("Kademe QMS" veya repo adın) bul ve seç
6. **"Import"** butonuna tıkla

### 3.3 Build Ayarları

Netlify otomatik olarak Vite projelerini tanır, ama kontrol et:

**Build settings:**
```
Build command: npm run build
Publish directory: dist
Base directory: (boş bırak)
```

✅ Bunlar doğru görünüyorsa değiştirme.

### 3.4 Environment Variables Ekle

**ÇOK ÖNEMLİ! Bu adımı atlamayın!**

1. **Site settings** → **Environment variables** bölümüne git
2. **"Add a variable"** veya **"Add environment variables"** butonuna tıkla
3. Aşağıdaki 3 değişkeni ekle:

**Variable 1:**
```
Key: VITE_SUPABASE_URL
Value: https://rqnvoatirfczpklaamhf.supabase.co
Scopes: All scopes (veya sadece Production)
```

**Variable 2:**
```
Key: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Scopes: All scopes
```

**Variable 3:**
```
Key: VITE_APP_URL
Value: https://your-site-name.netlify.app
```
(Deploy sonrası otomatik oluşacak URL'i yazabilirsin)

### 3.5 Deploy Et

1. **"Deploy site"** butonuna tıkla (veya ilk import'ta otomatik başlar)
2. Netlify otomatik olarak build ve deploy başlatacak
3. ~2-3 dakika bekle

**Build Tamamlandı Mesajı:**
```
✅ Published
```

### 3.6 Deployment Sonrası

Build tamamlandıktan sonra:

1. **Deploys** tab'ına tıkla
2. Yeşil ✅ "Published" göreceksin
3. **"Open production deploy"** ile production URL'ni test et
4. URL'i not et (Adım 4'te kullanacaksın):
   ```
   https://your-site-name.netlify.app
   ```

---

## 📱 Adım 4: Domain Bağla (kademekalite.online)

### 4.1 Netlify'da Domain Setup

1. **Netlify Dashboard** → Senin site'ını aç
2. **Domain management** veya **Site configuration** → **Domains** bölümüne git
3. **"Add custom domain"** veya **"Add domain alias"** butonuna tıkla

### 4.2 Domain Adını Gir

1. **Domain** alanına yaz:
   ```
   kademekalite.online
   ```
2. **"Verify"** veya **"Add domain"** butonuna tıkla

### 4.3 DNS Konfigürasyonu

Netlify sana DNS ayarlarını gösterecek:

```
Type: CNAME (veya A record - Netlify IP)
Name: @ veya www
Value: [site-adı].netlify.app
```

**Bu ayarı Domain Provider'ında (örneğin GoDaddy, Namecheap) yapman gerekiyor.**

---

## 🔧 DNS Ayarlarını Domain Provider'ında Yap

### Eğer GoDaddy Kullanıyorsan:

1. **GoDaddy.com** → **My Products** → Domains
2. Senin domain'i ("kademekalite.online") bul
3. **"Manage"** butonuna tıkla
4. **DNS** tab'ına git
5. **CNAME Records** bölümünde **"Add"** tıkla
6. Netlify'ın verdiği değerleri gir (örn: `your-site.netlify.app`)

### Eğer Namecheap Kullanıyorsan:

1. **Namecheap.com** → **Account** → Manage Domains
2. Senin domain'i bul ve **"Manage"** tıkla
3. **Advanced DNS** tab'ına git
4. **Add New Record** → CNAME
5. Host: `@` veya `www`, Value: `[site-adı].netlify.app`

---

## ⏳ DNS Propagation (Bekleme)

DNS değişiklikleri 5-10 dakika alabilir (bazen 24 saate kadar).

**Kontrol:**
```bash
nslookup kademekalite.online
```

---

## ✅ Kontrol Adımları

### 1. Netlify'da Kontrol Et

1. Netlify Dashboard → Site → Domains
2. Domain'in yanında 🟢 "Netlify DNS" veya "External DNS" görmelisin

### 2. Browser'da Test Et

```
https://kademekalite.online
```

### 3. SSL Certificate (HTTPS)

Netlify otomatik olarak Let's Encrypt SSL certificate oluşturur.
Birkaç dakika sonra 🔒 görünmeli.

---

## 📋 Netlify Setup Checklist

### Environment Variables
- [ ] `VITE_SUPABASE_URL` eklendi
- [ ] `VITE_SUPABASE_ANON_KEY` eklendi
- [ ] `VITE_APP_URL` eklendi

### Personel / Hesap Yönetimi (Ayarlar → Hesap)
Push sonrası personel yetki ve hesap işlemlerinin çalışması için:
1. **Migration çalıştır**: `supabase db push` (veya Supabase Dashboard → SQL Editor'da migration dosyalarını çalıştır)
2. **Edge Function deploy et**: `npm run supabase:deploy-functions` (manage-user fonksiyonu)

### Deployment
- [ ] Build başarılı (✅ Published)
- [ ] Production URL çalışıyor
- [ ] Supabase bağlı

### Domain
- [ ] Domain Netlify'da eklendi
- [ ] DNS CNAME/A record eklendi
- [ ] DNS propagation bitti (~10 dakika)
- [ ] https://kademekalite.online açılıyor
- [ ] SSL certificate aktif (🔒)

---

## 🆘 Sorun Çözme

### "Build failed"
```
Çözüm:
1. Netlify Dashboard → Deploys → Build log kontrol et
2. Environment vars kontrol et
3. Local'de npm run build çalışıyor mu test et
```

### "DNS not resolving"
```
Çözüm:
1. DNS record'u domain provider'da kontrol et
2. 15-30 dakika bekle
3. nslookup kademekalite.online
```

### "Supabase connection error in production"
```
Çözüm:
1. Environment vars doğru mu kontrol et (Netlify → Site settings → Environment variables)
2. Netlify Deploy log'ları kontrol et
3. Supabase'de CORS settings kontrol et
```

---

## 📊 İşlem Sırası (Özet)

```
1. GitHub'a push
   ↓
2. Netlify'da import et (GitHub bağlantısı)
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

## 🎯 Kısaca

**Adım 3: Netlify Setup**
1. https://app.netlify.com → Add new site → Import from GitHub
2. Repo'yu seç
3. Build: `npm run build`, Publish: `dist`
4. **3 Environment Variable ekle** (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL)
5. Deploy et

**Adım 4: Domain**
1. Netlify → Domain management → Add custom domain
2. `kademekalite.online` ekle
3. Domain Provider'da DNS ekle
4. 10 dakika bekle
5. Test et

✅ **BITTI!** 🎉
