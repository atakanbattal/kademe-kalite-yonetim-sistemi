
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
            incomingControlPlans: [],
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
        });

        // İlk yükleme flag'i - sonsuz döngüyü önlemek için
        const initialLoadDone = useRef(false);
        const fetchInProgress = useRef(false);

        const logAudit = useCallback(async (action, details, table) => {
            if (!profile) return;
            try {
                await supabase.from('audit_log_entries').insert({
                    user_id: profile.id,
                    user_full_name: profile.full_name,
                    action: action,
                    details: details,
                    table_name: table,
                });
            } catch (error) {
                console.error('Audit log error:', error);
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

            // KRİTİK TABLOLAR (Hemen yükle)
            const criticalPromises = {
                personnel: supabase.from('personnel').select('id, full_name, email, avatar_url, department, unit_id, is_active').order('full_name'),
                unitCostSettings: supabase.from('cost_settings').select('*'),
                productionDepartments: supabase.from('production_departments').select('*'),
                taskTags: supabase.from('task_tags').select('*'),
                characteristics: supabase.from('characteristics').select('id, name, type, sampling_rate'),
                equipment: supabase.from('measurement_equipment').select('id, name').order('name', { ascending: true }),
                standards: supabase.from('tolerance_standards').select('id, name'),
                customers: supabase.from('customers').select('*').order('name'),
            };

            // ORTA ÖNCELİKLİ TABLOLAR (İkinci dalga)
            const mediumPromises = {
                nonConformities: supabase.from('non_conformities').select('id, nc_number, title, status, type, opening_date, due_date, department_id').order('opening_date', { ascending: false }).limit(300),
                deviations: supabase.from('deviations').select('id, request_no, title, status, created_at, deviation_approvals(id, status)').order('created_at', { ascending: false }).limit(200),
                kaizenEntries: supabase.from('kaizen_entries').select('id, kaizen_no, title, status, proposer:proposer_id(full_name), department:department_id(unit_name)').order('created_at', { ascending: false }).limit(200),
                tasks: supabase.from('tasks').select('id, title, status, priority, due_date, owner:owner_id(full_name), assignees:task_assignees(personnel(id, full_name))').order('created_at', { ascending: false }).limit(200),
                qualityCosts: supabase.from('quality_costs').select('id, cost_type, amount, date, responsible_personnel:personnel!responsible_personnel_id(full_name)').order('date', { ascending: false }).limit(200),
                kpis: supabase.from('kpis').select('id, name, current_value, target_value, unit').limit(100),
                materialCostSettings: supabase.from('material_costs').select('id, material_name, unit_cost').limit(100),
            };

            // AĞIR TABLOLAR (Üçüncü dalga - limit ile)
            const heavyPromises = {
                suppliers: supabase.from('suppliers').select('id, name, code, is_active, alternative_supplier:suppliers!alternative_to_supplier_id(id, name), supplier_certificates(valid_until), supplier_scores(final_score, grade, period)').limit(200),
                producedVehicles: supabase.from('quality_inspections').select('id, vehicle_vin, vehicle_model, inspection_date, status, quality_inspection_faults(id, fault_description)').order('inspection_date', { ascending: false }).limit(200),
                equipments: supabase.from('equipments').select('id, name, serial_number, status, responsible_unit, equipment_calibrations(id, calibration_date, next_calibration_date)').limit(200),
                // Documents sorgusu - önce documents çek, sonra document_revisions ayrı çekilecek
                documents: (async () => {
                    try {
                        // Önce documents'ı department, personnel ve owner bilgileriyle birlikte çek
                        const { data: docsData, error: docsError } = await supabase
                            .from('documents')
                            .select('*, department:department_id(id, unit_name), personnel:personnel_id(id, full_name), owner:owner_id(id, full_name)')
                            .order('created_at', { ascending: false });
                        
                        if (docsError) throw docsError;
                        if (!docsData || docsData.length === 0) {
                            return { data: [], error: null };
                        }
                        
                        // Her doküman için document_revisions ve personel bilgilerini çek
                        const docsWithRevisions = await Promise.all(docsData.map(async (doc) => {
                            const [revisionsResult, personnelResult, ownerResult] = await Promise.all([
                                // Document revisions
                                supabase.from('document_revisions').select('*').eq('document_id', doc.id),
                                // Personnel bilgisi (eğer personnel_id varsa)
                                doc.personnel_id ? supabase.from('personnel').select('id, full_name').eq('id', doc.personnel_id).single() : Promise.resolve({ data: null, error: null }),
                                // Owner bilgisi (eğer owner_id varsa)
                                doc.owner_id ? supabase.from('personnel').select('id, full_name').eq('id', doc.owner_id).single() : Promise.resolve({ data: null, error: null })
                            ]);
                            
                            const revisions = revisionsResult.data || [];
                            const personnel = personnelResult.data || null;
                            const owner = ownerResult.data || null;
                            
                            if (revisionsResult.error) {
                                console.warn(`⚠️ Document ${doc.id} için revisions çekilemedi:`, revisionsResult.error);
                            }
                            
                            return { 
                                ...doc, 
                                document_revisions: revisions,
                                personnel: personnel,
                                owner: owner
                            };
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
                supplierNonConformities: supabase.from('supplier_non_conformities').select('id, supplier_id, nc_number, status, created_at').limit(200),
                audits: supabase.from('audits').select(`
                    id, report_number, title, status, audit_date, department_id,
                    department:cost_settings(id, unit_name),
                    audit_standard:audit_standards!audit_standard_id(id, code, name)
                `).order('report_number', { ascending: false }).limit(100),
                auditFindings: supabase.from('audit_findings').select('id, audit_id, description, status, audits(report_number), non_conformities!source_finding_id(id, nc_number, status)').limit(200),
                quarantineRecords: supabase.from('quarantine_records_api').select('id, part_code, part_name, lot_no, quantity, status, created_at').order('created_at', { ascending: false }).limit(200),
                incomingInspections: supabase.from('incoming_inspections_with_supplier').select('id, record_no, part_code, part_name, inspection_date, decision, supplier_id').order('inspection_date', { ascending: false }).limit(200),
                incomingControlPlans: supabase.from('incoming_control_plans').select('id, part_code, is_current').limit(100),
                questions: supabase.from('supplier_audit_questions').select('id, question_text, points').limit(100),
                auditLogs: supabase.from('audit_log_entries').select('id, action, table_name, created_at, user_full_name').order('created_at', { ascending: false }).limit(100),
                stockRiskControls: supabase.from('stock_risk_controls').select(`
                    id, part_code, part_name, status, decision, created_at,
                    supplier:suppliers!stock_risk_controls_supplier_id_fkey(id, name),
                    source_inspection:incoming_inspections!stock_risk_controls_source_inspection_id_fkey(id, record_no),
                    controlled_by:profiles!stock_risk_controls_controlled_by_id_fkey(id, full_name)
                `).order('created_at', { ascending: false }).limit(100),
                inkrReports: supabase.from('inkr_reports').select('id, report_number, supplier_id, created_at, supplier:supplier_id(name)').order('created_at', { ascending: false }).limit(100),
                customerComplaints: supabase.from('customer_complaints').select('id, complaint_number, complaint_date, status, customer_id, customer:customer_id(name, customer_code)').order('complaint_date', { ascending: false }).limit(200),
                complaintAnalyses: supabase.from('complaint_analyses').select('id, complaint_id, analysis_type').limit(100),
                complaintActions: supabase.from('complaint_actions').select('id, complaint_id, action_type, status, responsible_person:responsible_person_id(full_name)').limit(200),
                complaintDocuments: supabase.from('complaint_documents').select('id, complaint_id, file_name').limit(100)
            };

            try {
                const newState = {};

                // DALGA 1: Kritik veriler (hızlı)
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
                            newState[key] = result.value.data.map(s => ({ value: s.id, label: s.name }));
                        } else {
                            newState[key] = result.value.data || [];
                        }
                    } else {
                        console.warn(`⚠️ ${key} fetch failed:`, result.reason || result.value?.error);
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
                        console.warn(`⚠️ ${key} fetch failed:`, result.reason || result.value?.error);
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
                    if (result.status === 'fulfilled' && !result.value.error) {
                        newState[key] = result.value.data || [];
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
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    toast({
                        variant: 'destructive',
                        title: 'Bağlantı Hatası',
                        description: 'İnternet bağlantınızı kontrol edin.',
                    });
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
        
            // SADECE KRİTİK TABLOLARI DİNLE
            const criticalTables = ['tasks', 'non_conformities', 'deviations', 'personnel'];
            
            const subscription = supabase.channel('critical-db-changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public',
                    filter: `table=in.(${criticalTables.join(',')})`
                }, handleDbChanges)
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Connected to critical tables realtime channel');
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Realtime channel error:', err);
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

        const value = {
            ...data,
            loading,
            refreshData: () => fetchData(true), // Force refresh
            refreshProducedVehicles, // Sadece produced vehicles'ı yenile
            logAudit,
        };

        return (
            <DataContext.Provider value={value}>
                {children}
            </DataContext.Provider>
        );
    };
