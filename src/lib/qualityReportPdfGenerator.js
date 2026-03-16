import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import liberationSansRegularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import liberationSansBoldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import liberationSansItalicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf?url';
import liberationSansBoldItalicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf?url';

const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_TOP = 34;
const PAGE_MARGIN_BOTTOM = 14;

let logoDataUrlPromise = null;
const CUSTOM_FONT_NAME = 'LiberationSans';
const FONT_ASSETS = {
    normal: {
        url: liberationSansRegularUrl,
        fileName: 'LiberationSans-Regular.ttf',
    },
    bold: {
        url: liberationSansBoldUrl,
        fileName: 'LiberationSans-Bold.ttf',
    },
    italic: {
        url: liberationSansItalicUrl,
        fileName: 'LiberationSans-Italic.ttf',
    },
    bolditalic: {
        url: liberationSansBoldItalicUrl,
        fileName: 'LiberationSans-BoldItalic.ttf',
    },
};
const fontBase64Promises = {};

const normalizeValue = (value, fallback = '-') => {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
};

const formatDateValue = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return normalizeValue(value);
    return format(parsed, 'dd.MM.yyyy', { locale: tr });
};

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
    if (!asset) {
        throw new Error(`Bilinmeyen font stili: ${style}`);
    }

    if (!fontBase64Promises[style]) {
        fontBase64Promises[style] = fetch(asset.url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`${asset.fileName} yüklenemedi.`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBufferToBase64);
    }

    return fontBase64Promises[style];
};

const getLogoDataUrl = async () => {
    if (!logoDataUrlPromise) {
        logoDataUrlPromise = fetch('/logo.png')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Logo yüklenemedi.');
                }
                return response.blob();
            })
            .then(blobToDataUrl)
            .catch(() => null);
    }

    return logoDataUrlPromise;
};

const ensurePdfAssets = async (doc) => {
    let fontName = 'helvetica';

    try {
        const fontList = doc.getFontList?.() || {};
        const registeredStyles = new Set(fontList[CUSTOM_FONT_NAME] || []);

        for (const [style, asset] of Object.entries(FONT_ASSETS)) {
            if (registeredStyles.has(style)) {
                continue;
            }

            const fontBase64 = await getFontBase64(style);
            doc.addFileToVFS(asset.fileName, fontBase64);
            doc.addFont(asset.fileName, CUSTOM_FONT_NAME, style);
        }

        fontName = CUSTOM_FONT_NAME;
    } catch (error) {
        console.warn('Ozel PDF fontu yuklenemedi, varsayilan font kullaniliyor:', error);
    }

    doc.setFont(fontName, 'normal');

    return {
        fontName,
        logoDataUrl: await getLogoDataUrl(),
    };
};

const addPageChrome = (doc, reportConfig, pdfAssets) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const generatedAt = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr });
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    const fontName = pdfAssets?.fontName || 'helvetica';
    const logoDataUrl = pdfAssets?.logoDataUrl;

    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.6);
    doc.line(PAGE_MARGIN_X, 28, pageWidth - PAGE_MARGIN_X, 28);

    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', PAGE_MARGIN_X, 7, 13, 13);
        } catch (error) {
            console.warn('PDF logo eklenemedi:', error);
        }
    }

    doc.setFont(fontName, 'normal');
    doc.setFontSize(18);
    doc.setTextColor(17, 24, 39);
    doc.text('KADEME A.Ş.', PAGE_MARGIN_X + 18, 13);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Kalite Yönetim Sistemi', PAGE_MARGIN_X + 18, 19);

    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text(reportConfig.title, pageWidth - PAGE_MARGIN_X, 12, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Rapor No: ${reportConfig.reportNo}`, pageWidth - PAGE_MARGIN_X, 18, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN_X, pageHeight - 9, pageWidth - PAGE_MARGIN_X, pageHeight - 9);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Oluşturma: ${generatedAt}`, PAGE_MARGIN_X, pageHeight - 4);
    doc.text(`Sayfa ${pageNumber}`, pageWidth - PAGE_MARGIN_X, pageHeight - 4, { align: 'right' });
};

