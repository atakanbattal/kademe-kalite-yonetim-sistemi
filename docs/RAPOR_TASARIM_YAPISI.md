# Rapor Görünümü, Tasarım ve Format Yapısı

Bu dokümanda kalite maliyeti raporlarının görüntü, tasarım ve format kodları özetlenmiştir.

---

## 1. Dosya Yapısı

| Dosya | Açıklama |
|-------|----------|
| `src/lib/reportUtils.jsx` | HTML üretimi, stiller, `generatePrintableReportHtml`, `generateListReportHtml`, `openPrintableReport` |
| `src/pages/PrintableReport.jsx` | Rapor sayfası bileşeni, iframe'de HTML gösterimi |
| `src/lib/pdfGenerator.js` | PDF çıktısı (opsiyonel) |

---

## 2. Rapor Türleri (Kalite Maliyeti)

- **quality_cost_list** – Birim bazlı maliyet listesi (PDF)
- **quality_cost_detail** – Tek maliyet kaydı detay raporu
- **quality_cost_executive_summary** – Yönetici özeti raporu

---

## 3. Base HTML Şablonu

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${getReportTitle(record, type)}</title>
  <style>
    ${defaultStyles}
    ${cssOverrides}
  </style>
</head>
<body>
  <div class="page-container">
    <div class="report-wrapper">
      ${reportContentHtml}
    </div>
    <div class="report-footer">
      <span>Bu belge, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</span>
      <span>Belge Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}</span>
      <span>Form No: ${formNumber}</span>
      <span>Rev: 01</span>
    </div>
  </div>
</body>
</html>
```

---

## 4. Rapor Header Yapısı

```html
<div class="report-header">
  <div class="report-logo">
    <img src="${mainLogoBase64}" alt="Kademe Logo">
  </div>
  <div class="company-title">
    <h1>KADEME A.Ş.</h1>
    <p>Kalite Yönetim Sistemi</p>
  </div>
  <div class="print-info">
    <div>Rapor No: ${reportNo}</div>
    <div>${formatDateTime(new Date())}</div>
  </div>
</div>
```

---

## 5. Rapor No Formatları

| Rapor Türü | Format |
|------------|--------|
| quality_cost_list | RAPOR-{tarih}-{timestamp} |
| quality_cost_detail | MALIYET-DETAY-{tarih}-{timestamp} |
| quality_cost_executive_summary | MALIYET-YONETICI-{tarih}-{timestamp} |

---

## 6. Base CSS (defaultStyles) – Özet

```css
/* Sayfa */
body { font-family: 'Noto Sans', 'Roboto', Arial; font-size: 10px; }
.page-container { width: 210mm; min-height: 297mm; }
.report-wrapper { padding: 10mm; }

/* Header */
.report-header { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; }
.report-logo img { height: 50px; }
.company-title h1 { font-size: 20px; font-weight: 700; }
.company-title p { font-size: 12px; color: #4b5563; }

/* Meta */
.meta-box { background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
.meta-item { font-size: 10px; }
.meta-item strong { font-weight: 600; margin-right: 6px; }

/* Bölüm başlıkları */
.section-title { font-size: 12px; font-weight: 700; padding: 6px 10px; text-transform: uppercase; }
.section-title.blue { background-color: #2563eb; }
.section-title.red { background-color: #dc2626; }
.section-title.green { background-color: #16a34a; }
.section-title.dark { background-color: #374151; }

/* Tablolar */
.info-table { width: 100%; border-collapse: collapse; }
.info-table td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 10px; }
.results-table th, .results-table td { border: 1px solid #e5e7eb; padding: 6px 8px; }

/* İmza */
.signature-section { margin-top: 30px; border-top: 1px solid #e5e7eb; }
.signature-box .role { font-size: 9px; font-weight: 600; }
.signature-line { border-bottom: 1px solid #9ca3af; height: 20px; }

/* Yazdırma */
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  * { print-color-adjust: exact !important; }
}
```

---

## 7. quality_cost_list Tablo Yapısı

**Sütunlar:** Tarih | Maliyet Türü | Parça | Araç Tipi | Miktar | Tutar | Açıklama | Birim/Müşteri

**Özet:** Birim, Dönem, Toplam Kayıt Sayısı, Toplam Maliyet, Maliyet Türü Dağılımı

**Dış Hata + Müşteri:** Müşteri mavi, birim/tedarikçi amber renkte gösterilir.

---

## 8. quality_cost_detail Bölümleri

1. **Ana bilgiler kartı** – Toplam Tutar, Maliyet Türü, Tarih
2. **Genel Bilgiler** – Araç Türü, Parça, Müşteri Adı vb.
3. **Maliyet Kalemleri** – Parça kodu, adı, alt tür, sorumlu, miktar, tutar
4. **Ortak Maliyetler** – Nakliye / konaklama
5. **Dolaylı Maliyetler**
6. **Maliyet Dağılımı** (varsa)
7. **Açıklama**
8. **Dokümanlar**
9. **İmza ve Onay**

---

## 9. quality_cost_executive_summary Bölümleri

1. **Özet kartları** – Toplam Maliyet, İç Hata, Dış Hata
2. **COPQ toplam** – İç + Dış + Değerlendirme + Önleme
3. **COPQ kategorileri** – İç, Dış, Değerlendirme, Önleme
4. **En çok hata türleri (Top 10)**
5. **En maliyetli birimler/tedarikçiler (Top 10)**
6. **En maliyetli parçalar (Top 10)**
7. **En maliyetli araç tipleri (Top 10)**
8. **Tedarikçi bazlı analiz (Top 10)**
9. **Aylık trend**

---

## 10. Renk Paleti

| Kullanım | Renk | Hex |
|----------|------|-----|
| Mavi (başlık, primary) | #2563eb, #1e40af |
| Kırmızı (tutar, iç hata) | #dc2626 |
| Turuncu (dış hata, tedarikçi) | #f59e0b, #d97706 |
| Yeşil (önleme) | #059669 |

---

## 11. İlgili Fonksiyonlar

- `openPrintableReport(record, type, useUrlParams)` – Raporu yeni sekmede açar
- `generatePrintableReportHtml(record, type)` – HTML oluşturur
- `getReportTitle(record, type)` – Pencere başlığını verir
- `generateListReportHtml(record, type)` – `quality_cost_list`, `quality_cost_detail`, `quality_cost_executive_summary` için HTML üretir

---

## 12. PrintableReport.jsx Akışı

1. `report/:type/:id` rotası
2. `storageKey` ile `localStorage`’dan veri okunur
3. `generatePrintableReportHtml(data, type)` ile HTML üretilir
4. HTML `Blob` olarak iframe’e yüklenir
5. `autoprint=true` ise otomatik yazdırma tetiklenir
