# 🔧 Tedarikçi Kaynaklı Kalite Maliyeti Entegrasyonu

## 📋 Genel Bakış

Bu geliştirme ile **Kalitesizlik Maliyeti** modülüne tedarikçi entegrasyonu eklenmiştir. Artık yeniden işlem, hurda ve diğer kalite maliyetlerini tedarikçi kaynaklı olarak işaretleyebilir ve direkt olarak DF/8D uygunsuzluk süreçlerini başlatabilirsiniz.

## ✨ Yeni Özellikler

### 1. Tedarikçi Kaynaklı Maliyet Kaydı
- ✅ **Tedarikçi Toggle**: Maliyet kaydı oluştururken "Tedarikçi Kaynaklı Maliyet" switch'i eklenmiştir
- ✅ **Tedarikçi Seçimi**: Toggle aktif edildiğinde, tedarikçi listesinden seçim yapılabilir
- ✅ **Durum Gösterimi**: Seçilen tedarikçinin durumu (Onaylı, Askıya Alınmış, vb.) görüntülenir
- ✅ **Uyarı Sistemi**: Onaylı olmayan tedarikçiler için uyarı mesajı gösterilir

### 2. DF/8D Entegrasyonu
- ✅ **Direkt Uygunsuzluk Oluşturma**: Tedarikçi kaynaklı maliyetlerden direkt DF veya 8D uygunsuzluğu oluşturabilirsiniz
- ✅ **Otomatik Veri Aktarımı**: Maliyet bilgileri (tutar, açıklama, vb.) otomatik olarak uygunsuzluk formuna aktarılır
- ✅ **Tedarikçi Bağlantısı**: Oluşturulan uygunsuzluk otomatik olarak ilgili tedarikçiye atanır
- ✅ **Çift Yönlü İlişki**: Uygunsuzluk ve maliyet kaydı birbirine bağlanır

### 3. Gelişmiş Görünürlük
- ✅ **Liste Görünümü**: Ana tabloda tedarikçi bilgisi badge olarak gösterilir
- ✅ **Detay Görünümü**: Maliyet detay modalında tedarikçi bilgisi vurgulanmış şekilde gösterilir
- ✅ **Filtreleme**: Tedarikçi bilgisi ile kayıtlar kolayca filtrelenebilir

## 🗄️ Veritabanı Değişiklikleri

### Yeni Kolonlar - `quality_costs` Tablosu

```sql
-- Tedarikçi ID (Foreign Key)
supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL

-- Tedarikçi uygunsuzluğu flag'i
is_supplier_nc BOOLEAN DEFAULT false
```

### Migration Script

Veritabanı değişikliklerini uygulamak için aşağıdaki script'i Supabase SQL Editor'de çalıştırın:

```bash
scripts/add-supplier-to-quality-costs.sql
```

## 📖 Kullanım Kılavuzu

### Tedarikçi Kaynaklı Maliyet Kaydı Oluşturma

1. **Kalitesizlik Maliyeti** modülüne gidin (`/quality-cost`)
2. **"Yeni Maliyet Kaydı"** butonuna tıklayın
3. Formun üst kısmında **"Tedarikçi Kaynaklı Maliyet"** switch'ini aktif edin
4. Açılan listeden **tedarikçi seçin**
5. Diğer maliyet bilgilerini girin (maliyet türü, tutar, vb.)
6. **"Maliyet Kaydet"** butonuna tıklayın

### Tedarikçiye DF/8D Uygunsuzluğu Oluşturma

1. **Kalitesizlik Maliyeti** modülünde tedarikçi kaynaklı bir maliyet kaydı bulun
2. Kayıt satırındaki **"⋮" (üç nokta)** menüsüne tıklayın
3. **"Tedarikçiye DF Oluştur"** veya **"Tedarikçiye 8D Oluştur"** seçeneğine tıklayın
4. Açılan DF/8D formunda:
   - Tedarikçi bilgisi **otomatik olarak doldurulmuştur**
   - Maliyet bilgileri açıklama alanına **otomatik eklenmiştir**
   - Başlık otomatik oluşturulmuştur
5. Gerekli ek bilgileri girin ve kaydedin

### Önemli Notlar

⚠️ **Uygunsuzluk Oluşturma Şartları:**
- Sadece **tedarikçi kaynaklı** olarak işaretlenmiş maliyetler için DF/8D oluşturma butonu görünür
- Bir maliyet kaydı için **yalnızca bir kez** uygunsuzluk oluşturulabilir
- Uygunsuzluk oluşturulduktan sonra **"İlişkili Uygunsuzluk"** sütununda bağlantı görünür

## 🔗 Sistem Akışı

