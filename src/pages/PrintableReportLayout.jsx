import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { generatePrintableReportHtml } from '@/lib/reportUtils';
import { Loader2 } from 'lucide-react';

const PrintableReportLayout = () => {
    const { type, id } = useParams();
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRecordAndGenerateReport = async () => {
            setLoading(true);
            setError(null);

            if (!type || !id) {
                setError('Rapor tipi veya ID eksik.');
                setLoading(false);
                return;
            }

            try {
                let record;
                let fetchError;
                let query;

                switch (type) {
                    case 'kaizen':
                        query = supabase.from('kaizen_entries').select(`*, proposer:proposer_id(full_name), responsible_person:responsible_person_id(full_name), department:department_id(unit_name)`).eq('id', id).single();
                        break;
                    case 'nonconformity':
                        query = supabase.from('non_conformities').select(`*, responsible_person_details:responsible_personnel_id(id, full_name), requesting_person_details:created_by(id, full_name)`).eq('id', id).single();
                        break;
                    case 'deviation':
                        query = supabase.from('deviations').select(`*, deviation_attachments(*), deviation_vehicles(*), deviation_approvals(*)`).eq('id', id).single();
                        break;
                    case 'quarantine':
                        query = supabase.from('quarantine_records').select(`*, quarantine_history(*)`).eq('id', id).single();
                        break;
                    case 'incoming_inspection':
                         query = supabase.from('incoming_inspections').select(`*, supplier:suppliers(name), results:incoming_inspection_results(*), defects:incoming_inspection_defects(*), attachments:incoming_inspection_attachments(*)`).eq('id', id).single();
                        break;
                    case 'sheet_metal_entry':
                        query = supabase.from('sheet_metal_entries').select(`*, supplier:suppliers(name), sheet_metal_items(*)`).eq('id', id).single();
                        break;
                    default:
                        setError(`Desteklenmeyen rapor tipi: ${type}`);
                        setLoading(false);
                        return;
                }

                const { data, error: queryError } = await query;
                record = data;
                fetchError = queryError;
                
                if (fetchError) throw fetchError;
                if (!record) { setError('Kayıt bulunamadı.'); setLoading(false); return; }

                if (type === 'kaizen' && record.team_members?.length > 0) {
                    const { data: teamMembersData, error: teamMembersError } = await supabase
                        .from('personnel').select('id, full_name').in('id', record.team_members);
                    if (teamMembersError) console.warn("Ekip üyeleri alınamadı:", teamMembersError.message);
                    record.personnel_team = teamMembersData || [];
                }
                
                const content = generatePrintableReportHtml(record, type);
                setHtmlContent(content);

            } catch (e) {
                console.error("Rapor oluşturma hatası:", e);
                setError(`Veri alınırken veya rapor oluşturulurken bir hata oluştu: ${e.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchRecordAndGenerateReport();
    }, [type, id]);

    useEffect(() => {
        if (!loading && !error && htmlContent) {
            document.body.innerHTML = htmlContent;
            const images = Array.from(document.querySelectorAll('img'));
            if (images.length === 0) {
                 setTimeout(() => window.print(), 500);
                 return;
            }
            const imagePromises = images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve; // Continue even if an image fails
                });
            });

            Promise.all(imagePromises).then(() => {
                setTimeout(() => {
                    window.print();
                }, 1000); // Small delay to ensure rendering
            });
        }
    }, [loading, error, htmlContent]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', flexDirection: 'column', gap: '20px' }}>
                <Loader2 size={48} className="animate-spin" />
                <p>Rapor hazırlanıyor, lütfen bekleyin...</p>
            </div>
        );
    }

    if (error) {
        return <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>Hata: {error}</div>;
    }

    return null; // The content is directly injected into the body
};

export default PrintableReportLayout;