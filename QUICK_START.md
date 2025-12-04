# ⚡ Quick Start Guide

## 🎯 30 dakika içinde production'a deploy et!

### Adım 1: Local Setup (5 min)
```bash
cd "/Users/atakanbattal/Downloads/Kademe Code"
npm install
npm run dev
```
✅ `http://localhost:3000` açılacak

---

### Adım 2: GitHub Repo Oluştur (10 min)

```bash
# Git initialize et
git init
git config user.name "Your Name"
git config user.email "your@email.com"

# Tüm dosyaları ekle (EXCEPT .env.local!)
git add -A
git commit -m "🚀 Initial commit - Kademe Kalite Yönetim Sistemi"

# GitHub'da yeni repo oluştur
# https://github.com/new
# Repository name: kademe-kalite-yonetim-sistemi

# Remote ekle ve push et
git remote add origin https://github.com/your-username/kademe-kalite-yonetim-sistemi.git
git branch -M main
git push -u origin main
```

---

### Adım 3: Vercel'de Deploy Et (10 min) ⭐ RECOMMENDED

**A. Quick Deploy (Vercel CLI):**
```bash
npm i -g vercel
vercel --prod
```

**B. Manual Deploy:**
1. `https://vercel.com/new` açıl
2. GitHub repo'yu seç
3. Import et
4. Environment Variables ekle:
   ```
   VITE_SUPABASE_URL=https://rqnvoatirfczpklaamhf.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM
   VITE_APP_URL=https://your-vercel-url.vercel.app
   ```
5. Deploy!

---

### Adım 4: Custom Domain Bağla (5 min)

1. Vercel Dashboard → Settings → Domains
2. `kademekalite.online` ekle
3. DNS kayıtlarını güncelle:
   ```
   CNAME: cname.vercel-dns.com
   ```
4. 5-10 dakika bekle

---

## 🗄️ Database Yönetimi

### Backup Al
```bash
npm run db:backup
# Dosya: backups/migration_TIMESTAMP.json
```

### İstatistikleri Göster
```bash
npm run db:migrate
# Seç: 4 (İstatistikleri göster)
```

---

## 🔄 Sonraki Deploymentler

Kod değiştirip push yap:
```bash
git add .
git commit -m "Feature: Description"
git push origin main
```

✅ Vercel otomatik deploy eder!

---

## 📋 Production Checklist

- [ ] GitHub repo oluşturuldu
- [ ] `.env.local` `.gitignore`'da
- [ ] Vercel connected
- [ ] Environment variables set
- [ ] Domain connected
- [ ] HTTPS active
- [ ] Supabase dashboard monitored
- [ ] Backup strategy planned

---

## 🆘 Quick Troubleshooting

| Problem | Çözüm |
|---------|-------|
| Port 3000 in use | `npm run dev -- --port 3001` |
| Build error | `npm cache clean --force && npm install` |
| Env vars not loading | Dev server'ı restart et |
| Vercel deploys old code | `vercel --prod --force` |

---

## 📞 Resources

- Supabase: https://supabase.com/docs
- Vercel: https://vercel.com/docs
- React: https://react.dev

---

**Ready? Let's go! 🚀**
