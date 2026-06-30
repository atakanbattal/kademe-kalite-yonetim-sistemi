import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { documentMatchesUnit, isLinkableDocument } from './processFlowConstants';

export function useLinkableDocuments(unitCode) {
    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingDocs(true);
            try {
                const { data, error } = await supabase
                    .from('documents')
                    .select('id, title, document_number, document_type, is_archived')
                    .not('document_number', 'is', null)
                    .order('document_number');
                if (error) throw error;
                if (!cancelled) setDocuments(data || []);
            } catch (err) {
                console.error('Doküman listesi alınamadı:', err);
                if (!cancelled) setDocuments([]);
            } finally {
                if (!cancelled) setLoadingDocs(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const options = useMemo(() => (
        (documents || [])
            .filter(isLinkableDocument)
            .map((doc) => ({
                value: doc.id,
                label: `${doc.document_number} — ${doc.title || doc.document_type}`,
                document_number: doc.document_number,
                unitMatch: documentMatchesUnit(doc, unitCode),
            }))
            .sort((a, b) => {
                if (a.unitMatch !== b.unitMatch) return a.unitMatch ? -1 : 1;
                return a.document_number.localeCompare(b.document_number, 'tr', { numeric: true });
            })
    ), [documents, unitCode]);

    return { options, loadingDocs };
}
