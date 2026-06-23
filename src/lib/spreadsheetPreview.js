import { read, utils } from 'xlsx';

export async function buildSpreadsheetPreviewSheets(blob) {
    const buffer = await blob.arrayBuffer();
    const workbook = read(buffer, { type: 'array', cellDates: true });

    if (!workbook.SheetNames.length) {
        throw new Error('Excel dosyasında sayfa bulunamadı.');
    }

    return workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const html = utils.sheet_to_html(sheet, {
            id: `spreadsheet-preview-${sheetName.replace(/[^a-zA-Z0-9_-]+/g, '-')}`,
            editable: false,
        });
        return { name: sheetName, html };
    });
}
