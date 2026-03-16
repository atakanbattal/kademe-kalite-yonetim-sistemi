export const getProcessInkrDisplayNumber = (report) => {
    const directValue = [
        report?.process_inkr_number,
        report?.inkr_number,
        report?.report_number,
        report?.report_no,
        report?.record_no,
    ].find((value) => typeof value === 'string' && value.trim());

    if (directValue) {
        return directValue.trim();
    }

    if (report?.part_code) {
        return `INKR-${String(report.part_code).trim()}`;
    }

    if (report?.id) {
        return `INKR-${String(report.id).slice(0, 8).toUpperCase()}`;
    }

    return 'INKR';
};
