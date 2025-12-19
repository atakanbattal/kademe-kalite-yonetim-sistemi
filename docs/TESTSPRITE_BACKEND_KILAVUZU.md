# TestSprite Backend Test Kılavuzu

## 📋 Genel Bakış

Bu kılavuz, Kademe QMS uygulamasının backend testlerini TestSprite ile çalıştırmak için gerekli bilgileri içerir.

## 🏗️ Backend Mimarisi

### Teknoloji Stack
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Database:** PostgreSQL 15.x
- **API:** Supabase REST API + PostgREST
- **Authentication:** Supabase Auth (JWT)
- **Storage:** Supabase Storage (S3-compatible)
- **Realtime:** Supabase Realtime (WebSocket)

### Supabase Proje Bilgileri
- **Project URL:** `https://rqnvoatirfczpklaamhf.supabase.co`
- **Project ID:** `rqnvoatirfczpklaamhf`
- **API Endpoint:** `https://rqnvoatirfczpklaamhf.supabase.co/rest/v1`
- **Auth Endpoint:** `https://rqnvoatirfczpklaamhf.supabase.co/auth/v1`

## 🗄️ Veritabanı Yapısı

### Ana Tablolar

#### Authentication & User Management
- `auth.users` - Supabase Auth kullanıcıları
- `profiles` - Kullanıcı profilleri ve izinleri
- `personnel` - Personel bilgileri

#### Quality Management
- `non_conformities` - Uygunsuzluklar (DF/8D)
- `quality_costs` - Kalitesizlik maliyetleri
- `audit_findings` - Denetim bulguları
- `risk_records` - Risk kayıtları
- `internal_audits` - İç tetkikler
- `audit_plans` - Denetim planları

#### Supplier Management
- `suppliers` - Tedarikçiler
- `supplier_non_conformities` - Tedarikçi uygunsuzlukları
- `supplier_audits` - Tedarikçi denetimleri
- `supplier_scores` - Tedarikçi skorları
- `supplier_documents` - Tedarikçi dokümanları

#### Production Management
- `quality_inspections` - Kalite kontrolleri
- `produced_vehicles` - Üretilen araçlar
- `incoming_quality` - Girdi kalite kontrolü
- `quarantine_records` - Karantina kayıtları

#### Equipment Management
- `equipments` - Ekipmanlar
- `equipment_calibrations` - Kalibrasyonlar
- `equipment_assignments` - Ekipman atamaları

#### Document Management
- `documents` - Dokümanlar
- `document_revisions` - Doküman revizyonları

#### Training & Development
- `trainings` - Eğitimler
- `training_records` - Eğitim kayıtları
- `polyvalence_matrix` - Polivalans matrisi

#### Other Modules
- `benchmarks` - Benchmark kayıtları
- `benchmark_items` - Benchmark alternatifleri
- `benchmark_criteria` - Benchmark kriterleri
- `deviations` - Sapma kayıtları
- `kaizen_records` - Kaizen kayıtları
- `kpi_records` - KPI kayıtları
- `wps_procedures` - WPS prosedürleri
- `process_control_records` - Proses kontrol kayıtları
- `customer_complaints` - Müşteri şikayetleri
- `tasks` - Görevler
- `audit_log_entries` - Denetim log kayıtları

### İlişkiler (Foreign Keys)
- `non_conformities` → `suppliers`, `personnel`, `audits`
- `supplier_non_conformities` → `suppliers`, `non_conformities`
- `quality_costs` → `non_conformities`, `suppliers`
- `audit_findings` → `audits`, `non_conformities`
- Ve daha fazlası...

## 🔐 Authentication & Authorization

### Supabase Auth
- **Method:** JWT Token-based
- **Token Type:** Bearer Token
- **Header:** `Authorization: Bearer {jwt_token}`
- **API Key:** `anon` key (public) veya `service_role` key (admin)

