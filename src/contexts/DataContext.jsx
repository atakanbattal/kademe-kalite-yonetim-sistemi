
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider = ({ children }) => {
    const { toast } = useToast();
    const { session, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        qualityCosts: [],
        personnel: [],
        unitCostSettings: [],
        materialCostSettings: [],
        producedVehicles: [],
        productionDepartments: [],
        nonConformities: [],
        nonconformityRecords: [],
        suppliers: [],
        supplierNonConformities: [],
        audits: [],
        auditFindings: [],
        documents: [],
        equipments: [],
        deviations: [],
        quarantineRecords: [],
        incomingInspections: [],
        kpis: [],
        tasks: [],
        taskTags: [],
        taskProjects: [], // Görev projeleri
        incomingControlPlans: [],
        processControlPlans: [],
        characteristics: [],
        equipment: [],
        standards: [],
        questions: [],
        kaizenEntries: [],
        auditLogs: [],
        stockRiskControls: [],
        inkrReports: [],
        customers: [],
        customerComplaints: [],
        complaintAnalyses: [],
        complaintActions: [],
        complaintDocuments: [],
        products: [],
        productCategories: [],
        trainings: [],
    });

    // İlk yükleme flag'i - sonsuz döngüyü önlemek için
    const initialLoadDone = useRef(false);
    const fetchInProgress = useRef(false);

    const logAudit = useCallback(async (action, details, table) => {
        if (!profile) return;
        try {
            const { error } = await supabase.from('audit_log_entries').insert({
                user_id: profile.id,
                user_full_name: profile.full_name,
                action: action,
                details: details,
                table_name: table,
            });
            if (error) {
                // 403 veya 500 hatası RLS politikası veya sunucu sorunu olabilir, sessizce geç
                if (error.code === 'PGRST301' || error.code === '42501' || error.status === 403 || error.status === 500) {
                    console.warn('⚠️ Audit log yazılamadı (RLS politikası veya sunucu hatası):', error.message);
                    return;
                }
                console.error('❌ Audit log error:', error);
            }
        } catch (error) {
            // 403 veya 500 hatası RLS politikası veya sunucu sorunu olabilir, sessizce geç
            if (error.code === 'PGRST301' || error.code === '42501' || error.status === 403 || error.status === 500) {
                console.warn('⚠️ Audit log yazılamadı (RLS politikası veya sunucu hatası):', error.message);
                return;
            }
            console.error('❌ Audit log error:', error);
        }
    }, [profile]);


    const fetchData = useCallback(async (forceRefresh = false) => {
        // Session yoksa dön
        if (!session) {
            setLoading(false);
            return;
        }

        // Eğer fetch devam ediyorsa ve force refresh yoksa, bekle
        if (fetchInProgress.current && !forceRefresh) {
            console.log('⏳ Fetch already in progress, skipping...');
            return;
        }

        fetchInProgress.current = true;
        setLoading(true);

        console.time('🚀 Total Data Fetch Time');

        // DALGA 0: Minimal veri - arayüz hemen açılsın (~1-2 sn)
        const instantPromises = {
            personnel: supabase.from('personnel').select('id, full_name, email, avatar_url, department, unit_id, is_active, registration_number, job_title, management_department, collar_type, unit:cost_settings(unit_name)').order('full_name'),
            productionDepartments: supabase.from('production_departments').select('*'),
            taskTags: supabase.from('task_tags').select('*'),
            taskProjects: supabase.from('task_projects').select('*').order('name'),
            unitCostSettings: supabase.from('cost_settings').select('*'),
        };

        // KRİTİK TABLOLAR (İkinci dalga)
        const criticalPromises = {
            auditLogs: (async () => {
                try {
                    const { data, error } = await supabase
                        .from('audit_log_entries')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(2000);
                    if (error) {
                        if (error.code === 'PGRST301' || error.code === '42501' || error.status === 403) {
                            console.warn('⚠️ Audit logs çekilemedi (RLS):', error.message);
                            return { data: [], error: null };
                        }
                        throw error;
                    }
                    return { data: data || [], error: null };
                } catch (error) {
                    console.warn('⚠️ Audit logs fetch failed:', error);
                    return { data: [], error: null };
                }
            })(),
            characteristics: supabase.from('characteristics').select('id, name, type, sampling_rate'),
            equipment: supabase.from('measurement_equipment').select('id, name').order('name', { ascending: true }),
            standards: supabase.from('audit_standards').select('id, code, name'),
            customers: supabase.from('customers').select('*').order('name'),
            products: supabase.from('products').select('*, product_categories(category_code, category_name)').eq('is_active', true).order('product_name'),
            productCategories: supabase.from('product_categories').select('*').eq('is_active', true).order('order_index'),
        };

        // ORTA ÖNCELİKLİ TABLOLAR (İkinci dalga)
        const mediumPromises = {
            producedVehicles: supabase.from('quality_inspections').select('*, quality_inspection_history(*), quality_inspection_faults(*, fault_category:fault_categories(name)), vehicle_timeline_events(*)').limit(500),
            nonConformities: supabase.from('non_conformities').select('*, supplier:supplier_id(name)'),
            nonconformityRecords: supabase.from('nonconformity_records').select('*').order('detection_date', { ascending: false }).limit(500),
            deviations: supabase.from('deviations').select('*, deviation_approvals(*), deviation_attachments(*), deviation_vehicles(*)'),
            kaizenEntries: supabase.from('kaizen_entries').select('*, proposer:proposer_id(full_name), responsible_person:responsible_person_id(full_name), approver:approver_id(full_name), department:department_id(unit_name, cost_per_minute), supplier:supplier_id(name)'),
            tasks: supabase.from('tasks').select('*, owner:owner_id(full_name, email), project:project_id(id, name, color), assignees:task_assignees(personnel(id, full_name, email, avatar_url)), tags:task_tag_relations(task_tags(id, name, color)), checklist:task_checklists(*)'),
            qualityCosts: (async () => {
                // Pagination ile tüm kayıtları çek (Supabase 1000 limit aşmak için)
                const allCosts = [];
                let from = 0;
                const pageSize = 1000;
                let hasMore = true;
                
                while (hasMore) {
                    const { data, error } = await supabase
                        .from('quality_costs')
                        .select('*, supplier:supplier_id(name), responsible_personnel:responsible_personnel_id(full_name)')
                        .order('created_at', { ascending: false })
                        .range(from, from + pageSize - 1);
                    
                    if (error) {
                        console.error('❌ Quality costs fetch error:', error);
                        return { data: allCosts, error: null };
                    }
                    
                    if (data && data.length > 0) {
                        allCosts.push(...data);
                        from += pageSize;
                        hasMore = data.length === pageSize;
                    } else {
                        hasMore = false;
                    }
                }
                
                console.log('✅ Quality costs fetched with pagination:', allCosts.length, 'records');
                return { data: allCosts, error: null };
            })(),
            kpis: supabase.from('kpis').select('*'),
            materialCostSettings: supabase.from('material_costs').select('*'),
        };

        // AĞIR TABLOLAR (Üçüncü dalga - limit ile)
        const heavyPromises = {
            suppliers: supabase.from('suppliers').select('*, alternative_supplier:suppliers!alternative_to_supplier_id(id, name), supplier_certificates(valid_until), supplier_audits(*), supplier_scores(final_score, grade, period), supplier_audit_plans(*)'),
            equipments: supabase.from('equipments').select('*, equipment_calibrations(*), equipment_assignments(*, personnel(full_name))'),
            // Documents sorgusu - dokümanları ve revizyonları toplu çekerek N+1 sorgularını önle
            documents: (async () => {
                try {
                    const { data: docsData, error: docsError } = await supabase
                        .from('documents')
                        .select('*, department:department_id(id, unit_name), personnel:personnel_id(id, full_name), owner:owner_id(id, full_name)')
                        .order('created_at', { ascending: false });

                    if (docsError) throw docsError;
                    if (!docsData || docsData.length === 0) {
                        return { data: [], error: null };
                    }

                    const documentIds = docsData.map(doc => doc.id).filter(Boolean);
                    let revisionsByDocumentId = new Map();

                    if (documentIds.length > 0) {
                        const { data: revisionsData, error: revisionsError } = await supabase
                            .from('document_revisions')
                            .select('*')
                            .in('document_id', documentIds)
                            .order('document_id', { ascending: true })
                            .order('revision_number', { ascending: false });

                        if (revisionsError) {
                            console.warn('⚠️ Document revisions toplu çekilemedi:', revisionsError);
                        } else {
                            revisionsByDocumentId = (revisionsData || []).reduce((map, revision) => {
                                const revisions = map.get(revision.document_id) || [];
                                revisions.push(revision);
                                map.set(revision.document_id, revisions);
                                return map;
                            }, new Map());
                        }
                    }

                    const docsWithRevisions = docsData.map(doc => ({
                        ...doc,
                        document_revisions: revisionsByDocumentId.get(doc.id) || []
                    }));

                    return { data: docsWithRevisions, error: null };
                } catch (error) {
                    console.error('❌ Documents fetch error:', error);
                    return { data: [], error };
                }
            })(),
        };

        // DÜŞÜK ÖNCELİKLİ TABLOLAR (Son dalga - limit ile)
        const lowPriorityPromises = {
            supplierNonConformities: supabase.from('supplier_non_conformities').select('*'),
            audits: supabase.from('audits').select(`
                    *,
                    department:cost_settings(id, unit_name),
                    audit_standard:audit_standards!audit_standard_id(id, code, name)
                `).order('report_number', { ascending: false }),
            auditFindings: supabase.from('audit_findings').select('*, audits(report_number), non_conformities!source_finding_id(id, nc_number, status, due_at, due_date)'),
            quarantineRecords: supabase.from('quarantine_records_api').select('*').order('quarantine_date', { ascending: false }).limit(500),
            incomingInspections: supabase.from('incoming_inspections_with_supplier').select('*').limit(500),
            incomingControlPlans: supabase.from('incoming_control_plans').select('part_code, is_current'),
            processControlPlans: (async () => {
                try {
                    const { data, error } = await supabase.from('process_control_plans').select('id').eq('is_active', true);
                    return error ? { data: [], error } : { data: data || [], error: null };
                } catch (e) {
                    return { data: [], error: null };
                }
            })(),
            questions: supabase.from('supplier_audit_questions').select('*'),
            stockRiskControls: supabase.from('stock_risk_controls').select(`
                    *,
                    supplier:suppliers!stock_risk_controls_supplier_id_fkey(id, name),
                    source_inspection:incoming_inspections!stock_risk_controls_source_inspection_id_fkey(id, record_no, part_code, part_name),
                    controlled_inspection:incoming_inspections!stock_risk_controls_controlled_inspection_id_fkey(id, record_no, part_code, part_name, delivery_note_number),
                    controlled_by:profiles!stock_risk_controls_controlled_by_id_fkey(id, full_name)
                `).order('created_at', { ascending: false }).limit(200),
            inkrReports: supabase.from('inkr_reports').select('*, supplier:supplier_id(name)').order('created_at', { ascending: false }),
            customerComplaints: supabase.from('customer_complaints').select('*, customer:customer_id(name, customer_name, customer_code), responsible_person:responsible_personnel_id(full_name), assigned_to:assigned_to_id(full_name), responsible_department:responsible_department_id(unit_name)').order('complaint_date', { ascending: false }).limit(500),
            complaintAnalyses: supabase.from('complaint_analyses').select('*'),
            complaintActions: supabase.from('complaint_actions').select('*, responsible_person:responsible_person_id(full_name), responsible_department:responsible_department_id(unit_name)'),
            complaintDocuments: supabase.from('complaint_documents').select('*'),
            trainings: supabase.from('trainings').select('id, title, start_date, end_date, status, created_at, instructor, duration_hours, training_participants(count)').order('start_date', { ascending: false }).limit(500),
        };

        try {
            const newState = {};

            // DALGA 0: Minimal veri - arayüz hemen açılsın
            console.time('⚡ Instant data fetch');
            const instantResults = await Promise.allSettled(Object.values(instantPromises));
            const instantKeys = Object.keys(instantPromises);
            instantResults.forEach((result, index) => {
                const key = instantKeys[index];
                const val = result.status === 'fulfilled' ? result.value : null;
                newState[key] = (val && !val.error && val.data) ? val.data : [];
            });
            setData(prev => ({ ...prev, ...newState }));
            setLoading(false); // Arayüz hemen göster
            console.timeEnd('⚡ Instant data fetch');

            // DALGA 1: Kritik veriler
            console.time('⚡ Critical data fetch');
            const criticalResults = await Promise.allSettled(Object.values(criticalPromises));
            const criticalKeys = Object.keys(criticalPromises);

            criticalResults.forEach((result, index) => {
                const key = criticalKeys[index];
                if (result.status === 'fulfilled' && !result.value.error) {
                    // Transform karakteristikleri, ekipmanları ve standartları
                    if (key === 'characteristics' && result.value.data) {
                        newState[key] = result.value.data.map(c => ({ value: c.id, label: c.name, type: c.type, sampling_rate: c.sampling_rate }));
                    } else if (key === 'equipment' && result.value.data) {
                        newState[key] = result.value.data.map(e => ({ value: e.id, label: e.name }));
                    } else if (key === 'standards' && result.value.data) {
                        newState[key] = result.value.data.map(s => ({ value: s.id, label: s.name || s.code, id: s.id, name: s.name, code: s.code }));
                    } else if (key === 'products' && result.value.data) {
                        // Products'ı kategoriye göre grupla ve transform et
                        newState[key] = result.value.data.map(p => ({
                            ...p,
                            value: p.id,
                            label: p.product_name,
                            category_code: p.product_categories?.category_code
                        }));
                    } else {
                        newState[key] = result.value.data || [];
                    }
                } else {
                    const error = result.reason || result.value?.error;
                    // Sessiz hata - console'a yaz ama toast gösterme
                    console.warn(`⚠️ ${key} fetch failed:`, error);

                    // Tablo bulunamadı hatası - bu normal olabilir
                    if (error?.code === 'PGRST205' || error?.code === '42P01') {
                        console.warn(`⚠️ ${key} tablosu henüz oluşturulmamış`);
                    }

                    newState[key] = [];
                }
            });
            console.timeEnd('⚡ Critical data fetch');

            // İlk state update - kullanıcı hemen temel verileri görsün
            setData(prev => ({ ...prev, ...newState }));
            setLoading(false);

            // DALGA 2: Orta öncelikli veriler
            console.time('⚡ Medium priority data fetch');
            const mediumResults = await Promise.allSettled(Object.values(mediumPromises));
            const mediumKeys = Object.keys(mediumPromises);

            mediumResults.forEach((result, index) => {
                const key = mediumKeys[index];
                if (result.status === 'fulfilled' && !result.value.error) {
                    newState[key] = result.value.data || [];
                } else {
                    const error = result.reason || result.value?.error;
                    console.warn(`⚠️ ${key} fetch failed:`, error);
                    if (key === 'qualityCosts') {
                        console.error('❌ Quality Costs Fetch Error Details:', {
                            message: error?.message,
                            code: error?.code,
                            details: error?.details,
                            hint: error?.hint
                        });
                    }
                    newState[key] = [];
                }
            });
            console.timeEnd('⚡ Medium priority data fetch');

            // İkinci state update
            setData(prev => ({ ...prev, ...newState }));

            // DALGA 3: Ağır tablolar
            console.time('⚡ Heavy data fetch');
            const heavyResults = await Promise.allSettled(Object.values(heavyPromises));
            const heavyKeys = Object.keys(heavyPromises);

            heavyResults.forEach((result, index) => {
                const key = heavyKeys[index];
                if (result.status === 'fulfilled') {
                    // Documents için özel kontrol - async fonksiyon { data, error } döndürüyor
                    if (key === 'documents') {
                        const documentsResult = result.value;
                        if (!documentsResult.error && documentsResult.data) {
                            newState[key] = documentsResult.data || [];
                            console.log('📚 Documents fetch başarılı:', documentsResult.data?.length || 0, 'doküman');
                            if (documentsResult.data && documentsResult.data.length > 0) {
                                console.log('📚 İlk doküman örneği:', documentsResult.data[0]);
                                console.log('📚 Doküman tipleri:', [...new Set(documentsResult.data.map(d => d.document_type).filter(Boolean))]);
                            }
                        } else {
                            console.error('❌ Documents fetch failed:', documentsResult.error);
                            console.error('❌ Documents sorgu hatası detayları:', {
                                error: documentsResult.error,
                                message: documentsResult.error?.message,
                                details: documentsResult.error?.details,
                                hint: documentsResult.error?.hint
                            });
                            newState[key] = [];
                        }
                    } else {
                        // Diğer tablolar için normal kontrol
                        if (!result.value.error) {
                            newState[key] = result.value.data || [];
                        } else {
                            console.error(`❌ ${key} fetch failed:`, result.value.error);
                            newState[key] = [];
                        }
                    }
                } else {
                    const error = result.reason || result.value?.error;
                    console.error(`❌ ${key} fetch failed:`, error);
                    newState[key] = [];
                }
            });
            console.timeEnd('⚡ Heavy data fetch');

            // Üçüncü state update
            setData(prev => ({ ...prev, ...newState }));

            // DALGA 4: Düşük öncelikli
            console.time('⚡ Low priority data fetch');
            const lowPriorityResults = await Promise.allSettled(Object.values(lowPriorityPromises));
            const lowPriorityKeys = Object.keys(lowPriorityPromises);

            lowPriorityResults.forEach((result, index) => {
                const key = lowPriorityKeys[index];
                if (result.status === 'fulfilled') {
                    // auditLogs için özel kontrol (async fonksiyon { data, error } döndürüyor)
                    if (key === 'auditLogs') {
                        const auditLogsResult = result.value;
                        if (!auditLogsResult.error && auditLogsResult.data) {
                            newState[key] = auditLogsResult.data || [];
                        } else {
                            console.warn(`⚠️ ${key} fetch failed:`, auditLogsResult.error);
                            newState[key] = [];
                        }
                    } else if (!result.value.error) {
                        newState[key] = result.value.data || [];
                    } else {
                        console.warn(`⚠️ ${key} fetch failed:`, result.value.error);
                        newState[key] = [];
                    }
                } else {
                    console.warn(`⚠️ ${key} fetch failed:`, result.reason || result.value?.error);
                    newState[key] = [];
                }
            });
            console.timeEnd('⚡ Low priority data fetch');

            // Final state update
            setData(prev => ({ ...prev, ...newState }));

            console.timeEnd('🚀 Total Data Fetch Time');
            console.log('✅ All data loaded successfully');

        } catch (error) {
            console.error("💥 General fetch error:", error);
            // Ağ hatasıysa, kullanıcıya bildir
            if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
                console.warn('⚠️ Network error during data fetch - will retry on next navigation');
                // Toast yerine sessiz hata - sürekli toast göstermek UX'i bozar
            }
        } finally {
            fetchInProgress.current = false;
            setLoading(false);
        }
    }, [session, toast]); // Sadece session ve toast'a bağımlı

    // İlk yükleme - SADECE BİR KEZ
    useEffect(() => {
        if (session && !initialLoadDone.current) {
            console.log('🎯 Initial data load triggered');
            initialLoadDone.current = true;
            fetchData();
        } else if (!session) {
            setLoading(false);
            initialLoadDone.current = false;
        }
    }, [session]); // fetchData'yı buraya ekleme - sonsuz döngü olur!

    // Realtime subscription - SADECE KRİTİK TABLOLARI DİNLE
    useEffect(() => {
        if (!session) return;

        // KPI'ları yenileme fonksiyonu (inline - hoisting sorununu önler)
        const refreshKpisInline = async () => {
            try {
                const { data, error } = await supabase
                    .from('kpis')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setData(prev => ({ ...prev, kpis: data }));
                    console.log('✅ KPIs refreshed via realtime:', data.length, 'kpis');
                }
            } catch (err) {
                console.error('❌ KPIs realtime refresh error:', err);
            }
        };

        const handleDbChanges = (payload) => {
            const { eventType, table, new: newRecord, old: oldRecord } = payload;
            let action = '';
            let details = {};

            switch (eventType) {
                case 'INSERT':
                    action = 'EKLEME';
                    details = { new: newRecord };
                    break;
                case 'UPDATE':
                    action = 'GÜNCELLEME';
                    details = { id: oldRecord?.id, changes: newRecord };
                    break;
                case 'DELETE':
                    action = 'SİLME';
                    details = { old: oldRecord };
                    break;
                default:
                    return;
            }

            // Audit log - performance impact azaltmak için
            if (!['quality_inspection_history', 'vehicle_timeline_events', 'audit_log_entries'].includes(table)) {
                logAudit(action, details, table);
            }

            // Realtime güncelleme yerine manual refresh kullanılsın
            console.log(`🔄 DB Change detected: ${table} - ${eventType}`);
        };

        // SADECE KRİTİK TABLOLARI DİNLE (kpis, quality_costs ve documents dahil)
        const criticalTables = ['tasks', 'non_conformities', 'deviations', 'personnel', 'kpis', 'quality_costs', 'documents'];

        const subscription = supabase.channel('critical-db-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                filter: `table=in.(${criticalTables.join(',')})`
            }, (payload) => {
                handleDbChanges(payload);
                // KPI tablosu değiştiyse otomatik refresh
                if (payload.table === 'kpis') {
                    console.log('🔄 KPI değişikliği algılandı, yenileniyor...');
                    refreshKpisInline();
                }
                // Quality costs tablosu değiştiyse direkt state güncelle
                if (payload.table === 'quality_costs') {
                    console.log('🔄 Quality costs değişikliği algılandı:', payload.eventType);
                    setData(prev => {
                        let newCosts = [...(prev.qualityCosts || [])];
                        if (payload.eventType === 'INSERT') {
                            newCosts = [payload.new, ...newCosts];
                        } else if (payload.eventType === 'UPDATE') {
                            newCosts = newCosts.map(c => c.id === payload.new.id ? payload.new : c);
                        } else if (payload.eventType === 'DELETE') {
                            newCosts = newCosts.filter(c => c.id !== payload.old.id);
                        }
                        console.log('✅ Quality costs güncellendi:', newCosts.length, 'kayıt');
                        return { ...prev, qualityCosts: newCosts };
                    });
                }
                // Documents tablosu değiştiyse full refresh (doküman numaraları trigger ile güncellendiği için)
                if (payload.table === 'documents') {
                    console.log('🔄 Documents değişikliği algılandı:', payload.eventType);
                    // Doküman numaraları database trigger ile güncellendiğinden full refresh gerekli
                    refreshData();
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Connected to critical tables realtime channel');
                }
                if (status === 'CHANNEL_ERROR') {
                    // Ağ kesintisi veya geçici bağlantı kaybı - kullanıcıyı rahatsız etmeden sessizce logla
                    if (err?.message?.includes('network') || err?.message?.includes('WebSocket') || !err) {
                        console.debug('Realtime bağlantısı geçici olarak kesildi (otomatik yeniden bağlanacak)');
                    } else {
                        console.warn('Realtime channel uyarısı:', err?.message || err);
                    }
                }
            });

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [session, logAudit]);

    const refreshProducedVehicles = useCallback(async () => {
        if (!session) return;
        try {
            const { data, error } = await supabase
                .from('quality_inspections')
                .select('*, quality_inspection_history(*), quality_inspection_faults(*, fault_category:fault_categories(name)), vehicle_timeline_events(*)')
                .limit(500);

            if (error) {
                console.error('❌ Produced vehicles refresh failed:', error);
                return;
            }

            setData(prev => ({ ...prev, producedVehicles: data || [] }));
            console.log('✅ Produced vehicles refreshed:', data?.length || 0, 'vehicles');
        } catch (error) {
            console.error('❌ Produced vehicles refresh error:', error);
        }
    }, [session]);

    // Quality Costs'ları yenile (pagination ile)
    const refreshQualityCosts = useCallback(async () => {
        if (!session) return;
        try {
            console.log('🔄 Quality costs refresh starting...');
            
            // Pagination ile tüm kayıtları çek
            const allCosts = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabase
                    .from('quality_costs')
                    .select('*, supplier:supplier_id(name), responsible_personnel:responsible_personnel_id(full_name)')
                    .order('created_at', { ascending: false })
                    .range(from, from + pageSize - 1);
                
                if (error) {
                    console.error('❌ Quality costs fetch error:', error);
                    break;
                }
                
                if (data && data.length > 0) {
                    allCosts.push(...data);
                    from += pageSize;
                    hasMore = data.length === pageSize;
                } else {
                    hasMore = false;
                }
            }

            setData(prev => ({ ...prev, qualityCosts: allCosts }));
            console.log('✅ Quality costs refreshed:', allCosts.length, 'costs');
        } catch (error) {
            console.error('❌ Quality costs refresh error:', error);
        }
    }, [session]);

    // KPI'ları yenile — kpis.target_value null ise kpi_monthly_data'dan bu ayın hedefini kullan
    const refreshKpis = useCallback(async () => {
        if (!session) return;
        try {
            const { data, error } = await supabase
                .from('kpis')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ KPIs refresh failed:', error);
                return;
            }

            const kpisRaw = data || [];
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            const { data: monthlyData } = await supabase
                .from('kpi_monthly_data')
                .select('kpi_id, target_value')
                .eq('year', currentYear)
                .eq('month', currentMonth);

            const monthlyTargetByKpi = {};
            (monthlyData || []).forEach(m => {
                if (m.target_value != null) monthlyTargetByKpi[m.kpi_id] = m.target_value;
            });

            const kpis = kpisRaw.map(k => {
                const needsFallback = (k.target_value == null || parseFloat(k.target_value) === 0) && monthlyTargetByKpi[k.id] != null;
                return needsFallback ? { ...k, target_value: monthlyTargetByKpi[k.id] } : k;
            });

            setData(prev => ({ ...prev, kpis }));
            console.log('✅ KPIs refreshed:', kpis.length, 'kpis');
        } catch (error) {
            console.error('❌ KPIs refresh error:', error);
        }
    }, [session]);

    // Otomatik KPI'ların değerlerini güncelle (RPC'den çekerek)
    const refreshAutoKpis = useCallback(async () => {
        if (!session) return;
        try {
            // Önce mevcut KPI'ları al
            const { data: kpis, error: fetchError } = await supabase
                .from('kpis')
                .select('*')
                .eq('is_auto', true);

            if (fetchError) {
                console.error('❌ Auto KPIs fetch failed:', fetchError);
                return;
            }

            if (!kpis || kpis.length === 0) {
                console.log('ℹ️ No auto KPIs to update');
                return;
            }

            console.log('🔄 Updating', kpis.length, 'auto KPIs...');

            // Her otomatik KPI için RPC çağrısı yap ve güncelle
            const updatePromises = kpis.map(async (kpi) => {
                if (!kpi.auto_kpi_id) return null;

                // kpi-definitions'dan RPC adını bul
                const rpcName = getRpcNameFromAutoKpiId(kpi.auto_kpi_id);
                if (!rpcName) return null;

                try {
                    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName);

                    if (rpcError) {
                        console.warn(`⚠️ RPC ${rpcName} failed:`, rpcError.message);
                        return null;
                    }

                    // KPI'ı güncelle
                    const { error: updateError } = await supabase
                        .from('kpis')
                        .update({ current_value: rpcData, updated_at: new Date().toISOString() })
                        .eq('id', kpi.id);

                    if (updateError) {
                        console.warn(`⚠️ KPI ${kpi.name} update failed:`, updateError.message);
                        return null;
                    }

                    return { id: kpi.id, name: kpi.name, value: rpcData };
                } catch (err) {
                    console.warn(`⚠️ Error updating KPI ${kpi.name}:`, err);
                    return null;
                }
            });

            const results = await Promise.all(updatePromises);
            const successCount = results.filter(r => r !== null).length;
            console.log('✅ Auto KPIs updated:', successCount, 'of', kpis.length);

            // Aylık trend verilerini otomatik backfill et (13 ay geçmiş)
            try {
                const { error: backfillError } = await supabase.rpc('backfill_kpi_monthly_data', { p_months_back: 13 });
                if (backfillError) {
                    console.warn('⚠️ KPI monthly backfill failed:', backfillError.message);
                } else {
                    console.log('✅ KPI monthly trend data backfilled');
                }
            } catch (backfillErr) {
                console.warn('⚠️ KPI monthly backfill error:', backfillErr);
            }

            // KPI listesini yenile
            await refreshKpis();
        } catch (error) {
            console.error('❌ Auto KPIs refresh error:', error);
        }
    }, [session, refreshKpis]);

    // auto_kpi_id'den RPC adını döndür
    const getRpcNameFromAutoKpiId = (autoKpiId) => {
        const rpcMap = {
            'open_non_conformities_count': 'get_open_non_conformities_count',
            'open_8d_count': 'get_open_8d_count',
            'df_closure_rate': 'get_df_closure_rate',
            'avg_quality_nc_closure_time': 'get_avg_quality_nc_closure_time',
            'avg_quality_process_time': 'get_avg_quality_process_time',
            'produced_vehicles_count': 'get_produced_vehicles_count',
            'quality_inspection_pass_rate': 'get_quality_inspection_pass_rate',
            'avg_quality_inspection_time': 'get_avg_quality_inspection_time',
            'quarantine_count': 'get_quarantine_count',
            'non_quality_cost': 'get_total_quality_cost',
            'expired_document_count': 'get_expired_document_count',
            'open_deviation_count': 'get_open_deviation_count',
            'calibration_due_count': 'get_calibration_due_count',
            'open_internal_audit_count': 'get_open_internal_audit_count',
            'open_supplier_nc_count': 'get_open_supplier_nc_count',
            'active_suppliers_count': 'get_active_suppliers_count',
            'avg_supplier_score': 'get_avg_supplier_score',
            'supplier_nc_rate': 'get_supplier_nc_rate',
            'incoming_rejection_rate': 'get_incoming_rejection_rate',
            'active_spc_characteristics_count': 'get_active_spc_characteristics_count',
            'out_of_control_processes_count': 'get_out_of_control_processes_count',
            'capable_processes_rate': 'get_capable_processes_rate',
            'msa_studies_count': 'get_msa_studies_count',
            'active_production_plans_count': 'get_active_production_plans_count',
            'critical_characteristics_count': 'get_critical_characteristics_count',
            'process_parameter_records_count': 'get_process_parameter_records_count',
            'active_validation_plans_count': 'get_active_validation_plans_count',
            'completed_validations_rate': 'get_completed_validations_rate',
            'active_fmea_projects_count': 'get_active_fmea_projects_count',
            'high_rpn_count': 'get_high_rpn_count',
            'completed_fmea_actions_rate': 'get_completed_fmea_actions_rate',
            'active_apqp_projects_count': 'get_active_apqp_projects_count',
            'pending_ppap_approvals_count': 'get_pending_ppap_approvals_count',
            'run_at_rate_completion_rate': 'get_run_at_rate_completion_rate',
            'active_dmaic_projects_count': 'get_active_dmaic_projects_count',
            'completed_dmaic_projects_count': 'get_completed_dmaic_projects_count',
            'dmaic_success_rate': 'get_dmaic_success_rate',
            'open_customer_complaints_count': 'get_open_customer_complaints_count',
            'sla_compliant_complaints_rate': 'get_sla_compliant_complaints_rate',
            'avg_complaint_resolution_time': 'get_avg_complaint_resolution_time',
            'active_kaizen_count': 'get_active_kaizen_count',
            'completed_kaizen_count': 'get_completed_kaizen_count',
            'kaizen_success_rate': 'get_kaizen_success_rate',
            'planned_trainings_count': 'get_planned_trainings_count',
            'completed_trainings_count': 'get_completed_trainings_count',
            'training_participation_rate': 'get_training_participation_rate',
            'avg_polyvalence_score': 'get_avg_polyvalence_score',
            'critical_skill_gaps_count': 'get_critical_skill_gaps_count',
            'expired_certifications_count': 'get_expired_certifications_count',
            'active_benchmarks_count': 'get_active_benchmarks_count',
            'completed_benchmarks_count': 'get_completed_benchmarks_count',
            'active_wps_procedures_count': 'get_active_wps_procedures_count',
            'pending_wps_approvals_count': 'get_pending_wps_approvals_count',
            'open_tasks_count': 'get_open_tasks_count',
            'overdue_tasks_count': 'get_overdue_tasks_count',
            'task_completion_rate': 'get_task_completion_rate',
            'nps_score': 'get_nps_score',
            'satisfaction_surveys_count': 'get_satisfaction_surveys_count',
            'avg_customer_satisfaction_score': 'get_avg_customer_satisfaction_score',
            'active_supplier_development_plans_count': 'get_active_supplier_development_plans_count',
            'completed_supplier_development_plans_count': 'get_completed_supplier_development_plans_count',
            // Uygunsuzluk Yönetimi
            'open_nonconformity_count': 'get_open_nonconformity_count',
            'nonconformity_closure_rate': 'get_nonconformity_closure_rate',
            'nonconformity_30d_count': 'get_nonconformity_30d_count',
            'critical_nonconformity_count': 'get_critical_nonconformity_count',
            'nonconformity_df_8d_conversion_rate': 'get_nonconformity_df_8d_conversion_rate',
            // Sızdırmazlık Kontrol
            'leak_test_pass_rate': 'get_leak_test_pass_rate',
            'leak_test_30d_count': 'get_leak_test_30d_count',
            'leak_test_rejection_30d_count': 'get_leak_test_rejection_30d_count',
            // Fikstür
            'active_fixture_count': 'get_active_fixture_count',
            'fixture_nonconformity_count': 'get_fixture_nonconformity_count',
            'total_fixture_count': 'get_total_fixture_count',
            // Proses Kontrol
            'process_inkr_30d_count': 'get_process_inkr_30d_count',
            'process_inkr_total_count': 'get_process_inkr_total_count',
            // Satış Sonrası / Müşteri
            'after_sales_open_count': 'get_after_sales_open_count',
            'after_sales_30d_count': 'get_after_sales_30d_count',
            // Görev Yönetimi ek
            'completed_tasks_30d_count': 'get_completed_tasks_30d_count',
            // Kalite Maliyeti
            'total_quality_cost': 'get_total_quality_cost',
        };
        return rpcMap[autoKpiId] || null;
    };

    // Modül bazlı refresh fonksiyonları
    // Her modül sadece kendi verisini yenileyebilir (full refresh yerine)
    const refreshSuppliers = useCallback(async () => {
        if (!session) return;
        try {
            const { data: suppData, error } = await supabase.from('suppliers').select('*, alternative_supplier:suppliers!alternative_to_supplier_id(id, name), supplier_certificates(valid_until), supplier_audits(*), supplier_scores(final_score, grade, period), supplier_audit_plans(*)');
            if (!error) {
                setData(prev => ({ ...prev, suppliers: suppData || [] }));
                console.log('✅ Suppliers refreshed:', suppData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Suppliers refresh error:', error);
        }
    }, [session]);

    const refreshNonConformities = useCallback(async () => {
        if (!session) return;
        try {
            const { data: ncData, error } = await supabase.from('non_conformities').select('*, supplier:supplier_id(name)');
            if (!error) {
                setData(prev => ({ ...prev, nonConformities: ncData || [] }));
                console.log('✅ Non-conformities refreshed:', ncData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Non-conformities refresh error:', error);
        }
    }, [session]);

    const refreshDeviations = useCallback(async () => {
        if (!session) return;
        try {
            const { data: devData, error } = await supabase.from('deviations').select('*, deviation_approvals(*), deviation_attachments(*), deviation_vehicles(*)');
            if (!error) {
                setData(prev => ({ ...prev, deviations: devData || [] }));
                console.log('✅ Deviations refreshed:', devData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Deviations refresh error:', error);
        }
    }, [session]);

    const refreshEquipments = useCallback(async () => {
        if (!session) return;
        try {
            const { data: eqData, error } = await supabase.from('equipments').select('*, equipment_calibrations(*), equipment_assignments(*, personnel(full_name))');
            if (!error) {
                setData(prev => ({ ...prev, equipments: eqData || [] }));
                console.log('✅ Equipments refreshed:', eqData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Equipments refresh error:', error);
        }
    }, [session]);

    const refreshEquipment = useCallback(async () => {
        if (!session) return;
        try {
            const { data: meData, error } = await supabase.from('measurement_equipment').select('id, name').order('name', { ascending: true });
            if (!error) {
                const mapped = (meData || []).map(e => ({ value: e.id, label: e.name }));
                setData(prev => ({ ...prev, equipment: mapped }));
                console.log('✅ Measurement equipment refreshed:', mapped.length);
            }
        } catch (error) {
            console.error('❌ Measurement equipment refresh error:', error);
        }
    }, [session]);

    const refreshIncomingInspections = useCallback(async () => {
        if (!session) return;
        try {
            const { data: iiData, error } = await supabase.from('incoming_inspections_with_supplier').select('*').limit(500);
            if (!error) {
                setData(prev => ({ ...prev, incomingInspections: iiData || [] }));
                console.log('✅ Incoming inspections refreshed:', iiData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Incoming inspections refresh error:', error);
        }
    }, [session]);

    const refreshCustomerComplaints = useCallback(async () => {
        if (!session) return;
        try {
            const { data: ccData, error } = await supabase.from('customer_complaints').select('*, customer:customer_id(name, customer_name, customer_code), responsible_person:responsible_personnel_id(full_name), assigned_to:assigned_to_id(full_name), responsible_department:responsible_department_id(unit_name)').order('complaint_date', { ascending: false }).limit(500);
            if (!error) {
                setData(prev => ({ ...prev, customerComplaints: ccData || [] }));
                console.log('✅ Customer complaints refreshed:', ccData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Customer complaints refresh error:', error);
        }
    }, [session]);

    const refreshTasks = useCallback(async () => {
        if (!session) return;
        try {
            const { data: taskData, error } = await supabase.from('tasks').select('*, owner:owner_id(full_name, email), project:project_id(id, name, color), assignees:task_assignees(personnel(id, full_name, email, avatar_url)), tags:task_tag_relations(task_tags(id, name, color)), checklist:task_checklists(*)');
            if (!error) {
                setData(prev => ({ ...prev, tasks: taskData || [] }));
                console.log('✅ Tasks refreshed:', taskData?.length || 0);
            }
        } catch (error) {
            console.error('❌ Tasks refresh error:', error);
        }
    }, [session]);

    // Context value'yu useMemo ile optimize et - gereksiz re-render'ları önler
    const value = useMemo(() => ({
        ...data,
        loading,
        refreshData: () => fetchData(true), // Force refresh (tüm data)
        // Modül bazlı refresh fonksiyonları (daha hızlı, daha az yük)
        refreshProducedVehicles,
        refreshQualityCosts,
        refreshKpis,
        refreshAutoKpis,
        refreshSuppliers,
        refreshNonConformities,
        refreshDeviations,
        refreshEquipments,
        refreshEquipment,
        refreshIncomingInspections,
        refreshCustomerComplaints,
        refreshTasks,
        logAudit,
    }), [
        data, loading, fetchData,
        refreshProducedVehicles, refreshQualityCosts, refreshKpis, refreshAutoKpis,
        refreshSuppliers, refreshNonConformities, refreshDeviations,
        refreshEquipments, refreshEquipment, refreshIncomingInspections, refreshCustomerComplaints,
        refreshTasks, logAudit,
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