const getTableDefaults = (doc, reportConfig, pdfAssets) => ({
    margin: {
        left: PAGE_MARGIN_X,
        right: PAGE_MARGIN_X,
        top: PAGE_MARGIN_TOP,
        bottom: PAGE_MARGIN_BOTTOM,
    },
    styles: {
        font: pdfAssets?.fontName || 'helvetica',
        fontStyle: 'normal',
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        overflow: 'linebreak',
        textColor: [31, 41, 55],
        valign: 'middle',
    },
    headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        lineColor: [191, 219, 254],
        lineWidth: 0.15,
        font: pdfAssets?.fontName || 'helvetica',
        fontStyle: 'bold',
        halign: 'center',
    },
    bodyStyles: {
        font: pdfAssets?.fontName || 'helvetica',
        fontStyle: 'normal',
    },
    alternateRowStyles: {
        fillColor: [248, 250, 252],
    },
    didDrawPage: () => {
        doc.setFont(pdfAssets?.fontName || 'helvetica', 'normal');
        addPageChrome(doc, reportConfig, pdfAssets);
    },
});

const getLastAutoTableY = (doc, fallback = PAGE_MARGIN_TOP) => doc.lastAutoTable?.finalY || fallback;

const ensureSpace = (doc, currentY, minHeight, reportConfig, pdfAssets) => {
    const pageHeight = doc.internal.pageSize.getHeight();

    if (currentY + minHeight <= pageHeight - PAGE_MARGIN_BOTTOM) {
        return currentY;
    }

    doc.addPage();
    doc.setFont(pdfAssets?.fontName || 'helvetica', 'normal');
    addPageChrome(doc, reportConfig, pdfAssets);
    return PAGE_MARGIN_TOP;
};

const addSectionTitle = (doc, currentY, title, reportConfig, pdfAssets) => {
    const startY = ensureSpace(doc, currentY, 10, reportConfig, pdfAssets);
    const sectionWidth = doc.internal.pageSize.getWidth() - PAGE_MARGIN_X * 2;

    doc.setFillColor(239, 246, 255);
    doc.roundedRect(PAGE_MARGIN_X, startY, sectionWidth, 8, 2, 2, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(PAGE_MARGIN_X, startY, sectionWidth, 8, 2, 2, 'S');
    doc.setTextColor(30, 64, 175);
    doc.setFont(pdfAssets?.fontName || 'helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(title, PAGE_MARGIN_X + 3, startY + 5.4);

    return startY + 10;
};

const addMetaTable = (doc, currentY, rows, reportConfig, pdfAssets) => {
    doc.autoTable({
        ...getTableDefaults(doc, reportConfig, pdfAssets),
        startY: currentY,
        theme: 'grid',
        body: rows.map(([label, value]) => [
            {
                content: label,
                styles: {
                    fillColor: [248, 250, 252],
                    textColor: [30, 41, 59],
                    cellWidth: 42,
                },
            },
            { content: normalizeValue(value) },
        ]),
        columnStyles: {
            0: { cellWidth: 42 },
            1: { cellWidth: 'auto' },
        },
    });

    return getLastAutoTableY(doc, currentY) + 6;
};

const getMeasurementDecision = (item) => {
    const measuredValue = normalizeValue(item.measured_value, '').trim();
    if (!measuredValue) return '-';

    const normalizedMeasured = measuredValue.toUpperCase();
    const normalizedNominal = normalizeValue(item.nominal_value, '').trim().toUpperCase();

    const explicitFail = ['RET', 'UYGUNSUZ', 'NOK', 'NG', 'HATALI', 'RED'].some(
        (value) => normalizedMeasured === value || normalizedMeasured.startsWith(`${value} `)
    );
    if (explicitFail) return 'RET';

    const explicitPass = ['OK', 'UYGUN', 'KABUL', 'PASS', 'GEÇER', 'GECER', 'VAR', 'EVET'].some(
        (value) => normalizedMeasured === value || normalizedMeasured.startsWith(`${value} `)
    );
    if (explicitPass) return 'KABUL';

    if (normalizedNominal && normalizedMeasured === normalizedNominal) {
        return 'KABUL';
    }

    const parseNumber = (value) => {
        if (value === null || value === undefined || value === '') return Number.NaN;
        return parseFloat(String(value).replace(',', '.'));
    };

    const measuredNumber = parseNumber(item.measured_value);
    const minNumber = parseNumber(item.min_value);
    const maxNumber = parseNumber(item.max_value);
    const nominalNumber = parseNumber(item.nominal_value);

    if (!Number.isNaN(measuredNumber)) {
        if (!Number.isNaN(minNumber) && !Number.isNaN(maxNumber)) {
            return measuredNumber >= minNumber && measuredNumber <= maxNumber ? 'KABUL' : 'RET';
        }

        if (!Number.isNaN(minNumber)) {
            return measuredNumber >= minNumber ? 'KABUL' : 'RET';
        }

        if (!Number.isNaN(maxNumber)) {
            return measuredNumber <= maxNumber ? 'KABUL' : 'RET';
        }

        if (!Number.isNaN(nominalNumber)) {
            return measuredNumber === nominalNumber ? 'KABUL' : 'RET';
        }
    }

    return 'RET';
};

const addPlanItemsTable = (doc, currentY, items, reportConfig, pdfAssets) => {
    doc.autoTable({
        ...getTableDefaults(doc, reportConfig, pdfAssets),
        startY: currentY,
        head: [[
            'No',
            'Karakteristik',
            'Ölçüm Ekipmanı',
            'Standart',
            'Nominal',
            'Yön',
            'Min',
            'Max',
        ]],
        body: (items || []).map((item, index) => [
            String(index + 1),
            normalizeValue(item.characteristic_name || item.characteristic_id),
            normalizeValue(item.equipment_name || item.equipment_id),
            normalizeValue(item.standard_name || item.standard_class || item.standard_id),
            normalizeValue(item.nominal_value),
            normalizeValue(item.tolerance_direction, '±'),
            normalizeValue(item.min_value),
            normalizeValue(item.max_value),
        ]),
        theme: 'grid',
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 62 },
            2: { cellWidth: 48 },
            3: { cellWidth: 54 },
            4: { cellWidth: 24, halign: 'center' },
            5: { cellWidth: 16, halign: 'center' },
            6: { cellWidth: 22, halign: 'center' },
            7: { cellWidth: 22, halign: 'center' },
        },
    });

    return getLastAutoTableY(doc, currentY) + 6;
};

