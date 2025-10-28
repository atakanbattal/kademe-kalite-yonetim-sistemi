const generatePrintableReport = (record) => {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';

    const getStatusBadge = (status) => {
        let bgColor, textColor;
        switch (status) {
            case 'Açık': bgColor = '#fde047'; textColor = '#713f12'; break; // yellow-300, yellow-800
            case 'Kapatıldı': bgColor = '#86efac'; textColor = '#15803d'; break; // green-300, green-700
            case 'Reddedildi': bgColor = '#fca5a5'; textColor = '#b91c1c'; break; // red-300, red-700
            default: bgColor = '#e5e7eb'; textColor = '#4b5563'; break; // gray-200, gray-600
        }
        return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${status}</span>`;
    };

    const attachmentsHtml = record.attachments && record.attachments.length > 0 ? `
        <div class="section">
            <h2 class="section-title">Ekli Görseller</h2>
            <div class="image-grid">
                ${record.attachments.map(path => `<img src="https://rqnvoatirfczpklaamhf.supabase.co/storage/v1/object/public/documents/${path}" class="attachment-image" alt="Ek" crossOrigin="anonymous"/>`).join('')}
            </div>
        </div>
    ` : '';
    
    const eightDStepsHtml = record.type === '8D' && record.eight_d_steps ? Object.entries(record.eight_d_steps).map(([key, step]) => `
        <div class="step-section">
            <h3 class="step-title">${key}: ${step.title || ''}</h3>
            <div class="step-content">
                <p><strong>Sorumlu:</strong> ${step.responsible || '-'}</p>
                <p><strong>Tamamlanma Tarihi:</strong> ${formatDate(step.completionDate)}</p>
                <p class="step-description"><strong>Açıklama:</strong> ${step.description || '-'}</p>
            </div>
        </div>
    `).join('') : '';

    const closingNotesHtml = record.status === 'Kapatıldı' ? `
        <div class="section">
            <h2 class="section-title">Kapanış Detayları</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Kapanış Tarihi</span>
                    <span class="value">${formatDate(record.closed_at)}</span>
                </div>
                 <div class="info-item full-width">
                    <span class="label">Kapanış Notları</span>
                    <span class="value">${record.closing_notes || '-'}</span>
                </div>
            </div>
        </div>
    ` : '';
    
    const rejectionHtml = record.status === 'Reddedildi' ? `
        <div class="section">
            <h2 class="section-title">Reddetme Detayları</h2>
            <div class="info-grid">
                <div class="info-item full-width">
                    <span class="label">Reddetme Gerekçesi</span>
                    <span class="value">${record.rejection_reason || '-'}</span>
                </div>
            </div>
        </div>
    ` : '';


    const htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>${record.type} Raporu - ${record.nc_number || record.mdi_no}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                    color: #1f2937;
                    margin: 0;
                    padding: 0;
                    background-color: #f3f4f6;
                }
                .page {
                    background-color: white;
                    width: 210mm;
                    min-height: 297mm;
                    margin: 20px auto;
                    padding: 20mm;
                    box-sizing: border-box;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .header h1 {
                    font-size: 24px;
                    font-weight: 700;
                    color: #111827;
                    margin: 0;
                }
                .header p {
                    font-size: 14px;
                    color: #6b7280;
                    margin: 5px 0 0;
                }
                .report-title-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 25px;
                }
                .report-title h2 {
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0;
                }
                .report-title p {
                    font-size: 14px;
                    color: #4b5563;
                    margin: 5px 0 0;
                }

                .section {
                    margin-bottom: 25px;
                    page-break-inside: avoid;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1e40af;
                    border-bottom: 2px solid #bfdbfe;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                .info-item {
                    background-color: #f9fafb;
                    border-radius: 8px;
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                }
                .info-item .label {
                    display: block;
                    font-size: 12px;
                    color: #6b7280;
                    margin-bottom: 4px;
                }
                .info-item .value {
                    font-size: 14px;
                    font-weight: 600;
                }
                .full-width {
                   grid-column: 1 / -1;
                }
                .problem-description {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .step-section {
                    margin-bottom: 15px;
                }
                .step-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e40af;
                    margin: 0 0 10px 0;
                }
                .step-content {
                    background-color: #f9fafb;
                    border-left: 3px solid #60a5fa;
                    padding: 15px;
                    border-radius: 0 8px 8px 0;
                }
                .step-content p { margin: 0 0 8px 0; font-size: 13px; }
                .step-content p:last-child { margin-bottom: 0; }
                .step-description {
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px dashed #d1d5db;
                }
                .image-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 10px;
                }
                .attachment-image {
                    width: 100%;
                    height: auto;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 12px;
                    color: #9ca3af;
                }
                @media print {
                    body { background-color: white; margin: 0; padding: 0; }
                    .page { margin: 0; box-shadow: none; border: none; }
                    @page {
                        size: A4;
                        margin: 20mm;
                    }
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <h1>KADEME A.Ş.</h1>
                    <p>Kalite Yönetim Sistemi</p>
                </div>
                <div class="report-title-section">
                    <div class="report-title">
                        <h2>${record.type} Raporu</h2>
                        <p>${record.title || '-'}</p>
                    </div>
                    <div>
                        ${getStatusBadge(record.status)}
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Genel Bilgiler</h2>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">${record.type} Numarası</span><span class="value">${record.nc_number || '-'}</span></div>
                        <div class="info-item"><span class="label">MDI Numarası</span><span class="value">${record.mdi_no || '-'}</span></div>
                        <div class="info-item"><span class="label">Açılış Tarihi</span><span class="value">${formatDate(record.opening_date)}</span></div>
                        <div class="info-item"><span class="label">Termin Tarihi</span><span class="value">${formatDate(record.due_date)}</span></div>
                        <div class="info-item"><span class="label">Talep Eden Kişi / Birim</span><span class="value">${record.requesting_person || '-'} / ${record.requesting_unit || '-'}</span></div>
                        <div class="info-item"><span class="label">Sorumlu Kişi / Birim</span><span class="value">${record.responsible_person || '-'} / ${record.department || '-'}</span></div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Problem Tanımı</h2>
                    <div class="info-item full-width">
                        <p class="problem-description">${record.description || record.problem_definition || '-'}</p>
                    </div>
                </div>

                ${attachmentsHtml}

                ${record.type === '8D' ? `
                <div class="section">
                    <h2 class="section-title">8D Adımları</h2>
                    ${eightDStepsHtml}
                </div>
                ` : ''}

                ${rejectionHtml}
                ${closingNotesHtml}
                
                <div class="footer">
                    Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.
                </div>
            </div>
            <script>
                const images = document.querySelectorAll('.attachment-image');
                const promises = Array.from(images).map(img => {
                    return new Promise((resolve) => {
                        if (img.complete) {
                            resolve();
                        } else {
                            img.onload = resolve;
                            img.onerror = resolve; // Resolve on error too, to not block printing
                        }
                    });
                });

                Promise.all(promises).then(() => {
                    setTimeout(() => {
                        window.print();
                    }, 500); // Increased delay to ensure rendering
                });
            </script>
        </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
        printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(url));
    }
};

export const generateDFPDF = (record) => {
    generatePrintableReport(record);
};

export const generate8DPDF = (record) => {
    generatePrintableReport(record);
};