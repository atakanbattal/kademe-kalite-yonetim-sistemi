# 🔧 HATA: "references Secret which does not exist" - Çözümü

## ❌ Hata Mesajı
```
Environment Variable "VITE_SUPABASE_URL" references Secret "vite_supabase_url", 
which does not exist.
```

## 🔍 Sorun Nedir?

Vercel environment variable adlarını **otomatik küçük harfe çevirdi**:
- Yazdığın: `VITE_SUPABASE_URL` (büyük harf)
- Vercel okudu: `vite_supabase_url` (küçük harf)

Bu iki isim aynı değildir, bu yüzden hata veriliyor.

---

## ✅ ÇÖZÜM: Vercel'de Değişkenleri Düzenle

### Adım 1: Vercel Dashboard'a Git
1. **https://vercel.com/dashboard** → Senin project
2. **Settings** tab'ı
3. **Environment Variables** bölümü

### Adım 2: Var Olan Değişkenleri Sil

Şu 3 değişkeni bul ve sil:
- `vite_supabase_url` ❌ Sil
- `vite_supabase_anon_key` ❌ Sil
- `vite_app_url` ❌ Sil

**Nasıl Silegceğin:**
1. Her değişkenin yanında (⋯) menu'su var
2. **Delete** butonuna tıkla
3. Confirm et

### Adım 3: Doğru Adlarla Yeniden Ekle

**HATAN: Büyük harf kullanmamışsan**

Şimdi **BÜYÜK HARFLE** yeniden ekle:

```
Name: VITE_SUPABASE_URL
Value: https://rqnvoatirfczpklaamhf.supabase.co
→ Add
```

```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
→ Add
```

```
Name: VITE_APP_URL
Value: https://your-app-name.vercel.app
→ Add
```

### Adım 4: Redeploy Et

1. Vercel Dashboard → **Deployments**
2. Son deployment'ı seç
3. **Redeploy** butonuna tıkla
4. ~30 saniye bekle

✅ Artık çalışması gerekir!

---

## 📋 Kontrol Checklist

Vercel'de şu 3 değişkenin **BÜYÜK HARFLE** olması lazım:

- [ ] `VITE_SUPABASE_URL` (Değil `vite_supabase_url`)
- [ ] `VITE_SUPABASE_ANON_KEY` (Değil `vite_supabase_anon_key`)
- [ ] `VITE_APP_URL` (Değil `vite_app_url`)

---

## 🆘 Hala Sorun Varsa?

### Seçenek 1: Production Logs Kontrol Et
1. Vercel Dashboard → **Deployments**
2. Last deployment → **Logs**
3. Hata mesajı arayın
4. Environment variables bölümü gözüksün

### Seçenek 2: Local'de Test Et
```bash
cd "/Users/atakanbattal/Downloads/Kademe Code"
npm run dev
# http://localhost:3000

# Local'de hata yaşamıyorsan, sorun environment vars
```

### Seçenek 3: Build Logs Kontrol Et
1. Vercel → Deployments → Last Build
2. Build logs'u aç
3. Error mesajını bul

---

## 💡 Neden Bu Oluyor?

Vercel'in bazı eski sürümlerinde variable adlarını otomatik küçük harfe çevirme vardı. 

**Çözüm:** Variable adlarını eklerken **BÜYÜK HARFLE** yazman gerekiyor!

---

## ✨ Özet

**YANLIŞ:** `vite_supabase_url` (küçük harf)  
**DOĞRU:** `VITE_SUPABASE_URL` (büyük harf)

Vercel'de sil ve yeniden ekle. Bitti! ✅
