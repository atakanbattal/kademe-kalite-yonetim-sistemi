import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { preloadLogos, getLogoUrl, logoCache } from '@/lib/reportUtils';

const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/** Matris başlığı: A3 yatayda taşmayı azaltmak için kısaltılmış etiket */
const shortCritLabel = (name, max = 22) => {
    if (!name) return '';
    const s = String(name);
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
};

/** Kademe QMS yazdırma şablonu ile uyumlu benchmark karşılaştırma raporu (PDF / yazdır). */
export async function generateBenchmarkComparisonReportHtml({
    benchmark,
    items,
    criteria,
    scores,
    itemScores,
    prosConsData,
}) {
    await preloadLogos();
    const localLogoUrl = getLogoUrl('logo.png');
    const mainLogoBase64 = logoCache[localLogoUrl] || localLogoUrl;

    const sortedItems = [...(items || [])].sort((a, b) => {
        const scoreA = itemScores[a.id]?.average || 0;
        const scoreB = itemScores[b.id]?.average || 0;
        return scoreB - scoreA;
    });

    const formatValue = (item, key) => {
        const value = item[key];
        if (value === null || value === undefined || value === '') return '-';
        if (key.includes('score') && typeof value === 'number') return `${value.toFixed(1)}/100`;
        if (key.includes('price') || key.includes('cost') || key.includes('ownership')) {
            return new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: item.currency || 'TRY',
            }).format(value);
        }
        if (key.includes('percentage') || key.includes('roi')) return `${value}%`;
        if (key.includes('days') || key.includes('hours') || key.includes('months') || key.includes('count')) {
            return `${value} ${key.includes('days') ? 'gün' : key.includes('hours') ? 'saat' : key.includes('months') ? 'ay' : 'adet'}`;
        }
        return escapeHtml(String(value));
    };

    const creationDate = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr });

    const prosConsBlock =
        prosConsData && Object.keys(prosConsData).length > 0
            ? `
    <div class="section">
        <h2 class="section-title section-title-strip blue">AVANTAJ &amp; DEZAVANTAJ ANALİZİ</h2>
        <div class="list-summary">
        ${sortedItems
            .map((item) => {
                const itemData = prosConsData[item.id];
                if (!itemData || (itemData.pros.length === 0 && itemData.cons.length === 0)) return '';
                return `
            <div style="margin-bottom: 16px; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; background: #fafafa;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #1e293b;">${escapeHtml(item.item_name)}</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="notes-box" style="border-left: 4px solid #16a34a;">
                        <strong style="color: #15803d;">Avantajlar</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 18px;">
                            ${(itemData.pros || []).length
                                ? (itemData.pros || []).map((pro) => `<li>${escapeHtml(pro.description)}</li>`).join('')
                                : '<li>—</li>'}
                        </ul>
                    </div>
                    <div class="notes-box" style="border-left: 4px solid #dc2626;">
                        <strong style="color: #b91c1c;">Dezavantajlar</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 18px;">
                            ${(itemData.cons || []).length
                                ? (itemData.cons || []).map((con) => `<li>${escapeHtml(con.description)}</li>`).join('')
                                : '<li>—</li>'}
                        </ul>
                    </div>
                </div>
            </div>`;
            })
            .join('')}
        </div>
    </div>`
            : '';

    const matrixBlock =
        criteria.length > 0
            ? `
    <div class="section section-matrix">
        <h2 class="section-title section-title-strip blue">DETAYLI KARŞILAŞTIRMA MATRİSİ</h2>
        <div class="matrix-wrap">
        <table class="results-table matrix-table">
            <thead>
                <tr>
                    <th class="col-alt">Alternatif</th>
                    ${criteria
                        .map(
                            (c) =>
                                `<th class="col-crit" title="${escapeHtml(c.criterion_name)} (${escapeHtml(String(c.weight))}%)"><span class="crit-name">${escapeHtml(shortCritLabel(c.criterion_name))}</span><span class="crit-w">(${escapeHtml(String(c.weight))}%)</span></th>`
                        )
                        .join('')}
                    <th class="col-sum">Toplam</th>
                </tr>
            </thead>
            <tbody>
                ${sortedItems
                    .map((item) => {
                        const cells = criteria
                            .map((criterion) => {
                                const key = `${item.id}_${criterion.id}`;
                                const score = scores[key];
                                const normalized = score?.normalized_score || 0;
                                return `<td>${Number(normalized).toFixed(1)}</td>`;
                            })
                            .join('');
                        return `<tr>
                        <td class="col-alt"><strong>${escapeHtml(item.item_name)}</strong></td>
                        ${cells}
                        <td class="col-sum">${(itemScores[item.id]?.average || 0).toFixed(1)}</td>
                    </tr>`;
                    })
                    .join('')}
            </tbody>
        </table>
        </div>
    </div>`
            : '';

    const detailKeys = [
        'unit_price',
        'total_cost_of_ownership',
        'roi_percentage',
        'quality_score',
        'performance_score',
        'reliability_score',
        'after_sales_service_score',
        'technical_support_score',
        'warranty_period_months',
        'delivery_time_days',
        'lead_time_days',
        'implementation_time_days',
        'energy_efficiency_score',
        'environmental_impact_score',
        'ease_of_use_score',
        'scalability_score',
        'compatibility_score',
        'innovation_score',
        'market_reputation_score',
        'customer_references_count',
        'risk_level',
    ];

    const criterionNames = {
        unit_price: 'Birim Fiyat',
        total_cost_of_ownership: 'Toplam Sahiplik Maliyeti (TCO)',
        roi_percentage: 'Yatırım Getirisi (ROI)',
        quality_score: 'Kalite Skoru',
        performance_score: 'Performans Skoru',
        reliability_score: 'Güvenilirlik Skoru',
        after_sales_service_score: 'Satış Sonrası Hizmet',
        technical_support_score: 'Teknik Destek',
        warranty_period_months: 'Garanti Süresi',
        delivery_time_days: 'Teslimat Süresi',
        lead_time_days: 'Tedarik Süresi',
        implementation_time_days: 'Uygulama Süresi',
        energy_efficiency_score: 'Enerji Verimliliği',
        environmental_impact_score: 'Çevresel Etki',
        ease_of_use_score: 'Kullanılabilirlik',
        scalability_score: 'Ölçeklenebilirlik',
        compatibility_score: 'Uyumluluk',
        innovation_score: 'İnovasyon',
        market_reputation_score: 'Pazar İtibarı',
        customer_references_count: 'Müşteri Referans Sayısı',
        risk_level: 'Risk Seviyesi',
    };

    const detailRows = detailKeys
        .map((key) => {
            const hasValue = sortedItems.some((item) => item[key] !== null && item[key] !== undefined && item[key] !== '');
            if (!hasValue) return '';
            const bestValue = sortedItems.reduce((best, current) => {
                const currentVal = current[key];
                const bestVal = best[key];
                if (currentVal === null || currentVal === undefined || currentVal === '') return best;
                if (bestVal === null || bestVal === undefined || bestVal === '') return current;
                if (key.includes('price') || key.includes('cost') || key.includes('days') || key.includes('hours')) {
                    return currentVal < bestVal ? current : best;
                }
                if (key.includes('score') || key.includes('percentage') || key.includes('count') || key.includes('months')) {
                    return currentVal > bestVal ? current : best;
                }
                return best;
            }, sortedItems[0]);

            return `<tr>
                <td style="font-weight:600;">${escapeHtml(criterionNames[key] || key)}</td>
                ${sortedItems
                    .map((item) => {
                        const value = formatValue(item, key);
                        const isBest =
                            bestValue &&
                            item[key] === bestValue[key] &&
                            item[key] !== null &&
                            item[key] !== undefined &&
                            item[key] !== '';
                        return `<td style="text-align:center;${isBest ? ' background:#dbeafe; font-weight:600;' : ''}">${value}</td>`;
                    })
                    .join('')}
            </tr>`;
        })
        .filter(Boolean)
        .join('');

    const detailTable =
        detailRows.length > 0
            ? `
    <div class="section">
        <h2 class="section-title section-title-strip blue">DETAYLI KRİTER KARŞILAŞTIRMASI</h2>
        <table class="results-table detail-table">
            <thead>
                <tr>
                    <th>Kriter</th>
                    ${sortedItems.map((item) => `<th style="text-align:center;">${escapeHtml(item.item_name)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>${detailRows}</tbody>
        </table>
    </div>`
            : '';

    const rankingRows = sortedItems
        .map((item, index) => {
            const avgScore = itemScores[item.id]?.average || 0;
            const scoreClass = avgScore >= 80 ? 'color:#059669;font-weight:700;' : avgScore >= 60 ? 'color:#d97706;font-weight:700;' : 'color:#dc2626;font-weight:700;';
            return `<tr>
                <td style="text-align:center;">${index + 1}</td>
                <td><strong>${escapeHtml(item.item_name)}</strong></td>
                <td>${escapeHtml(item.description) || '—'}</td>
                <td style="text-align:center;${scoreClass}">${avgScore.toFixed(1)}</td>
            </tr>`;
        })
        .join('');

    const reportContentHtml = `
        <div class="report-header">
            <div class="report-logo">
                <img src="${mainLogoBase64}" alt="Kademe Logo">
            </div>
            <div class="company-title">
                <h1>KADEME A.Ş.</h1>
                <p>Kalite Yönetim Sistemi</p>
            </div>
            <div class="print-info">
                <div class="report-no">Form No</div>
                <div class="report-id">${escapeHtml(benchmark?.benchmark_number || '—')}</div>
                <div class="report-date">${creationDate}</div>
            </div>
        </div>

        <div class="meta-box meta-box-header">
            <div class="meta-item"><strong>Form No:</strong> ${escapeHtml(benchmark?.benchmark_number || '—')}</div>
            <div class="meta-item"><strong>Belge Türü:</strong> Benchmark Karşılaştırma Raporu</div>
            <div class="meta-item"><strong>Başlık:</strong> ${escapeHtml(benchmark?.title || '—')}</div>
            <div class="meta-item"><strong>Durum:</strong> ${escapeHtml(benchmark?.status || '—')}</div>
            <div class="meta-item"><strong>Onay durumu:</strong> ${escapeHtml(benchmark?.approval_status || '—')}</div>
        </div>

        <div class="section">
            <h2 class="section-title section-title-strip blue">GENEL SIRALAMA</h2>
            <table class="results-table">
                <thead>
                    <tr>
                        <th style="width:48px;">Sıra</th>
                        <th>Alternatif</th>
                        <th>Açıklama</th>
                        <th style="width:100px;text-align:center;">Toplam Skor</th>
                    </tr>
                </thead>
                <tbody>${rankingRows}</tbody>
            </table>
        </div>

        ${matrixBlock}
        ${prosConsBlock}
        ${detailTable}

        <div class="section signature-section">
            <h2 class="section-title section-title-strip dark">İMZA VE ONAY</h2>
            <div class="signature-area">
                <div class="signature-box">
                    <p class="role">HAZIRLAYAN</p>
                    <div class="signature-line"></div>
                    <p class="name">${escapeHtml('Atakan BATTAL')}</p>
                </div>
                <div class="signature-box">
                    <p class="role">ONAYLAYAN</p>
                    <div class="signature-line"></div>
                    <p class="name">${escapeHtml(
                        benchmark?.approved_by_person?.full_name ||
                            benchmark?.approved_by_person?.name ||
                            'Ad Soyad / İmza'
                    )}</p>
                </div>
            </div>
        </div>
    `;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(benchmark?.title || 'Benchmark')} — Karşılaştırma Raporu</title>
    <style>
${BENCHMARK_REPORT_PRINT_CSS}
    </style>
</head>
<body>
    <div class="page-container">
        <div class="report-wrapper">
            ${reportContentHtml}
        </div>
        <div class="report-footer">
            <span>Bu belge, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</span>
            <span>Belge Tarihi: ${creationDate}</span>
            <span>Rev: 01</span>
        </div>
    </div>
    <script>
        window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 400);
        });
    </script>
</body>
</html>`;
}

