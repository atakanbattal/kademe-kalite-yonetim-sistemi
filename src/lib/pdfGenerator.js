import { toCamelCase } from './utils';

const generatePrintableReport = (record) => {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';
    
    // Metin alanlarını camelCase formatına çevir
    const formatText = (text) => typeof text === 'string' ? toCamelCase(text) : text;
    
    // HTML escape fonksiyonu (güvenlik için)
    const escapeHtml = (text) => {
        if (!text || typeof text !== 'string') return text || '-';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    // Problem tanımı için profesyonel formatlama
    const formatProblemDescription = (text) => {
        if (!text || typeof text !== 'string') return '-';
        
        // HTML escape yap
        let escaped = escapeHtml(text);
        
        // Satırları ayır
        let lines = escaped.split('\n');
        let formattedLines = [];
        let currentParagraph = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            // Boş satır - paragraf sonu
            if (!line) {
                if (currentParagraph.length > 0) {
                    formattedLines.push(formatParagraph(currentParagraph));
                    currentParagraph = [];
                }
                formattedLines.push('');
                continue;
            }
            
            // Başlık tespiti: "Başlık:" veya "Başlık Adı:" formatı
            const headingMatch = line.match(/^([A-ZÇĞİÖŞÜ][^:]+):\s*(.*)$/);
            if (headingMatch) {
                const [, title, value] = headingMatch;
                
                // Önceki paragrafı bitir
                if (currentParagraph.length > 0) {
                    formattedLines.push(formatParagraph(currentParagraph));
                    currentParagraph = [];
                }
                
                // Başlığı formatla
                if (value && value.trim()) {
                    formattedLines.push(`<div style="margin-top: 12px; margin-bottom: 6px;"><strong style="color: #1e40af; font-weight: 600;">${title}:</strong> <span style="color: #374151;">${value}</span></div>`);
                } else {
                    formattedLines.push(`<div style="margin-top: 12px; margin-bottom: 6px;"><strong style="color: #1e40af; font-weight: 600;">${title}:</strong></div>`);
                }
                continue;
            }
            
            // Liste öğesi tespiti: "- ", "• ", veya sayısal "1. ", "2. "
            const listMatch = line.match(/^([-•]|\d+[.)])\s+(.+)$/);
            if (listMatch) {
                // Önceki paragrafı bitir
                if (currentParagraph.length > 0) {
                    formattedLines.push(formatParagraph(currentParagraph));
                    currentParagraph = [];
                }
                
                const itemText = listMatch[2];
                formattedLines.push(`<div style="margin-left: 24px; margin-bottom: 4px; padding-left: 8px; border-left: 2px solid #e5e7eb;">${itemText}</div>`);
                continue;
            }
            
            // Normal metin - paragrafa ekle
            currentParagraph.push(line);
        }
        
        // Son paragrafı ekle
        if (currentParagraph.length > 0) {
            formattedLines.push(formatParagraph(currentParagraph));
        }
        
        return formattedLines.join('\n');
    };
    
    // Paragraf formatlama yardımcı fonksiyonu
    const formatParagraph = (lines) => {
        if (lines.length === 0) return '';
        const content = lines.join(' ');
        return `<p style="margin: 8px 0; line-height: 1.6; color: #374151;">${content}</p>`;
    };

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
            <h3 class="step-title">${key}: ${formatText(step.title || '')}</h3>
            <div class="step-content">
                <p><strong>Sorumlu:</strong> ${formatText(step.responsible || '-')}</p>
                <p><strong>Tamamlanma Tarihi:</strong> ${formatDate(step.completionDate)}</p>
                <p class="step-description"><strong>Açıklama:</strong> ${formatText(step.description || '-')}</p>
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
                    <span class="value">${formatText(record.closing_notes || '-')}</span>
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
                    <span class="value">${formatText(record.rejection_reason || '-')}</span>
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
                    white-space: normal;
                    word-wrap: break-word;
                    font-family: 'Inter', sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0;
                    padding: 12px;
                    background-color: #f9fafb;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
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
                        <p>${formatText(record.title || '-')}</p>
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
                        <div class="info-item"><span class="label">Talep Eden Kişi / Birim</span><span class="value">${formatText(record.requesting_person || '-')} / ${formatText(record.requesting_unit || '-')}</span></div>
                        <div class="info-item"><span class="label">Sorumlu Kişi / Birim</span><span class="value">${formatText(record.responsible_person || '-')} / ${formatText(record.department || '-')}</span></div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Problem Tanımı</h2>
                    <div class="info-item full-width">
                        <div class="problem-description">${formatProblemDescription(record.description || record.problem_definition || '-')}</div>
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

