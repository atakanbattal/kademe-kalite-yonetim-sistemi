
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
            documentFolders: [],
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
                nonConformities: supabase.from('non_conformities').select('*'),
                deviations: supabase.from('deviations').select('*, deviation_approvals(*), deviation_attachments(*), deviation_vehicles(*)'),
                kaizenEntries: supabase.from('kaizen_entries').select('*, proposer:proposer_id(full_name), responsible_person:responsible_person_id(full_name), approver:approver_id(full_name), department:department_id(unit_name, cost_per_minute), supplier:supplier_id(name)'),
                tasks: supabase.from('tasks').select('*, owner:owner_id(full_name, email), assignees:task_assignees(personnel(id, full_name, email, avatar_url)), tags:task_tag_relations(task_tags(id, name, color)), checklist:task_checklists(*)'),
                qualityCosts: supabase.from('quality_costs').select('*, responsible_personnel:personnel!responsible_personnel_id(full_name), non_conformities(nc_number, id), supplier:suppliers!supplier_id(name)'),
                kpis: supabase.from('kpis').select('*'),
                materialCostSettings: supabase.from('material_costs').select('*'),
            };

            // AĞIR TABLOLAR (Üçüncü dalga - limit ile)
            const heavyPromises = {
                suppliers: supabase.from('suppliers').select('*, alternative_supplier:suppliers!alternative_to_supplier_id(id, name), supplier_certificates(valid_until), supplier_audits(*), supplier_scores(final_score, grade, period), supplier_audit_plans(*)'),
                producedVehicles: supabase.from('quality_inspections').select('*, quality_inspection_history(*), quality_inspection_faults(*, fault_category:fault_categories(name)), vehicle_timeline_events(*)').limit(500),
                equipments: supabase.from('equipments').select('*, equipment_calibrations(*), equipment_assignments(*, personnel(full_name))'),
                documents: supabase.from('documents').select(`
                    *,
                    department:department_id(unit_name),
                    supplier:supplier_id(name),
                    owner:owner_id(full_name, email),
                    folder:folder_id(folder_name, folder_path),
                    current_revision:current_revision_id(*)
                `),
                documentFolders: supabase.from('document_folders').select('*').eq('is_archived', false).order('folder_name'),
            };

            // DÜŞÜK ÖNCELİKLİ TABLOLAR (Son dalga - limit ile)
            const lowPriorityPromises = {
                supplierNonConformities: supabase.from('supplier_non_conformities').select('*'),
                audits: supabase.from('audits').select('*, department:cost_settings(id, unit_name)').order('report_number', { ascending: false }),
                auditFindings: supabase.from('audit_findings').select('*, audits(report_number), non_conformities!source_finding_id(id, nc_number, status)'),
                quarantineRecords: supabase.from('quarantine_records_api').select('*').limit(500),
                incomingInspections: supabase.from('incoming_inspections_with_supplier').select('*').limit(500),
                incomingControlPlans: supabase.from('incoming_control_plans').select('part_code, is_current'),
                questions: supabase.from('supplier_audit_questions').select('*'),
                auditLogs: supabase.from('audit_log_entries').select('*').order('created_at', { ascending: false }).limit(200),
                stockRiskControls: supabase.from('stock_risk_controls').select('*').order('created_at', { ascending: false }).limit(200),
                inkrReports: supabase.from('inkr_reports').select('*, supplier:supplier_id(name)').order('created_at', { ascending: false }).limit(200),
                customerComplaints: supabase.from('customer_complaints').select('*, customer:customer_id(name, customer_code), responsible_person:responsible_personnel_id(full_name), assigned_to:assigned_to_id(full_name), responsible_department:responsible_department_id(unit_name)').order('complaint_date', { ascending: false }).limit(500),
                complaintAnalyses: supabase.from('complaint_analyses').select('*'),
                complaintActions: supabase.from('complaint_actions').select('*, responsible_person:responsible_person_id(full_name), responsible_department:responsible_department_id(unit_name)'),
                complaintDocuments: supabase.from('complaint_documents').select('*')
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
                    if (result.status === 'fulfilled' && !result.value.error) {
                        newState[key] = result.value.data || [];
                    } else {
                        console.warn(`⚠️ ${key} fetch failed:`, result.reason || result.value?.error);
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

        const value = {
            ...data,
            loading,
            refreshData: () => fetchData(true), // Force refresh
            logAudit,
        };

        return (
            <DataContext.Provider value={value}>
                {children}
            </DataContext.Provider>
        );
    };