/** A3 yatay baskı; Kademe rapor şablonu ile uyumlu */
const BENCHMARK_REPORT_PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap');
body {
    font-family: 'Noto Sans', 'Roboto', 'Segoe UI', Tahoma, sans-serif;
    color: #1f2937;
    margin: 0;
    padding: 0;
    background-color: #e5e7eb;
    font-size: 10px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.page-container {
    background-color: white;
    box-sizing: border-box;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    margin: 12px auto;
    width: 100%;
    max-width: 420mm;
    min-height: 200mm;
    display: flex;
    flex-direction: column;
}
.report-wrapper { padding: 6mm 8mm; flex: 1; box-sizing: border-box; }
.report-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 20px;
    align-items: center;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-top: 4px solid #1e40af;
    border-radius: 6px;
    padding: 14px 18px;
    margin-bottom: 10px;
    page-break-inside: avoid;
}
.report-logo img { height: 48px; object-fit: contain; }
.company-title { text-align: center; }
.company-title h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; color: #1e293b; }
.company-title p { font-size: 12px; margin: 0; color: #64748b; }
.print-info { text-align: right; font-size: 11px; color: #334155; }
.print-info .report-no { font-size: 9px; color: #64748b; text-transform: uppercase; }
.print-info .report-id { font-weight: 700; color: #1e293b; }
.print-info .report-date { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #64748b; }
.meta-box {
    display: flex; flex-wrap: wrap; gap: 10px 20px;
    background: #f8fafc; padding: 10px 14px; border-radius: 6px;
    border: 1px solid #e2e8f0; border-left: 4px solid #1e40af;
    margin-bottom: 10px; page-break-inside: avoid;
}
.meta-item { font-size: 10px; color: #374151; }
.meta-item strong { color: #1f2937; }
.section { margin-bottom: 10px; page-break-inside: auto; }
.section-matrix { page-break-inside: auto; }
.section-title {
    font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px;
    text-transform: uppercase; letter-spacing: 0.4px; page-break-after: avoid;
}
.section-title-strip {
    background-color: #f8fafc !important;
    border-left: 5px solid #2563eb;
    color: #1f2937 !important;
}
.section-title-strip.blue { border-left-color: #2563eb; }
.section-title-strip.dark { border-left-color: #374151; }
.list-summary { margin-bottom: 8px; font-size: 10px; }
.results-table {
    width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto;
}
.results-table th, .results-table td {
    border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 10px; vertical-align: middle;
}
.results-table thead {
    display: table-header-group; background: #f9fafb; font-weight: 600;
}
.results-table tbody tr { page-break-inside: avoid; }
.detail-table th, .detail-table td { font-size: 9px; padding: 5px 6px; }
.matrix-wrap {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    box-sizing: border-box;
}
.matrix-table { table-layout: fixed; width: 100%; min-width: 100%; }
.matrix-table th, .matrix-table td {
    font-size: 7px !important;
    line-height: 1.15;
    padding: 3px 2px !important;
    text-align: center;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    hyphens: auto;
}
.matrix-table .col-alt {
    width: 11%;
    text-align: left !important;
    font-size: 8px !important;
    font-weight: 700;
}
.matrix-table .col-crit { width: auto; }
.matrix-table .crit-name { display: block; font-weight: 600; }
.matrix-table .crit-w { display: block; font-size: 6px; font-weight: 500; color: #64748b; }
.matrix-table .col-sum {
    width: 6%;
    background: #f0f9ff !important;
    font-weight: 700;
}
.notes-box {
    border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; font-size: 9px; page-break-inside: avoid;
}
.signature-section { page-break-inside: avoid; margin-top: 16px; }
.signature-area {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    flex-wrap: wrap;
}
.signature-box {
    flex: 1;
    min-width: 200px;
    max-width: calc(50% - 12px);
    text-align: center;
}
.signature-box .role { font-size: 9px; font-weight: 700; color: #64748b; margin: 0; letter-spacing: 0.06em; }
.signature-line { border-bottom: 1px solid #334155; height: 36px; margin: 8px 12px; }
.signature-box .name { font-size: 11px; font-weight: 600; margin: 0; color: #0f172a; }
.report-footer {
    font-size: 8px; color: #64748b; padding: 6px 8mm; border-top: 1px solid #e5e7eb;
    display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between;
}
@media print {
    @page { size: A3 landscape; margin: 8mm; }
    body { background: #fff !important; font-size: 9px; }
    .page-container { margin: 0 !important; box-shadow: none !important; width: 100% !important; max-width: none !important; min-height: 0 !important; }
    .report-wrapper { padding: 0 !important; }
    .matrix-wrap { overflow: visible !important; }
    .matrix-table th, .matrix-table td { font-size: 6.5px !important; padding: 2px 2px !important; }
}
`;
