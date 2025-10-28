import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

const PrintableKaizenReport = () => {
    const { id } = useParams();
    const [kaizen, setKaizen] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) {
                setError('Kaizen ID bulunamadı.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                const { data: kaizenData, error: kaizenError } = await supabase
                    .from('kaizen_entries')
                    .select(`
                        *,
                        proposer:proposer_id ( id, full_name ),
                        responsible_person:responsible_person_id ( id, full_name ),
                        department:department_id ( id, unit_name, cost_per_minute ),
                        supplier:supplier_id ( id, name )
                    `)
                    .eq('id', id)
                    .single();

                if (kaizenError) throw kaizenError;
                
                const teamMemberIds = kaizenData.team_members || [];
                if (teamMemberIds.length > 0) {
                    const { data: teamMembersProfiles, error: teamMembersError } = await supabase
                        .from('personnel')
                        .select('id, full_name')
                        .in('id', teamMemberIds);

                    if (teamMembersError) throw teamMembersError;
                    kaizenData.team_members_profiles = teamMembersProfiles;
                } else {
                    kaizenData.team_members_profiles = [];
                }

                setKaizen(kaizenData);

            } catch (err) {
                console.error('Rapor verisi alınırken hata:', err);
                setError(`Rapor verisi alınamadı: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    useEffect(() => {
        if (!loading && kaizen) {
            const images = document.querySelectorAll('.attachment-image');
            const promises = Array.from(images).map(img => {
                return new Promise((resolve) => {
                    if (img.complete) {
                        resolve();
                    } else {
                        img.onload = resolve;
                        img.onerror = resolve;
                    }
                });
            });

            Promise.all(promises).then(() => {
                setTimeout(() => {
                    window.print();
                }, 1500);
            });
        }
    }, [loading, kaizen]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
                <Loader2 className="w-12 h-12 animate-spin mr-4" />
                <span className="text-xl font-semibold">Rapor oluşturuluyor, lütfen bekleyin...</span>
            </div>
        );
    }

    if (error) {
        return <div className="text-center p-8 text-red-600 font-semibold">{error}</div>;
    }

    if (!kaizen) {
        return <div className="text-center p-8">Kaizen verisi bulunamadı.</div>;
    }

    const getStatusBadge = (status) => {
        let bgColor, textColor;
        switch (status) {
            case 'Onaylandı': case 'Standartlaştırıldı': case 'Kapandı': bgColor = '#dcfce7'; textColor = '#166534'; break;
            case 'Reddedildi': bgColor = '#fee2e2'; textColor = '#991b1b'; break;
            case 'İncelemede': case 'Uygulamada': bgColor = '#fef9c3'; textColor = '#854d0e'; break;
            default: bgColor = '#f3f4f6'; textColor = '#4b5563'; break;
        }
        return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600; border: 1px solid ${textColor}33;">${status}</span>`;
    };

    const formatDate = (dateString) => dateString ? format(new Date(dateString), 'dd MMMM yyyy', { locale: tr }) : '-';
    const formatCurrency = (value) => (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    const formatArray = (value) => Array.isArray(value) && value.length > 0 ? value.join(', ') : '-';
    
    const teamMemberNames = kaizen.team_members_profiles?.map(p => p.full_name).join(', ') || '-';

    const duration = kaizen.start_date && kaizen.end_date ? `${differenceInDays(new Date(kaizen.end_date), new Date(kaizen.start_date))} gün` : '-';

    const getFileUrl = (fileObject) => {
        if (!fileObject || !fileObject.path) return null;
        const { data } = supabase.storage.from('kaizen_attachments').getPublicUrl(fileObject.path);
        return data.publicUrl;
    };

    const attachmentsHtml = (files, title) => {
        if (!files || files.length === 0) return '';
        return `
            <div class="section">
                <h3 class="section-subtitle">${title}</h3>
                <div class="image-grid">
                    ${files.map(file => `<div class="image-container"><img src="${getFileUrl(file)}" class="attachment-image" alt="${file.name}" crossOrigin="anonymous"/><p class="image-caption">${file.name}</p></div>`).join('')}
                </div>
            </div>
        `;
    };

    const analysis_5n1k = kaizen.analysis_5n1k || {};
    const analysis_5_whys = kaizen.analysis_5_whys || {};
    const analysis_fishbone = kaizen.analysis_fishbone || {};

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Kaizen Raporu - ${kaizen.kaizen_no}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; }
                .page { background-color: white; width: 210mm; min-height: 297mm; margin: 20px auto; padding: 20mm; box-sizing: border-box; box-shadow: 0 0 15px rgba(0,0,0,0.1); }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { font-size: 28px; font-weight: 700; color: #111827; margin: 0; }
                .header p { font-size: 14px; color: #6b7280; margin: 5px 0 0; }
                .report-title-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
                .report-title h2 { font-size: 22px; font-weight: 600; margin: 0; }
                .report-title p { font-size: 16px; color: #4b5563; margin: 5px 0 0; }
                .section { margin-bottom: 25px; page-break-inside: avoid; }
                .section-title { font-size: 18px; font-weight: 600; color: #1e40af; border-bottom: 2px solid #bfdbfe; padding-bottom: 8px; margin-bottom: 15px; }
                .section-subtitle { font-size: 16px; font-weight: 600; color: #1d4ed8; margin-bottom: 10px; }
                .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                .info-item { background-color: #f9fafb; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb; }
                .info-item .label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500; }
                .info-item .value { font-size: 14px; font-weight: 600; }
                .span-3 { grid-column: span 3 / span 3; }
                .span-2 { grid-column: span 2 / span 2; }
                .description-box { background-color: #f9fafb; border-radius: 8px; padding: 15px; border: 1px solid #e5e7eb; white-space: pre-wrap; word-wrap: break-word; font-size: 14px; }
                .analysis-section { margin-bottom: 20px; }
                .analysis-item { margin-bottom: 10px; }
                .analysis-item .label { font-weight: 600; font-size: 13px; color: #374151; }
                .analysis-item .value { font-size: 14px; padding: 8px; background-color: #f3f4f6; border-radius: 4px; margin-top: 4px; min-height: 20px; }
                .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
                .image-container { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                .attachment-image { width: 100%; height: auto; display: block; }
                .image-caption { font-size: 12px; text-align: center; padding: 8px; background-color: #f9fafb; }
                .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
                @media print { body { background-color: white; } .page { margin: 0; box-shadow: none; border: none; } @page { size: A4; margin: 20mm; } }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div><h1>KADEME A.Ş.</h1><p>Kalite Yönetim Sistemi</p></div>
                    <div style="text-align: right;">
                        <p style="font-weight: 600; font-size: 16px;">Kaizen Raporu</p>
                        <p>Rapor No: ${kaizen.kaizen_no}</p>
                    </div>
                </div>
                <div class="report-title-section">
                    <div class="report-title"><h2>${kaizen.title}</h2><p>${kaizen.description || ''}</p></div>
                    <div>${getStatusBadge(kaizen.status)}</div>
                </div>

                <div class="section">
                    <h2 class="section-title">Genel Bilgiler</h2>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">Öneri Sahibi</span><span class="value">${kaizen.proposer?.full_name || '-'}</span></div>
                        <div class="info-item"><span class="label">Sorumlu Kişi</span><span class="value">${kaizen.responsible_person?.full_name || '-'}</span></div>
                        <div class="info-item"><span class="label">Departman</span><span class="value">${kaizen.department?.unit_name || '-'}</span></div>
                        <div class="info-item"><span class="label">Başlangıç Tarihi</span><span class="value">${formatDate(kaizen.start_date)}</span></div>
                        <div class="info-item"><span class="label">Bitiş Tarihi</span><span class="value">${formatDate(kaizen.end_date)}</span></div>
                        <div class="info-item"><span class="label">Süre</span><span class="value">${duration}</span></div>
                        <div class="info-item span-3"><span class="label">Kaizen Ekibi</span><span class="value">${teamMemberNames}</span></div>
                        <div class="info-item span-3"><span class="label">Kaizen Konuları</span><span class="value">${formatArray(kaizen.kaizen_topic)}</span></div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Problem Tanımı ve Kök Neden Analizi</h2>
                    <div class="analysis-section">
                        <h3 class="section-subtitle">5N1K Analizi</h3>
                        <div class="analysis-item"><span class="label">Ne?</span><div class="value">${analysis_5n1k.what || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Nerede?</span><div class="value">${analysis_5n1k.where || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Ne Zaman?</span><div class="value">${analysis_5n1k.when || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Kim?</span><div class="value">${analysis_5n1k.who || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Nasıl?</span><div class="value">${analysis_5n1k.how || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Neden Önemli?</span><div class="value">${analysis_5n1k.why || '-'}</div></div>
                    </div>
                    <div class="analysis-section">
                        <h3 class="section-subtitle">5 Neden Analizi</h3>
                        <div class="analysis-item"><span class="label">1. Neden?</span><div class="value">${analysis_5_whys.answer1 || '-'}</div></div>
                        <div class="analysis-item"><span class="label">2. Neden?</span><div class="value">${analysis_5_whys.answer2 || '-'}</div></div>
                        <div class="analysis-item"><span class="label">3. Neden?</span><div class="value">${analysis_5_whys.answer3 || '-'}</div></div>
                        <div class="analysis-item"><span class="label">4. Neden?</span><div class="value">${analysis_5_whys.answer4 || '-'}</div></div>
                        <div class="analysis-item"><span class="label">5. Neden (Kök Neden)?</span><div class="value">${analysis_5_whys.answer5 || '-'}</div></div>
                    </div>
                    <div class="analysis-section">
                        <h3 class="section-subtitle">Balık Kılçığı Analizi</h3>
                        <div class="analysis-item"><span class="label">İnsan</span><div class="value">${analysis_fishbone.man || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Makine</span><div class="value">${analysis_fishbone.machine || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Metot</span><div class="value">${analysis_fishbone.method || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Malzeme</span><div class="value">${analysis_fishbone.material || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Çevre</span><div class="value">${analysis_fishbone.environment || '-'}</div></div>
                        <div class="analysis-item"><span class="label">Ölçüm</span><div class="value">${analysis_fishbone.measurement || '-'}</div></div>
                    </div>
                </div>
                
                <div class="section">
                    <h2 class="section-title">Uygulanan Çözüm</h2>
                    <div class="description-box">${kaizen.solution_description || '-'}</div>
                </div>

                ${attachmentsHtml(kaizen.attachments_before, 'Önceki Durum')}
                ${attachmentsHtml(kaizen.attachments_after, 'Sonraki Durum')}

                <div class="section">
                    <h2 class="section-title">Kazanımlar</h2>
                    <div class="info-grid">
                        <div class="info-item" style="background-color: #f0fdf4; border-color: #bbf7d0;"><span class="label">Aylık Kazanç</span><span class="value" style="color: #15803d;">${formatCurrency(kaizen.total_monthly_gain)}</span></div>
                        <div class="info-item" style="background-color: #eff6ff; border-color: #bfdbfe;"><span class="label">Yıllık Kazanç</span><span class="value" style="color: #1d4ed8;">${formatCurrency(kaizen.total_yearly_gain)}</span></div>
                        <div class="info-item"><span class="label">İşçilik Tasarrufu (dk/adet)</span><span class="value">${kaizen.labor_time_saving_minutes || 0} dk</span></div>
                        <div class="info-item span-2"><span class="label">İSG Etkileri</span><span class="value">${formatArray(kaizen.isg_effect)}</span></div>
                        <div class="info-item"><span class="label">Çevresel Etkiler</span><span class="value">${formatArray(kaizen.environmental_effect)}</span></div>
                    </div>
                </div>

                <div class="footer">Bu rapor, Kalite Yönetim Sistemi tarafından ${formatDate(new Date())} tarihinde otomatik olarak oluşturulmuştur.</div>
            </div>
        </body>
        </html>
    `;

    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

export default PrintableKaizenReport;