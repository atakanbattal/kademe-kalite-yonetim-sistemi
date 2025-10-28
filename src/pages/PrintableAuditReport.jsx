import React, { useState, useEffect, useRef } from 'react';
    import { useParams } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Helmet } from 'react-helmet';
    import { Loader2, Check, X, Eye } from 'lucide-react';

    const PrintableAuditReport = () => {
        const { id } = useParams();
        const [audit, setAudit] = useState(null);
        const [results, setResults] = useState([]);
        const [findings, setFindings] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const printTriggered = useRef(false);

        useEffect(() => {
            const fetchReportData = async () => {
                if (!id) {
                    setError('Tetkik ID bulunamadı.');
                    setLoading(false);
                    return;
                }

                try {
                    setLoading(true);
                    const { data: auditData, error: auditError } = await supabase
                        .from('audits')
                        .select('*, department:cost_settings(unit_name)')
                        .eq('id', id)
                        .single();

                    if (auditError) throw auditError;
                    if (!auditData) {
                        setError('Tetkik bulunamadı.');
                        setLoading(false);
                        return;
                    }
                    setAudit(auditData);

                    const { data: resultsData, error: resultsError } = await supabase
                        .from('audit_results')
                        .select('*')
                        .eq('audit_id', id)
                        .order('created_at');
                    if (resultsError) throw resultsError;
                    setResults(resultsData);

                    const { data: findingsData, error: findingsError } = await supabase
                        .from('audit_findings')
                        .select('*, non_conformities(id, nc_number, status, type)')
                        .eq('audit_id', id);
                    if (findingsError) throw findingsError;
                    
                    const processedFindings = findingsData.map(f => ({
                        ...f,
                        non_conformity: Array.isArray(f.non_conformities) && f.non_conformities.length > 0 ? f.non_conformities[0] : (f.non_conformities || null)
                    }));
                    setFindings(processedFindings);

                } catch (err) {
                    setError(`Veri alınırken bir hata oluştu: ${err.message}`);
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };

            fetchReportData();
        }, [id]);

        useEffect(() => {
            if (!loading && audit && !printTriggered.current) {
                printTriggered.current = true;
                setTimeout(() => window.print(), 1000);
            }
        }, [loading, audit]);

        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

        const getStatusBadgeStyle = (status) => {
            let backgroundColor, color, borderColor;
            switch (status) {
                case 'Planlandı': backgroundColor = '#F1F5F9'; color = '#475569'; borderColor = '#E2E8F0'; break;
                case 'Devam Ediyor': backgroundColor = '#FEFCE8'; color = '#A16207'; borderColor = '#F7F0B9'; break;
                case 'Tamamlandı': backgroundColor = '#F0FDF4'; color = '#16A34A'; borderColor = '#BBF7D0'; break;
                default: backgroundColor = '#F8FAFC'; color = '#475569'; borderColor = '#E2E8F0'; break;
            }
            return { backgroundColor, color, borderColor, borderWidth: '1px', borderStyle: 'solid', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', display: 'inline-block' };
        };

        const getAnswerIcon = (answer) => {
            switch (answer) {
                case 'Uygun': return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                case 'Uygunsuz': return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
                case 'Gözlem': return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                default: return '';
            }
        };

        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
                        <p className="mt-4 text-lg font-semibold">Rapor hazırlanıyor, lütfen bekleyin...</p>
                    </div>
                </div>
            );
        }

        if (error) return <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-700">Hata: {error}</div>;
        if (!audit) return <div className="flex items-center justify-center h-screen">Tetkik bulunamadı.</div>;

        return (
            <>
                <Helmet><title>{`Tetkik Raporu - ${audit.report_number}`}</title></Helmet>
                <div className="page">
                    <style>{`
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                        body { font-family: 'Inter', sans-serif; color: #1f2937; background-color: #f3f4f6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .page { background-color: white; width: 210mm; min-height: 297mm; margin: 20px auto; padding: 20mm; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1F3A5F; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h1 { font-size: 28px; font-weight: 700; color: #1F3A5F; margin: 0; }
                        .header p { font-size: 14px; color: #6b7280; margin: 5px 0 0; }
                        .section { margin-bottom: 25px; page-break-inside: avoid; }
                        .section-title { font-size: 18px; font-weight: 600; color: #1F3A5F; border-bottom: 2px solid #D32F2F; padding-bottom: 8px; margin-bottom: 15px; }
                        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                        .info-item { background-color: #f9fafb; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb; }
                        .info-item .label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
                        .info-item .value { font-size: 14px; font-weight: 600; }
                        .question-list { page-break-inside: auto; }
                        .question-item { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; padding: 15px; page-break-inside: avoid; }
                        .question-text { font-weight: 600; margin-bottom: 10px; }
                        .answer-section { display: flex; justify-content: space-between; align-items: flex-start; }
                        .answer-badge { font-weight: 600; display: flex; align-items: center; gap: 6px; }
                        .notes { font-size: 13px; color: #4b5563; background-color: #f9fafb; border-radius: 6px; padding: 10px; margin-top: 10px; white-space: pre-wrap; word-break: break-word; }
                        .finding-item { border-left: 3px solid #ef4444; padding-left: 15px; margin-bottom: 10px; }
                        .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 60px; page-break-inside: avoid; }
                        .signature-box { border-top: 1px solid #9ca3af; padding-top: 10px; text-align: center; }
                        .signature-box p { margin: 0; font-size: 14px; }
                        .footer { text-align: right; margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
                        .footer .left { float: left; }
                        @media print {
                            body { background-color: white; margin: 0; padding: 0; }
                            .page { margin: 0; box-shadow: none; border: none; width: 100%; min-height: auto; }
                            @page { size: A4; margin: 20mm; }
                        }
                    `}</style>
                    <header className="header">
                        <div><h1>KADEME A.Ş.</h1><p>Kalite Yönetim Sistemi</p></div>
                        <div style={{textAlign: 'right'}}>
                            <p style={{fontWeight: 600, fontSize: '16px'}}>İç Tetkik Raporu</p>
                            <p>Rapor No: {audit.report_number}</p>
                        </div>
                    </header>

                    <main>
                        <div className="section">
                            <h2 className="section-title">Tetkik Bilgileri</h2>
                            <div className="info-grid">
                                <div className="info-item"><span className="label">Tetkik Başlığı</span><span className="value">{audit.title}</span></div>
                                <div className="info-item"><span className="label">Tetkik Tarihi</span><span className="value">{formatDate(audit.audit_date)}</span></div>
                                <div className="info-item"><span className="label">Denetlenen Birim</span><span className="value">{audit.department?.unit_name || 'N/A'}</span></div>
                                <div className="info-item"><span className="label">Tetkikçi</span><span className="value">{audit.auditor_name}</span></div>
                                <div className="info-item"><span className="label">Durum</span><span className="value"><span style={getStatusBadgeStyle(audit.status)}>{audit.status}</span></span></div>
                            </div>
                        </div>

                        <div className="section">
                            <h2 className="section-title">Tetkik Soruları ve Cevapları</h2>
                            <div className="question-list">
                                {results.map((result, index) => (
                                    <div key={result.id} className="question-item">
                                        <p className="question-text">{index + 1}. {result.question_text}</p>
                                        <div className="answer-section">
                                            <div className="answer-badge" dangerouslySetInnerHTML={{ __html: getAnswerIcon(result.answer) + ' ' + (result.answer || 'Cevaplanmadı') }}></div>
                                        </div>
                                        {result.notes && <div className="notes">{result.notes}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {findings.length > 0 && (
                            <div className="section">
                                <h2 className="section-title">Bulgular</h2>
                                {findings.map(finding => (
                                    <div key={finding.id} className="finding-item">
                                        <p><strong>Bulgu:</strong> {finding.description}</p>
                                        {finding.non_conformity && <p><strong>İlişkili Uygunsuzluk:</strong> {finding.non_conformity.nc_number} ({finding.non_conformity.status})</p>}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="signature-section">
                            <div className="signature-box">
                                <p>{audit.auditor_name}</p>
                                <p><strong>Tetkikçi</strong></p>
                            </div>
                            <div className="signature-box">
                                <p>&nbsp;</p>
                                <p><strong>Birim Yetkilisi</strong></p>
                            </div>
                        </div>
                    </main>

                    <footer className="footer">
                        <span className="left">Oluşturma Tarihi: {formatDate(new Date())}</span>
                        <span>Hazırlayan: Atakan BATTAL</span>
                    </footer>
                </div>
            </>
        );
    };

    export default PrintableAuditReport;