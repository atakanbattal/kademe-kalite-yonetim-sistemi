# Modül Geliştirme Planı

## ✅ Tamamlanan Modüller

### 1. KPI Modülü ✅
- ✅ Aylık hedef ve gerçekleşen takibi
- ✅ 12 aylık trend grafiği
- ✅ % sapma hesaplama
- ✅ Sorumlu birim ve aksiyon listesi
- ✅ Hedef tutmazsa otomatik DÖF/8D/Geliştirme planı önerisi
- ✅ ISO 9001:2015 Madde 9.1 uyumlu

## 🔄 Devam Eden Modüller

### 2. DF ve 8D Yönetimi (Öncelik: YÜKSEK - ISO/IATF Kritik)
**Durum:** Planlama aşamasında

**Gereksinimler:**
- [ ] D1–D8 otomatik kontrol (her adım tamamlanmadan bir sonraki açılmamalı)
- [ ] 5N1K – Ishikawa – 5 Why – FTA şablonları
- [ ] Kanıt yükleme (foto, video)
- [ ] Problem tekrar durumunda otomatik "major uygunsuzluk" işareti
- [ ] DF kayıtlarının araç tipi / birim / parça kodu analizleri
- [ ] 8D revizyon sistemi (Rev.01, Rev.02 vb.)

**Tahmini Süre:** 2-3 gün

### 3. Kalitesizlik Maliyetleri (Öncelik: YÜKSEK)
**Durum:** Planlama aşamasında

**Gereksinimler:**
- [ ] COPQ = Internal Failure + External Failure + Appraisal + Prevention (IATF mantığı)
- [ ] Araç başı ortalama kalitesizlik maliyeti
- [ ] Parça bazlı maliyet liderleri
- [ ] "Anormal maliyet algılama" (AI destekli) → aylık ortalamadan %50 sapma olunca uyarı

**Tahmini Süre:** 1-2 gün

### 4. Tedarikçi Kalite Modülü (Öncelik: YÜKSEK - Sistemin Omurgası)
**Durum:** Planlama aşamasında

**Gereksinimler:**
- [ ] Her tedarikçi için otomatik PPM hesaplama
- [ ] Zamanında teslimat OTD%
- [ ] Yıllık değerlendirme (A – B – C sınıfı)
- [ ] Tedarikçiler kendi 8D'sini sisteme yüklemeli (firmalara özel link)
- [ ] Girdi KK ile Entegrasyon (Reddedilen her stok → otomatik tedarikçi kalite modülüne düşmeli)

**Tahmini Süre:** 2-3 gün

### 5. Kaizen Modülü (Öncelik: ORTA - ISO 9001:2015 Madde 10.3)
**Durum:** Planlama aşamasında

**Gereksinimler:**
- [ ] Kaizen skor sistemi (Maliyet faydası / zorluk derecesi / çalışan katılımı)
- [ ] Tamamlanan Kaizen'in yıllık maliyet kazancı otomatik hesaplanmalı
- [ ] Kaizen standardı → TPS / Kaizen A3 formatı

**Tahmini Süre:** 1-2 gün

### 6. Müşteri Şikayetleri (Öncelik: ORTA - ISO 10002)
**Durum:** Planlama aşamasında

**Gereksinimler:**
- [ ] Şikayet sınıflandırma (ürün, servis, montaj, yanlış kullanım)
- [ ] SLA süreleri
- [ ] Geri bildirim süresinin otomatik takibi

**Tahmini Süre:** 1 gün

## 📊 Toplam Tahmini Süre
**Yaklaşık 8-12 gün** (tüm modüller için)

## 🎯 Öncelik Sırası
1. **DF/8D Yönetimi** - ISO/IATF kritik gereksinim
2. **Tedarikçi Kalite** - Sistemin omurgası
3. **Kalitesizlik Maliyetleri** - Analiz eksikliği
4. **Kaizen Modülü** - ISO 9001 gereği
5. **Müşteri Şikayetleri** - ISO 10002 gereği

## 📝 Notlar
- Her modül için ayrı migration script'leri oluşturulacak
- Veritabanı değişiklikleri Supabase'de test edilecek
- Frontend geliştirmeleri React/Next.js ile yapılacak
- ISO/IATF standartlarına uyum sağlanacak

