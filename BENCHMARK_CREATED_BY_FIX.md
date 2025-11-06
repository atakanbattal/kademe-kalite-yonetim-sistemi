# Benchmark "created_by" Kolonu Hatası - Çözüm

## Sorun
`benchmark could not find the "created_by" column of "benchmarks" in the schema cache` hatası alınıyor.

## Neden
Benchmark modülü `created_by` kolonunu kullanıyor ancak bu kolon veritabanında eksik.

## Çözüm

### Yöntem 1: Supabase Dashboard ile (Önerilen)

1. **Supabase Dashboard'a giriş yapın**
   - https://supabase.com adresine gidin
   - Projenizi seçin

2. **SQL Editor'ü açın**
   - Sol menüden "SQL Editor" seçeneğine tıklayın
   - "New Query" butonuna tıklayın

3. **Aşağıdaki SQL kodunu yapıştırıp çalıştırın:**

```sql
-- BENCHMARK TABLOLARINA CREATED_BY KOLONU EKLEME

-- 1. benchmarks tablosuna created_by kolonu ekle
ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. benchmark_pros_cons tablosuna created_by kolonu ekle
ALTER TABLE benchmark_pros_cons ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 3. benchmark_documents tablosuna uploaded_by kolonu ekle
ALTER TABLE benchmark_documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- 4. benchmark_activity_log tablosuna performed_by kolonu ekle
ALTER TABLE benchmark_activity_log ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES auth.users(id);

-- 5. benchmark_reports tablosuna generated_by kolonu ekle
ALTER TABLE benchmark_reports ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES auth.users(id);

-- 6. İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_benchmarks_created_by ON benchmarks(created_by);
```

4. **"Run" butonuna tıklayın**

5. **Başarılı mesajı gördükten sonra sayfayı yenileyin**

### Yöntem 2: Terminal ile (Alternatif)

Eğer Supabase CLI kuruluysa:

```bash
cd "/Users/atakanbattal/Desktop/Uygulamalar/Kademe QMS"
chmod +x run-benchmark-created-by-migration.sh
./run-benchmark-created-by-migration.sh
```

**NOT:** Bu yöntem için DATABASE_URL environment variable'ının tanımlı olması gerekir.

### Yöntem 3: Manuel SQL Dosyası ile

1. `scripts/add-created-by-to-benchmarks.sql` dosyasını açın
2. İçeriğini kopyalayın
3. Supabase Dashboard > SQL Editor'de çalıştırın

## Eklenen Kolonlar

| Tablo | Kolon | Açıklama |
|-------|-------|----------|
| `benchmarks` | `created_by` | Benchmark kaydını oluşturan kullanıcı |
| `benchmark_pros_cons` | `created_by` | Avantaj/dezavantajı ekleyen kullanıcı |
| `benchmark_documents` | `uploaded_by` | Dokümanı yükleyen kullanıcı |
| `benchmark_activity_log` | `performed_by` | Aktiviteyi gerçekleştiren kullanıcı |
| `benchmark_reports` | `generated_by` | Raporu oluşturan kullanıcı |

## Sonuç

Migration başarıyla tamamlandıktan sonra:
- Benchmark modülü artık sorunsuz çalışacaktır
- Tüm kayıtlar hangi kullanıcı tarafından oluşturulduğunu izleyebilecektir
- Uygulama şemasını yeniden yükleyecek ve hata ortadan kalkacaktır

## Test

Migration sonrası test için:
1. Uygulamayı yeniden başlatın (sayfayı yenileyin)
2. Benchmark modülüne gidin
3. Yeni bir benchmark oluşturmayı deneyin
4. Hata almadan kayıt oluşturabilmelisiniz

## Sorun Devam Ederse

Eğer hata devam ederse:
1. Tarayıcı cache'ini temizleyin
2. Uygulamayı tamamen yeniden başlatın
3. Supabase Dashboard'da tabloyu kontrol edin ve `created_by` kolonunun var olduğunu doğrulayın

