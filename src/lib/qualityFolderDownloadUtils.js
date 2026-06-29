import jsPDF from 'jspdf';

const REPORT_PDF_ROUTE = '/__report-pdf';

export const sanitizeArchiveName = (value, fallback = 'dosya') => {
    const normalized = String(value || fallback)
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
        .replace(/\s+/g, ' ');

    return normalized || fallback;
};

export const getStorageFileName = (path, fallback) => {
    const lastSegment = String(path || '').split('/').pop();
    return sanitizeArchiveName(lastSegment || fallback || 'dosya');
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const runInBatches = async (items, batchSize, worker) => {
    for (let index = 0; index < items.length; index += batchSize) {
        const chunk = items.slice(index, index + batchSize);
        await Promise.all(chunk.map(worker));
    }
};

const waitForPrintableAssets = async (doc) => {
    if (!doc) return;

    if (doc.fonts?.ready) {
        try {
            await doc.fonts.ready;
        } catch (error) {
            console.warn('Yazi tipleri beklenirken hata olustu:', error);
        }
    }

    const images = Array.from(doc.images || []);
    await Promise.all(
        images.map(
            (image) =>
                new Promise((resolve) => {
                    if (image.complete) {
                        resolve();
                        return;
                    }

                    const done = () => resolve();
                    image.addEventListener('load', done, { once: true });
                    image.addEventListener('error', done, { once: true });
                })
        )
    );

    await sleep(80);
};

const getPrintablePageElement = async (doc) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const pageElement = doc?.querySelector('.page-container');
        if (pageElement) {
            return pageElement;
        }

        await sleep(100);
    }

    return null;
};

const sliceCanvasToPdfPages = (canvas, pdf) => {
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imageHeightMm = (canvas.height * pdfWidth) / canvas.width;
    const pageHeightPx = (canvas.height * pdfHeight) / imageHeightMm;

    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height - 1) {
        let sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);

        if (sliceHeight < canvas.height - offsetY) {
            const minChunk = Math.min(pageHeightPx * 0.35, 120);
            sliceHeight = Math.max(minChunk, sliceHeight - 1);
        }

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceHeight);
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
        );

        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = (sliceHeight * pdfWidth) / canvas.width;

        if (pageIndex > 0) {
            pdf.addPage();
        }
        pdf.addImage(sliceData, 'PNG', 0, 0, pdfWidth, sliceHeightMm, undefined, 'FAST');

        offsetY += sliceHeight;
        pageIndex += 1;
    }
};

const collectProtectedIntervals = (pageElement, scale) => {
    const rootTop = pageElement.getBoundingClientRect().top;
    const selector = [
        '.report-header',
        '.meta-box',
        '.section-title',
        '.df-print-unit',
        '.analysis-print-row',
        '.df-analysis-group > .analysis-box > h4',
        '.step-section',
        '.step-title',
        '.attachments-section',
        '.signature-section',
    ].join(',');

    return Array.from(pageElement.querySelectorAll(selector))
        .map((el) => {
            const rect = el.getBoundingClientRect();
            const top = Math.floor((rect.top - rootTop) * scale);
            const bottom = Math.ceil((rect.bottom - rootTop) * scale);
            return { top, bottom };
        })
        .filter((interval) => interval.bottom > interval.top + 4);
};

const findSafeSliceEnd = (startY, idealEndY, intervals, minSlicePx = 96) => {
    let cutY = idealEndY;
    const crossing = intervals.filter(
        (interval) => cutY > interval.top + 6 && cutY < interval.bottom - 6,
    );

    if (!crossing.length) {
        return cutY;
    }

    const first = crossing.sort((a, b) => a.top - b.top)[0];
    if (first.top - startY >= minSlicePx) {
        return first.top;
    }

    return Math.min(idealEndY, first.bottom);
};

const collectCanvasBreakPoints = (pageElement, scale) => {
    const rootTop = pageElement.getBoundingClientRect().top;
    const selectors = [
        '.report-header',
        '.meta-box',
        '.section',
        '.df-analysis-group',
        '.df-print-unit',
        '.analysis-print-row',
        '.step-section',
        '.attachments-section',
        '.signature-section',
    ].join(',');

    const points = Array.from(pageElement.querySelectorAll(selectors))
        .map((el) => Math.round((el.getBoundingClientRect().bottom - rootTop) * scale))
        .filter((y) => y > 0);

    return [...new Set(points)].sort((a, b) => a - b);
};

