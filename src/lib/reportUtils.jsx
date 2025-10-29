import { format, differenceInDays } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { supabase } from '@/lib/customSupabaseClient';

// Global formatter helpers
const formatDateHelper = (dateStr, style = 'dd.MM.yyyy') => dateStr ? format(new Date(dateStr), style, { locale: tr }) : '-';
const formatDateTimeFull = (dateStr) => dateStr ? format(new Date(dateStr), 'dd MMMM yyyy', { locale: tr }) : '-';
const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
const formatCurrency = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const formatArray = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : '-';
    
    const openPrintableReport = (record, type, useUrlParams = false) => {
    if (!record) {
            console.error("openPrintableReport called with invalid record:", record);
            return;
        }

    // Kontrol planları ve diğer tipler için farklı ID field'leri
    const hasValidId = record.id || record.delivery_note_number;
    if (!hasValidId) {
        console.error("openPrintableReport: record has no valid ID field:", record);
        return;
    }

    const reportId = type === 'sheet_metal_entry' ? record.delivery_note_number : (record.id || record.delivery_note_number);
    
        let reportUrl;
        if (useUrlParams) {
            const dataStr = btoa(encodeURIComponent(JSON.stringify(record)));
            const params = new URLSearchParams({
                useUrlParams: 'true',
                data: dataStr,
                autoprint: 'true',
            });
            reportUrl = `/print/report/${type}/${reportId}?${params.toString()}`;
        } else {
            reportUrl = `/print/report/${type}/${reportId}?autoprint=true`;
        }
        
        const reportWindow = window.open(reportUrl, '_blank', 'noopener,noreferrer');
        if (reportWindow) {
            reportWindow.focus();
        }
    };
    
    const getReportTitle = (record, type) => {
        if (!record) return 'Rapor';
        switch (type) {
            case 'supplier_audit':
                return `Tedarikçi Denetim Raporu - ${record.supplier?.name || 'Bilinmiyor'}`;
            case 'internal_audit':
        return `İç Tetkik Raporu - ${record.report_number || 'Bilinmiyor'}`;            case 'sheet_metal_entry':
        return `Sac Metal Giriş Raporu - ${record.delivery_note_number || 'Bilinmiyor'}`;
    
            case 'incoming_inspection':
                return `Girdi Kontrol Raporu - ${record.record_no || 'Bilinmiyor'}`;
    
            case 'deviation':
                return `Sapma Talep Raporu - ${record.request_no || 'Bilinmiyor'}`;
            case 'nonconformity':
                return `${record.type} Raporu - ${record.nc_number || record.mdi_no || 'Bilinmiyor'}`;
            case 'kaizen':
                return `Kaizen Raporu - ${record.kaizen_no || 'Bilinmiyor'}`;
            case 'quarantine':
                return `Karantina Raporu - ${record.lot_no || 'Bilinmiyor'}`;
            case 'quarantine_list':
                return 'Genel Karantina Raporu';
            case 'wps':
                return `Kaynak Prosedür Şartnamesi (WPS) - ${record.wps_no || 'Bilinmiyor'}`;
            case 'equipment':
                return `Ekipman Raporu - ${record.serial_number || 'Bilinmiyor'}`;
            case 'certificate':
                return `Başarı Sertifikası - ${record.personnelName || ''}`;
            case 'exam_paper':
                return `Sınav Kağıdı - ${record.title || ''}`;
case 'incoming_control_plans':
    return `
        <tr><td>Parça Kodu</td><td>${record.part_code || '-'}</td></tr>
        <tr><td>Parça Adı</td><td>${record.part_name || '-'}</td></tr>
        <tr><td>Revizyon</td><td>${record.revision || '-'}</td></tr>
        <tr><td>Muayene Türü</td><td>${record.inspection_type || '-'}</td></tr>
        <tr><td>Örnekleme Seviyesi</td><td>${record.sampling_level || '-'}</td></tr>
        <tr><td>Örnek Boyutu</td><td>${record.sample_size ? record.sample_size + ' Adet' : '-'}</td></tr>
        <tr><td>AQL (Kabul Kriteri)</td><td>${record.aql || '-'}</td></tr>
        <tr><td>Geçerli Durum</td><td>${record.is_current ? 'Evet (Güncel)' : 'Hayır (Eski)'}</td></tr>
        <tr><td>Oluşturulma Tarihi</td><td>${formatDateHelper(record.created_at)}</td></tr>
        <tr><td colspan="2"><h3 style="margin-top: 15px;">Plan Açıklaması</h3><pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${record.description || 'Açıklama bulunmamaktadır.'}</pre></td></tr>
    `;
case 'inkr_management':
    return `
        <tr><td>INKR Numarası</td><td>${record.inkr_number || '-'}</td></tr>
        <tr><td>Ürün Adı</td><td>${record.product_name || '-'}</td></tr>
        <tr><td>Tedarikçi</td><td>${record.supplier?.name || record.supplier_name || '-'}</td></tr>
        <tr><td>Tarih</td><td>${formatDateHelper(record.date)}</td></tr>
        <tr><td>Durum</td><td><strong style="font-weight: bold; color: ${record.status === 'Tamamlandı' ? '#16a34a' : record.status === 'Devam Ediyor' ? '#2563eb' : '#f59e0b'};">${record.status || 'Beklemede'}</strong></td></tr>
        <tr><td>Sorumlu Personel</td><td>${record.responsible_person || '-'}</td></tr>
        <tr><td>Açıklama</td><td><pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${record.description || 'Açıklama bulunmamaktadır.'}</pre></td></tr>
    `;
case 'stock_risk_controls':
    return `
        <tr><td>Kontrol Numarası</td><td>${record.control_number || '-'}</td></tr>
        <tr><td>Risk Türü</td><td>${record.risk_type || '-'}</td></tr>
        <tr><td>Ürün / Lot</td><td>${record.product_lot || '-'}</td></tr>
        <tr><td>Tespit Tarihi</td><td>${formatDateHelper(record.detection_date)}</td></tr>
        <tr><td>Risk Seviyesi</td><td><strong style="font-weight: bold; color: ${record.risk_level === 'Yüksek' ? '#dc2626' : record.risk_level === 'Orta' ? '#f59e0b' : '#16a34a'};">${record.risk_level || 'Belirsiz'}</strong></td></tr>
        <tr><td>Durum</td><td><strong style="font-weight: bold; color: ${record.status === 'Çözüldü' ? '#16a34a' : record.status === 'Izleme Altında' ? '#2563eb' : '#f59e0b'};">${record.status || 'Yeni'}</strong></td></tr>
        <tr><td>İşlemler Alınanlar</td><td><pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${record.actions_taken || 'İşlem belirtilmemiştir.'}</pre></td></tr>
    `;
            default:
                return 'Detaylı Rapor';
        }
    };
    
    const getFormNumber = (type) => {
        const formNumbers = {
            nonconformity: 'FR-KAL-021',
            kaizen: 'FR-KAL-022',
            incoming_inspection: 'FR-KAL-023',
            deviation: 'FR-KAL-024',
            quarantine: 'FR-KAL-025',
            quarantine_list: 'FR-KAL-025-A',
            supplier_audit: 'FR-KAL-026',
            sheet_metal_entry: 'FR-KAL-027',
            wps: 'FR-KAL-028',
            internal_audit: 'FR-KAL-029',
            equipment: 'FR-KAL-030',
            certificate: 'FR-EGT-001',
            exam_paper: 'FR-EGT-002',
        };
        return formNumbers[type] || 'FR-GEN-000';
    };
    
    const generateCertificateReportHtml = (record) => {
        const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd MMMM yyyy', { locale: tr }) : '-';
        const participantName = record?.personnelName || 'VERİ YOK';
        return `
            <div class="certificate-container">
                <div class="certificate-content">
                    <div class="bg-shape top-right"></div>
                    <div class="bg-shape bottom-left"></div>
                    
                    <div class="logo-header">
                        <img class="header-logo" alt="Kademe Logosu" src="https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/e3b0ec0cdd1c4814b02c9d873c194be1.png" />
                        <img class="header-logo" alt="Albayrak Logosu" src="https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/4cc3358898350beed09f6af71029b7fe.png" />
                    </div>
    
                    <div class="header-section">
                        <p class="company-name">KADEME AKADEMİ</p>
                        <h1 class="main-title">BAŞARI SERTİFİKASI</h1>
                        <p class="subtitle">Bu sertifika, aşağıdaki eğitimi başarıyla tamamlayan</p>
                    </div>
    
                    <p class="participant-name">${participantName}</p>
                    
                    <p class="training-title">adlı katılımcıya, "${record?.trainingTitle || 'Eğitim Adı'}" eğitimini başarıyla tamamladığı için verilmiştir.</p>
    
                    <div class="details-section">
                        <div class="detail-item">
                            <strong>Eğitim Tarihi</strong>
                            <span>${formatDate(record?.completedAt)}</span>
                        </div>
                        <div class="detail-item">
                             <strong>Sertifika No</strong>
                             <span>${record?.id?.substring(0, 8).toUpperCase() || 'N/A'}</span>
                        </div>
                    </div>
    
                    <div class="signature-area">
                        <div class="signature-block">
                            <p class="name">${record?.trainingInstructor || 'Eğitmen Adı'}</p>
                            <div class="signature-line"></div>
                            <p class="title">Eğitmen</p>
                        </div>
                        <div class="signature-block">
                            <p class="name">Atakan BATTAL</p>
                            <div class="signature-line"></div>
                            <p class="title">Kalite Güvence Yöneticisi</p>
                        </div>
                        <div class="signature-block">
                            <p class="name">Kenan ÇELİK</p>
                            <div class="signature-line"></div>
                            <p class="title">Genel Müdür</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };
    
    const generateExamPaperHtml = (record) => {
        const exam = record;
        const questions = exam.training_exam_questions || [];
    
        const questionsHtml = questions.map((q, index) => {
            const optionsHtml = q.options?.map((opt, i) => `
                <div class="exam-option">
                    <div class="exam-option-letter">${String.fromCharCode(65 + i)}</div>
                    <div class="exam-option-text">${opt.text}</div>
                </div>
            `).join('') || '';
    
            return `
                <div class="exam-question-card">
                    <div class="exam-question-header">
                        <span class="exam-question-number">Soru ${index + 1}</span>
                        <span class="exam-question-points">${q.points || 0} Puan</span>
                    </div>
                    <p class="exam-question-text">${q.question_text}</p>
                    <div class="exam-options-grid">
                        ${optionsHtml}
                    </div>
                </div>
            `;
        }).join('');
    
        return `
            <div class="exam-header">
                <div class="company-logo-exam">
                    <img src="https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png" alt="Kademe Logo">
                </div>
                <div class="exam-title-section">
                    <h1>${exam.title || 'Sınav Değerlendirme Formu'}</h1>
                    <p>${exam.trainings?.title || 'Genel Eğitim'}</p>
                </div>
                 <div class="exam-meta-grid">
                    <div><strong>Doküman No:</strong> ${getFormNumber('exam_paper')}</div>
                    <div><strong>Yayın Tarihi:</strong> ${format(new Date(), 'dd.MM.yyyy')}</div>
                    <div><strong>Revizyon No:</strong> 00</div>
                 </div>
            </div>
    
            <div class="exam-participant-info">
                <div class="exam-info-field">
                    <label>Ad Soyad</label>
                    <span></span>
                </div>
                <div class="exam-info-field">
                    <label>Tarih</label>
                    <span></span>
                </div>
                <div class="exam-info-field">
                    <label>Toplam Puan</label>
                    <span></span>
                </div>
                 <div class="exam-info-field">
                    <label>Geçme Notu</label>
                    <span class="static-value">${exam.passing_score || '-'}</span>
                </div>
            </div>
    
            <div class="exam-questions-container">
                ${questionsHtml}
            </div>
        `;
    };
    
    
    const generateWPSReportHtml = (record) => {
        const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
        const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
    
        const passPlanHtml = record.pass_plan?.map(p => `
            <tr>
                <td>${p.pass || '-'}</td>
                <td>${p.technique || '-'}</td>
                <td>${p.current_polarity || '-'}</td>
                <td>${p.min_current_a || ''} - ${p.max_current_a || ''}</td>
                <td>${p.min_voltage_v || ''} - ${p.max_voltage_v || ''}</td>
                <td>${p.travel_speed || '-'}</td>
                <td>${p.heat_input || '-'}</td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="text-center">Paso planı detayı bulunamadı.</td></tr>';
        
        const jointTypeMap = {
            'Butt': 'Alın (Butt)',
            'Fillet': 'Köşe (Fillet)'
        };
    
        return `
            <div class="report-header">
                 <div class="report-logo">
                    <img src="https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png" alt="Kademe Logo">
                </div>
                <div class="company-title">
                    <h1>KADEME A.Ş.</h1>
                    <p>Kalite Yönetim Sistemi</p>
                </div>
                <div class="print-info">
                    Yazdır: ${record.wps_no || ''}<br>
                    Yazdırılma: ${formatDateTime(new Date())}
                </div>
            </div>
    
            <div class="meta-box">
                <div class="meta-item"><strong>Belge Türü:</strong> WPS Spesifikasyonu</div>
                <div class="meta-item"><strong>WPS No:</strong> ${record.wps_no || '-'}</div>
                <div class="meta-item"><strong>Revizyon:</strong> ${record.revision || '0'}</div>
                <div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
                <div class="meta-item"><strong>Yayın Tarihi:</strong> ${formatDate(record.wps_date)}</div>
                <div class="meta-item"><strong>Güncelleme:</strong> ${formatDate(record.updated_at)}</div>
            </div>
    
            <div class="section">
                <h2 class="section-title blue">1. TEMEL BİLGİLER</h2>
                <table class="info-table">
                    <tbody>
                        <tr><td>Ana Malzeme</td><td>${record.base_material_1?.name || '-'} (${record.base_material_1?.standard || '-'}) / Grup ${record.base_material_1?.iso_15608_group || '-'}</td></tr>
                        <tr><td>Malzeme Kalınlığı</td><td>${record.thickness_1 || '-'} mm</td></tr>
                        <tr><td>Dolgu Malzemesi</td><td>${record.filler_material?.classification || '-'}</td></tr>
                        <tr><td>Kaynak Prosesi</td><td>${record.welding_process_code || '-'}</td></tr>
                        <tr><td>Kaynak Pozisyonu</td><td>${record.welding_position || '-'}</td></tr>
                        <tr><td>Birleşim Tipi</td><td>${jointTypeMap[record.joint_type] || record.joint_type || '-'}</td></tr>
                        <tr><td>Kaynak Ağzı Tasarımı</td><td>${record.joint_detail || '-'} (${record.joint_detail === 'I' ? 'N/A' : (record.joint_angle || 'N/A') + '°'}) / Kök Aralığı: ${record.root_gap || 'N/A'} mm</td></tr>
                    </tbody>
                </table>
            </div>
    
            <div class="section">
                <h2 class="section-title red">2. KAYNAK PARAMETRELERİ</h2>
                <table class="info-table">
                    <tbody>
                        <tr><td>Koruyucu Gaz</td><td>${record.shielding_gas?.name || '-'}</td></tr>
                        <tr><td>Gaz Debisi</td><td>${record.gas_flow_rate || '-'} L/dk</td></tr>
                        <tr><td>Tel Çapı</td><td>${record.filler_diameter || '-'} mm</td></tr>
                        <tr><td>Ön Tav Sıcaklığı</td><td>${record.preheat_temperature || '-'} °C</td></tr>
                        <tr><td>Pasolar Arası Sıcaklık</td><td>${record.interpass_temperature || '-'} °C</td></tr>
                        <tr><td>Verim (η)</td><td>${record.efficiency || '-'}</td></tr>
                    </tbody>
                </table>
            </div>
    
            <div class="section">
                <h2 class="section-title gray">3. PASO PLANI</h2>
                <table class="pass-table">
                    <thead>
                        <tr>
                            <th>Paso</th>
                            <th>Teknik</th>
                            <th>Akım Türü</th>
                            <th>Akım (A)</th>
                            <th>Voltaj (V)</th>
                            <th>İlerleme (mm/dk)</th>
                            <th>Isı Girdisi (kJ/mm)</th>
                        </tr>
                    </thead>
                    <tbody>${passPlanHtml}</tbody>
                </table>
            </div>
            
            <div class="section">
                 <h2 class="section-title gray">4. NOTLAR</h2>
                 <div class="notes-box">
                    <strong>Kaynakçı Notları:</strong>
                    <pre>${record.welder_notes || 'Belirtilmemiş.'}</pre>
                 </div>
            </div>
    
            <div class="section signature-section">
                <h2 class="section-title dark">5. İMZA VE ONAY</h2>
                <div class="signature-area">
                    <div class="signature-box">
                        <p class="role">HAZIRLAYAN</p>
                        <div class="signature-line"></div>
                        <p class="name">Atakan BATTAL</p>
                        <p class="title">Kaynak Mühendisi</p>
                    </div>
                    <div class="signature-box">
                        <p class="role">KONTROL EDEN</p>
                        <div class="signature-line"></div>
                        <p class="name">&nbsp;</p>
                        <p class="title">Üretim Müdürü</p>
                    </div>
                    <div class="signature-box">
                        <p class="role">ONAYLAYAN</p>
                        <div class="signature-line"></div>
                        <p class="name">&nbsp;</p>
                        <p class="title">Kalite Müdürü</p>
                    </div>
                </div>
            </div>
        `;
    };
    
    const generateListReportHtml = (record, type) => {
        const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
        const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
    
        let title = '';
        let headers = [];
        let rowsHtml = '';
        let totalCount = record.items.length;
        let summaryHtml = '';
    
        if (type === 'quarantine_list') {
            title = 'Genel Karantina Raporu';
            headers = ['Tarih', 'Parça Adı/Kodu', 'Miktar', 'Birim', 'Durum', 'Sebep'];
            rowsHtml = record.items.map(item => `
                <tr>
                    <td>${formatDate(item.quarantine_date)}</td>
                    <td>${item.part_name || ''}<br><small class="muted">${item.part_code || ''}</small></td>
                    <td>${item.quantity || '0'}</td>
                    <td>${item.unit || '-'}</td>
                    <td>${item.status || '-'}</td>
                    <td><pre>${item.description || '-'}</pre></td>
                </tr>
            `).join('');
            summaryHtml = `<p><strong>Toplam Kayıt Sayısı:</strong> ${totalCount}</p>`;
        }
    
        return `
            <div class="report-header">
                 <div class="report-logo">
                    <img src="https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png" alt="Kademe Logo">
                </div>
                <div class="company-title">
                    <h1>KADEME A.Ş.</h1>
                    <p>Kalite Yönetim Sistemi</p>
                </div>
                <div class="print-info">
                    Rapor Tarihi: ${formatDateTime(new Date())}
                </div>
            </div>
    
            <div class="meta-box">
                <div class="meta-item"><strong>Belge Türü:</strong> ${title}</div>
            </div>
    
            <div class="section">
                <h2 class="section-title blue">${title}</h2>
                <div class="list-summary">${summaryHtml}</div>
                <table class="info-table results-table">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
    
             <div class="section signature-section">
                <h2 class="section-title dark">İMZA VE ONAY</h2>
                <div class="signature-area">
                    <div class="signature-box">
                        <p class="role">HAZIRLAYAN</p>
                        <div class="signature-line"></div>
                        <p class="name">Atakan BATTAL</p>
                    </div>
                </div>
            </div>
        `;
    };
    
    const generateGenericReportHtml = (record, type) => {
        const formatDate = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy') : '-';
        const formatDateTime = (dateStr) => dateStr ? format(new Date(dateStr), 'dd.MM.yyyy HH:mm') : '-';
        const formatCurrency = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
        const formatArray = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : '-';
    
        const getAttachmentUrl = (path, bucket) => {
            if (typeof path === 'object' && path !== null && path.path) {
                path = path.path;
            }
            if (typeof path !== 'string') return '';
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            return data?.publicUrl || '';
        };
    
        const getDocumentNumber = () => {
            switch (type) {
                case 'nonconformity': return record.nc_number || record.mdi_no || '-';
                case 'deviation': return record.request_no || '-';
                case 'kaizen': return record.kaizen_no || '-';
                case 'quarantine': return record.lot_no || '-';
                case 'incoming_inspection': return record.record_no || '-';
            case 'incoming_control_plans': return record.part_code || '-';
                case 'sheet_metal_entry': return record.delivery_note_number || '-';
                case 'supplier_audit': return `TDA-${format(new Date(record.planned_date || record.actual_date || new Date()), 'yyyy-MM')}-${record.id.substring(0, 4)}`;
                case 'internal_audit': return record.report_number || '-';
                case 'equipment': return record.serial_number || '-';
                default: return record.id;
            }
        };
        
        const getDocumentType = () => {
            switch (type) {
                case 'nonconformity': return `${record.type} Raporu`;
                case 'deviation': return 'Sapma Talep Raporu';
                case 'kaizen': return 'Kaizen Raporu';
                case 'quarantine': return 'Karantina Raporu';
                case 'incoming_inspection': return 'Girdi Kontrol Raporu';
            case 'incoming_control_plans': return 'Kontrol Planı Raporu';
                case 'sheet_metal_entry': return 'Sac Metal Giriş Raporu';
                case 'supplier_audit': return 'Tedarikçi Denetim Raporu';
                case 'internal_audit': return 'İç Tetkik Raporu';
                case 'equipment': return 'Ekipman Kalibrasyon Raporu';
                default: return 'Rapor';
            }
        };
    
        const getPublicationDate = () => {
            return formatDate(record.created_at || record.opening_date || record.df_opened_at || record.quarantine_date || record.inspection_date || record.entry_date || record.audit_date || record.planned_date);
        };
        
        const getDeviationApprovalReference = (ref) => {
            if (!ref || typeof ref !== 'string') return '-';
            
            const deviationNoMatch = ref.match(/ST-\d{4}-\d+/i);
            if (deviationNoMatch) {
                return `Sapma No: ${deviationNoMatch[0]}`;
            }
    
            const uuidMatch = ref.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
            if (uuidMatch) {
                 return `Sapma No: ${record.nc_number || uuidMatch[0]}`;
            }
    
            if (ref.includes('/') && ref.length > 40) {
                const parts = ref.split('/');
                const lastPart = parts[parts.length - 1];
                 if (lastPart) return `Sapma No: ${lastPart}`;
            }
            return `Sapma Ref: ${ref}`;
        };
    
    
        const getGeneralInfo = () => {
        const formatDate = (dateStr) => formatDateHelper(dateStr, 'dd.MM.yyyy');
            switch (type) {
                case 'nonconformity':
                    return `
                        <tr><td>Problem Tanımı</td><td><pre>${record.description || '-'}</pre></td></tr>
                        <tr><td>Talep Eden Kişi</td><td>${record.requesting_person || '-'}</td></tr>
                        <tr><td>Talep Eden Birim</td><td>${record.requesting_unit || '-'}</td></tr>
                        <tr><td>Sorumlu Kişi</td><td>${record.responsible_person || '-'}</td></tr>
                        <tr><td>Sorumlu Birim</td><td>${record.department || '-'}</td></tr>
                        <tr><td>Termin Tarihi</td><td>${formatDate(record.due_at || record.due_date)}</td></tr>
                    `;
                case 'deviation':
                    return `
                        <tr><td>Sapma Açıklaması</td><td><pre>${record.description || '-'}</pre></td></tr>
                        <tr><td>Talep Eden Kişi</td><td>${record.requesting_person || '-'}</td></tr>
                        <tr><td>Talep Eden Birim</td><td>${record.requesting_unit || '-'}</td></tr>
                        <tr><td>Sapma Kaynağı</td><td>${record.source || '-'}</td></tr>
                        <tr><td>Araç Tipi</td><td>${record.vehicle_type || '-'}</td></tr>
                    `;
                case 'kaizen':
                    const teamMembers = record.team_members_profiles?.map(p => p.full_name).join(', ') || '-';
                    const duration = record.start_date && record.end_date ? `${differenceInDays(new Date(record.end_date), new Date(record.start_date))} gün` : '-';
                    return `
                        <tr><td>Kaizen Konusu</td><td>${record.title || '-'}</td></tr>
                        <tr><td>Problem Tanımı</td><td><pre>${record.description || '-'}</pre></td></tr>
                        <tr><td>Öneri Sahibi</td><td>${record.proposer?.full_name || '-'}</td></tr>
                        <tr><td>Sorumlu Kişi</td><td>${record.responsible_person?.full_name || '-'}</td></tr>
                        <tr><td>Departman</td><td>${record.department?.unit_name || '-'}</td></tr>
                        <tr><td>Kaizen Ekibi</td><td>${teamMembers}</td></tr>
                        <tr><td>Süre</td><td>${duration}</td></tr>
                    `;
                case 'quarantine':
                     const deviationRef = record.deviation_approval_url ? `<tr><td>İlişkili Sapma</td><td>${getDeviationApprovalReference(record.deviation_approval_url)}</td></tr>` : '';
                    return `
                        <tr><td>Parça Adı / Kodu</td><td>${record.part_name} / ${record.part_code || '-'}</td></tr>
                        <tr><td>Miktar</td><td>${record.quantity} ${record.unit}</td></tr>
                        <tr><td>Karantina Sebebi</td><td><pre>${record.description || '-'}</pre></td></tr>
                        <tr><td>Sebep Olan Birim</td><td>${record.source_department || '-'}</td></tr>
                        ${deviationRef}
                    `;
        case 'incoming_inspection':
            const defectsHtml = record.defects && record.defects.length > 0 
                ? record.defects.map(d => `<li><strong>${d.defect_type || '-'}</strong>: ${d.description || '-'}</li>`).join('')
                : '<li>Kusur tespit edilmemiştir.</li>';
            
            const resultsTableHtml = record.results && record.results.length > 0
                ? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Özellik</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Yöntem</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçüm No</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Nominal</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Min</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Mak</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ölçülen</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Sonuç</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${record.results.map(r => `
                            <tr style="border-bottom: 1px solid #d1d5db;">
                                <td style="border: 1px solid #d1d5db; padding: 8px;">${r.feature || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; font-size: 0.9em;">${r.measurement_method || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">${r.measurement_number || '-'} / ${r.total_measurements || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.nominal_value || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.min_value || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${r.max_value || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">${r.actual_value || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold; color: ${r.result ? '#16a34a' : '#dc2626'};">${r.result ? '✓ OK' : '✗ NOK'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
                : '<p>Muayene sonuçları bulunamadı.</p>';
    
                        return `
            <tr><td>Tedarikçi</td><td>${record.supplier?.name || record.supplier_name || '-'}</td></tr>
            <tr><td>Teslimat Belgesi</td><td>${record.delivery_note_number || '-'}</td></tr>
            <tr><td>Parça Adı / Kodu</td><td>${record.part_name || '-'} / ${record.part_code || '-'}</td></tr>
            <tr><td>Gelen Miktar</td><td>${record.quantity_received || 0} ${record.unit || 'Adet'}</td></tr>
            <tr><td>Muayene Tarihi</td><td>${formatDate(record.inspection_date)}</td></tr>
            <tr><td>Karar</td><td><strong style="font-weight: bold; ${record.decision === 'Kabul' ? 'color: #16a34a' : record.decision === 'Ret' ? 'color: #dc2626' : 'color: #f59e0b'}">${record.decision || 'Beklemede'}</strong></td></tr>
            <tr><td>Kabul Edilen</td><td>${record.quantity_accepted || 0} ${record.unit || 'Adet'}</td></tr>
            <tr><td>Şartlı Kabul</td><td>${record.quantity_conditional || 0} ${record.unit || 'Adet'}</td></tr>
            <tr><td>Reddedilen</td><td>${record.quantity_rejected || 0} ${record.unit || 'Adet'}</td></tr>
            <tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Tespit Edilen Kusurlar</h3><ul>${defectsHtml}</ul></td></tr>
            <tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Muayene Sonuçları (Ölçüm Detayları)</h3>${resultsTableHtml}</td></tr>
        `;
        case 'sheet_metal_entry': {
            const itemsTableHtml = record.sheet_metal_items && record.sheet_metal_items.length > 0
                ? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Kalem No</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Boyutlar (L×G×K)</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Ağırlık (kg)</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Miktar</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Kalite</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Standart</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Heat No</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Coil No</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Sertlik</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Karar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${record.sheet_metal_items.map((item, idx) => `
                            <tr style="border-bottom: 1px solid #d1d5db;">
                                <td style="border: 1px solid #d1d5db; padding: 8px; font-weight: bold;">${idx + 1}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.uzunluk || '-'} × ${item.genislik || '-'} × ${item.kalinlik || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.weight || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.quantity || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.material_quality || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.malzeme_standarti || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.heat_number || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.coil_no || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-size: 0.9em;">${item.hardness || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold; color: ${item.decision === 'Kabul' || item.decision === 'Kabul Edildi' ? '#16a34a' : item.decision === 'Ret' ? '#dc2626' : '#f59e0b'};">${item.decision || 'Beklemede'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
                : '<p>Kalem bilgisi bulunamadı.</p>';

            // Detaylı bilgiler her kalem için
            const detailedItemsHtml = record.sheet_metal_items && record.sheet_metal_items.length > 0
                ? record.sheet_metal_items.map((item, idx) => `
                <div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background-color: #fafafa;">
                    <h4 style="margin-top: 0; margin-bottom: 10px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; color: #1f2937;">Kalem ${idx + 1} - Detaylı Bilgiler</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Malzeme Özellikleri</h5>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Uzunluk (mm):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.uzunluk || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Genişlik (mm):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.genislik || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Kalınlık (mm):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.kalinlik || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Kalite:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.material_quality || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Standart:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.malzeme_standarti || '-'}</td></tr>
                            </table>
                        </div>
                        
                        <div>
                            <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Lot & Referans Bilgileri</h5>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Lot No:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.lot_number || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Heat No (Şarj):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.heat_number || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Coil No (Bobin):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.coil_no || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Sertifika Türü:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.sertifika_turu || '-'}</td></tr>
                            </table>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Test Sonuçları</h5>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Sertlik (HRB/HRC):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.hardness || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Ağırlık (kg):</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.weight || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Adet:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;">${item.quantity || '-'}</td></tr>
                                <tr><td style="padding: 4px; border-bottom: 1px solid #e5e7eb;"><strong>Karar:</strong></td><td style="padding: 4px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: ${item.decision === 'Kabul' || item.decision === 'Kabul Edildi' ? '#16a34a' : item.decision === 'Ret' ? '#dc2626' : '#f59e0b'};">${item.decision || 'Beklemede'}</td></tr>
                            </table>
                        </div>
                        
                        <div>
                            <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 0.95em;">Sertifika Bilgileri</h5>
                            ${item.certificates && item.certificates.length > 0
                                ? `<ul style="margin: 0; padding-left: 20px; font-size: 0.9em;">
                                    ${item.certificates.map((cert, cidx) => {
                                        const certName = typeof cert === 'string' ? cert.split('/').pop() : cert.name || cert.path?.split('/').pop() || `Sertifika ${cidx + 1}`;
                                        return `<li>${certName}</li>`;
                                    }).join('')}
                                  </ul>`
                                : '<p style="margin: 0; font-size: 0.9em; color: #6b7280;">Sertifika belirtilmemiş</p>'
                            }
                        </div>
                    </div>
                </div>
            `).join('')
            : '<p>Kalem bilgisi bulunamadı.</p>';

                    return `
            <tr><td>Tedarikçi</td><td>${record.supplier?.name || record.supplier_name || '-'}</td></tr>
                        <tr><td>İrsaliye No</td><td>${record.delivery_note_number || '-'}</td></tr>
                        <tr><td>Giriş Tarihi</td><td>${formatDate(record.entry_date)}</td></tr>
            <tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Giriş Yapılan Kalemler (Özet Tablo)</h3>${itemsTableHtml}</td></tr>
            <tr><td colspan="2"><h3 style="margin-top: 20px; margin-bottom: 15px;">Giriş Yapılan Kalemler (Detaylı Bilgiler)</h3>${detailedItemsHtml}</td></tr>
                    `;
            break;
        }
    case 'supplier_audit': {
                    const getGradeInfo = (score) => {
                        if (score === null || score === undefined) return { grade: 'N/A', description: 'Puanlanmamış', color: '#6b7280' };
                        if (score >= 90) return { grade: 'A', description: 'Stratejik İş Ortağı', color: '#16a34a' };
                        if (score >= 75) return { grade: 'B', description: 'Güvenilir Tedarikçi', color: '#2563eb' };
                        if (score >= 60) return { grade: 'C', description: 'İzlemeye Alınacak', color: '#f59e0b' };
                        return { grade: 'D', description: 'İş Birliği Sonlandırılacak', color: '#dc2626' };
                    };
                    const gradeInfo = getGradeInfo(record.score);
                    return `
                        <tr><td>Tedarikçi</td><td>${record.supplier?.name || '-'}</td></tr>
                        <tr><td>Denetim Tarihi</td><td>${formatDate(record.actual_date || record.planned_date)}</td></tr>
                        <tr><td>Denetçi(ler)</td><td>${formatArray(record.participants)}</td></tr>
                        <tr>
                            <td>Alınan Puan / Sınıf</td>
                            <td>
                                <strong style="font-size: 1.1em; color: ${gradeInfo.color};">${record.score ?? 'N/A'}</strong> 
                                <span style="font-weight: bold; background-color: ${gradeInfo.color}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 10px;">${gradeInfo.grade}</span>
                                <span style="margin-left: 10px; color: #4b5563;">(${gradeInfo.description})</span>
                            </td>
                        </tr>
                        <tr><td>Denetim Notları</td><td><pre>${record.notes || '-'}</pre></td></tr>
                    `;
            break;
            }
        case 'internal_audit': {
                    return `
                        <tr><td>Tetkik Başlığı</td><td>${record.title || '-'}</td></tr>
                        <tr><td>Denetlenen Birim</td><td>${record.department?.unit_name || '-'}</td></tr>
                        <tr><td>Tetkik Tarihi</td><td>${formatDate(record.audit_date)}</td></tr>
                        <tr><td>Tetkikçi</td><td>${record.auditor_name || '-'}</td></tr>
                    `;
            break;
            }
        case 'equipment': {
                    const latestCalibration = record.equipment_calibrations?.sort((a,b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
                    return `
                        <tr><td>Ekipman Adı</td><td>${record.name}</td></tr>
                        <tr><td>Marka/Model</td><td>${record.brand_model || '-'}</td></tr>
                        <tr><td>Sorumlu Birim</td><td>${record.responsible_unit}</td></tr>
                        <tr><td>Son Kalibrasyon</td><td>${latestCalibration ? formatDate(latestCalibration.calibration_date) : '-'}</td></tr>
                        <tr><td>Sonraki Kalibrasyon</td><td>${latestCalibration ? formatDate(latestCalibration.next_calibration_date) : '-'}</td></tr>
                    `;
            break;
            }
        case 'incoming_control_plans': {
            const itemsTableHtml = record.items && record.items.length > 0
                ? `<table class="details-table" style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f3f4f6; border: 1px solid #d1d5db;">
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Sıra</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Değerler (Nominal/Min/Max)</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Tip</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Tolerans Sınıfı</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Yön</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${record.items.map((item, idx) => `
                            <tr style="border-bottom: 1px solid #d1d5db;">
                                <td style="border: 1px solid #d1d5db; padding: 8px;">${idx + 1}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px;">Nominal: ${item.nominal_value || '-'} | Min: ${item.min_value || '-'} | Max: ${item.max_value || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px;">${item.characteristic_type || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px;">${item.tolerance_class || '-'}</td>
                                <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.tolerance_direction || '±'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
                : '<p>Örnekleme detayı bulunamadı.</p>';
            
            return `
                <tr><td>Parça Kodu</td><td>${record.part_code || '-'}</td></tr>
                <tr><td>Parça Adı</td><td>${record.part_name || '-'}</td></tr>
                <tr><td>Revizyon No</td><td>${record.revision_number || 0}</td></tr>
                <tr><td>Revizyon Tarihi</td><td>${formatDate(record.revision_date)}</td></tr>
                <tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Örnekleme Özellikleri</h3>${itemsTableHtml}</td></tr>
            `;
            break;
            }
        case 'inkr_management': {
            const testResultsHtml = record.test_results && record.test_results.length > 0
                ? `<div style="margin-top: 10px;">${record.test_results.map((test, idx) => `
                    <div style="margin-bottom: 8px; padding: 8px; border-left: 3px solid #2563eb; background-color: #f0f9ff;">
                        <strong>${test.test_name || `Test ${idx + 1}`}:</strong> ${test.result || '-'}
                        ${test.description ? `<br><small style="color: #6b7280;">${test.description}</small>` : ''}
                    </div>
                `).join('')}</div>`
                : '<p style="color: #6b7280;">Test sonucu bulunmadı.</p>';
            
            return `
                <tr><td>INKR Numarası</td><td>${record.inkr_number || '-'}</td></tr>
                <tr><td>Ürün Adı</td><td>${record.part_name || '-'}</td></tr>
                <tr><td>Ürün Kodu</td><td>${record.part_code || '-'}</td></tr>
                <tr><td>Tedarikçi</td><td>${record.supplier_name || '-'}</td></tr>
                <tr><td>Rapor Tarihi</td><td>${formatDate(record.report_date || record.created_at)}</td></tr>
                <tr><td>Durum</td><td>${record.status || 'Aktif'}</td></tr>
                <tr><td colspan="2"><h3 style="margin-top: 15px; margin-bottom: 10px;">Test Sonuçları</h3>${testResultsHtml}</td></tr>
                ${record.notes ? `<tr><td>Notlar</td><td><pre>${record.notes}</pre></td></tr>` : ''}
            `;
            break;
            }
        case 'stock_risk_controls': {
            const riskLevelColor = {
                'Yüksek': '#dc2626',
                'Orta': '#f59e0b',
                'Düşük': '#16a34a',
            };
            const color = riskLevelColor[record.decision] || '#6b7280';
            
            // Build results table if exists
            const resultsTableHtml = record.results && Array.isArray(record.results) && record.results.length > 0
                ? `
                    <tr><td colspan="2"><h4 style="margin: 10px 0;">Kontrol Sonuçları</h4>
                        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                            <thead>
                                <tr style="background-color: #f3f4f6;">
                                    <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Ölçüm Türü</th>
                                    <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Değer</th>
                                    <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Sonuç</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${record.results.map(r => `
                                    <tr>
                                        <td style="border: 1px solid #d1d5db; padding: 8px;">${r.measurement_type || '-'}</td>
                                        <td style="border: 1px solid #d1d5db; padding: 8px;">${r.value || '-'}</td>
                                        <td style="border: 1px solid #d1d5db; padding: 8px;">${r.result || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </td></tr>
                `
                : '';
            
            return `
                <tr><td>Parça Kodu</td><td>${record.part_code || '-'}</td></tr>
                <tr><td>Parça Adı</td><td>${record.part_name || '-'}</td></tr>
                <tr><td>Tedarikçi</td><td>${record.supplier?.name || '-'}</td></tr>
                <tr><td>Karar</td><td><strong style="color: ${color}; font-size: 1.1em;">${record.decision || '-'}</strong></td></tr>
                <tr><td>Kontrol Tarihi</td><td>${formatDateHelper(record.created_at)}</td></tr>
                <tr><td>Kontrol Eden</td><td>${record.controlled_by?.full_name || '-'}</td></tr>
                ${resultsTableHtml}
                ${record.notes ? `<tr><td>Notlar</td><td><pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${record.notes}</pre></td></tr>` : ''}
            `;
            break;
            }
                default: return `<tr><td>Detaylar</td><td>Bu modül için özel rapor formatı tanımlanmamış.</td></tr>`;
            }
        };
    
        const getAdditionalSections = () => {
            let html = '';
            if (type === 'nonconformity' && record.eight_d_steps) {
                html += `<div class="section"><h2 class="section-title red">2. 8D ADIMLARI</h2>`;
                Object.entries(record.eight_d_steps).forEach(([key, step]) => {
                    html += `<div class="step-section">
                        <h3 class="step-title">${key}: ${step.title || ''}</h3>
                        <p><strong>Sorumlu:</strong> ${step.responsible || '-'}</p>
                        <p><strong>Tarih:</strong> ${formatDate(step.completionDate)}</p>
                        <p class="step-description"><strong>Açıklama:</strong> <pre>${step.description || '-'}</pre></p>
                    </div>`;
                });
                html += `</div>`;
            }
            if (type === 'deviation' && record.deviation_approvals?.length > 0) {
                html += `<div class="section"><h2 class="section-title red">2. ONAY SÜRECİ</h2><table class="info-table"><tbody>`;
                record.deviation_approvals.forEach(approval => {
                    html += `<tr><td>${approval.approval_stage}</td><td>${approval.approver_name || 'Bekleniyor'} - <strong>${approval.status}</strong><br><i>"${approval.notes || ''}"</i></td></tr>`;
                });
                html += `</tbody></table></div>`;
            }
            if (type === 'kaizen') {
                const analysis_5n1k = record.analysis_5n1k || {};
                const analysis_5_whys = record.analysis_5_whys || {};
                const analysis_fishbone = record.analysis_fishbone || {};
                html += `
                    <div class="section">
                        <h2 class="section-title red">2. KÖK NEDEN ANALİZİ</h2>
                        <div class="analysis-box">
                            <h4>5N1K Analizi</h4>
                            <p><strong>Ne:</strong> ${analysis_5n1k.what || '-'}</p>
                            <p><strong>Nerede:</strong> ${analysis_5n1k.where || '-'}</p>
                            <p><strong>Ne Zaman:</strong> ${analysis_5n1k.when || '-'}</p>
                            <p><strong>Kim:</strong> ${analysis_5n1k.who || '-'}</p>
                            <p><strong>Nasıl:</strong> ${analysis_5n1k.how || '-'}</p>
                            <p><strong>Neden Önemli:</strong> ${analysis_5n1k.why || '-'}</p>
                        </div>
                        <div class="analysis-box">
                            <h4>5 Neden Analizi</h4>
                            <p><strong>1. Neden:</strong> ${analysis_5_whys.answer1 || '-'}</p>
                            <p><strong>2. Neden:</strong> ${analysis_5_whys.answer2 || '-'}</p>
                            <p><strong>3. Neden:</strong> ${analysis_5_whys.answer3 || '-'}</p>
                            <p><strong>4. Neden:</strong> ${analysis_5_whys.answer4 || '-'}</p>
                            <p><strong>5. Neden (Kök Neden):</strong> ${analysis_5_whys.answer5 || '-'}</p>
                        </div>
                        <div class="analysis-box">
                            <h4>Balık Kılçığı Analizi</h4>
                            <p><strong>İnsan:</strong> ${analysis_fishbone.man || '-'}</p>
                            <p><strong>Makine:</strong> ${analysis_fishbone.machine || '-'}</p>
                            <p><strong>Metot:</strong> ${analysis_fishbone.method || '-'}</p>
                            <p><strong>Malzeme:</strong> ${analysis_fishbone.material || '-'}</p>
                            <p><strong>Çevre:</strong> ${analysis_fishbone.environment || '-'}</p>
                            <p><strong>Ölçüm:</strong> ${analysis_fishbone.measurement || '-'}</p>
                        </div>
                    </div>
                    <div class="section">
                        <h2 class="section-title green">3. ÇÖZÜM VE KAZANÇLAR</h2>
                        <table class="info-table">
                            <tbody>
                                <tr><td>Uygulanan Çözüm</td><td><pre>${record.solution_description || '-'}</pre></td></tr>
                                <tr><td>Aylık Kazanç</td><td>${formatCurrency(record.total_monthly_gain)}</td></tr>
                                <tr><td>Yıllık Kazanç</td><td>${formatCurrency(record.total_yearly_gain)}</td></tr>
                                <tr><td>İSG Etkileri</td><td>${formatArray(record.isg_effect)}</td></tr>
                                <tr><td>Çevresel Etkiler</td><td>${formatArray(record.environmental_effect)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }
            
             if (type === 'supplier_audit' || type === 'internal_audit') {
                const results = record.audit_results || record.results || [];
                
                if (results.length > 0) {
                    html += `<div class="section"><h2 class="section-title red">2. DENETİM SONUÇLARI</h2><table class="info-table results-table"><thead><tr><th>Soru</th><th>Cevap</th><th>Notlar</th></tr></thead><tbody>`;
                    results.forEach((result) => {
                        if (result) {
                            const answerValue = result.answer;
                            let answerColor = '#6b7280';
                            if (answerValue === 'Evet' || answerValue === 'Uygun') answerColor = '#16a34a';
                            else if (answerValue === 'Hayır' || answerValue === 'Uygunsuz') answerColor = '#dc2626';
                            else if (answerValue === 'Kısmen' || answerValue === 'Gözlem') answerColor = '#f59e0b';
                            
                            html += `<tr>
                                <td>${result.question_text}</td>
                                <td><strong style="color: ${answerColor};">${answerValue || '-'}</strong></td>
                                <td><pre>${result.notes || '-'}</pre></td>
                            </tr>`;
                        }
                    });
                    html += `</tbody></table></div>`;
                }
            }
            
            let attachments = [];
            let bucket = '';
    
            if (type === 'nonconformity') {
                attachments = record.attachments || [];
                bucket = 'df_attachments';
            } else if (type === 'kaizen') {
                attachments = [...(record.attachments_before || []), ...(record.attachments_after || [])];
                bucket = 'kaizen_attachments';
            } else if (type === 'supplier_audit') {
                attachments = record.report_files || [];
                bucket = 'supplier_audit_reports';
            } else if (type === 'deviation') {
                attachments = record.deviation_attachments || [];
                bucket = 'deviation_attachments';
            }
    
            if (attachments.length > 0) {
                html += `<div class="section"><h2 class="section-title gray">EKLİ GÖRSELLER</h2><div class="image-grid">`;
                attachments.forEach(path => {
                    const url = getAttachmentUrl(path, bucket);
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(typeof path === 'string' ? path : path.path);
                    if (isImage) {
                        html += `<div class="image-container"><img src="${url}" class="attachment-image" alt="Ek" crossOrigin="anonymous"/></div>`;
                    } else {
                        html += `<div class="attachment-file"><a href="${url}" target="_blank">${(typeof path === 'string' ? path : path.name).split('/').pop()}</a></div>`;
                    }
                });
                html += `</div></div>`;
            }
            return html;
        };
    
        return `
            <div class="report-header">
                <div class="report-logo">
                    <img src="https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png" alt="Kademe Logo">
                </div>
                <div class="company-title">
                    <h1>KADEME A.Ş.</h1>
                    <p>Kalite Yönetim Sistemi</p>
                </div>
                <div class="print-info">
                    Yazdır: ${getDocumentNumber()}<br>
                    Yazdırılma: ${formatDateTime(new Date())}
                </div>
            </div>
    
            <div class="meta-box">
                <div class="meta-item"><strong>Belge Türü:</strong> ${getDocumentType()}</div>
                <div class="meta-item"><strong>No:</strong> ${getDocumentNumber()}</div>
                <div class="meta-item"><strong>Revizyon:</strong> ${record.revision || '0'}</div>
                <div class="meta-item"><strong>Sistem:</strong> Kademe Kalite Yönetim Sistemi</div>
                <div class="meta-item"><strong>Yayın Tarihi:</strong> ${getPublicationDate()}</div>
                <div class="meta-item"><strong>Durum:</strong> ${record.status || '-'}</div>
            </div>
    
            <div class="section">
                <h2 class="section-title blue">1. TEMEL BİLGİLER</h2>
                <table class="info-table">
                    <tbody>
                        ${getGeneralInfo()}
                    </tbody>
                </table>
            </div>
            
            ${getAdditionalSections()}
    
            <div class="section signature-section">
                <h2 class="section-title dark">İMZA VE ONAY</h2>
                <div class="signature-area">
                    <div class="signature-box">
                        <p class="role">HAZIRLAYAN</p>
                        <div class="signature-line"></div>
            <p class="name">${type === 'incoming_inspection' ? (record.prepared_by ? record.prepared_by : '&nbsp;') : '&nbsp;'}</p>
                    </div>
                    <div class="signature-box">
                        <p class="role">KONTROL EDEN</p>
                        <div class="signature-line"></div>
            <p class="name">${type === 'incoming_inspection' ? (record.controlled_by ? record.controlled_by : '&nbsp;') : '&nbsp;'}</p>
                    </div>
                    <div class="signature-box">
                        <p class="role">ONAYLAYAN</p>
                        <div class="signature-line"></div>
            <p class="name">${type === 'incoming_inspection' ? (record.created_by ? record.created_by : '&nbsp;') : '&nbsp;'}</p>
                    </div>
                </div>
            </div>
        `;
    };
    
    const generatePrintableReportHtml = (record, type) => {
        let reportContentHtml = '';
        if (type.endsWith('_list')) {
            reportContentHtml = generateListReportHtml(record, type);
        } else if (type === 'wps') {
            reportContentHtml = generateWPSReportHtml(record);
        } else if (type === 'certificate') {
            reportContentHtml = generateCertificateReportHtml(record);
        } else if (type === 'exam_paper') {
            reportContentHtml = generateExamPaperHtml(record);
        } else {
            reportContentHtml = generateGenericReportHtml(record, type);
        }
    
        const formNumber = getFormNumber(record.report_type || type);
        const isCertificate = type === 'certificate';
        const isExam = type === 'exam_paper';
    
        const defaultStyles = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            body { 
                font-family: 'Inter', sans-serif; 
                color: #1f2937; 
                margin: 0; 
                padding: 0;
                background-color: #f3f4f6; 
                font-size: 10px; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .page-container {
                background-color: white;
                box-sizing: border-box;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                margin: 20px auto;
                width: 210mm;
            }
            .report-wrapper {
                padding: 15mm;
                position: relative;
                min-height: calc(297mm - 30mm - 40px); /* A4 height - padding - footer */
            }
            
            .report-header { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px; }
            .report-logo img { height: 50px; }
    .company-title { text-align: center; }
            .company-title h1 { font-size: 20px; font-weight: 700; margin: 0; color: #111827; }
            .company-title p { font-size: 12px; margin: 0; color: #4b5563; }
            .print-info { text-align: right; font-size: 9px; color: #4b5563; }
    
            .meta-box { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background-color: #f3f4f6; padding: 10px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
            .meta-item { font-size: 9px; color: #374151; }
            .meta-item strong { color: #111827; }
    
            .section { margin-bottom: 15px; page-break-inside: avoid; }
            .section-title { font-size: 12px; font-weight: 700; color: white; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px; text-transform: uppercase; }
            .section-title.blue { background-color: #2563eb; }
            .section-title.red { background-color: #dc2626; }
            .section-title.green { background-color: #16a34a; }
            .section-title.gray { background-color: #6b7280; }
            .section-title.dark { background-color: #374151; }
            
            .list-summary { margin-bottom: 10px; font-size: 11px; }
    
            .info-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
            .info-table td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 10px; vertical-align: top; }
            .info-table tr:nth-child(even) td { background-color: #f9fafb; }
            .info-table tr td:first-child { font-weight: 600; width: 25%; }
            .info-table pre { white-space: pre-wrap; font-family: 'Inter', sans-serif; margin: 0; font-size: 10px; }
            .item-section-title { font-size: 1.1em; font-weight: 600; margin-top: 10px; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
            .item-box { border: 1px solid #eee; border-radius: 4px; padding: 8px; margin-bottom: 5px; font-size: 9px; background: #fdfdfd;}
            .item-box p { margin: 2px 0; }
            .item-box:last-child { margin-bottom: 0; }
            
            .pass-table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; page-break-inside: avoid; }
            .pass-table th, .pass-table td { border: 1px solid #e5e7eb; padding: 6px; }
            .pass-table thead { background-color: #f3f4f6; font-weight: 600; }
            
            .results-table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
            .results-table th, .results-table td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 10px; vertical-align: top; text-align: left; }
            .results-table thead { background-color: #f9fafb; font-weight: 600; }
            .results-table pre { white-space: pre-wrap; font-family: 'Inter', sans-serif; margin: 0; font-size: 10px; }
            .results-table small.muted { color: #6b7280; font-size: 9px; }
    
            .notes-box { border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; min-height: 50px; font-size: 10px; page-break-inside: avoid; }
            .notes-box pre { white-space: pre-wrap; font-family: 'Inter', sans-serif; margin: 0; }
    
            .signature-section, .signature-area { page-break-inside: avoid !important; }
            .signature-area { display: flex; justify-content: space-around; text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
            .signature-box { width: 30%; }
            .signature-box .role { font-weight: 600; font-size: 10px; margin-bottom: 5px; }
            .signature-line { border-bottom: 1px solid #9ca3af; margin-bottom: 5px; height: 20px; }
            .signature-box .name { font-size: 11px; font-weight: 500; margin: 0; min-height: 16px; }
            .signature-box .title { font-size: 9px; color: #6b7280; margin: 0; }
    
            .footer { text-align: center; font-size: 9px; color: #9ca3af; padding-top: 10px; padding-bottom: 10px; border-top: 1px solid #e5e7eb; position: relative; margin-top: 20px; }
            .footer-content { display: flex; justify-content: space-between; align-items: center; }
    
            .step-section { margin-top: 10px; padding: 10px; border-left: 3px solid #2563eb; background-color: #fafafa; border-radius: 0 4px 4px 0; page-break-inside: avoid; }
            .step-title { font-weight: bold; color: #1e40af; }
            .step-description { white-space: pre-wrap; }
            .step-description pre { white-space: pre-wrap; font-family: 'Inter', sans-serif; margin: 0; }
            
            .analysis-box { margin-top: 10px; padding: 10px; border: 1px solid #eee; border-radius: 4px; page-break-inside: avoid; }
            .analysis-box h4 { font-weight: bold; margin-bottom: 5px; }
            .analysis-box p { margin: 2px 0; }
    
            .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
            .image-container { page-break-inside: avoid; }
            .attachment-image { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; object-fit: cover; }
            .attachment-file a { text-decoration: none; color: #2563eb; word-break: break-all; }
    
            @media print {
                html, body {
                    width: 210mm;
                    height: 297mm;
                    background-color: white;
                }
                .page-container { 
                    margin: 0; 
                    box-shadow: none; 
                    border: none;
                    width: 100%;
                    padding: 0;
                }
                .report-wrapper {
                    padding: 0;
                    min-height: 0;
                }
                .footer {
                    position: fixed;
                    bottom: 0;
                    left: 10mm;
                    right: 10mm;
                    width: calc(100% - 20mm);
                    padding-top: 5px;
                    padding-bottom: 5px;
                }
                a[href]:after { content: none !important; }
            }
        `;
    
        const certificateStyles = `
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&family=Playfair+Display:wght@700&family=Dancing+Script:wght@700&display=swap');
            body { 
                background-color: #f0f2f5; 
                font-family: 'Montserrat', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .page-container {
                width: 297mm;
                height: 210mm;
                background-color: #ffffff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                margin: 0;
                overflow: hidden;
            }
            .report-wrapper {
                padding: 0;
                height: 100%;
            }
            .certificate-container {
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                position: relative;
                overflow: hidden;
            }
            .certificate-content {
                width: 100%;
                height: 100%;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                padding: 20mm;
                box-sizing: border-box;
                position: relative;
                z-index: 2;
                border: 10px solid #f0f0f0;
            }
            .bg-shape {
                position: absolute;
                background: linear-gradient(45deg, #0033a0, #0056b3);
                border-radius: 50%;
                opacity: 0.1;
                z-index: 1;
            }
            .bg-shape.top-right {
                width: 300px;
                height: 300px;
                top: -100px;
                right: -100px;
            }
            .bg-shape.bottom-left {
                width: 400px;
                height: 400px;
                bottom: -150px;
                left: -150px;
            }
            .certificate-content::before {
                content: '';
                position: absolute;
                top: 20px;
                left: 20px;
                right: 20px;
                bottom: 20px;
                border: 2px solid #d4af37;
                z-index: -1;
            }
            .logo-header {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: default;
            }
            .header-logo {
                height: 50px;
                object-fit: contain;
                cursor: default;
            }
            .header-section { margin-bottom: 10px; }
            .company-name { font-size: 14pt; color: #555; letter-spacing: 1px; font-weight: 500; }
            .main-title {
                font-family: 'Playfair Display', serif;
                font-size: 36pt;
                font-weight: 700;
                color: #0033a0;
                margin: 5px 0;
            }
            .subtitle { font-size: 11pt; color: #666; margin: 0; }
            
            .participant-name {
                font-family: 'Dancing Script', cursive;
                font-size: 48pt;
                color: #0033a0;
                margin: 10px 0;
            }
            
            .training-title {
                font-size: 12pt;
                color: #555;
                margin: 0 auto 20px auto;
                max-width: 80%;
            }
    
            .details-section {
                width: 100%;
                display: flex;
                justify-content: space-around;
                align-items: center;
                margin: 15px 0;
            }
            .detail-item { text-align: center; display: flex; flex-direction: column; }
            .detail-item strong { font-size: 10pt; color: #555; margin-bottom: 4px; }
            .detail-item span { font-size: 11pt; font-weight: 500; }
    
            .signature-area {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                padding-top: 20px;
            }
            .signature-block { text-align: center; width: 30%; }
            .signature-line {
                border-bottom: 1px solid #333;
                margin-bottom: 8px;
                height: 30px;
                width: 100%;
            }
            .name { font-size: 11pt; font-weight: 700; margin: 0; }
            .title { font-size: 9pt; color: #666; margin: 0; }
            
            .footer { display: none; }
    
            @media print {
                @page { size: A4 landscape; margin: 0; }
                body { background-color: #fff; }
                .page-container { box-shadow: none; border: none; margin: 0; height: 100vh; }
            }
        `;
        
        const examPaperStyles = `
            body { 
                font-size: 11px; 
                color: #333;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .report-wrapper { padding: 10mm; }
            
            .exam-header {
                display: grid;
                grid-template-columns: auto 1fr auto;
                gap: 20px;
                align-items: center;
                border-bottom: 2px solid #0033a0;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            .company-logo-exam img { height: 60px; }
            .exam-title-section { text-align: center; }
            .exam-title-section h1 { font-size: 18px; font-weight: 700; color: #0033a0; margin: 0; }
            .exam-title-section p { font-size: 12px; color: #555; margin: 0; }
            .exam-meta-grid { font-size: 9px; text-align: right; color: #666; }
    
            .exam-participant-info {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                background-color: #f9fafb;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid #e5e7eb;
            }
            .exam-info-field { display: flex; flex-direction: column; }
            .exam-info-field label { font-size: 10px; font-weight: 600; color: #555; margin-bottom: 4px; }
            .exam-info-field span {
                height: 24px;
                border-bottom: 1px dotted #999;
                font-size: 12px;
                font-weight: 500;
            }
            .exam-info-field span.static-value { border-bottom: none; }
    
            .exam-questions-container { display: flex; flex-direction: column; gap: 15px; }
            .exam-question-card {
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 15px;
                page-break-inside: avoid;
                background: #fff;
            }
            .exam-question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .exam-question-number { font-size: 13px; font-weight: 700; color: #0033a0; }
            .exam-question-points { font-size: 11px; font-weight: 500; background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 12px; }
            .exam-question-text { font-size: 12px; line-height: 1.6; margin-bottom: 15px; }
            
            .exam-options-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }
            .exam-option { display: flex; align-items: center; background: #f9fafb; padding: 8px; border-radius: 6px; border: 1px solid #f3f4f6;}
            .exam-option-letter {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #fff;
                border: 1px solid #d1d5db;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                margin-right: 10px;
            }
            .exam-option-text { font-size: 11px; }
    
            .footer { display: block !important; }
        `;
    
        return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>${getReportTitle(record, type)}</title>
            <style>
                ${isCertificate ? certificateStyles : (isExam ? `${defaultStyles} ${examPaperStyles}` : defaultStyles)}
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="report-wrapper">
                    ${reportContentHtml}
                </div>
                <div class="footer ${isCertificate ? 'footer-hidden' : ''}">
                    <div class="footer-content">
                        <span>Bu belge, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</span>
                        <span>Form No: ${formNumber}</span>
                    </div>
                </div>
            </div>
        </body>
        </html>
`
    };
    
    export { openPrintableReport, getReportTitle, generatePrintableReportHtml };