### Row Level Security (RLS)
- Tüm tablolarda RLS aktif
- Kullanıcı bazlı erişim kontrolü
- Permission-based modül erişimi

### Permission System
```json
{
  "permissions": {
    "dashboard": "full" | "read" | "none",
    "kpi": "full" | "read" | "none",
    "quality-cost": "full" | "read" | "none",
    // ... diğer modüller
  }
}
```

## 📡 API Endpoints

### Authentication Endpoints
```
POST   /auth/v1/token?grant_type=password
POST   /auth/v1/logout
GET    /auth/v1/user
POST   /auth/v1/user
```

### REST API Endpoints (PostgREST)

#### Generic CRUD Pattern
```
GET    /rest/v1/{table}                    # Liste
GET    /rest/v1/{table}?id=eq.{id}         # Tek kayıt
POST   /rest/v1/{table}                    # Yeni kayıt
PATCH  /rest/v1/{table}?id=eq.{id}         # Güncelle
DELETE /rest/v1/{table}?id=eq.{id}         # Sil
```

#### Örnek Endpoints
```
GET    /rest/v1/non_conformities
GET    /rest/v1/non_conformities?status=eq.Açık
POST   /rest/v1/non_conformities
PATCH  /rest/v1/non_conformities?id=eq.{id}
DELETE /rest/v1/non_conformities?id=eq.{id}
```

### RPC Functions (Stored Procedures)
```
POST   /rest/v1/rpc/generate_nc_number
POST   /rest/v1/rpc/generate_benchmark_number
POST   /rest/v1/rpc/calculate_supplier_score
POST   /rest/v1/rpc/get_dashboard_stats
```

### Storage Endpoints
```
GET    /storage/v1/object/{bucket}/{path}
POST   /storage/v1/object/{bucket}/{path}
DELETE /storage/v1/object/{bucket}/{path}
```

## 🧪 Test Senaryoları

### 1. Authentication Testleri
- ✅ Login API çağrısı
- ✅ Token alımı
- ✅ Token doğrulama
- ✅ Session yönetimi
- ✅ Logout işlemi
- ✅ Token refresh

### 2. CRUD İşlemleri
- ✅ CREATE - Yeni kayıt oluşturma
- ✅ READ - Kayıt okuma
- ✅ UPDATE - Kayıt güncelleme
- ✅ DELETE - Kayıt silme
- ✅ LIST - Liste çekme

### 3. Query Testleri
- ✅ Filtreleme (eq, neq, gt, lt, gte, lte)
- ✅ Sıralama (order)
- ✅ Sayfalama (limit, offset)
- ✅ İlişkili veri çekme (select, join)
- ✅ Arama (ilike, like)

### 4. RPC Function Testleri
- ✅ `generate_nc_number` - NC numarası üretme
- ✅ `generate_benchmark_number` - Benchmark numarası üretme
- ✅ `calculate_supplier_score` - Tedarikçi skoru hesaplama
- ✅ `get_dashboard_stats` - Dashboard istatistikleri

### 5. Storage Testleri
- ✅ Dosya yükleme
- ✅ Dosya indirme
- ✅ Dosya silme
- ✅ Bucket listeleme
- ✅ Public/Private erişim kontrolü

### 6. RLS (Row Level Security) Testleri
- ✅ Kullanıcı bazlı erişim kontrolü
- ✅ Permission kontrolü
- ✅ Yetkisiz erişim engelleme
- ✅ Cross-user data leakage kontrolü

### 7. Validation Testleri
- ✅ Zorunlu alan kontrolü
- ✅ Veri tipi kontrolü
- ✅ Foreign key kontrolü
- ✅ Unique constraint kontrolü
- ✅ Check constraint kontrolü

### 8. Transaction Testleri
- ✅ Atomic işlemler
- ✅ Rollback senaryoları
- ✅ Concurrent access
- ✅ Deadlock durumları

