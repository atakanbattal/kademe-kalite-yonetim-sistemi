import { logoCache, imageUrlToBase64, preloadLogos, getLogoUrl } from './reportUtils';

const generatePrintableReport = (record) => {
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';
    
    // Metin alanlarını formatla (camelCase kaldırıldı)
    const formatText = (text) => typeof text === 'string' ? text : (text || '-');

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
    
    // Türkçe karakterleri normalize et (Unicode normalization)
    const normalizeTurkishChars = (text) => {
        if (!text || typeof text !== 'string') return text;
        
        // Unicode normalize et (NFD -> NFC) - birleşik karakterleri düzelt
        let normalized = text.normalize('NFC');
        
        // Bozuk Türkçe karakterleri düzelt
        const fixes = {
            // Bozuk İ karakterleri
            'i̇': 'i',
            'İ̇': 'İ',
            'İ': 'İ',
            'ı̇': 'ı',
            // Bozuk diğer karakterler
            'ğ': 'ğ',
            'Ğ': 'Ğ',
            'ü': 'ü',
            'Ü': 'Ü',
            'ö': 'ö',
            'Ö': 'Ö',
            'ş': 'ş',
            'Ş': 'Ş',
            'ç': 'ç',
            'Ç': 'Ç'
        };
        
        Object.keys(fixes).forEach(broken => {
            normalized = normalized.replace(new RegExp(broken, 'g'), fixes[broken]);
        });
        
        return normalized;
    };
    
    // Problem tanımı için profesyonel formatlama
    const formatProblemDescription = (text) => {
        if (!text || typeof text !== 'string') return '-';
        
        // Önce Türkçe karakterleri normalize et
        text = normalizeTurkishChars(text);
        
        // HTML escape yap
        let escaped = escapeHtml(text);
        
        // Satır geçişlerini koru - boş satırları da koru
        let lines = escaped.split('\n');
        let formattedLines = [];
        let inList = false;
        let currentParagraph = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let trimmedLine = line.trim();
            
            // Boş satır - paragraf sonu veya boşluk
            if (!trimmedLine) {
                // Önceki paragrafı bitir
                if (currentParagraph.length > 0) {
                    formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
                    currentParagraph = [];
                }
                // Liste durumunu bitir
                if (inList) {
                    formattedLines.push('</ul>');
                    inList = false;
                }
                // Boş satırı koru (küçük bir boşluk olarak)
                formattedLines.push('<div style="height: 4px;"></div>');
                continue;
            }
            
            // Başlık tespiti: "Başlık:" veya "Başlık: Değer" formatı
            const headingMatch = trimmedLine.match(/^([A-ZÇĞİÖŞÜ][^:]+):\s*(.*)$/);
            if (headingMatch) {
                const [, title, value] = headingMatch;
                
                // Önceki paragrafı bitir
                if (currentParagraph.length > 0) {
                    formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
                    currentParagraph = [];
                }
                
                // Liste durumunu bitir
                if (inList) {
                    formattedLines.push('</ul>');
                    inList = false;
                }
                
                // Başlığı formatla - daha küçük ve profesyonel
                if (value && value.trim()) {
                    formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px;"><strong style="color: #2563eb; font-weight: 600; font-size: 13px;">${title}:</strong> <span style="color: #374151; font-size: 13px;">${value}</span></div>`);
                } else {
                    formattedLines.push(`<div style="margin-top: 10px; margin-bottom: 4px;"><strong style="color: #2563eb; font-weight: 600; font-size: 13px;">${title}:</strong></div>`);
                }
                continue;
            }
            
            // Liste öğesi tespiti: "* ", "- ", veya sayısal "1. ", "2. "
            const listMatch = trimmedLine.match(/^([*•-]|\d+[.,])\s+(.+)$/);
            if (listMatch) {
                // Önceki paragrafı bitir
                if (currentParagraph.length > 0) {
                    formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
                    currentParagraph = [];
                }
                
                if (!inList) {
                    formattedLines.push('<ul style="margin: 4px 0; padding-left: 20px; list-style-type: disc;">');
                    inList = true;
                }
                
                const itemText = listMatch[2];
                formattedLines.push(`<li style="margin-bottom: 4px; line-height: 1.5; color: #374151; font-size: 13px;">${itemText}</li>`);
                continue;
            }
            
            // Liste durumunu bitir
            if (inList) {
                formattedLines.push('</ul>');
                inList = false;
            }
            
            // Normal metin - paragrafa ekle
            currentParagraph.push(trimmedLine);
        }
        
        // Son paragrafı ekle
        if (currentParagraph.length > 0) {
            formattedLines.push(`<p style="margin: 6px 0; line-height: 1.5; color: #374151; font-size: 13px;">${currentParagraph.join(' ')}</p>`);
        }
        
        // Son liste durumunu bitir
        if (inList) {
            formattedLines.push('</ul>');
        }
        
        return formattedLines.join('\n');
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
                    width: 297mm;
                    min-height: 210mm;
                    margin: 0;
                    padding: 10mm;
                    box-sizing: border-box;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 10px;
                    margin-bottom: 12px;
                }
                .header h1 {
                    font-size: 22px;
                    font-weight: 700;
                    color: #111827;
                    margin: 0;
                }
                .header p {
                    font-size: 13px;
                    color: #6b7280;
                    margin: 3px 0 0;
                }
                .report-title-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 15px;
                }
                .report-title h2 {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                }
                .report-title p {
                    font-size: 13px;
                    color: #4b5563;
                    margin: 3px 0 0;
                }

                .section {
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e40af;
                    border-bottom: 2px solid #bfdbfe;
                    padding-bottom: 4px;
                    margin-bottom: 10px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                .info-item {
                    background-color: #f9fafb;
                    border-radius: 4px;
                    padding: 6px;
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
                    font-size: 12px;
                    line-height: 1.5;
                    margin: 0;
                    padding: 6px;
                    background-color: #ffffff;
                    border-radius: 4px;
                    border: 1px solid #e5e7eb;
                }

                .step-section {
                    margin-bottom: 12px;
                }
                .step-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #1e40af;
                    margin: 0 0 8px 0;
                }
                .step-content {
                    background-color: #f9fafb;
                    border-left: 3px solid #60a5fa;
                    padding: 12px;
                    border-radius: 0 6px 6px 0;
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
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 11px;
                    color: #9ca3af;
                }
                @media print {
                    /* Print için renkleri koru */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }

                    body { 
                        background-color: white !important; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        width: 210mm !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    .page { 
                        margin: 0 !important; 
                        box-shadow: none !important; 
                        border: none !important;
                        width: 100% !important;
                        padding: 0 !important;
                    }
                    
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }

                    /* Section'lar bölünmesin */
                    .section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .section-title {
                        page-break-after: avoid;
                        break-after: avoid;
                    }

                    /* Step section'lar bölünmesin */
                    .step-section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Info grid ve items bölünmesin */
                    .info-grid {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .info-item {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Problem description bölünmesin */
                    .problem-description {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Image grid ve images bölünmesin */
                    .image-grid {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .image-container {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Footer bölünmesin */
                    .footer {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Link URL'lerini gizle */
                    a:link:after,
                    a:visited:after,
                    a[href]:after,
                    a[href]::after {
                        content: "" !important;
                        display: none !important;
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
                    <div class="problem-description">${formatProblemDescription(record.description || record.problem_definition || '-')}</div>
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

export const generateVehicleSummaryReport = async (vehicles, timelineByVehicle, faultsByVehicle, selectedStatuses = []) => {
    // Logoları önceden yükle (cache'de yoksa) - uygunsuzluk yönetimindeki gibi
    await preloadLogos();
    
    // Logo base64 - önce yerel dosyadan çek (logo.png), yoksa harici URL'den
    const localLogoUrl = getLogoUrl('logo.png');
    const mainLogoUrl = logoCache[localLogoUrl] 
        ? localLogoUrl
        : (logoCache[getLogoUrl('kademe-logo.png')] 
            ? getLogoUrl('kademe-logo.png')
            : 'https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png');
    const mainLogoBase64 = logoCache[mainLogoUrl] || mainLogoUrl;
    
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
                    } else {
                        // Devam eden kontrol - şu anki zamana kadar hesapla
                        totalControlMillis += (new Date() - currentEventTime);
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
                    } else {
                        // Devam eden yeniden işlem - şu anki zamana kadar hesapla
                        totalReworkMillis += (new Date() - currentEventTime);
                    }
                }
            }
        }
        
        return {
            totalControlTime: formatDuration(totalControlMillis),
            totalReworkTime: formatDuration(totalReworkMillis),
            totalQualityTime: formatDuration(totalControlMillis + totalReworkMillis)
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

        const dmoStatus = vehicle.dmo_status || '-';
        const dmoBadgeColor = dmoStatus === 'DMO Geçti' ? { bg: '#dcfce7', text: '#166534', border: '#22c55e' } :
                              dmoStatus === 'DMO Kaldı' ? { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' } :
                              dmoStatus === 'DMO Bekliyor' ? { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' } :
                              { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' };

        return `
            <tr style="page-break-inside: avoid; border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px 8px; text-align: center; font-weight: 600;"><span style="display: none;">${index + 1}</span></td>
                <td style="padding: 12px 8px;">
                    <div style="font-weight: 600; color: #111827;">${vehicle.chassis_no || '-'}</div>
                    <div style="font-size: 11px; color: #6b7280;">${vehicle.serial_no || '-'}</div>
                </td>
                <td style="padding: 12px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${vehicle.vehicle_type || '-'}</td>
                <td style="padding: 12px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${vehicle.customer_name || '-'}</td>
                <td style="padding: 12px 8px; overflow: hidden; white-space: nowrap;">
                    <span style="background-color: ${statusBadge.bg}; color: ${statusBadge.text}; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; border: 1px solid ${statusBadge.border}; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                        ${vehicle.status || '-'}
                    </span>
                </td>
                <td style="padding: 12px 8px; overflow: hidden; white-space: nowrap;">
                    <span style="background-color: ${dmoBadgeColor.bg}; color: ${dmoBadgeColor.text}; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; border: 1px solid ${dmoBadgeColor.border}; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                        ${dmoStatus}
                    </span>
                </td>
                <td style="padding: 12px 8px; text-align: center; white-space: nowrap;">
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                        ${unresolvedFaultCount > 0 ? `
                            <div style="display: inline-flex; align-items: center; gap: 4px; background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; border: 1px solid #ef4444; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                                <span style="display: inline-block; width: 6px; height: 6px; background-color: #ef4444; border-radius: 50%; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></span>
                                Bekleyen: ${unresolvedFaultCount}
                            </div>
                        ` : `
                            <div style="display: inline-flex; align-items: center; gap: 4px; background-color: #f3f4f6; color: #6b7280; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; border: 1px solid #d1d5db; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                                <span style="display: inline-block; width: 6px; height: 6px; background-color: #9ca3af; border-radius: 50%; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></span>
                                Bekleyen: 0
                            </div>
                        `}
                        ${resolvedFaultCount > 0 ? `
                            <div style="display: inline-flex; align-items: center; gap: 4px; background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; border: 1px solid #22c55e; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                                <span style="display: inline-block; width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></span>
                                Çözülen: ${resolvedFaultCount}
                            </div>
                        ` : `
                            <div style="display: inline-flex; align-items: center; gap: 4px; background-color: #f3f4f6; color: #6b7280; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; border: 1px solid #d1d5db; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                                <span style="display: inline-block; width: 6px; height: 6px; background-color: #9ca3af; border-radius: 50%; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></span>
                                Çözülen: 0
                            </div>
                        `}
                        ${(unresolvedFaultCount + resolvedFaultCount) > 0 ? `
                            <div style="margin-top: 2px; font-size: 9px; color: #6b7280; font-weight: 500;">
                                Toplam: ${unresolvedFaultCount + resolvedFaultCount}
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td style="padding: 12px 8px; text-align: center; font-size: 11px; white-space: nowrap;">${times.totalReworkTime}</td>
            </tr>
        `;
    }).join('');

    // Rapor numarası oluştur
    const reportNo = `ARAC-${formatDate(new Date()).replace(/\./g, '')}-${Date.now().toString().slice(-6)}`;
    const reportDate = formatDate(new Date());

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
                    padding: 10mm;
                    box-sizing: border-box;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 15px;
                    align-items: center;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                    page-break-inside: avoid;
                    page-break-after: avoid;
                }
                .header-logo {
                    height: 50px;
                    width: auto;
                }
                .company-title {
                    text-align: center;
                }
                .company-title h1 {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0;
                    color: #111827;
                }
                .company-title p {
                    font-size: 12px;
                    margin: 0;
                    color: #4b5563;
                }
                .print-info {
                    text-align: right;
                    font-size: 9px;
                    color: #4b5563;
                    line-height: 1.4;
                    white-space: nowrap;
                }
                .meta-box {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 10px 12px;
                    background-color: #f9fafb;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    border: 1px solid #e5e7eb;
                    page-break-inside: avoid;
                }
                .meta-item {
                    font-size: 10px;
                    color: #374151;
                    padding: 0;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    line-height: 1.6;
                }
                .meta-item strong {
                    color: #1f2937;
                    font-weight: 600;
                    margin-right: 6px;
                }
                .summary-section {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 15px;
                }
                .summary-card {
                    background-color: #f9fafb;
                    border-radius: 6px;
                    padding: 12px;
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
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .section-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: white;
                    padding: 6px 10px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    page-break-after: avoid;
                }
                .section-title.blue {
                    background-color: #1e40af;
                }
                .section-title.red {
                    background-color: #dc2626;
                }
                .section-title.green {
                    background-color: #059669;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    table-layout: fixed;
                    counter-reset: row-number 0;
                }
                tbody {
                    counter-reset: row-number 0;
                }
                tbody tr {
                    counter-increment: row-number;
                }
                tbody tr td:first-child {
                    position: relative;
                    text-align: center;
                }
                tbody tr td:first-child::before {
                    content: counter(row-number);
                    font-weight: 600;
                    display: inline-block;
                }
                thead {
                    background-color: #f9fafb;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                }
                th {
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                    font-size: 11px;
                    text-transform: uppercase;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    background-color: #f9fafb;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                }
                td {
                    padding: 12px 8px;
                    border-bottom: 1px solid #e5e7eb;
                    overflow: hidden;
                    word-wrap: break-word;
                    vertical-align: middle;
                }
                td:first-child {
                    text-align: center;
                }
                td:first-child::before {
                    display: block;
                }
                .footer {
                    text-align: center;
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 11px;
                    color: #9ca3af;
                }
                @media print {
                    * {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    body { 
                        background-color: white !important; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    .page { 
                        margin: 0 !important; 
                        box-shadow: none !important; 
                        border: none !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    table {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    thead {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    th, td {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="report-logo">
                        <img src="${mainLogoBase64}" alt="Kademe Logo" class="header-logo" />
                    </div>
                    <div class="company-title">
                        <h1>KADEME A.Ş.</h1>
                        <p>Kalite Yönetim Sistemi</p>
                    </div>
                    <div class="print-info">
                        Yazdır: ${reportNo.split('-').pop()}<br>
                        Yazdırılma: ${reportDate} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <div class="meta-box">
                    <div class="meta-item"><strong>Belge Türü:</strong> Araç İşlemleri Özet Raporu</div>
                    <div class="meta-item"><strong>No:</strong> ${reportNo}</div>
                    <div class="meta-item"><strong>Revizyon:</strong> 0</div>
                    <div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
                    <div class="meta-item"><strong>Yayın Tarihi:</strong> ${reportDate}</div>
                    <div class="meta-item"><strong>Toplam Araç:</strong> ${vehicles.length}</div>
                    ${selectedStatuses && selectedStatuses.length > 0 ? `
                        <div class="meta-item" style="grid-column: 1 / -1;"><strong>Seçilen Durumlar:</strong> ${selectedStatuses.join(', ')}</div>
                    ` : ''}
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
                    <h2 class="section-title blue">1. DURUM DAĞILIMI</h2>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        ${Object.entries(statusStats).map(([status, count]) => {
                            const badge = getStatusBadgeColor(status);
                            return `
                                <div style="background-color: ${badge.bg}; border: 1px solid ${badge.border}; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                                    <span style="color: ${badge.text}; font-weight: 600; font-size: 13px; print-color-adjust: exact; -webkit-print-color-adjust: exact;">${status}</span>
                                    <span style="color: ${badge.text}; font-weight: 700; font-size: 18px; print-color-adjust: exact; -webkit-print-color-adjust: exact;">${count}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title blue">2. ARAÇ LİSTESİ</h2>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 3%;">#</th>
                                <th style="width: 12%;">Şasi/Seri No</th>
                                <th style="width: 12%;">Araç Tipi</th>
                                <th style="width: 15%;">Müşteri</th>
                                <th style="width: 15%;">Durum</th>
                                <th style="width: 12%;">DMO Durumu</th>
                                <th style="width: 16%; text-align: center;">Hata Durumu</th>
                                <th style="width: 15%; text-align: center;">Yeniden İşlem</th>
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
        </body>
        </html>
    `;

    // Mevcut pencereyi kapat ve yeni bir pencere aç (iç içe açılmayı önlemek için)
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Eğer önceki bir print penceresi açıksa kapat
    if (window.printWindow && !window.printWindow.closed) {
        window.printWindow.close();
    }
    
    const printWindow = window.open(url, '_blank', 'width=800,height=600');
    if (printWindow) {
        window.printWindow = printWindow; // Referansı sakla
        printWindow.addEventListener('load', () => {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        });
        printWindow.addEventListener('afterprint', () => {
            URL.revokeObjectURL(url);
            if (window.printWindow) {
                window.printWindow = null;
            }
        });
    }
};

export const generateVehicleReport = async (vehicle, timeline, faults, equipment = null) => {
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
                    } else {
                        // Devam eden kontrol - şu anki zamana kadar hesapla
                        totalControlMillis += (new Date() - currentEventTime);
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
                    } else {
                        // Devam eden yeniden işlem - şu anki zamana kadar hesapla
                        totalReworkMillis += (new Date() - currentEventTime);
                    }
                }
            }
        }
        
        // Kalitede geçen toplam süre kontrol ve yeniden işlem sürelerinin toplamıdır
        const totalQualityMillis = totalControlMillis + totalReworkMillis;
        
        return {
            totalControlTime: formatDuration(totalControlMillis),
            totalReworkTime: formatDuration(totalReworkMillis),
            totalQualityTime: formatDuration(totalQualityMillis)
        };
    };
    
    const qualityTimes = calculateQualityTimes();

    const timelineHtml = timeline && timeline.length > 0 ? `
        <div class="section">
            <h2 class="section-title blue">${vehicle.notes ? '3' : '2'}. İŞLEM GEÇMİŞİ</h2>
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; border-left: 3px solid #60a5fa; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                ${timeline.map((event, index) => `
                    <div class="timeline-item" style="margin-bottom: ${index < timeline.length - 1 ? '12px' : '0'}; padding-bottom: ${index < timeline.length - 1 ? '12px' : '0'}; border-bottom: ${index < timeline.length - 1 ? '1px dashed #d1d5db' : 'none'};">
                        <p style="margin: 0 0 4px 0; font-size: 13px;"><strong>${eventTypeLabels[event.event_type] || event.event_type}</strong></p>
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Tarih: ${formatDate(event.event_timestamp)}</p>
                        ${event.notes ? `<p style="margin: 0; font-size: 12px; color: #4b5563;">Not: ${event.notes}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    // Section numarasını dinamik olarak hesapla
    let sectionNum = 1;
    if (vehicle.notes) sectionNum++;
    if (timeline && timeline.length > 0) sectionNum++;
    sectionNum++; // Kalite Süre Özeti
    if (equipment && equipment.id) sectionNum++;
    const faultsSectionNum = sectionNum;

    const faultsHtml = faults && faults.length > 0 ? `
        <div class="section">
            <h2 class="section-title red">${faultsSectionNum}. TESPİT EDİLEN HATALAR (${faults.length} Adet)</h2>
            ${faults.map((fault, index) => `
                <div class="fault-card" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 15px; margin-bottom: ${index < faults.length - 1 ? '12px' : '0'}; print-color-adjust: exact; -webkit-print-color-adjust: exact; color-adjust: exact;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #991b1b;">${fault.category?.name || 'Kategori Belirtilmemiş'}</p>
                        <span style="background-color: ${fault.is_resolved ? '#86efac' : '#fde047'}; color: ${fault.is_resolved ? '#15803d' : '#713f12'}; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; print-color-adjust: exact; -webkit-print-color-adjust: exact; color-adjust: exact;">
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
            <h2 class="section-title green">${faultsSectionNum}. TESPİT EDİLEN HATALAR</h2>
            <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; padding: 15px; print-color-adjust: exact; -webkit-print-color-adjust: exact; color-adjust: exact;">
                <p style="margin: 0; color: #15803d; font-weight: 600; font-size: 14px;">Bu araçta hiç hata kaydı bulunmamaktadır.</p>
            </div>
        </div>`;

    // Logoları önceden yükle (cache'de yoksa) - uygunsuzluk yönetimindeki gibi
    await preloadLogos();
    
    // Logo base64 - önce yerel dosyadan çek (logo.png), yoksa harici URL'den
    const localLogoUrl = getLogoUrl('logo.png');
    const mainLogoUrl = logoCache[localLogoUrl] 
        ? localLogoUrl
        : (logoCache[getLogoUrl('kademe-logo.png')] 
            ? getLogoUrl('kademe-logo.png')
            : 'https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png');
    const mainLogoBase64 = logoCache[mainLogoUrl] || mainLogoUrl;
    
    // Rapor numarası oluştur
    const reportNo = `ARAC-${vehicle.chassis_no || 'N/A'}-${Date.now().toString().slice(-6)}`;
    const reportDate = formatDate(new Date());

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
                    padding: 10mm;
                    box-sizing: border-box;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 15px;
                    align-items: center;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                    page-break-inside: avoid;
                    page-break-after: avoid;
                }
                .header-logo {
                    height: 50px;
                    width: auto;
                }
                .company-title {
                    text-align: center;
                }
                .company-title h1 {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0;
                    color: #111827;
                }
                .company-title p {
                    font-size: 12px;
                    margin: 0;
                    color: #4b5563;
                }
                .print-info {
                    text-align: right;
                    font-size: 9px;
                    color: #4b5563;
                    line-height: 1.4;
                    white-space: nowrap;
                }
                .section {
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .meta-box {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 10px 12px;
                    background-color: #f9fafb;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    border: 1px solid #e5e7eb;
                    page-break-inside: avoid;
                }
                .meta-item {
                    font-size: 10px;
                    color: #374151;
                    padding: 0;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    line-height: 1.6;
                }
                .meta-item strong {
                    color: #1f2937;
                    font-weight: 600;
                    margin-right: 6px;
                }
                .section-title {
                    font-size: 13px;
                    font-weight: 700;
                    color: white;
                    padding: 6px 10px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    page-break-after: avoid;
                }
                .section-title.blue {
                    background-color: #1e40af;
                }
                .section-title.red {
                    background-color: #dc2626;
                }
                .section-title.green {
                    background-color: #059669;
                }
                .fault-card {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin-bottom: 12px;
                }
                .timeline-item {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                .info-item {
                    background-color: #f9fafb;
                    border-radius: 4px;
                    padding: 6px;
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
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 11px;
                    color: #9ca3af;
                }
                @media print {
                    * {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                    }
                    body { 
                        background-color: white; 
                        margin: 0; 
                        padding: 0;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .page { 
                        margin: 0; 
                        box-shadow: none; 
                        border: none;
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .fault-card {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .timeline-item {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="report-logo">
                        <img src="${mainLogoBase64}" alt="Kademe Logo" class="header-logo" />
                    </div>
                    <div class="company-title">
                        <h1>KADEME A.Ş.</h1>
                        <p>Kalite Yönetim Sistemi</p>
                    </div>
                    <div class="print-info">
                        Yazdır: ${reportNo.split('-').pop()}<br>
                        Yazdırılma: ${formatDate(new Date())} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <div class="meta-box">
                    <div class="meta-item"><strong>Belge Türü:</strong> Araç Kalite Raporu</div>
                    <div class="meta-item"><strong>No:</strong> ${reportNo}</div>
                    <div class="meta-item"><strong>Revizyon:</strong> 0</div>
                    <div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
                    <div class="meta-item"><strong>Yayın Tarihi:</strong> ${reportDate}</div>
                    <div class="meta-item"><strong>Durum:</strong> ${vehicle.status || '-'}</div>
                </div>

                <div class="section">
                    <h2 class="section-title blue">1. ARAÇ BİLGİLERİ</h2>
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
                        <h2 class="section-title blue">2. ARAÇ NOTLARI</h2>
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 15px; print-color-adjust: exact; -webkit-print-color-adjust: exact; color-adjust: exact;">
                            <p style="margin: 0; font-size: 13px; color: #92400e; white-space: pre-wrap;">${vehicle.notes}</p>
                        </div>
                    </div>
                ` : ''}

                ${timelineHtml}
                
                <div class="section">
                    <h2 class="section-title blue">${timeline && timeline.length > 0 ? (vehicle.notes ? '4' : '3') : (vehicle.notes ? '3' : '2')}. KALİTE SÜRE ÖZETİ</h2>
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
                
                ${equipment && equipment.id ? `
                    <div class="section">
                        <h2 class="section-title blue">${timeline && timeline.length > 0 ? (vehicle.notes ? '5' : '4') : (vehicle.notes ? '4' : '3')}. ÖLÇÜM EKİPMANI BİLGİLERİ</h2>
                        <div class="info-grid">
                            ${equipment.name ? `
                                <div class="info-item">
                                    <span class="label">Ekipman Adı</span>
                                    <span class="value">${equipment.name}</span>
                                </div>
                            ` : ''}
                            ${equipment.brand_model ? `
                                <div class="info-item">
                                    <span class="label">Marka/Model</span>
                                    <span class="value">${equipment.brand_model}</span>
                                </div>
                            ` : ''}
                            ${equipment.measurement_range ? `
                                <div class="info-item">
                                    <span class="label">Ölçüm Aralığı</span>
                                    <span class="value">${equipment.measurement_range}</span>
                                </div>
                            ` : ''}
                            ${equipment.measurement_uncertainty ? `
                                <div class="info-item">
                                    <span class="label">Ölçüm Belirsizliği</span>
                                    <span class="value">${equipment.measurement_uncertainty.startsWith('±') ? equipment.measurement_uncertainty : `± ${equipment.measurement_uncertainty}`}</span>
                                </div>
                            ` : ''}
                            ${equipment.assignment ? `
                                <div class="info-item">
                                    <span class="label">Zimmet Durumu</span>
                                    <span class="value">${equipment.assignment.is_assigned ? `Zimmetli - ${equipment.assignment.personnel_name || '-'}` : 'Zimmetli Değil'}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                ${faultsHtml}
                
                <div class="footer">
                    Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.
                </div>
            </div>
        </body>
        </html>
    `;

    // Mevcut pencereyi kapat ve yeni bir pencere aç (iç içe açılmayı önlemek için)
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Eğer önceki bir print penceresi açıksa kapat
    if (window.printWindow && !window.printWindow.closed) {
        window.printWindow.close();
    }
    
    const printWindow = window.open(url, '_blank', 'width=800,height=600');
    if (printWindow) {
        window.printWindow = printWindow; // Referansı sakla
        printWindow.addEventListener('load', () => {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        });
        printWindow.addEventListener('afterprint', () => {
            URL.revokeObjectURL(url);
            if (window.printWindow) {
                window.printWindow = null;
            }
        });
    }
};
export const generateComplaintReport = async (complaint, analyses = [], actions = []) => {
    await preloadLogos();
    const localLogoUrl = getLogoUrl('logo.png');
    const mainLogoUrl = logoCache[localLogoUrl] ? localLogoUrl : (logoCache[getLogoUrl('kademe-logo.png')] ? getLogoUrl('kademe-logo.png') : 'https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png');
    const mainLogoBase64 = logoCache[mainLogoUrl] || mainLogoUrl;
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';
    const escapeHtml = (text) => {
        if (!text || typeof text !== 'string') return text || '-';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    // Açıklamayı paragraflara böl ve formatla - görseldeki gibi profesyonel formatlama
    const formatDescription = (text) => {
        if (!text || typeof text !== 'string') return '<p style="color: #9ca3af; font-style: italic;">Açıklama bulunmamaktadır.</p>';
        const escaped = escapeHtml(text);
        
        // Önce çift satır sonlarını paragraf ayırıcı olarak kullan
        let paragraphs = escaped.split(/\n\s*\n+/).filter(p => p.trim());
        
        // Eğer çift satır sonu yoksa, tek satır sonlarını kullan
        if (paragraphs.length === 1) {
            paragraphs = escaped.split(/\n/).filter(p => p.trim());
        }
        
        if (paragraphs.length === 0) return escaped;
        
        // Her paragrafı formatla
        return paragraphs.map(p => {
            const trimmed = p.trim();
            // Eğer paragraf başlık gibi görünüyorsa (büyük harfle başlıyor ve kısa ise)
            if (trimmed.length < 100 && /^[A-ZÇĞİÖŞÜ]/.test(trimmed)) {
                return `<p style="margin: 0 0 8px 0; line-height: 1.6; font-size: 12px; font-weight: 600; color: #1f2937;">${trimmed}</p>`;
            }
            // Normal paragraf
            return `<p style="margin: 0 0 12px 0; line-height: 1.7; font-size: 12px; color: #374151; text-align: justify;">${trimmed.replace(/\n/g, ' ')}</p>`;
        }).join('');
    };
    const getSeverityBadge = (severity) => {
        const colors = { 'Kritik': { bg: '#dc2626', text: '#ffffff' }, 'Yüksek': { bg: '#ea580c', text: '#ffffff' }, 'Orta': { bg: '#f59e0b', text: '#ffffff' }, 'Düşük': { bg: '#84cc16', text: '#ffffff' } };
        const c = colors[severity] || { bg: '#6b7280', text: '#ffffff' };
        return `<span style="background-color: ${c.bg}; color: ${c.text}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block;">${severity}</span>`;
    };
    const getStatusBadge = (status) => {
        const colors = { 'Açık': { bg: '#fde047', text: '#713f12' }, 'Analiz Aşamasında': { bg: '#fbbf24', text: '#78350f' }, 'Aksiyon Alınıyor': { bg: '#60a5fa', text: '#1e3a8a' }, 'Doğrulama Bekleniyor': { bg: '#a78bfa', text: '#4c1d95' }, 'Kapalı': { bg: '#86efac', text: '#15803d' }, 'İptal': { bg: '#fca5a5', text: '#b91c1c' } };
        const c = colors[status] || { bg: '#e5e7eb', text: '#4b5563' };
        return `<span style="background-color: ${c.bg}; color: ${c.text}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block;">${status}</span>`;
    };
    // Analizler HTML'i oluştur
    const analysesHtml = analyses && analyses.length > 0 ? analyses.map((analysis, idx) => {
        let analysisContent = '';
        if (analysis.analysis_type === '5N1K') {
            analysisContent = `
                ${analysis.what_ne ? `<p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Ne oldu?</strong><br><span style="margin-left: 0;">${escapeHtml(analysis.what_ne)}</span></p>` : ''}
                ${analysis.where_nerede ? `<p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Nerede oldu?</strong><br><span style="margin-left: 0;">${escapeHtml(analysis.where_nerede)}</span></p>` : ''}
                ${analysis.when_ne_zaman ? `<p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Ne zaman oldu?</strong><br><span style="margin-left: 0;">${escapeHtml(analysis.when_ne_zaman)}</span></p>` : ''}
                ${analysis.who_kim ? `<p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Kim tespit etti?</strong><br><span style="margin-left: 0;">${escapeHtml(analysis.who_kim)}</span></p>` : ''}
                ${analysis.why_neden ? `<p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Neden oldu?</strong><br><span style="margin-left: 0;">${escapeHtml(analysis.why_neden)}</span></p>` : ''}
                ${analysis.how_nasil ? `<p style="margin: 0 0 10px 0;"><strong style="color: #1e40af;">Nasıl tespit edildi?</strong><br><span style="margin-left: 0;">${escapeHtml(analysis.how_nasil)}</span></p>` : ''}
            `;
        } else if (analysis.analysis_type === '5 Neden') {
            analysisContent = `
                ${analysis.why_1 ? `<p style="margin: 0 0 8px 0;"><strong style="color: #1e40af;">1. Neden:</strong> ${escapeHtml(analysis.why_1)}</p>` : ''}
                ${analysis.why_2 ? `<p style="margin: 0 0 8px 0;"><strong style="color: #1e40af;">2. Neden:</strong> ${escapeHtml(analysis.why_2)}</p>` : ''}
                ${analysis.why_3 ? `<p style="margin: 0 0 8px 0;"><strong style="color: #1e40af;">3. Neden:</strong> ${escapeHtml(analysis.why_3)}</p>` : ''}
                ${analysis.why_4 ? `<p style="margin: 0 0 8px 0;"><strong style="color: #1e40af;">4. Neden:</strong> ${escapeHtml(analysis.why_4)}</p>` : ''}
                ${analysis.why_5 ? `<p style="margin: 0 0 12px 0;"><strong style="color: #1e40af;">5. Neden:</strong> ${escapeHtml(analysis.why_5)}</p>` : ''}
                ${analysis.root_cause ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 2px solid #3b82f6; background-color: #eff6ff; padding: 12px; border-radius: 4px;"><strong style="color: #1e40af; font-size: 13px;">Kök Neden:</strong><p style="margin-top: 6px; margin-bottom: 0;">${formatDescription(analysis.root_cause)}</p></div>` : ''}
            `;
        } else if (analysis.analysis_summary) {
            analysisContent = formatDescription(analysis.analysis_summary);
        }
        return `
            <div class="analysis-item" style="margin-bottom: 20px; padding: 18px; background-color: #ffffff; border: 1px solid #e5e7eb; border-left: 4px solid #3b82f6; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
                    <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e40af;">${escapeHtml(analysis.analysis_type)} Analizi</h4>
                    <span style="font-size: 11px; color: #6b7280; background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${formatDate(analysis.analysis_date)}</span>
                </div>
                <div style="font-size: 12px; line-height: 1.7; color: #374151;">
                    ${analysisContent}
                    ${analysis.analysis_summary && analysis.analysis_type !== '5N1K' && analysis.analysis_type !== '5 Neden' ? `<div style="margin-top: 12px;"><strong style="color: #1e40af;">Analiz Özeti:</strong><div style="margin-top: 8px;">${formatDescription(analysis.analysis_summary)}</div></div>` : ''}
                    ${analysis.immediate_action ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;"><strong style="color: #dc2626; font-size: 13px;">Anlık Aksiyon:</strong><div style="margin-top: 8px;">${formatDescription(analysis.immediate_action)}</div></div>` : ''}
                    ${analysis.preventive_action ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;"><strong style="color: #059669; font-size: 13px;">Önleyici Aksiyon:</strong><div style="margin-top: 8px;">${formatDescription(analysis.preventive_action)}</div></div>` : ''}
                </div>
            </div>
        `;
    }).join('') : '<div style="padding: 20px; text-align: center; color: #9ca3af; font-style: italic; background-color: #f9fafb; border-radius: 4px;">Henüz analiz kaydı bulunmamaktadır.</div>';
    
    // Aksiyonlar HTML'i oluştur
    const actionsHtml = actions && actions.length > 0 ? actions.map((action, idx) => {
        const getStatusColor = (status) => {
            const colors = {
                'Planlandı': { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
                'Devam Ediyor': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
                'Tamamlandı': { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
                'İptal': { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
                'Ertelendi': { bg: '#f3f4f6', text: '#4b5563', border: '#9ca3af' }
            };
            return colors[action.status] || colors['Planlandı'];
        };
        const statusColor = getStatusColor(action.status);
        return `
            <div class="action-item" style="margin-bottom: 20px; padding: 18px; background-color: #ffffff; border: 1px solid #e5e7eb; border-left: 4px solid ${statusColor.border}; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1f2937;">${escapeHtml(action.action_title)}</h4>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background-color: ${statusColor.bg}; color: ${statusColor.text}; border: 1px solid ${statusColor.border};">
                                ${escapeHtml(action.action_type)}
                            </span>
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background-color: ${statusColor.bg}; color: ${statusColor.text}; border: 1px solid ${statusColor.border};">
                                ${escapeHtml(action.status)}
                            </span>
                        </div>
                    </div>
                    ${action.completion_percentage !== null && action.completion_percentage !== undefined ? `
                        <div style="text-align: right; background-color: #f3f4f6; padding: 8px 12px; border-radius: 6px;">
                            <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; font-weight: 600;">Tamamlanma</div>
                            <div style="font-size: 18px; font-weight: 700; color: #1e40af;">${action.completion_percentage}%</div>
                        </div>
                    ` : ''}
                </div>
                <div style="font-size: 12px; line-height: 1.7; color: #374151; margin-bottom: 15px;">
                    <strong style="color: #1e40af; display: block; margin-bottom: 6px;">Açıklama:</strong>
                    <div style="padding-left: 8px; border-left: 2px solid #e5e7eb;">
                        ${formatDescription(action.action_description)}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 11px; color: #6b7280; padding-top: 15px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; padding: 12px; border-radius: 4px;">
                    ${action.responsible_person?.full_name ? `<div><strong style="color: #374151;">Sorumlu:</strong> ${escapeHtml(action.responsible_person.full_name)}</div>` : ''}
                    ${action.responsible_department?.unit_name ? `<div><strong style="color: #374151;">Departman:</strong> ${escapeHtml(action.responsible_department.unit_name)}</div>` : ''}
                    ${action.planned_start_date ? `<div><strong style="color: #374151;">Planlanan Başlangıç:</strong> ${formatDate(action.planned_start_date)}</div>` : ''}
                    ${action.planned_end_date ? `<div><strong style="color: #374151;">Planlanan Bitiş:</strong> ${formatDate(action.planned_end_date)}</div>` : ''}
                    ${action.actual_start_date ? `<div><strong style="color: #374151;">Gerçekleşen Başlangıç:</strong> ${formatDate(action.actual_start_date)}</div>` : ''}
                    ${action.actual_completion_date ? `<div><strong style="color: #374151;">Gerçekleşen Bitiş:</strong> ${formatDate(action.actual_completion_date)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('') : '<div style="padding: 20px; text-align: center; color: #9ca3af; font-style: italic; background-color: #f9fafb; border-radius: 4px;">Henüz aksiyon kaydı bulunmamaktadır.</div>';
    
    const reportNo = complaint.complaint_number || `CS-${Date.now().toString().slice(-6)}`;
    const reportDate = formatDate(new Date());
    
    // Section numarasını dinamik olarak hesapla
    let sectionNum = 3;
    if (complaint.product_name || complaint.product_code || complaint.batch_number) sectionNum++;
    if (complaint.responsible_department || complaint.responsible_person || complaint.assigned_to) sectionNum++;
    if (analyses && analyses.length > 0) sectionNum++;
    if (actions && actions.length > 0) sectionNum++;
    const analysesSectionNum = (complaint.product_name || complaint.product_code || complaint.batch_number) ? 
        ((complaint.responsible_department || complaint.responsible_person || complaint.assigned_to) ? 5 : 4) : 
        ((complaint.responsible_department || complaint.responsible_person || complaint.assigned_to) ? 4 : 3);
    const actionsSectionNum = analysesSectionNum + (analyses && analyses.length > 0 ? 1 : 0);
    
    const htmlContent = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Müşteri Şikayeti Raporu - ${reportNo}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');body{font-family:'Inter',sans-serif;color:#1f2937;margin:0;padding:0;background-color:#f3f4f6}.page{background-color:white;width:210mm;min-height:297mm;margin:20px auto;padding:10mm;box-sizing:border-box;box-shadow:0 0 10px rgba(0,0,0,0.1)}.header{display:grid;grid-template-columns:auto 1fr auto;gap:15px;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:10px;page-break-inside:avoid}.header-logo{height:50px;width:auto}.company-title{text-align:center}.company-title h1{font-size:20px;font-weight:700;margin:0;color:#111827}.company-title p{font-size:12px;margin:0;color:#4b5563}.print-info{text-align:right;font-size:9px;color:#4b5563;line-height:1.4}.section{margin-bottom:20px;page-break-inside:avoid}.section-title{font-size:14px;font-weight:700;color:white;background-color:#1e40af;padding:6px 10px;border-radius:4px;margin-bottom:12px;text-transform:uppercase}.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.info-item{background-color:#f9fafb;border-radius:4px;padding:8px;border:1px solid #e5e7eb}.info-item .label{display:block;font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600}.info-item .value{font-size:13px;font-weight:600;color:#1f2937}.full-width{grid-column:1/-1}.description-box{background-color:#f9fafb;border-left:4px solid #3b82f6;padding:20px;border-radius:4px;margin-top:8px;min-height:100px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}.description-box p{margin:0 0 12px 0;font-size:12px;line-height:1.7;color:#374151;text-align:justify}.description-box p:last-child{margin-bottom:0}.description-box p strong{color:#1e40af;font-weight:600}.footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}@media print{*{print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important;color-adjust:exact!important}body{background-color:white!important;margin:0!important;padding:0!important}.page{margin:0!important;box-shadow:none!important;border:none!important}@page{size:A4 portrait;margin:10mm}}</style></head><body><div class="page"><div class="header"><div class="report-logo"><img src="${mainLogoBase64}" alt="Kademe Logo" class="header-logo"/></div><div class="company-title"><h1>KADEME A.Ş.</h1><p>Kalite Yönetim Sistemi</p></div><div class="print-info">Rapor No: ${reportNo}<br>Tarih: ${reportDate}</div></div><div class="section"><h2 class="section-title">1. ŞİKAYET BİLGİLERİ</h2><div class="info-grid"><div class="info-item"><span class="label">Şikayet Numarası</span><span class="value">${escapeHtml(complaint.complaint_number||'-')}</span></div><div class="info-item"><span class="label">Şikayet Tarihi</span><span class="value">${formatDate(complaint.complaint_date)}</span></div><div class="info-item"><span class="label">Önem Seviyesi</span><span class="value">${getSeverityBadge(complaint.severity)}</span></div><div class="info-item"><span class="label">Durum</span><span class="value">${getStatusBadge(complaint.status)}</span></div><div class="info-item"><span class="label">Kaynak</span><span class="value">${escapeHtml(complaint.complaint_source||'-')}</span></div><div class="info-item"><span class="label">Kategori</span><span class="value">${escapeHtml(complaint.complaint_category||'-')}</span></div><div class="info-item full-width"><span class="label">Başlık</span><span class="value" style="font-size: 14px; font-weight: 700;">${escapeHtml(complaint.title||'-')}</span></div><div class="info-item full-width"><span class="label">Açıklama</span><div class="description-box">${formatDescription(complaint.description||'-')}</div></div></div></div><div class="section"><h2 class="section-title">2. MÜŞTERİ BİLGİLERİ</h2><div class="info-grid"><div class="info-item"><span class="label">Müşteri Adı</span><span class="value">${escapeHtml(complaint.customer?.customer_name||complaint.customer?.name||'-')}</span></div><div class="info-item"><span class="label">Müşteri Kodu</span><span class="value">${escapeHtml(complaint.customer?.customer_code||'-')}</span></div>${complaint.customer?.contact_person?`<div class="info-item"><span class="label">Yetkili Kişi</span><span class="value">${escapeHtml(complaint.customer.contact_person)}</span></div>`:''}${complaint.customer?.contact_email?`<div class="info-item"><span class="label">Email</span><span class="value">${escapeHtml(complaint.customer.contact_email)}</span></div>`:''}${complaint.customer?.contact_phone?`<div class="info-item"><span class="label">Telefon</span><span class="value">${escapeHtml(complaint.customer.contact_phone)}</span></div>`:''}</div></div>${(complaint.product_name||complaint.product_code||complaint.batch_number)?`<div class="section"><h2 class="section-title">3. ÜRÜN BİLGİLERİ</h2><div class="info-grid">${complaint.product_name?`<div class="info-item"><span class="label">Ürün Adı</span><span class="value">${escapeHtml(complaint.product_name)}</span></div>`:''}${complaint.product_code?`<div class="info-item"><span class="label">Ürün Kodu</span><span class="value">${escapeHtml(complaint.product_code)}</span></div>`:''}${complaint.batch_number?`<div class="info-item"><span class="label">Parti/Lot No</span><span class="value">${escapeHtml(complaint.batch_number)}</span></div>`:''}${complaint.quantity_affected?`<div class="info-item"><span class="label">Etkilenen Miktar</span><span class="value">${complaint.quantity_affected}</span></div>`:''}${complaint.production_date?`<div class="info-item"><span class="label">Üretim Tarihi</span><span class="value">${formatDate(complaint.production_date)}</span></div>`:''}</div></div>`:''}${(complaint.responsible_department||complaint.responsible_person||complaint.assigned_to)?`<div class="section"><h2 class="section-title">${(complaint.product_name||complaint.product_code||complaint.batch_number)?'4':'3'}. SORUMLULUK</h2><div class="info-grid">${complaint.responsible_department?.unit_name?`<div class="info-item"><span class="label">Sorumlu Departman</span><span class="value">${escapeHtml(complaint.responsible_department.unit_name)}</span></div>`:''}${complaint.responsible_person?.full_name?`<div class="info-item"><span class="label">Sorumlu Kişi</span><span class="value">${escapeHtml(complaint.responsible_person.full_name)}</span></div>`:''}${complaint.assigned_to?.full_name?`<div class="info-item"><span class="label">Atanan Kişi</span><span class="value">${escapeHtml(complaint.assigned_to.full_name)}</span></div>`:''}</div></div>`:''}${analyses && analyses.length > 0 ? `<div class="section"><h2 class="section-title">${analysesSectionNum}. ANALİZLER</h2>${analysesHtml}</div>` : ''}${actions && actions.length > 0 ? `<div class="section"><h2 class="section-title">${actionsSectionNum}. AKSİYONLAR</h2>${actionsHtml}</div>` : ''}<div class="footer">Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</div></div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    if (window.printWindow && !window.printWindow.closed) window.printWindow.close();
    const printWindow = window.open(url, '_blank', 'width=800,height=600');
    if (printWindow) {
        window.printWindow = printWindow;
        printWindow.addEventListener('load', () => setTimeout(() => printWindow.print(), 500));
        printWindow.addEventListener('afterprint', () => { URL.revokeObjectURL(url); if (window.printWindow) window.printWindow = null; });
    }
};