const addInkrItemsTable = (doc, currentY, items, reportConfig, pdfAssets) => {
    doc.autoTable({
        ...getTableDefaults(doc, reportConfig, pdfAssets),
        startY: currentY,
        head: [[
            'No',
            'Karakteristik',
            'Ekipman',
            'Nominal',
            'Min',
            'Max',
            'Ölçülen',
            'Sonuç',
        ]],
        body: (items || []).map((item, index) => {
            const result = getMeasurementDecision(item);
            return [
                String(index + 1),
                normalizeValue(item.characteristic_name || item.characteristic_id),
                normalizeValue(item.equipment_name || item.equipment_id),
                normalizeValue(item.nominal_value),
                normalizeValue(item.min_value),
                normalizeValue(item.max_value),
                normalizeValue(item.measured_value),
                {
                    content: result,
                    styles:
                        result === 'KABUL'
                            ? {
                                  fillColor: [220, 252, 231],
                                  textColor: [22, 101, 52],
                                  halign: 'center',
                              }
                            : result === 'RET'
                              ? {
                                    fillColor: [254, 226, 226],
                                    textColor: [153, 27, 27],
                                    halign: 'center',
                                }
                              : {
                                    fillColor: [248, 250, 252],
                                    textColor: [100, 116, 139],
                                    halign: 'center',
                                },
                },
            ];
        }),
        theme: 'grid',
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 72 },
            2: { cellWidth: 46 },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 22, halign: 'center' },
            5: { cellWidth: 22, halign: 'center' },
            6: { cellWidth: 28, halign: 'center' },
            7: { cellWidth: 24, halign: 'center' },
        },
    });

    return getLastAutoTableY(doc, currentY) + 6;
};

const addParagraphTable = (doc, currentY, title, text, reportConfig, pdfAssets) => {
    if (!text) return currentY;

    const nextY = addSectionTitle(doc, currentY, title, reportConfig, pdfAssets);

    doc.autoTable({
        ...getTableDefaults(doc, reportConfig, pdfAssets),
        startY: nextY,
        theme: 'grid',
        body: [[normalizeValue(text)]],
        styles: {
            ...getTableDefaults(doc, reportConfig, pdfAssets).styles,
            minCellHeight: 12,
            overflow: 'linebreak',
        },
    });

    return getLastAutoTableY(doc, nextY) + 6;
};