```
┌─────────────────────────────────────────────────────────────┐
│                  Kalitesizlik Maliyeti                       │
│                                                              │
│  1. Tedarikçi Kaynaklı Maliyet Kaydı Oluştur                │
│     ├─ Tedarikçi Seç                                        │
│     ├─ Maliyet Türü: Hurda / Yeniden İşlem / Fire          │
│     └─ Tutar ve Detayları Gir                              │
│                                                              │
│  2. DF/8D Oluştur Butonuna Tıkla                            │
│     ├─ Tedarikçi bilgisi otomatik aktarılır                │
│     ├─ Maliyet detayları açıklama olarak eklenir           │
│     └─ DF/8D Formu açılır                                   │
│                                                              │
│  3. DF/8D Kaydı Oluşturulur                                 │
│     ├─ Tedarikçi Modülüne yansır                           │
│     ├─ supplier_non_conformities tablosuna kayıt oluşur    │
│     └─ Maliyet kaydı ile bağlantı kurulur                  │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Veri İlişkileri

```
quality_costs (Kalite Maliyeti)
    ├─ supplier_id → suppliers (Tedarikçi)
    ├─ is_supplier_nc (Boolean flag)
    └─ İlgili non_conformities kaydı

non_conformities (DF/8D)
    ├─ supplier_id → suppliers (Tedarikçi)
    ├─ source: 'quality_cost'
    ├─ source_id → quality_costs
    └─ supplier_non_conformities ile entegrasyon
```

## 🎯 Avantajlar

1. **Hız**: Tedarikçi maliyetlerinden direkt uygunsuzluk açabilme
2. **İzlenebilirlik**: Maliyet ve uygunsuzluk kayıtları birbirine bağlı
3. **Raporlama**: Tedarikçi bazlı maliyet analizi kolaylaşır
4. **Sorumluluk**: Maliyetler direkt tedarikçiye yansıtılabilir
5. **Entegrasyon**: Tüm sistem modülleri (Tedarikçi, DF/8D, Maliyet) entegre çalışır

## 🔧 Teknik Detaylar

### Frontend Değişiklikleri

#### 1. CostFormModal.jsx
- Tedarikçi seçim UI'ı eklendi
- `SearchableSelectDialog` komponenti entegre edildi
- Tedarikçi toggle mantığı eklendi
- Form validasyonu güncellendi

#### 2. QualityCostModule.jsx
- Tedarikçi kolonu tabloya eklendi
- DF/8D oluşturma butonları eklendi (sadece tedarikçi kaynaklı maliyetler için)
- Tedarikçi bilgisi ile veri fetch edildi
- `handleOpenNCModal` fonksiyonu güncellendi

#### 3. CostViewModal.jsx
- Tedarikçi bilgisi görsel olarak vurgulandı
- Badge komponenti ile tedarikçi adı gösterildi

### Backend Entegrasyon

- `quality_costs` tablosuna `supplier_id` ve `is_supplier_nc` kolonları eklendi
- Tedarikçi bilgisi foreign key ile `suppliers` tablosuna bağlandı
- Performans için indeks oluşturuldu
- Mevcut App.jsx'deki tedarikçi uygunsuzluğu mantığı kullanılarak entegrasyon sağlandı

## 📝 Örnek Senaryo

**Senaryo**: Tedarikçiden gelen hatalı parça nedeniyle hurda maliyeti oluştu

1. **Maliyet Kaydı Oluşturma**:
   - Modül: Kalitesizlik Maliyeti
   - Tedarikçi Kaynaklı: ✅ Aktif
   - Tedarikçi: "ABC Metal A.Ş."
   - Maliyet Türü: Hurda Maliyeti
   - Tutar: 15.000 TL

2. **DF Uygunsuzluğu Oluşturma**:
   - Maliyet kaydı menüsünden "Tedarikçiye DF Oluştur"
   - Otomatik doldurulan bilgiler:
     - Tedarikçi: ABC Metal A.Ş.
     - Başlık: "Kalite Maliyeti - ABC Metal A.Ş. - Hurda Maliyeti"
     - Açıklama: Tüm maliyet detayları

3. **Sonuç**:
   - DF kaydı oluşturuldu
   - Tedarikçi modülüne yansıtıldı
   - Maliyet ve DF birbirine bağlandı
   - Tedarikçi puanlama sistemine etki etti

## 🚀 Dağıtım

Bu özelliği production ortamına almak için:

1. **Veritabanı Migration**:
   ```sql
   -- Supabase SQL Editor'de çalıştırın
   -- Script: scripts/add-supplier-to-quality-costs.sql
   ```

2. **Frontend Build**:
   ```bash
   npm run build
   ```

3. **Deploy**:
   ```bash
   # Netlify, Vercel veya kendi deployment süreciniz
   git add .
   git commit -m "feat: Tedarikçi kaynaklı maliyet entegrasyonu eklendi"
   git push origin main
   ```

## 📞 Destek

Herhangi bir sorun veya soru için lütfen geliştirme ekibiyle iletişime geçin.

---

**Geliştirme Tarihi**: 2025-01-04  
**Versiyon**: 1.0.0  
**Durum**: ✅ Tamamlandı ve Test Edildi


