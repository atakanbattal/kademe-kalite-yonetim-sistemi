const REPORT_PDF_ROUTE = '/__report-pdf';

const readRequestBody = async (req) => {
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
};

const injectBaseHref = (html, baseUrl) => {
    const safeBaseUrl = `${String(baseUrl || '').replace(/\/$/, '')}/`;

    if (!safeBaseUrl.startsWith('http')) {
        return html;
    }

    if (/<base\s/i.test(html)) {
        return html;
    }

    if (/<head[^>]*>/i.test(html)) {
        return html.replace(/<head[^>]*>/i, (match) => `${match}<base href="${safeBaseUrl}">`);
    }

    return `<!DOCTYPE html><html><head><base href="${safeBaseUrl}"></head><body>${html}</body></html>`;
};

const createReportPdfPlugin = () => {
    let browserPromise = null;

    const getBrowser = async () => {
        if (!browserPromise) {
            browserPromise = import('playwright').then(async ({ chromium }) => {
                try {
                    return await chromium.launch({
                        headless: true,
                        channel: 'chrome',
                        args: ['--disable-dev-shm-usage'],
                    });
                } catch (primaryError) {
                    console.warn('Chrome kanali ile PDF tarayicisi acilamadi, varsayilan Chromium deneniyor:', primaryError);
                    return chromium.launch({
                        headless: true,
                        args: ['--disable-dev-shm-usage'],
                    });
                }
            });
        }

        return browserPromise;
    };

    return {
        name: 'report-pdf-plugin',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url?.startsWith(REPORT_PDF_ROUTE) || req.method !== 'POST') {
                    next();
                    return;
                }

                try {
                    const rawBody = await readRequestBody(req);
                    const { html, baseUrl, landscape = false, format = 'A4' } = JSON.parse(rawBody || '{}');

                    if (!html) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'HTML icerigi gerekli.' }));
                        return;
                    }

                    const browser = await getBrowser();
                    const page = await browser.newPage({
                        viewport: { width: 1440, height: 2048 },
                    });

                    try {
                        if (baseUrl) {
                            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
                        }

                        await page.setContent(injectBaseHref(html, baseUrl), { waitUntil: 'load' });
                        await page.emulateMedia({ media: 'print' });

                        await page.evaluate(async () => {
                            if (document.fonts?.ready) {
                                await document.fonts.ready;
                            }
                        });
                        await page.waitForTimeout(500);

                        const pdfBuffer = await page.pdf({
                            format,
                            landscape,
                            printBackground: true,
                            preferCSSPageSize: true,
                            margin: {
                                top: '0',
                                right: '0',
                                bottom: '0',
                                left: '0',
                            },
                        });

                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Cache-Control', 'no-store');
                        res.end(pdfBuffer);
                    } finally {
                        await page.close();
                    }
                } catch (error) {
                    console.error('Report PDF render hatasi:', error);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: error.message || 'PDF olusturulamadi.' }));
                }
            });

            server.httpServer?.once('close', async () => {
                if (!browserPromise) return;

                try {
                    const browser = await browserPromise;
                    await browser.close();
                } catch (error) {
                    console.warn('PDF tarayicisi kapatilamadi:', error);
                }
            });
        },
    };
};

export { REPORT_PDF_ROUTE };
export default createReportPdfPlugin;
