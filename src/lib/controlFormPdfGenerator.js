import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import liberationSansRegularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import liberationSansBoldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import liberationSansItalicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf?url';
import liberationSansBoldItalicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf?url';

const PAGE_MARGIN_X = 12;
const PAGE_MARGIN_TOP = 34;
const PAGE_MARGIN_BOTTOM = 14;
const CUSTOM_FONT_NAME = 'LiberationSans';

const trUpper = (value) => {
    if (value === null || value === undefined) return '';
    try {
        return String(value).toLocaleUpperCase('tr-TR');
    } catch {
        return String(value).toUpperCase();
    }
};

const FONT_ASSETS = {
    normal: { url: liberationSansRegularUrl, fileName: 'LiberationSans-Regular.ttf' },
    bold: { url: liberationSansBoldUrl, fileName: 'LiberationSans-Bold.ttf' },
    italic: { url: liberationSansItalicUrl, fileName: 'LiberationSans-Italic.ttf' },
    bolditalic: { url: liberationSansBoldItalicUrl, fileName: 'LiberationSans-BoldItalic.ttf' },
};

let logoDataUrlPromise = null;
const fontBase64Promises = {};

const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
};

const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const getFontBase64 = async (style) => {
    const asset = FONT_ASSETS[style];
    if (!asset) throw new Error(`Bilinmeyen font stili: ${style}`);
    if (!fontBase64Promises[style]) {
        fontBase64Promises[style] = fetch(asset.url)
            .then((r) => {
                if (!r.ok) throw new Error(`${asset.fileName} yüklenemedi.`);
                return r.arrayBuffer();
            })
            .then(arrayBufferToBase64);
    }
    return fontBase64Promises[style];
};

const getLogoDataUrl = async () => {
    if (!logoDataUrlPromise) {
        logoDataUrlPromise = fetch('/logo.png')
            .then((r) => (r.ok ? r.blob() : null))
            .then((b) => (b ? blobToDataUrl(b) : null))
            .catch(() => null);
    }
    return logoDataUrlPromise;
};

const ensurePdfAssets = async (doc) => {
    let fontName = 'helvetica';
    try {
        const fontList = doc.getFontList?.() || {};
        const registered = new Set(fontList[CUSTOM_FONT_NAME] || []);
        for (const [style, asset] of Object.entries(FONT_ASSETS)) {
            if (registered.has(style)) continue;
            const b64 = await getFontBase64(style);
            doc.addFileToVFS(asset.fileName, b64);
            doc.addFont(asset.fileName, CUSTOM_FONT_NAME, style);
        }
        fontName = CUSTOM_FONT_NAME;
    } catch (err) {
        console.warn('Özel font yüklenemedi, helvetica kullanılıyor:', err);
    }
    doc.setFont(fontName, 'normal');
    return { fontName, logoDataUrl: await getLogoDataUrl() };
};

const formatDate = (value, fallback = '') => {
    if (!value) return fallback;
    try {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return String(value);
        return format(parsed, 'dd.MM.yyyy', { locale: tr });
    } catch {
        return String(value);
    }
};

const normalize = (v, fallback = '') =>
    v === null || v === undefined || v === '' ? fallback : String(v);

const drawHeaderBlock = (doc, template, pdfAssets) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const fontName = pdfAssets.fontName;
    const marginX = PAGE_MARGIN_X;
    const headerY = 8;
    const headerH = 20;
    const headerW = pageWidth - 2 * marginX;

    // Dış çerçeve
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, headerY, headerW, headerH, 'F');
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.6);
    doc.roundedRect(marginX, headerY, headerW, headerH, 2, 2, 'S');

    // İki sütun: Logo 30 | Başlık (kalan genişlik)
    const logoColW = 30;
    const titleColX = marginX + logoColW;
    const titleColW = headerW - logoColW;

    // Sütun ayırıcı çizgi
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(titleColX, headerY, titleColX, headerY + headerH);

    // Sol: Logo (orantı korunarak — bozulmasın diye)
    if (pdfAssets.logoDataUrl) {
        try {
            const maxH = headerH - 4;
            const maxW = logoColW - 6;
            let logoW = maxW;
            let logoH = maxH;
            try {
                const props = doc.getImageProperties(pdfAssets.logoDataUrl);
                const aspect = props.width / props.height;
                if (aspect >= 1) {
                    logoW = Math.min(maxW, maxH * aspect);
                    logoH = logoW / aspect;
                } else {
                    logoH = Math.min(maxH, maxW / aspect);
                    logoW = logoH * aspect;
                }
            } catch {
                /* fallback sabit */
            }
            const logoX = marginX + (logoColW - logoW) / 2;
            const logoYPos = headerY + (headerH - logoH) / 2;
            doc.addImage(pdfAssets.logoDataUrl, 'PNG', logoX, logoYPos, logoW, logoH);
        } catch {
            /* ignore */
        }
    } else {
        doc.setFont(fontName, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 64, 175);
        doc.text('KADEME', marginX + logoColW / 2, headerY + headerH / 2 + 1, { align: 'center' });
    }

    // Sağ: Şirket adı + Form başlığı
    const titleCenterX = titleColX + titleColW / 2;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text('KADEME A.Ş. · Kalite Yönetim Sistemi', titleCenterX, headerY + 5.5, { align: 'center' });

    // Form başlığı (otomatik font-boyutu ile sığdır)
    const rawTitle = trUpper(template?.name || 'KONTROL FORMU');
    doc.setFont(fontName, 'bold');
    doc.setTextColor(30, 64, 175);
    let titleFs = 14;
    doc.setFontSize(titleFs);
    while (titleFs > 9 && doc.getTextWidth(rawTitle) > titleColW - 10) {
        titleFs -= 0.5;
        doc.setFontSize(titleFs);
    }
    const titleLines = doc.splitTextToSize(rawTitle, titleColW - 10);
    doc.text(titleLines, titleCenterX, headerY + 13.5, { align: 'center' });
};

