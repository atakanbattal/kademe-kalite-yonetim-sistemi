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

    await sleep(150);
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

const renderPrintableHtmlToPdfBuffer = async (html) => {
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
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: Math.ceil(pageElement.scrollWidth || 1200),
            windowHeight: Math.ceil(pageElement.scrollHeight || 1800),
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imageData = canvas.toDataURL('image/png');
        const imageHeight = (canvas.height * pdfWidth) / canvas.width;
        let remainingHeight = imageHeight;
        let offsetY = 0;

        pdf.addImage(imageData, 'PNG', 0, offsetY, pdfWidth, imageHeight, undefined, 'FAST');
        remainingHeight -= pdfHeight;

        while (remainingHeight > 0) {
            offsetY = remainingHeight - imageHeight;
            pdf.addPage();
            pdf.addImage(imageData, 'PNG', 0, offsetY, pdfWidth, imageHeight, undefined, 'FAST');
            remainingHeight -= pdfHeight;
        }

        return pdf.output('arraybuffer');
    } finally {
        cleanup();
    }
};

export const createPrintableReportPdfBuffer = async (record, type) => {
    const { generatePrintableReportHtml } = await import('@/lib/reportUtils');
    const html = await generatePrintableReportHtml(record, type);

    try {
        const response = await fetch(REPORT_PDF_ROUTE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                html,
                baseUrl: window.location.origin,
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

    return renderPrintableHtmlToPdfBuffer(html);
};