### 9. Performance Testleri
- ✅ Query performansı
- ✅ Index kullanımı
- ✅ Connection pooling
- ✅ Response time
- ✅ Throughput

### 10. Error Handling Testleri
- ✅ 400 Bad Request
- ✅ 401 Unauthorized
- ✅ 403 Forbidden
- ✅ 404 Not Found
- ✅ 500 Internal Server Error
- ✅ Database constraint hataları

## 🎯 TestSprite Konfigürasyonu

### Bootstrap Parametreleri
```javascript
{
  localPort: 3001, // Frontend port (backend testleri için de gerekli)
  type: "backend",
  projectPath: "/Users/atakanbattal/Desktop/Cursor Uygulamalar/Kademe QMS",
  testScope: "codebase" // veya "diff"
}
```

### Test Verileri
- Test için ayrı bir Supabase projesi kullanılmalı (production'dan ayrı)
- Veya test verileri production'da izole edilmeli
- Her test sonrası veritabanı temizlenmeli (rollback)

### Environment Variables
```bash
VITE_SUPABASE_URL=https://rqnvoatirfczpklaamhf.supabase.co
VITE_SUPABASE_ANON_KEY={anon_key}
SUPABASE_SERVICE_ROLE_KEY={service_role_key} # Admin işlemleri için
```

## 🚀 Test Çalıştırma

### Adımlar
1. Supabase projesine bağlantıyı kontrol et
2. Test verilerini hazırla
3. TestSprite bootstrap'ı çalıştır
4. Backend test planını oluştur
5. Testleri generate et ve çalıştır
6. Sonuçları analiz et

### Önemli Notlar
- TestSprite backend testleri için Supabase API'ye direkt erişim gerektirir
- Test kullanıcısı için geçerli token olmalı
- Test verileri production verilerini etkilememeli
- RLS politikaları test senaryolarına uygun olmalı

## 📊 Beklenen Test Sonuçları

### Başarı Kriterleri
- ✅ Tüm API endpoint'leri çalışmalı
- ✅ CRUD işlemleri başarılı olmalı
- ✅ RLS politikaları doğru çalışmalı
- ✅ Validation'lar çalışmalı
- ✅ Error handling doğru olmalı
- ✅ Performance kabul edilebilir olmalı

### Performans Metrikleri
- **Response Time:** < 500ms (ortalama)
- **Throughput:** > 100 req/s
- **Error Rate:** < 1%
- **Availability:** > 99.9%

## 🔧 Troubleshooting

### Yaygın Sorunlar
1. **401 Unauthorized:** Token eksik veya geçersiz
2. **403 Forbidden:** RLS politikası erişimi engelliyor
3. **404 Not Found:** Endpoint veya kayıt bulunamadı
4. **500 Internal Server Error:** Database hatası veya constraint ihlali
5. **Connection Timeout:** Supabase bağlantı sorunu

### Debug İpuçları
- Supabase dashboard'u kontrol et
- API log'larını incele
- Database log'larını kontrol et
- Network trafiğini izle
- TestSprite log'larını incele

## 📝 Test Raporu Formatı

TestSprite otomatik olarak test raporu oluşturur. Rapor şunları içerir:
- Test senaryoları
- API endpoint testleri
- Başarılı/başarısız testler
- Response time metrikleri
- Hata mesajları
- Database query log'ları

## 🔒 Güvenlik Notları

### Test Ortamı Güvenliği
- Test verileri production'dan izole olmalı
- Service role key production'da kullanılmamalı
- Test kullanıcıları sınırlı izinlere sahip olmalı
- Test sonrası hassas veriler temizlenmeli

### API Key Yönetimi
- Anon key public olabilir (RLS korumalı)
- Service role key gizli tutulmalı
- Environment variable'larda saklanmalı
- Version control'a commit edilmemeli

---

**Son Güncelleme:** 2025-01-27  
**Versiyon:** 1.0

