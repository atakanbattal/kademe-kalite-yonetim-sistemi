# 🔗 Supabase-Centric Workflow Guide

## 📋 Yapı (Architecture)

```
┌─────────────────────────────────────────────────────┐
│                  SUPABASE CLOUD                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ • PostgreSQL Database (20+ tables)          │    │
│  │ • Authentication (Supabase Auth)            │    │
│  │ • Storage (Dosya Yönetimi)                  │    │
│  │ • Real-time Updates                         │    │
│  │ • Edge Functions (opsiyonel)                │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
              ↑                          ↑
              │                          │
       ┌──────┴──────┐          ┌───────┴────────┐
       │              │          │                │
   LOCAL DEV      PRODUCTION  STAGING        BACKUP
   (Port 3000)    (Vercel)     (Branch)       (JSON)
```

---

## 🛠️ Local Development Workflow

### Setup (İlk Kez)

```bash
# 1. Projeyi klonla
git clone <repo-url>
cd "Kademe Code"

# 2. Dependencies kur
npm install

# 3. Supabase credentials ekle (.env.local)
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://rqnvoatirfczpklaamhf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=development
EOF

# 4. Dev server başlat
npm run dev
# → http://localhost:3000
```

### Günlük Geliştirme

```bash
# Başlangıç
npm run dev

# Supabase'de değişiklik yaptıysan pull et (opsiyonel)
npm run supabase:pull

# Kod geliştir...
# → Otomatik hot-reload

# Supabase verisini local'e yükle (gerekirse)
npm run db:backup

# Commit & Push
git add .
git commit -m "Feature: Açıklama"
git push origin main
```

---

## 📊 Supabase Dashboard Yönetimi

### Erişim
- **URL**: https://app.supabase.com/project/rqnvoatirfczpklaamhf
- **Kontrol**: Tables, Auth, Storage, SQL Editor, Logs
- **Monitoring**: Real-time analytics

### Yapılacak İşlemler (Supabase'de)

#### ✅ Veritabanı Tasarımı
```sql
-- Supabase SQL Editor'da
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policy'si ekle
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);
```

#### ✅ Authentication Setup
- Supabase Dashboard → Authentication → Providers
- Email/Password, OAuth (Google, GitHub), vb.

#### ✅ Storage Buckets
- Supabase Dashboard → Storage → Create Bucket
- Dosya yönetimi (Belgeler, Resimler, vb.)

#### ✅ Monitoring
- Supabase Dashboard → Monitoring
- Database size, API calls, Auth sessions

---

## 🔄 Deployment Workflow (Supabase + Vercel)

### Pre-Deployment Checklist

```bash
# 1. Local test yap
npm run build
npm run preview

# 2. Supabase'de gerekli değişiklikler yap
# → Dashboard'da RLS policies kontrol et
# → Storage bucket'ları configure et

# 3. Environment variables set et (Vercel'de)
# → Supabase URL & Keys

# 4. Backup al
npm run db:backup
```

### Deployment Adımları

#### **1. GitHub'a Push**
```bash
git add .
git commit -m "Deploy: Açıklama"
git push origin main
```

#### **2. Vercel Otomatik Deploy**
- GitHub Push → GitHub Actions trigger → Vercel deploy
- ~30 saniye içinde live

#### **3. Vercel Environment Variables**
```
VITE_SUPABASE_URL=https://rqnvoatirfczpklaamhf.supabase.co
VITE_SUPABASE_ANON_KEY=<from Supabase>
VITE_APP_URL=https://production-url.vercel.app
```

#### **4. Doğrula**
```bash
# Production'ı test et
curl https://production-url.vercel.app

# Supabase Logs'ta API calls kontrol et
# Dashboard → Monitoring → API Requests
```

---

## 🔐 Supabase Security Best Practices

### Row Level Security (RLS)

```sql
-- Her tabloda RLS enable et
ALTER TABLE quality_costs ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi verilerini görebilsin
CREATE POLICY "Users can read own records"
ON quality_costs FOR SELECT
USING (auth.uid() = user_id);

-- Sadece insert/update/delete kontrol et
CREATE POLICY "Users can insert own records"
ON quality_costs FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### API Keys Yönetimi

| Key | Kullanım | Güvenlik |
|-----|----------|----------|
| **Anon Key** | Frontend (Public) | Düşük - RLS ile kontrol |
| **Service Key** | Backend (Secret) | Yüksek - Tüm erişim |

**ASLA public olarak expose etmeyin!**

---

## 💾 Data Management

### Backup (Local'e)

```bash
# Tüm verileri JSON olarak kaydet
npm run db:backup