export const generateVehicleSummaryReport = (vehicles, timelineByVehicle, faultsByVehicle) => {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';
    
    const formatDuration = (milliseconds) => {
        if (!milliseconds || milliseconds < 0) return '0 dk';
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} gün ${hours % 24} saat`;
        if (hours > 0) return `${hours} saat ${minutes % 60} dk`;
        if (minutes > 0) return `${minutes} dk ${seconds % 60} sn`;
        return `${seconds} sn`;
    };

    const getStatusBadgeColor = (status) => {
        if (status === 'Yeniden İşlemde') return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' };
        if (status === 'Kalite Kontrolde' || status === 'Kontrol Başladı' || status === 'Kaliteye Girdi') return { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' };
        if (status === 'Sevk Bilgisi Bekleniyor') return { bg: '#fed7aa', text: '#9a3412', border: '#f97316' };
        if (status === 'Sevk Hazır') return { bg: '#dcfce7', text: '#166534', border: '#22c55e' };
        if (status === 'Sevk Edildi') return { bg: '#f3f4f6', text: '#374151', border: '#6b7280' };
        return { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' };
    };

    // Her araç için süreleri hesapla
    const calculateVehicleTimes = (vehicleId, timeline) => {
        let totalControlMillis = 0;
        let totalReworkMillis = 0;
        let waitingForShippingStart = null;

        if (timeline && timeline.length > 0) {
            const waitingEvent = timeline.find(e => e.event_type === 'waiting_for_shipping_info');
            if (waitingEvent) {
                waitingForShippingStart = new Date(waitingEvent.event_timestamp);
            }

            for (let i = 0; i < timeline.length; i++) {
                const currentEvent = timeline[i];
                const currentEventTime = new Date(currentEvent.event_timestamp);
                
                if (waitingForShippingStart && currentEventTime >= waitingForShippingStart) {
                    continue;
                }

                if (currentEvent.event_type === 'control_start') {
                    const nextEnd = timeline.slice(i + 1).find(e => {
                        const endTime = new Date(e.event_timestamp);
                        if (waitingForShippingStart && endTime >= waitingForShippingStart) {
                            return false;
                        }
                        return e.event_type === 'control_end';
                    });
                    if (nextEnd) {
                        const endTime = waitingForShippingStart && new Date(nextEnd.event_timestamp) > waitingForShippingStart 
                            ? waitingForShippingStart 
                            : new Date(nextEnd.event_timestamp);
                        totalControlMillis += (endTime - currentEventTime);
                    } else if (waitingForShippingStart) {
                        totalControlMillis += (waitingForShippingStart - currentEventTime);
                    }
                } else if (currentEvent.event_type === 'rework_start') {
                    const nextEnd = timeline.slice(i + 1).find(e => {
                        const endTime = new Date(e.event_timestamp);
                        if (waitingForShippingStart && endTime >= waitingForShippingStart) {
                            return false;
                        }
                        return e.event_type === 'rework_end';
                    });
                    if (nextEnd) {
                        const endTime = waitingForShippingStart && new Date(nextEnd.event_timestamp) > waitingForShippingStart 
                            ? waitingForShippingStart 
                            : new Date(nextEnd.event_timestamp);
                        totalReworkMillis += (endTime - currentEventTime);
                    } else if (waitingForShippingStart) {
                        totalReworkMillis += (waitingForShippingStart - currentEventTime);
                    }
                }
            }
        }
        
        return {
            totalControlTime: formatDuration(totalControlMillis),
            totalReworkTime: formatDuration(totalReworkMillis),
            totalQualityTime: formatDuration(totalControlMillis)
        };
    };

    // Durum istatistikleri
    const statusStats = {};
    vehicles.forEach(v => {
        const status = v.status || 'Belirtilmemiş';
        if (!statusStats[status]) {
            statusStats[status] = 0;
        }
        statusStats[status]++;
    });

    // Hata istatistikleri
    let totalFaults = 0;
    let resolvedFaults = 0;
    let unresolvedFaults = 0;
    vehicles.forEach(v => {
        const faults = faultsByVehicle[v.id] || [];
        totalFaults += faults.length;
        resolvedFaults += faults.filter(f => f.is_resolved).length;
        unresolvedFaults += faults.filter(f => !f.is_resolved).length;
    });

    // Araç listesi HTML
    const vehiclesHtml = vehicles.map((vehicle, index) => {
        const timeline = timelineByVehicle[vehicle.id] || [];
        const faults = faultsByVehicle[vehicle.id] || [];
        const times = calculateVehicleTimes(vehicle.id, timeline);
        const statusBadge = getStatusBadgeColor(vehicle.status);
        const unresolvedFaultCount = faults.filter(f => !f.is_resolved).length;
        const resolvedFaultCount = faults.filter(f => f.is_resolved).length;

        return `
            <tr style="page-break-inside: avoid; border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px; text-align: center; font-weight: 600;">${index + 1}</td>
                <td style="padding: 12px;">
                    <div style="font-weight: 600; color: #111827;">${vehicle.chassis_no || '-'}</div>
                    <div style="font-size: 11px; color: #6b7280;">${vehicle.serial_no || '-'}</div>
                </td>
                <td style="padding: 12px;">${vehicle.vehicle_type || '-'}</td>
                <td style="padding: 12px;">${vehicle.customer_name || '-'}</td>
                <td style="padding: 12px;">
                    <span style="background-color: ${statusBadge.bg}; color: ${statusBadge.text}; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid ${statusBadge.border};">
                        ${vehicle.status || '-'}
                    </span>
                </td>
                <td style="padding: 12px; text-align: center;">
                    ${unresolvedFaultCount > 0 ? `<span style="color: #ef4444; font-weight: 600;">${unresolvedFaultCount}</span>` : '0'}
                    ${resolvedFaultCount > 0 ? `<span style="color: #22c55e; margin-left: 4px;">(${resolvedFaultCount})</span>` : ''}
                </td>
                <td style="padding: 12px; text-align: center; font-size: 12px;">${times.totalControlTime}</td>
                <td style="padding: 12px; text-align: center; font-size: 12px;">${times.totalReworkTime}</td>
                <td style="padding: 12px; text-align: center; font-size: 12px;">${formatDate(vehicle.created_at)}</td>
            </tr>
        `;
    }).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Araç İşlemleri Özet Raporu</title>
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
                .summary-section {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin-bottom: 25px;
                }
                .summary-card {
                    background-color: #f9fafb;
                    border-radius: 8px;
                    padding: 15px;
                    border: 1px solid #e5e7eb;
                    text-align: center;
                }
                .summary-card h3 {
                    font-size: 12px;
                    color: #6b7280;
                    margin: 0 0 8px 0;
                    font-weight: 600;
                }
                .summary-card .value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #111827;
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
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                thead {
                    background-color: #f9fafb;
                }
                th {
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                    font-size: 11px;
                    text-transform: uppercase;
                }
                td {
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
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
                    <p>Kalite Yönetim Sistemi - Araç İşlemleri Özet Raporu</p>
                </div>

                <div class="summary-section">
                    <div class="summary-card">
                        <h3>Toplam Araç</h3>
                        <div class="value">${vehicles.length}</div>
                    </div>
                    <div class="summary-card">
                        <h3>Toplam Hata</h3>
                        <div class="value">${totalFaults}</div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                            Çözülen: ${resolvedFaults} | Bekleyen: ${unresolvedFaults}
                        </div>
                    </div>
                    <div class="summary-card">
                        <h3>Rapor Tarihi</h3>
                        <div class="value" style="font-size: 16px;">${formatDate(new Date())}</div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Durum Dağılımı</h2>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        ${Object.entries(statusStats).map(([status, count]) => {
                            const badge = getStatusBadgeColor(status);
                            return `
                                <div style="background-color: ${badge.bg}; border: 1px solid ${badge.border}; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: ${badge.text}; font-weight: 600; font-size: 13px;">${status}</span>
                                    <span style="color: ${badge.text}; font-weight: 700; font-size: 18px;">${count}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Araç Listesi</h2>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px;">#</th>
                                <th>Şasi/Seri No</th>
                                <th>Araç Tipi</th>
                                <th>Müşteri</th>
                                <th>Durum</th>
                                <th style="width: 80px; text-align: center;">Hata</th>
                                <th style="width: 100px; text-align: center;">Kontrol Süresi</th>
                                <th style="width: 100px; text-align: center;">Yeniden İşlem</th>
                                <th style="width: 100px; text-align: center;">Oluşturma</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vehiclesHtml}
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.
                </div>
            </div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };
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