const addPageChrome = (doc, template, pdfAssets) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generatedAt = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr });
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    const fontName = pdfAssets.fontName;

    drawHeaderBlock(doc, template, pdfAssets);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN_X, pageHeight - 9, pageWidth - PAGE_MARGIN_X, pageHeight - 9);
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Oluşturma: ${generatedAt}`, PAGE_MARGIN_X, pageHeight - 4);
    doc.text(
        `Doküman No: ${normalize(template?.document_no)} • Rev ${normalize(template?.revision_no, '0')}`,
        pageWidth / 2,
        pageHeight - 4,
        { align: 'center' }
    );
    doc.text(`Sayfa ${pageNumber}`, pageWidth - PAGE_MARGIN_X, pageHeight - 4, { align: 'right' });
};

const tableDefaults = (doc, template, pdfAssets) => ({
    margin: {
        left: PAGE_MARGIN_X,
        right: PAGE_MARGIN_X,
        top: PAGE_MARGIN_TOP,
        bottom: PAGE_MARGIN_BOTTOM,
    },
    styles: {
        font: pdfAssets.fontName,
        fontStyle: 'normal',
        fontSize: 8.5,
        cellPadding: 1.8,
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        overflow: 'linebreak',
        textColor: [31, 41, 55],
        valign: 'middle',
    },
    headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        font: pdfAssets.fontName,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
    },
    bodyStyles: { font: pdfAssets.fontName, fontStyle: 'normal' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didDrawPage: () => addPageChrome(doc, template, pdfAssets),
});

const getLastY = (doc, fb = PAGE_MARGIN_TOP) => doc.lastAutoTable?.finalY || fb;

const ensureSpace = (doc, currentY, minHeight, template, pdfAssets) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + minHeight <= pageHeight - PAGE_MARGIN_BOTTOM) return currentY;
    doc.addPage();
    addPageChrome(doc, template, pdfAssets);
    return PAGE_MARGIN_TOP;
};

const addSectionHeader = (doc, currentY, title, template, pdfAssets) => {
    const startY = ensureSpace(doc, currentY, 9, template, pdfAssets);
    const sectionWidth = doc.internal.pageSize.getWidth() - PAGE_MARGIN_X * 2;

    doc.setFillColor(219, 234, 254);
    doc.roundedRect(PAGE_MARGIN_X, startY, sectionWidth, 7, 1.5, 1.5, 'F');
    doc.setDrawColor(147, 197, 253);
    doc.setLineWidth(0.2);
    doc.roundedRect(PAGE_MARGIN_X, startY, sectionWidth, 7, 1.5, 1.5, 'S');
    doc.setFont(pdfAssets.fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.text(trUpper(title), PAGE_MARGIN_X + 2.5, startY + 4.7);
    return startY + 8.5;
};

const addTopInfoTable = (doc, currentY, execution, template, pdfAssets) => {
    const pairs = [];
    // Doküman bilgileri ilk sayfada bir kere
    pairs.push(['Doküman No', normalize(template?.document_no)]);
    pairs.push(['Revizyon No', normalize(template?.revision_no, '0')]);
    pairs.push(['Yayın Tarihi', formatDate(template?.publish_date)]);
    pairs.push(['Rev. Tarihi', formatDate(template?.revision_date)]);

    pairs.push(['Müşteri/Kurum', normalize(execution?.customer)]);
    pairs.push(['Ürün / Araç', normalize(execution?.product_name)]);
    pairs.push(['Seri Numarası', normalize(execution?.serial_number)]);
    pairs.push(['Şase No', normalize(execution?.chassis_no)]);
    pairs.push(['Kontrol Tarihi', formatDate(execution?.inspection_date)]);
    pairs.push(['Sevk Tarihi', formatDate(execution?.shipment_date)]);

    // header_fields (şablona özel alanlar)
    if (Array.isArray(template?.header_fields)) {
        template.header_fields.forEach((f) => {
            if (!f?.label) return;
            pairs.push([f.label, normalize(execution?.header_data?.[f.key])]);
        });
    }

    const rows = [];
    for (let i = 0; i < pairs.length; i += 2) {
        const left = pairs[i];
        const right = pairs[i + 1] || ['', ''];
        rows.push([
            { content: left[0], styles: { fillColor: [241, 245, 249], fontStyle: 'bold', cellWidth: 36 } },
            { content: left[1], styles: { cellWidth: 52 } },
            { content: right[0], styles: { fillColor: [241, 245, 249], fontStyle: 'bold', cellWidth: 36 } },
            { content: right[1], styles: { cellWidth: 'auto' } },
        ]);
    }

    doc.autoTable({
        ...tableDefaults(doc, template, pdfAssets),
        startY: currentY,
        theme: 'grid',
        body: rows,
        styles: { ...tableDefaults(doc, template, pdfAssets).styles, fontSize: 8 },
    });
    return getLastY(doc, currentY) + 4;
};

const addReferencesRow = (doc, currentY, template, pdfAssets) => {
    if (!template?.references_text) return currentY;
    const nextY = ensureSpace(doc, currentY, 10, template, pdfAssets);
    doc.autoTable({
        ...tableDefaults(doc, template, pdfAssets),
        startY: nextY,
        theme: 'grid',
        body: [
            [
                { content: 'Referanslar', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', cellWidth: 36 } },
                { content: normalize(template.references_text) },
            ],
        ],
        styles: { ...tableDefaults(doc, template, pdfAssets).styles, fontSize: 7.8 },
    });
    return getLastY(doc, nextY) + 4;
};

const addSectionItemsTable = (doc, currentY, section, results, isFilled, template, pdfAssets) => {
    const nextY = addSectionHeader(doc, currentY, section.name, template, pdfAssets);

    // Başlık: visual vs measurement (section içeriğine göre)
    const hasMeasurement = (section.items || []).some((i) => i.item_type === 'measurement');

    // Ölçüm tablosunda "Açıklama" sütunu yok — Kabul/Ret daha geniş
    const head = hasMeasurement
        ? [['No', 'Kontrol Maddesi', 'Ölçüm Cihazı', 'Referans', 'Ölçüm', 'Kabul', 'Ret']]
        : [['No', 'Kontrol Maddesi', 'Kabul', 'Ret', 'Açıklama']];

    const body = (section.items || []).map((item, idx) => {
        const res = results?.[item.id] || {};
        const acceptMark = isFilled ? (res.result === 'accept' ? '✓' : '') : '';
        const rejectMark = isFilled ? (res.result === 'reject' ? '✓' : '') : '';
        const measured = isFilled ? normalize(res.measured_value, '') : '';
        const notes = isFilled ? normalize(res.notes, '') : '';

        if (hasMeasurement) {
            return [
                String(idx + 1),
                normalize(item.text),
                normalize(item.measurement_equipment_name || ''),
                normalize(
                    item.reference_value
                        ? `${item.reference_value}${item.unit ? ' ' + item.unit : ''}`
                        : '',
                    ''
                ),
                measured,
                {
                    content: acceptMark,
                    styles: {
                        halign: 'center',
                        fillColor: acceptMark ? [220, 252, 231] : undefined,
                        textColor: acceptMark ? [22, 101, 52] : [31, 41, 55],
                        fontStyle: 'bold',
                    },
                },
                {
                    content: rejectMark,
                    styles: {
                        halign: 'center',
                        fillColor: rejectMark ? [254, 226, 226] : undefined,
                        textColor: rejectMark ? [153, 27, 27] : [31, 41, 55],
                        fontStyle: 'bold',
                    },
                },
            ];
        }

        return [
            String(idx + 1),
            normalize(item.text),
            {
                content: acceptMark,
                styles: {
                    halign: 'center',
                    fillColor: acceptMark ? [220, 252, 231] : undefined,
                    textColor: acceptMark ? [22, 101, 52] : [31, 41, 55],
                    fontStyle: 'bold',
                },
            },
            {
                content: rejectMark,
                styles: {
                    halign: 'center',
                    fillColor: rejectMark ? [254, 226, 226] : undefined,
                    textColor: rejectMark ? [153, 27, 27] : [31, 41, 55],
                    fontStyle: 'bold',
                },
            },
            notes,
        ];
    });

    const columnStyles = hasMeasurement
        ? {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 34 },
              3: { cellWidth: 22, halign: 'center' },
              4: { cellWidth: 22, halign: 'center' },
              5: { cellWidth: 16, halign: 'center' },
              6: { cellWidth: 16, halign: 'center' },
          }
        : {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 16, halign: 'center' },
              3: { cellWidth: 16, halign: 'center' },
              4: { cellWidth: 60 },
          };

    doc.autoTable({
        ...tableDefaults(doc, template, pdfAssets),
        startY: nextY,
        head,
        body,
        theme: 'grid',
        columnStyles,
    });

    return getLastY(doc, nextY) + 4;
};

const addResultFooter = (doc, currentY, execution, template, pdfAssets) => {
    const startY = ensureSpace(doc, currentY, 70, template, pdfAssets);

    // Eksikler / Notlar kutusu — geniş alan (doldurulmuşsa mevcut metin, boşsa el yazısı için boş)
    doc.autoTable({
        ...tableDefaults(doc, template, pdfAssets),
        startY,
        theme: 'grid',
        body: [
            [
                {
                    content: 'EKSİKLER / NOTLAR',
                    styles: {
                        fillColor: [241, 245, 249],
                        fontStyle: 'bold',
                        cellWidth: 40,
                        halign: 'left',
                        valign: 'top',
                    },
                },
                {
                    content: normalize(execution?.missing_items || execution?.inspector_notes, ''),
                    styles: { minCellHeight: 42, valign: 'top' },
                },
            ],
        ],
        styles: { ...tableDefaults(doc, template, pdfAssets).styles, fontSize: 9 },
    });

    let y = getLastY(doc, startY) + 4;
    y = ensureSpace(doc, y, 28, template, pdfAssets);

    // Sonuç + imza
    const result = execution?.result;
    const markOnay = result === 'ONAY' ? '■' : '☐';
    const markSartli = result === 'SARTLI_KABUL' ? '■' : '☐';
    const markRet = result === 'RET' ? '■' : '☐';

    doc.autoTable({
        ...tableDefaults(doc, template, pdfAssets),
        startY: y,
        theme: 'grid',
        body: [
            [
                { content: 'KONTROL SONUCU', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', cellWidth: 40 } },
                { content: `${markOnay} ONAY      ${markSartli} ŞARTLI KABUL      ${markRet} RET` },
            ],
            [
                { content: 'Sonuç Tarihi', styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } },
                { content: formatDate(execution?.result_date) },
            ],
            [
                { content: 'Kontrol Eden', styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } },
                { content: normalize(execution?.inspector_name, ''), styles: { minCellHeight: 14 } },
            ],
        ],
        styles: { ...tableDefaults(doc, template, pdfAssets).styles, fontSize: 9 },
    });

    return getLastY(doc, y) + 4;
};

/**
 * Options:
 *   template: { id, document_no, name, publish_date, revision_no, revision_date, header_fields, references_text, sections: [{ name, items: [...] }] }
 *   execution: (opsiyonel) doldurulmuş form verisi
 *   results:   (opsiyonel) { [item_id]: { result, measured_value, notes } }
 *   mode: 'blank' (boş form) | 'filled' (doldurulmuş)
 */
export const generateControlFormPdf = async ({
    template,
    execution = null,
    results = {},
    mode = 'blank',
    action = 'download',
}) => {
    if (!template) throw new Error('Template gerekli');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfAssets = await ensurePdfAssets(doc);

    addPageChrome(doc, template, pdfAssets);

    let y = PAGE_MARGIN_TOP;
    y = addTopInfoTable(doc, y, execution, template, pdfAssets);
    y = addReferencesRow(doc, y, template, pdfAssets);

    const isFilled = mode === 'filled';

    (template.sections || []).forEach((section) => {
        y = addSectionItemsTable(doc, y, section, results, isFilled, template, pdfAssets);
    });

    y = addResultFooter(doc, y, execution, template, pdfAssets);

    const fileName = `${template.document_no || 'KontrolFormu'}_Rev${template.revision_no || 0}${
        execution?.serial_number ? '_' + execution.serial_number : ''
    }.pdf`.replace(/[^\w\-_.]/g, '_');

    if (action === 'print') {
        window.open(doc.output('bloburl'), '_blank');
    } else {
        doc.save(fileName);
    }

    return fileName;
};
