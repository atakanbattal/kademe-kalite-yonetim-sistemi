# 🚀 Kademe QMS - Kurulum Talimatları

## ✅ Tamamlanan İşlemler

### 1. Supabase Veritabanı Migration'ları ✅
Tüm SQL migration'ları başarıyla uygulandı:
- ✅ `create_spc_module` - SPC modülü tabloları ve fonksiyonları
- ✅ `create_ppap_apqp_module` - PPAP/APQP modülü tabloları
- ✅ `create_fmea_module` - FMEA modülü tabloları ve fonksiyonları
- ✅ `create_mpc_module` - MPC modülü tabloları ve fonksiyonları
- ✅ `create_process_validation_module` - Process Validation tabloları

### 2. Supabase Storage ✅
- ✅ `ppap_documents` bucket oluşturuldu
- ✅ Storage politikaları yapılandırıldı

### 3. React Component'leri ✅
Tüm modüller için UI component'leri tamamlandı:
- ✅ SPC Modülü (6 component)
- ✅ PPAP/APQP Modülü (8 component)
- ✅ FMEA Modülü (4 component)
- ✅ MPC Modülü (11 component)
- ✅ Process Validation Modülü (5 component)

---

## 📦 Gerekli NPM Paketleri

Aşağıdaki paketlerin yüklü olduğundan emin olun:

```bash
npm install recharts react-dropzone
```

Eğer yüklü değilse:
```bash
npm install recharts react-dropzone uuid
```

---

## 🧪 Test Etme

### Modül URL'leri:
- `/spc` - İstatistiksel Proses Kontrolü
- `/ppap` - PPAP/APQP Yönetimi
- `/fmea` - FMEA Analizi
- `/mpc` - Üretim Planlama ve Kontrolü
- `/process-validation` - Proses Validasyonu

### Test Senaryoları:

#### SPC Modülü:
1. Yeni karakteristik ekleyin
2. Ölçüm verileri girin
3. Kontrol grafiklerini görüntüleyin
4. Proses yetenek analizi yapın

#### PPAP Modülü:
1. Yeni APQP projesi oluşturun
2. Doküman yükleyin (drag-drop)
3. PSW (Part Submission Warrant) oluşturun
4. Run-at-Rate çalışması ekleyin

#### FMEA Modülü:
1. Yeni FMEA projesi oluşturun (DFMEA veya PFMEA)
2. Fonksiyonlar ekleyin
3. Hata modları tanımlayın
4. RPN matrisini görüntüleyin

#### MPC Modülü:
1. Üretim planı oluşturun
2. Kritik karakteristikler tanımlayın (CC/SC)
3. Proses parametreleri ekleyin ve kayıtları takip edin
4. Lot/seri takibi yapın

#### Process Validation Modülü:
1. Validasyon planı oluşturun
2. IQ/OQ/PQ protokolleri ekleyin
3. Test sonuçlarını kaydedin

---

## 🔧 Sorun Giderme

### Storage Bucket Hatası:
Eğer PPAP doküman yükleme hatası alırsanız:
```sql
-- Supabase SQL Editor'da çalıştırın:
SELECT * FROM storage.buckets WHERE id = 'ppap_documents';
```

### RLS Politikası Hatası:
Tüm tablolarda RLS politikaları aktif. Eğer erişim sorunu yaşarsanız, Supabase Dashboard'dan politikaları kontrol edin.

### Grafik Görüntüleme Hatası:
`recharts` paketinin yüklü olduğundan emin olun:
```bash
npm list recharts
```

---

## 📝 Notlar

- Tüm modüller IATF 16949 standardına uygun olarak tasarlandı
- Veritabanı fonksiyonları otomatik hesaplamalar yapar (RPN, Cp/Cpk, verimlilik)
- Storage bucket'ları private olarak yapılandırıldı
- Tüm component'ler responsive tasarıma sahip

---

**Son Güncelleme:** 2025-01-27  
**Durum:** Tüm modüller hazır ve test edilmeye hazır ✅

