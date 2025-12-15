# Proses Kontrol Yönetimi Modülü

## Genel Bakış

Proses Kontrol Yönetimi modülü, üretim araçlarının (kalıp, fixture, jig vb.) dokümanlarını, kontrol planlarını ve kalite bulgularını yönetmek için tasarlanmıştır.

## Özellikler

- **Araç Yönetimi**: Üretim araçlarının kayıtlarını tutma
- **Doküman Yönetimi**: Teknik resimler, kontrol planları ve iş talimatlarını saklama
- **Kontrol Planı Yönetimi**: Girdi kontrolündeki gibi kontrol planları oluşturma
- **Not Yönetimi**: 
  - Teknik resimlerdeki hatalar için notlar
  - Parça kodlu notlar
  - Genel notlar
- **Uygunsuzluk Entegrasyonu**: Notlardan direkt uygunsuzluk kaydı oluşturma
- **Dashboard**: Son girilen notları görüntüleme

## Kurulum

### 1. Veritabanı Tablolarını Oluşturma

Supabase Dashboard'da SQL Editor'e gidin ve `scripts/create-process-control-module.sql` dosyasını çalıştırın.

```sql
-- Dosya içeriği Supabase SQL Editor'de çalıştırılmalıdır
```

### 2. Storage Bucket Oluşturma

Supabase Dashboard'da Storage bölümüne gidin ve yeni bir bucket oluşturun:

- **Bucket Adı**: `process_control`
- **Public**: `false` (özel)
- **Allowed MIME types**: 
  - `application/pdf`
  - `image/*`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 3. RLS Politikaları

RLS politikaları SQL scriptinde otomatik olarak oluşturulur. Eğer manuel kontrol etmek isterseniz:

```sql
-- RLS politikaları kontrol edilebilir
SELECT * FROM pg_policies WHERE tablename LIKE 'process_control%';
```

## Kullanım

### Araç Yönetimi

1. **Araçlar** sekmesine gidin
2. **Yeni Araç** butonuna tıklayın
3. Araç bilgilerini girin:
   - Araç Kodu (zorunlu)
   - Araç Adı (zorunlu)
   - Araç Tipi (Araç, Kalıp, Fixture, Jig, Diğer)
   - Lokasyon
   - Sorumlu Birim
   - Sorumlu Personel
   - Durum

### Doküman Yönetimi

1. **Dokümanlar** sekmesine gidin
2. **Yeni Doküman** butonuna tıklayın
3. Doküman bilgilerini girin:
   - Araç seçin
   - Doküman Tipi (Teknik Resim, Kontrol Planı, İş Talimatı, Diğer)
   - Doküman Adı
   - Doküman Numarası
   - Revizyon Numarası
   - Dosya yükleyin

### Kontrol Planı Oluşturma

1. **Kontrol Planları** sekmesine gidin
2. **Yeni Plan** butonuna tıklayın
3. **Adım 1**: Temel bilgileri girin:
   - Araç seçin
   - Plan Adı
   - Parça Kodu
   - Parça Adı
   - Karakteristik sayısı
4. **Adım 2**: Kontrol planı maddelerini oluşturun:
   - Her madde için karakteristik seçin
   - Ölçüm ekipmanı seçin
   - Standart ve tolerans bilgilerini girin
   - Nominal değer ve toleransları belirleyin
5. Onaylı plan PDF'ini yükleyin (opsiyonel)
6. **Kaydet** butonuna tıklayın

### Not Ekleme

#### Teknik Resim Notu

1. **Notlar** sekmesine gidin
2. **Yeni Not** butonuna tıklayın
3. Not tipi olarak **Teknik Resim Notu** seçin
4. Teknik resim dokümanını seçin
5. Resim revizyonu ve konum bilgilerini girin
6. Başlık ve açıklama yazın
7. Durum ve öncelik belirleyin
8. Ekler ekleyin (opsiyonel)

#### Parça Kodu Notu

1. **Notlar** sekmesine gidin
2. **Yeni Not** butonuna tıklayın
3. Not tipi olarak **Parça Kodu Notu** seçin
4. Parça kodu ve adını girin
5. Başlık ve açıklama yazın
6. Durum ve öncelik belirleyin
7. Ekler ekleyin (opsiyonel)

### Uygunsuzluk Oluşturma

1. **Notlar** sekmesinde açık durumdaki bir notu bulun
2. Not satırındaki **Uygunsuzluk Oluştur** butonuna tıklayın
3. Uygunsuzluk formu açılacaktır
4. Formu doldurup kaydedin

## Dashboard

Ana ekranda şunlar görüntülenir:

- **İstatistikler**:
  - Toplam Araç Sayısı
  - Doküman Sayısı
  - Kontrol Planı Sayısı
  - Açık Not Sayısı
- **Son Girilen Notlar**: En son 10 not listelenir
- Her nottan direkt uygunsuzluk oluşturulabilir

## Veritabanı Yapısı

### Tablolar

1. **process_control_equipment**: Araçlar
2. **process_control_documents**: Dokümanlar
3. **process_control_plans**: Kontrol planları
4. **process_control_notes**: Notlar

### İlişkiler

- Her doküman bir araca bağlıdır
- Her kontrol planı bir araca bağlıdır
- Her not bir araca bağlıdır
- Teknik resim notları bir dokümana bağlıdır
- Notlar uygunsuzluk kayıtlarına bağlanabilir

## Entegrasyonlar

- **Uygunsuzluk Yönetimi**: Notlardan direkt uygunsuzluk kaydı oluşturma
- **Ekipman Modülü**: Ölçüm ekipmanları kontrol planlarında kullanılır
- **Karakteristikler**: Kontrol planlarında karakteristikler kullanılır

## Notlar

- Kontrol planları girdi kontrolündeki sistemle aynı yapıdadır
- Teknik resim notları için doküman tipi "Teknik Resim" olmalıdır
- Parça kodlu notlar için parça kodu ve adı zorunludur
- Notlardan oluşturulan uygunsuzluklar otomatik olarak not ile ilişkilendirilir

