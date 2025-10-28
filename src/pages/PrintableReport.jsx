import React, { useEffect, useState } from 'react';
    import { useParams, useLocation } from 'react-router-dom';
    import { Helmet } from 'react-helmet-async';
    import { supabase } from '@/lib/customSupabaseClient';
    import { generatePrintableReportHtml, getReportTitle } from '@/lib/reportUtils';
    import { Button } from '@/components/ui/button';
    import { AlertTriangle, Loader2 } from 'lucide-react';

    const PrintableReport = () => {
        const { type, id } = useParams();
        const location = useLocation();
        const [data, setData] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [reportTitle, setReportTitle] = useState('Rapor Yükleniyor...');
        const [reportHtml, setReportHtml] = useState('');

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            let recordData = null;
            let queryError = null;

            try {
                const urlParams = new URLSearchParams(location.search);
                const useUrlParams = urlParams.get('useUrlParams') === 'true';

                if (useUrlParams) {
                    const encodedData = urlParams.get('data');
                    if (encodedData) {
                        try {
                            recordData = JSON.parse(decodeURIComponent(atob(encodedData)));
                        } catch (e) {
                             console.error('URL verisi okunurken hata:', e);
                             throw new Error('URL\'den rapor verisi okunurken bir hata oluştu. Veri formatı bozuk olabilir.');
                        }
                    } else {
                        throw new Error('URL parametrelerinde veri bulunamadı.');
                    }
                } else {
                    switch (type) {
                        case 'certificate': {
                            const urlParams = new URLSearchParams(window.location.search);
                            recordData = {
                                id: id,
                                personnelName: urlParams.get('personnelName') || 'İsim Bulunamadı',
                                trainingTitle: urlParams.get('trainingTitle') || 'Eğitim Bulunamadı',
                                trainingInstructor: urlParams.get('trainingInstructor') || '',
                                score: urlParams.get('score') || '',
                                completedAt: urlParams.get('completedAt') || '',
                                status: urlParams.get('status') || ''
                            };
                            break;
                        }
                        case 'supplier_audit': {
                            const { data: auditData, error: auditError } = await supabase
                                .from('supplier_audit_plans')
                                .select('*, supplier:supplier_id!left(name)')
                                .eq('id', id)
                                .maybeSingle();
                            recordData = auditData;
                            queryError = auditError;
                            break;
                        }
                        case 'internal_audit': {
                            const { data: auditData, error: auditError } = await supabase
                                .from('audits')
                                .select('*, department:department_id!left(unit_name), audit_results:audit_results!left(*)')
                                .eq('id', id)
                                .maybeSingle();
                            recordData = auditData;
                            queryError = auditError;
                            break;
                        }
                        case 'sheet_metal_entry': {
                           const { data: items, error: itemsError } = await supabase
                                .from('sheet_metal_items')
                                .select('*, supplier:suppliers(name)')
                                .eq('delivery_note_number', id);

                            if (itemsError) throw itemsError;
                            if (!items || items.length === 0) throw new Error('Bu irsaliyeye ait kalem bulunamadı.');

                            recordData = {
                                id: items[0].id, 
                                delivery_note_number: id,
                                entry_date: items[0].entry_date,
                                supplier: items[0].supplier,
                                sheet_metal_items: items
                            };
                            break;
                        }
                        case 'incoming_inspection': {
                            const { data: inspectionData, error: inspectionError } = await supabase
                                .from('incoming_inspections_with_supplier')
                                .select('*')
                                .eq('id', id)
                                .maybeSingle();
                            
                            if (inspectionError) throw inspectionError;
                            if (!inspectionData) throw new Error('Muayene kaydı bulunamadı.');
                            
                            // Related data'yı ayrı ayrı çek
                            const [attachmentsRes, defectsRes, resultsRes] = await Promise.all([
                                supabase.from('incoming_inspection_attachments').select('*').eq('inspection_id', id),
                                supabase.from('incoming_inspection_defects').select('*').eq('inspection_id', id),
                                supabase.from('incoming_inspection_results').select('*').eq('inspection_id', id)
                            ]);
                            
                            recordData = {
                                ...inspectionData,
                                attachments: attachmentsRes.data || [],
                                defects: defectsRes.data || [],
                                results: resultsRes.data || []
                            };
                            break;
                        }
                        case 'deviation':
                        case 'quarantine':
                        case 'equipment': {
                            const tableNameMap = {
                                incoming_inspection: 'incoming_inspections',
                                deviation: 'deviations',
                                quarantine: 'quarantine_records',
                                equipment: 'equipments',
                            };
                            const tableName = tableNameMap[type];
                            if (!tableName) throw new Error(`Geçersiz rapor türü: ${type}`);
                            
                            let selectQuery = '*';
                            if (type === 'equipment') {
                                selectQuery = '*, equipment_calibrations!left(*)';
                            } else if (type === 'deviation') {
                                selectQuery = '*, deviation_approvals!left(*)';
                            }
                            
                            const { data: genericData, error: genericError } = await supabase
                                .from(tableName)
                                .select(selectQuery)
                                .eq('id', id)
                                .maybeSingle();
                            recordData = genericData;
                            queryError = genericError;
                            break;
                        }
                        case 'kaizen': {
                            const { data: kaizenData, error: kaizenError } = await supabase
                                .from('kaizen_entries')
                                .select('*, proposer:proposer_id!left(full_name), responsible_person:responsible_person_id!left(full_name), department:department_id!left(unit_name)')
                                .eq('id', id)
                                .maybeSingle();

                            if (kaizenError) throw kaizenError;
                            recordData = kaizenData;
                            
                            if (recordData && recordData.team_members && Array.isArray(recordData.team_members) && recordData.team_members.length > 0) {
                                const { data: profiles, error: profilesError } = await supabase
                                    .from('personnel')
                                    .select('id, full_name')
                                    .in('id', recordData.team_members);
                                if (profilesError) throw profilesError;
                                recordData.team_members_profiles = profiles;
                            } else if (recordData) {
                                recordData.team_members_profiles = [];
                            }
                            break;
                        }
                        case 'nonconformity': {
                            const { data: ncData, error: ncError } = await supabase
                                .from('non_conformities_with_details')
                                .select('*')
                                .eq('id', id)
                                .maybeSingle();
                            recordData = ncData;
                            queryError = ncError;
                            break;
                        }
                        case 'exam_paper': {
                            const { data: examData, error: examError } = await supabase
                                .from('training_exams')
                                .select('*, trainings:training_id!left(title), training_exam_questions!left(*)')
                                .eq('id', id)
                                .maybeSingle();
                            recordData = examData;
                            queryError = examError;
                            break;
                        }

                        default:
                            throw new Error(`Geçersiz rapor türü: ${type}`);
                    }
                }

                if (queryError) throw queryError;
                if (!recordData) throw new Error('Kayıt bulunamadı. Rapor oluşturulamıyor.');
                
                setData(recordData);
                setReportTitle(getReportTitle(recordData, type));

            } catch (err) {
                console.error("Rapor oluşturulurken hata:", err);
                setError(`Rapor oluşturulurken hata: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        useEffect(() => {
            fetchData();
        }, [type, id, location.search]);

        useEffect(() => {
            if (data) {
                const html = generatePrintableReportHtml(data, type);
                setReportHtml(html);
                const timeoutId = setTimeout(() => {
                     if (window.location.search.includes('autoprint=true')) {
                         window.print();
                     }
                }, 500);
                return () => clearTimeout(timeoutId);
            }
        }, [data, type]);
        
        if (loading) {
            return (
                <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
                    <div className="text-center">
                        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 text-lg font-semibold text-gray-700">Rapor Oluşturuluyor...</p>
                        <p className="text-sm text-gray-500">Lütfen bekleyin, verileriniz hazırlanıyor.</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex h-screen w-screen items-center justify-center bg-red-50">
                    <div className="text-center p-8 bg-white rounded-lg shadow-xl">
                        <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                        <h1 className="mt-4 text-2xl font-bold text-red-800">Rapor Oluşturulamadı</h1>
                        <p className="mt-2 text-sm text-red-600">{error}</p>
                        <Button onClick={fetchData} className="mt-6">Tekrar Dene</Button>
                    </div>
                </div>
            );
        }

        return (
            <>
                <Helmet>
                    <title>{reportTitle}</title>
                </Helmet>
                <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
            </>
        );
    };

    export default PrintableReport;