export const generateVehicleReport = (vehicle, timeline, faults) => {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';
    
    // formatDuration fonksiyonunu import etmek yerine burada basit bir versiyonunu kullanıyoruz
    const formatDuration = (milliseconds) => {
        if (!milliseconds || milliseconds < 0) return '0 dk';
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} gün ${hours % 24} saat`;
        if (hours > 0) return `${hours} saat ${minutes % 60} dk`;
        if (minutes > 0) return `${minutes} dk ${seconds % 60} sn`;
        return `${seconds} sn`;
    };

    const eventTypeLabels = {
        quality_entry: 'Kaliteye Giriş',
        control_start: 'Kontrol Başladı',
        control_end: 'Kontrol Bitti',
        rework_start: 'Yeniden İşlem Başladı',
        rework_end: 'Yeniden İşlem Bitti',
        waiting_for_shipping_info: 'Sevk Bilgisi Bekleniyor',
        ready_to_ship: 'Sevke Hazır',
        shipped: 'Sevk Edildi'
    };
    
    // Kalite sürelerini hesapla
    const calculateQualityTimes = () => {
        let totalControlMillis = 0;
        let totalReworkMillis = 0;
        let waitingForShippingStart = null;
        
        if (timeline && timeline.length > 0) {
            // "Sevk Bilgisi Bekleniyor" durumunun başlangıcını bul
            const waitingEvent = timeline.find(e => e.event_type === 'waiting_for_shipping_info');
            if (waitingEvent) {
                waitingForShippingStart = new Date(waitingEvent.event_timestamp);
            }

            for (let i = 0; i < timeline.length; i++) {
                const currentEvent = timeline[i];
                const currentEventTime = new Date(currentEvent.event_timestamp);
                
                // "Sevk Bilgisi Bekleniyor" durumundan sonraki süreleri sayma
                if (waitingForShippingStart && currentEventTime >= waitingForShippingStart) {
                    continue;
                }

                if (currentEvent.event_type === 'control_start') {
                    const nextEnd = timeline.slice(i + 1).find(e => {
                        const endTime = new Date(e.event_timestamp);
                        if (waitingForShippingStart && endTime >= waitingForShippingStart) {
                            return false;
                        }
                        return e.event_type === 'control_end';
                    });
                    if (nextEnd) {
                        const endTime = waitingForShippingStart && new Date(nextEnd.event_timestamp) > waitingForShippingStart 
                            ? waitingForShippingStart 
                            : new Date(nextEnd.event_timestamp);
                        totalControlMillis += (endTime - currentEventTime);
                    } else if (waitingForShippingStart) {
                        totalControlMillis += (waitingForShippingStart - currentEventTime);
                    }
                } else if (currentEvent.event_type === 'rework_start') {
                    const nextEnd = timeline.slice(i + 1).find(e => {
                        const endTime = new Date(e.event_timestamp);
                        if (waitingForShippingStart && endTime >= waitingForShippingStart) {
                            return false;
                        }
                        return e.event_type === 'rework_end';
                    });
                    if (nextEnd) {
                        const endTime = waitingForShippingStart && new Date(nextEnd.event_timestamp) > waitingForShippingStart 
                            ? waitingForShippingStart 
                            : new Date(nextEnd.event_timestamp);
                        totalReworkMillis += (endTime - currentEventTime);
                    } else if (waitingForShippingStart) {
                        totalReworkMillis += (waitingForShippingStart - currentEventTime);
                    }
                }
            }
        }
        
        // Kalitede geçen toplam süre sadece kontrol başladı-bitti arasındaki sürelerdir
        const totalQualityMillis = totalControlMillis;
        
        return {
            totalControlTime: formatDuration(totalControlMillis),
            totalReworkTime: formatDuration(totalReworkMillis),
            totalQualityTime: formatDuration(totalQualityMillis)
        };
    };
    
    const qualityTimes = calculateQualityTimes();

    const timelineHtml = timeline && timeline.length > 0 ? `
        <div class="section">
            <h2 class="section-title">İşlem Geçmişi</h2>
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; border-left: 3px solid #60a5fa;">
                ${timeline.map((event, index) => `
                    <div style="margin-bottom: ${index < timeline.length - 1 ? '12px' : '0'}; padding-bottom: ${index < timeline.length - 1 ? '12px' : '0'}; border-bottom: ${index < timeline.length - 1 ? '1px dashed #d1d5db' : 'none'};">
                        <p style="margin: 0 0 4px 0; font-size: 13px;"><strong>${eventTypeLabels[event.event_type] || event.event_type}</strong></p>
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Tarih: ${formatDate(event.event_timestamp)}</p>
                        ${event.notes ? `<p style="margin: 0; font-size: 12px; color: #4b5563;">Not: ${event.notes}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const faultsHtml = faults && faults.length > 0 ? `
        <div class="section">
            <h2 class="section-title">Tespit Edilen Hatalar (${faults.length} Adet)</h2>
            ${faults.map((fault, index) => `
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 15px; margin-bottom: ${index < faults.length - 1 ? '12px' : '0'};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #991b1b;">${fault.category?.name || 'Kategori Belirtilmemiş'}</p>
                        <span style="background-color: ${fault.is_resolved ? '#86efac' : '#fde047'}; color: ${fault.is_resolved ? '#15803d' : '#713f12'}; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600;">
                            ${fault.is_resolved ? 'Çözüldü' : 'Bekliyor'}
                        </span>
                    </div>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280;"><strong>Departman:</strong> ${fault.department?.name || '-'}</p>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280;"><strong>Miktar:</strong> ${fault.quantity || '-'}</p>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280;"><strong>Tarih:</strong> ${formatDate(fault.fault_date)}</p>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280;"><strong>Giriş Tarihi:</strong> ${fault.created_at ? formatDate(fault.created_at) : '-'}</p>
                    ${fault.is_resolved && fault.resolved_at ? `<p style="margin: 0 0 6px 0; font-size: 12px; color: #15803d;"><strong>Çözüm Tarihi:</strong> ${formatDate(fault.resolved_at)}</p>` : ''}
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #fecaca;">
                        <p style="margin: 0; font-size: 13px; color: #4b5563;"><strong>Açıklama:</strong></p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #1f2937; white-space: pre-wrap;">${fault.description || '-'}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : `<div class="section">
            <h2 class="section-title">Tespit Edilen Hatalar</h2>
            <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; padding: 15px;">
                <p style="margin: 0; color: #15803d; font-weight: 600; font-size: 14px;">Bu araçta hiç hata kaydı bulunmamaktadır.</p>
            </div>
        </div>`;

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Araç Raporu - ${vehicle.chassis_no}</title>
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
                        <h2>Araç Kalite Raporu</h2>
                        <p>${vehicle.chassis_no} - ${vehicle.serial_no || '-'}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280;">Rapor Tarihi</p>
                        <p style="margin: 2px 0 0; font-size: 13px; font-weight: 600;">${formatDate(new Date())}</p>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Araç Bilgileri</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Şasi Numarası</span>
                            <span class="value">${vehicle.chassis_no || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Seri Numarası</span>
                            <span class="value">${vehicle.serial_no || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Araç Tipi</span>
                            <span class="value">${vehicle.vehicle_type || '-'}</span>
                        </div>
                        ${vehicle.vehicle_brand ? `
                            <div class="info-item">
                                <span class="label">Marka</span>
                                <span class="value" style="color: #1e40af; font-weight: 700;">${vehicle.vehicle_brand}</span>
                            </div>
                        ` : ''}
                        <div class="info-item">
                            <span class="label">Müşteri</span>
                            <span class="value">${vehicle.customer_name || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Durum</span>
                            <span class="value">${vehicle.status || '-'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">DMO Durumu</span>
                            <span class="value">${vehicle.dmo_status || '-'}</span>
                        </div>
                        ${vehicle.delivery_due_date ? `
                            <div class="info-item">
                                <span class="label">Termin Tarihi</span>
                                <span class="value" style="color: #d97706; font-weight: 600;">${formatDate(vehicle.delivery_due_date)}</span>
                            </div>
                        ` : ''}
                        <div class="info-item">
                            <span class="label">Oluşturulma</span>
                            <span class="value">${formatDate(vehicle.created_at)}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Son Güncelleme</span>
                            <span class="value">${formatDate(vehicle.updated_at)}</span>
                        </div>
                    </div>
                </div>
                
                ${vehicle.notes ? `
                    <div class="section">
                        <h2 class="section-title">Araç Notları</h2>
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 15px;">
                            <p style="margin: 0; font-size: 13px; color: #92400e; white-space: pre-wrap;">${vehicle.notes}</p>
                        </div>
                    </div>
                ` : ''}

                ${timelineHtml}
                
                <div class="section">
                    <h2 class="section-title">Kalite Süre Özeti</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Toplam Kontrol Süresi</span>
                            <span class="value">${qualityTimes.totalControlTime}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Toplam Yeniden İşlem Süresi</span>
                            <span class="value">${qualityTimes.totalReworkTime}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Kalitede Geçen Toplam Süre</span>
                            <span class="value" style="color: #1e40af; font-weight: 700;">${qualityTimes.totalQualityTime}</span>
                        </div>
                    </div>
                </div>
                
                ${faultsHtml}
                
                <div class="footer">
                    Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.
                </div>
            </div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };
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