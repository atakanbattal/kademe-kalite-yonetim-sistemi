# 📅 Günlük Geliştirme Workflow

## 🌅 Sabah (Başlarken)

```bash
# 1. Projeye gir
cd "/Users/atakanbattal/Downloads/Kademe Code"

# 2. Son değişiklikleri çek
git pull origin main

# 3. Dev server başlat
npm run dev

# ✅ http://localhost:3000 açılacak
```

---

## 💻 Gün İçinde (Geliştirme)

### Feature Eklerken

```bash
# 1. Feature branch oluştur (opsiyonel ama tavsiye)
git checkout -b feature/feature-name

# 2. Kod geliştir & test et
# → http://localhost:3000'de test et
# → Hot-reload otomatik

# 3. Supabase Dashboard'ı aç (gerekirse)
# https://app.supabase.com/project/rqnvoatirfczpklaamhf
# → Tables, SQL Editor, Auth yapılandırması

# 4. Commit & Push
git add .
git commit -m "Feature: Açıklama"
git push origin feature/feature-name  # veya main
```

### Bug Fix

```bash
# 1. Bug'ı tanımla (local'de)
# http://localhost:3000'de repro et

# 2. Supabase Logs'u kontrol et
# Dashboard → Logs → Recent requests

# 3. Kodu düzelt
git add .
git commit -m "Fix: Bug açıklaması"
git push origin main
```

### Database Değişikliği

```bash
# Supabase Dashboard'da yap:
# 1. Tables → Edit Table
# 2. Column'u add/edit/delete
# 3. RLS Policy'si update
# 4. Kaydet

# Local'de test et:
npm run dev

# Eğer migration gerekirse:
npm run supabase:pull
git add .
git commit -m "Database: Schema değişikliği"
git push origin main
```

---

## 🌙 Akşam (Bitmeden Önce)

```bash
# 1. Tüm değişiklikleri commit et
git status  # Unutulan dosya var mı?
git add .
git commit -m "Final: Açıklama"
git push origin main

# 2. Build test et
npm run build
npm run preview

# 3. Supabase Logs kontrol et
# Dashboard → Logs → View recent requests

# 4. Backup al (opsiyonel)
npm run db:backup
# → backups/migration_TIMESTAMP.json

# ✅ Bitti! Netlify otomatik deploy etti
```

---

## 📋 Haftada Bir

```bash
# Pazartesi sabahı
npm run db:backup
# Backup'ları check et

# Supabase Monitoring
# Dashboard → Monitoring
# → Database size kontrol
# → API requests kontrol

# Performance review
# → Slow queries?
# → Storage kullanımı?
```

---

## 🚀 Production Deploy

### Otomatik (Recommended)
```bash
# Yapman gereken sadece:
git push origin main

# → GitHub Actions trigger
# → Netlify auto-deploy
# → ~30 saniye → LIVE ✅
```

### Manual (Gerekirse)
```bash
npm i -g netlify
netlify --prod
```

---

## 🆘 Yaygın Sorunlar

| Problem | Çözüm |
|---------|-------|
| Port 3000 busy | `npm run dev -- --port 3001` |
| Supabase connection error | Env vars kontrol + dev restart |
| Build hata | `npm cache clean --force && npm install` |
| Hot-reload çalışmıyor | Browser cache temizle |
| Production'da crash | Supabase Logs kontrol et |

---

## 🔗 Önemli Linkler

```
🖥️  Local Dev: http://localhost:3000
🌐 Production: https://kademekalite.online
📊 Supabase: https://app.supabase.com/project/rqnvoatirfczpklaamhf
💻 Netlify: https://netlify.com/dashboard
📝 GitHub: https://github.com/YOUR-USERNAME/kademe-kalite
```

---

## 📦 Sık Kullanılan Commands

```bash
# Development
npm run dev              # Start dev server

# Database
npm run db:backup       # Backup all data
npm run db:migrate      # Interactive tool

# Deployment
git push origin main    # → Auto-deploy

# Build
npm run build           # Production build
npm run preview         # Test build locally

# Maintenance
npm cache clean --force # Clear cache
npm install            # Update packages
```

---

## ✅ Günlük Checklist

- [ ] `npm run dev` ile başla
- [ ] Kod geliştir & test et
- [ ] Supabase Logs kontrol et
- [ ] Commit & Push
- [ ] Build test (`npm run build`)
- [ ] Backup al (`npm run db:backup`)
- [ ] Netlify deployment kontrol et

**Tüm bunlar ~5 dakika alır!** ⚡

---

## 🎯 TL;DR

```bash
# Morning
git pull origin main && npm run dev

# Work
# → Code + Test
# → git commit + git push

# Evening
npm run build && npm run db:backup

# That's it! ✅
```

---

**Remember**: Supabase is your single source of truth. Dashboard'da her şey görülebilir.