const sliceCanvasToPdfPagesAtSafeBreaks = (canvas, pdf, breakPointsPx, protectedIntervals = []) => {
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imageHeightMm = (canvas.height * pdfWidth) / canvas.width;
    const pageHeightPx = (canvas.height * pdfHeight) / imageHeightMm;

    const pushSlice = (startY, endY, pageIndex) => {
        const sliceHeight = endY - startY;
        if (sliceHeight <= 0) return pageIndex;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceHeight);
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(
            canvas,
            0,
            startY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
        );

        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = (sliceHeight * pdfWidth) / canvas.width;
        if (pageIndex > 0) {
            pdf.addPage();
        }
        pdf.addImage(sliceData, 'PNG', 0, 0, pdfWidth, sliceHeightMm, undefined, 'FAST');
        return pageIndex + 1;
    };

    let y = 0;
    let pageIndex = 0;

    while (y < canvas.height - 1) {
        const idealMax = Math.min(y + pageHeightPx, canvas.height);
        let nextY = idealMax;

        if (protectedIntervals.length) {
            nextY = findSafeSliceEnd(y, idealMax, protectedIntervals);
        } else {
            const candidates = breakPointsPx.filter((point) => point > y + 24 && point <= idealMax);
            nextY = candidates.length ? candidates[candidates.length - 1] : idealMax;
        }

        if (nextY <= y + 8) {
            nextY = idealMax;
        }

        pageIndex = pushSlice(y, nextY, pageIndex);
        y = nextY;
    }

    return pageIndex;
};

const REPORT_PDF_FORMATS = {
    master_document_list: { format: 'A3', landscape: true },
    code_mapping_list: { format: 'A3', landscape: true },
};

const renderPrintableHtmlToPdfBuffer = async (html, type) => {
    const { default: html2canvas } = await import('html2canvas');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1400px';
    iframe.style.height = '2200px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = html;

    const cleanup = () => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    };

    try {
        const loadPromise = new Promise((resolve) => {
            iframe.addEventListener('load', resolve, { once: true });
        });

        document.body.appendChild(iframe);
        await loadPromise;

        const frameDoc = iframe.contentDocument;
        if (!frameDoc) {
            throw new Error('Rapor dokumani olusturulamadi.');
        }

        const pageElement = await getPrintablePageElement(frameDoc);
        if (!pageElement) {
            throw new Error('Rapor sayfasi bulunamadi.');
        }

        await waitForPrintableAssets(frameDoc);

        const canvas = await html2canvas(pageElement, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: Math.ceil(pageElement.scrollWidth || 1200),
            windowHeight: Math.ceil(pageElement.scrollHeight || 1800),
        });

        const isLandscapeA3 = type === 'master_document_list' || type === 'code_mapping_list';
        const pdf = isLandscapeA3
            ? new jsPDF('l', 'mm', 'a3')
            : new jsPDF('p', 'mm', 'a4');
        const scale = 1.5;
        const protectedIntervals = collectProtectedIntervals(pageElement, scale);
        const breakPointsPx = collectCanvasBreakPoints(pageElement, scale);
        if (protectedIntervals.length) {
            sliceCanvasToPdfPagesAtSafeBreaks(canvas, pdf, breakPointsPx, protectedIntervals);
        } else if (breakPointsPx.length) {
            sliceCanvasToPdfPagesAtSafeBreaks(canvas, pdf, breakPointsPx);
        } else {
            sliceCanvasToPdfPages(canvas, pdf);
        }

        return pdf.output('arraybuffer');
    } finally {
        cleanup();
    }
};

export const createPrintableReportPdfBuffer = async (record, type) => {
    const { generatePrintableReportHtml } = await import('@/lib/reportUtils');
    const html = await generatePrintableReportHtml(record, type);
    const pageFormat = REPORT_PDF_FORMATS[type] || { format: 'A4', landscape: false };

    try {
        const response = await fetch(REPORT_PDF_ROUTE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                html,
                baseUrl: window.location.origin,
                ...pageFormat,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Tarayici tabanli PDF servisi yanit vermedi.');
        }

        return response.arrayBuffer();
    } catch (error) {
        console.warn('Tarayici tabanli PDF servisi kullanilamadi, istemci fallback devreye giriyor:', error);
    }

    return renderPrintableHtmlToPdfBuffer(html, type);
};