# Çıktı: backups/migration_TIMESTAMP.json
# İçerir: 20+ tablonun tüm verileri
```

### Migration (Supabase → Supabase)

```bash
# Eğer Supabase migration yapmak istersen
npm run supabase:pull      # Remote schema'yı çek
npm run supabase:push      # Local migration'ları push
```

### Schema Değişiklikleri

```bash
# Supabase Dashboard'da değişiklik yap:
# 1. Tables → New Table / Edit Table
# 2. Columns → Add / Edit / Delete
# 3. Indexes & Relationships ayarla
# 4. RLS Policies ekle

# Atau SQL Editor'da:
ALTER TABLE table_name ADD COLUMN new_column TYPE;
```

---

## 📱 Production Monitoring

### Supabase Dashboard

**URL**: https://app.supabase.com/project/rqnvoatirfczpklaamhf

**İzlenecek Metrikler:**
1. **Database**
   - Size: 0-100 MB (Free tier)
   - Active connections
   - Query performance

2. **API**
   - Request count (daily limit)
   - Response times
   - Error rates

3. **Auth**
   - Active users
   - Sign-up rates
   - Failed logins

4. **Logs**
   - API errors
   - Database errors
   - Auth issues

### Alerting (Opsiyonel)

```bash
# Sentry setup (error tracking)
npm install @sentry/react @sentry/tracing

# src/main.jsx'de
import * as Sentry from "@sentry/react";
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

---

## 🚀 Typical Development Day

### Sabah
```bash
# 1. Latest version'ı çek
git pull origin main

# 2. Dev server başlat
npm run dev

# 3. Supabase Dashboard'ı aç
# https://app.supabase.com/project/rqnvoatirfczpklaamhf
```

### Gün İçinde
```bash
# Kod geliştir
# → Supabase'de RLS/policies kontrol et
# → Local test (http://localhost:3000)
# → Gerekirse Supabase Dashboard'da schema değiştir

# Commit
git add .
git commit -m "Feature: Açıklama"
git push origin main
```

### Akşam
```bash
# Production durumunu kontrol et
# → Vercel deployment status
# → Supabase Logs

# Backup al (opsiyonel)
npm run db:backup

# Sonraki gün hazırlıkları yap
git pull origin main
```

---

## 🆘 Troubleshooting

### "Supabase bağlantı hatası"
```bash
# 1. Credentials kontrol et
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# 2. Dev server restart et
npm run dev

# 3. Browser cache temizle
# Ctrl+Shift+Delete (Chromium) / Cmd+Shift+Delete (Safari)

# 4. Network tab'ında kontrol et
# DevTools → Network → API requests
```

### "RLS policy hatası"
```sql
-- Supabase SQL Editor'da
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Policy'leri göster ve debug et
```

### "Production'da çalışmıyor ama local'de ok"
```bash
# 1. Env vars kontrol et (Vercel Dashboard)
# 2. Build log'ları kontrol et (Vercel Deployments)
# 3. Supabase Logs kontrol et
# 4. CORS settings kontrol et
```

---

## 🔄 CI/CD Pipeline (GitHub Actions)

### Otomatik Flow

```
Push to main
    ↓
GitHub Actions
    ├─ npm ci
    ├─ npm run build
    ├─ npm run lint
    └─ Test
        ↓
    ✅ Build Success
        ↓
    Vercel Deploy
        ↓
    Supabase API calls
        ↓
    Production Live ✅
```

### Manual Deployment (Gerekirse)

```bash
# Vercel CLI ile immediate deploy
npm i -g vercel
vercel --prod

# Vercel Dashboard'dan manual trigger
# → Deployments → Redeploy
```

---

## 📋 Checklist

### Hergün
- [ ] `npm run dev` ile local test
- [ ] Supabase Logs kontrol (errors?)
- [ ] Commit & Push

### Haftada Bir
- [ ] `npm run db:backup` ile backup al
- [ ] Supabase Monitoring kontrol
- [ ] Production logs review

### Aylık
- [ ] Supabase Database size review
- [ ] RLS Policies audit
- [ ] API key rotation (security)
- [ ] Performance optimization

---

## 🎯 Summary

**Bu workflow ile:**

✅ Supabase tamamen canlı ve merkezi veri kaynağı
✅ Local'de geliştir, Supabase'de kontrol et
✅ Git push → Vercel auto-deploy → Supabase sync
✅ Dashboard'dan gerçek zamanlı monitoring
✅ Güvenli, scalable, production-ready sistem

**Hiçbir karmaşa, hiçbir local database, 100% Supabase!** 🎉

---

**Son Güncelleme**: 2024-10-28
**Status**: ✅ Production Ready with Supabase