const addAttachmentList = (doc, currentY, attachments, reportConfig, pdfAssets) => {
    if (!attachments?.length) return currentY;

    const nextY = addSectionTitle(doc, currentY, 'Ek Dosyalar', reportConfig, pdfAssets);

    doc.autoTable({
        ...getTableDefaults(doc, reportConfig, pdfAssets),
        startY: nextY,
        head: [['Dosya Adı', 'Türü']],
        body: attachments.map((attachment) => [
            normalizeValue(attachment.file_name || attachment.name),
            normalizeValue(attachment.file_type || attachment.type, 'Dosya'),
        ]),
        theme: 'grid',
        columnStyles: {
            0: { cellWidth: 170 },
            1: { cellWidth: 55 },
        },
    });

    return getLastAutoTableY(doc, nextY) + 6;
};

const buildPlanMetaRows = (record, type) => {
    const rows = [];

    if (type === 'process_control_plans') {
        rows.push(['Araç Tipi', normalizeValue(record.vehicle_type)]);
    }

    rows.push(['Parça Kodu', normalizeValue(record.part_code)]);
    rows.push(['Parça Adı', normalizeValue(record.part_name)]);
    rows.push(['Revizyon No', `Rev.${normalizeValue(record.revision_number, 0)}`]);
    rows.push(['Revizyon Tarihi', formatDateValue(record.revision_date || record.updated_at || record.created_at)]);

    return rows;
};

const buildInkrMetaRows = (record) => {
    const rows = [
        ['INKR Numarası', normalizeValue(record.inkr_number || record.record_no || record.id)],
        ['Parça Kodu', normalizeValue(record.part_code)],
        ['Parça Adı', normalizeValue(record.part_name)],
        ['Rapor Tarihi', formatDateValue(record.report_date || record.created_at)],
        ['Durum', normalizeValue(record.status, 'Aktif')],
    ];

    const supplierName = record.supplier_name || record.supplier?.name;
    if (supplierName) {
        rows.push(['Tedarikçi', supplierName]);
    }

    if (record.vehicle_type) {
        rows.push(['Araç Tipi', record.vehicle_type]);
    }

    return rows;
};

export const generateQualityReportPdfBuffer = async (record, type) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    const pdfAssets = await ensurePdfAssets(doc);
    let reportConfig;
    let currentY = PAGE_MARGIN_TOP;

    if (type === 'incoming_control_plans' || type === 'process_control_plans') {
        reportConfig = {
            title: type === 'process_control_plans' ? 'Proses Kontrol Planı' : 'Girdi Kontrol Planı',
            reportNo: `${normalizeValue(record.part_code)} / Rev.${normalizeValue(record.revision_number, 0)}`,
        };

        addPageChrome(doc, reportConfig, pdfAssets);
        currentY = addMetaTable(doc, currentY, buildPlanMetaRows(record, type), reportConfig, pdfAssets);
        currentY = addSectionTitle(doc, currentY, 'Ölçülmesi Gereken Noktalar ve Ölçüler', reportConfig, pdfAssets);
        currentY = addPlanItemsTable(doc, currentY, record.items || [], reportConfig, pdfAssets);
        currentY = addParagraphTable(doc, currentY, 'Revizyon Notları', record.revision_notes, reportConfig, pdfAssets);
    } else if (type === 'inkr_management') {
        reportConfig = {
            title: 'INKR Raporu',
            reportNo: normalizeValue(record.inkr_number || record.record_no || record.id),
        };

        addPageChrome(doc, reportConfig, pdfAssets);
        currentY = addMetaTable(doc, currentY, buildInkrMetaRows(record), reportConfig, pdfAssets);
        currentY = addSectionTitle(doc, currentY, 'Ölçüm Sonuçları', reportConfig, pdfAssets);
        currentY = addInkrItemsTable(doc, currentY, record.items || [], reportConfig, pdfAssets);
        currentY = addParagraphTable(doc, currentY, 'Notlar', record.notes, reportConfig, pdfAssets);
        currentY = addAttachmentList(doc, currentY, record.inkr_attachments || [], reportConfig, pdfAssets);
    } else {
        throw new Error(`Desteklenmeyen kalite raporu tipi: ${type}`);
    }

    return doc.output('arraybuffer');
};
