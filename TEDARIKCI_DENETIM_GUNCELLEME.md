# Tedarikçi Denetim Modülü Güncellemesi

## Yapılan İyileştirmeler

### 1. Denetlenen Firmadan Katılanların Eklenmesi
- Denetim sırasında sadece denetçiler değil, denetlenen firmadan katılan kişiler de artık kaydedilebiliyor
- `supplier_audit_plans` tablosuna `supplier_attendees` kolonu eklendi
- UI'da iki ayrı bölüm var:
  - **Denetçiler (Bizim Firma)**: Denetimi yapan kişiler
  - **Denetlenen Firmadan Katılanlar**: Tedarikçi firmasından denetime katılanlar

### 2. Denetim Raporlarında Tam Bilgi Görüntüleme
- Denetim raporları artık soruları, cevapları ve bulguları **tam ve detaylı** olarak gösteriyor
- Raporlarda yer alan özellikler:
  - ✅ Tüm soru metinleri
  - ✅ Her sorunun cevabı (Evet/Hayır/Kısmen/Uygulanamaz)
  - ✅ Denetçi notları ve bulgular
  - ✅ Soru puanları
  - ✅ Kategori bazlı gruplama
  - ✅ Denetim özeti istatistikleri (Toplam soru, Uygun, Uygunsuz, Kısmen, vb.)
  - ✅ Görsel iyileştirmeler ve renkli gösterimler

### 3. Denetçiler ve Tedarikçi Temsilcileri
Raporda artık şunlar gösteriliyor:
- **Denetçiler**: Denetimi yapan kişilerin listesi
- **Denetlenen Firmadan Katılanlar**: Tedarikçi firmasından denetime katılanların listesi

## Veritabanı Migration

Aşağıdaki SQL scriptini çalıştırarak veritabanını güncelleyin:

```bash
psql -h [SUPABASE_HOST] -U postgres -d postgres -f scripts/add-supplier-attendees-to-audit.sql
```

**VEYA** Supabase Dashboard'dan SQL Editor'de şu komutu çalıştırın:

```sql
-- supplier_audit_plans tablosuna supplier_attendees kolonu ekle
ALTER TABLE supplier_audit_plans
ADD COLUMN IF NOT EXISTS supplier_attendees TEXT[] DEFAULT '{}';

-- Kolon açıklaması ekle
COMMENT ON COLUMN supplier_audit_plans.supplier_attendees IS 'Denetlenen firmadan denetime katılan kişilerin isimleri (Array olarak saklanır)';

COMMENT ON COLUMN supplier_audit_plans.participants IS 'Denetimi yapan denetçilerin isimleri (Array olarak saklanır)';
```

## Kullanım

### Denetim Başlatma
1. Supplier Quality modülüne gidin
2. "Denetim Takibi" sekmesine tıklayın
3. Bir denetim planı seçin ve "Başlat" butonuna tıklayın
4. Açılan sayfada:
   - **Sol taraf**: Denetçileri (bizim firma) ekleyin
   - **Sağ taraf**: Denetlenen firmadan katılanları ekleyin
5. Soruları cevaplayın ve notlarınızı yazın
6. "Denetimi Tamamla" butonuna tıklayın

### Rapor Oluşturma
1. Tamamlanmış bir denetim için "Rapor" butonuna tıklayın
2. Rapor otomatik olarak oluşturulacak ve yeni bir sekmede açılacak
3. Raporda şunlar yer alır:
   - Temel bilgiler (Tedarikçi, tarih, puan, sınıf)
   - Denetçiler ve tedarikçi temsilcileri
   - Kategori bazlı denetim sonuçları
   - Her sorunun cevabı ve denetçi notları
   - Denetim özeti (istatistikler)

## Değişen Dosyalar

- ✅ `scripts/add-supplier-attendees-to-audit.sql` - Yeni veritabanı migration scripti
- ✅ `src/pages/SupplierLiveAudit.jsx` - Denetim sayfası güncellendi
- ✅ `src/lib/reportUtils.jsx` - Rapor oluşturma mantığı iyileştirildi
- ✅ `src/components/supplier/AuditTrackingTab.jsx` - Rapor oluştururken sorular eklendi

## Test Edilmesi Gerekenler

- [ ] Migration scriptinin çalıştırılması
- [ ] Yeni bir denetim başlatma
- [ ] Denetçi ve tedarikçi temsilcisi ekleme
- [ ] Soruları cevaplama ve not ekleme
- [ ] Denetimi tamamlama
- [ ] Rapor oluşturma ve içeriğin doğruluğunu kontrol etme
- [ ] Raporun PDF olarak yazdırılması

## Notlar

- Mevcut denetim kayıtları etkilenmez
- `supplier_attendees` alanı opsiyoneldir, boş bırakılabilir
- Eski raporlar da yeni formatla açılacaktır (sorular varsa)
- Raporda kategori bazlı gruplama otomatik yapılır

