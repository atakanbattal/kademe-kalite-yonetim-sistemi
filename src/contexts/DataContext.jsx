
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
            products: [],
            productCategories: [],
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
                standards: supabase.from('audit_standards').select('id, code, name'),
                customers: supabase.from('customers').select('*').order('name'),
                products: supabase.from('products').select('*, product_categories(category_code, category_name)').eq('is_active', true).order('product_name'),
                productCategories: supabase.from('product_categories').select('*').eq('is_active', true).order('order_index'),
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
                                // Document revisions - sadece revisions çek, join yapma
                                supabase.from('document_revisions').select('*').eq('document_id', doc.id).order('revision_number', { ascending: false }),
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
                supplierNonConformities: supabase.from('supplier_non_conformities').select('*'),
                audits: supabase.from('audits').select(`
                    *,
                    department:cost_settings(id, unit_name),
                    audit_standard:audit_standards!audit_standard_id(id, code, name)
                `).order('report_number', { ascending: false }),
                auditFindings: supabase.from('audit_findings').select('*, audits(report_number), non_conformities!source_finding_id(id, nc_number, status)'),
                quarantineRecords: supabase.from('quarantine_records_api').select('*').limit(500),
                incomingInspections: supabase.from('incoming_inspections_with_supplier').select('*').limit(500),
                incomingControlPlans: supabase.from('incoming_control_plans').select('part_code, is_current'),
                questions: supabase.from('supplier_audit_questions').select('*'),
                auditLogs: supabase.from('audit_log_entries').select('*').order('created_at', { ascending: false }).limit(200),
                stockRiskControls: supabase.from('stock_risk_controls').select(`
                    *,
                    supplier:suppliers!stock_risk_controls_supplier_id_fkey(id, name),
                    source_inspection:incoming_inspections!stock_risk_controls_source_inspection_id_fkey(id, record_no, part_code, part_name),
                    controlled_inspection:incoming_inspections!stock_risk_controls_controlled_inspection_id_fkey(id, record_no, part_code, part_name, delivery_note_number),
                    controlled_by:profiles!stock_risk_controls_controlled_by_id_fkey(id, full_name)
                `).order('created_at', { ascending: false }).limit(200),
                inkrReports: supabase.from('inkr_reports').select('*, supplier:supplier_id(name)').order('created_at', { ascending: false }),
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
        
            // SADECE KRİTİK TABLOLARI DİNLE (kpis dahil)
            const criticalTables = ['tasks', 'non_conformities', 'deviations', 'personnel', 'kpis'];
            
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
                        refreshKpis();
                    }
                })
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
        }, [session, logAudit, refreshKpis]);

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

        // KPI'ları yenile
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
                
                setData(prev => ({ ...prev, kpis: data || [] }));
                console.log('✅ KPIs refreshed:', data?.length || 0, 'kpis');
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
                'non_quality_cost': 'get_total_non_quality_cost',
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
            };
            return rpcMap[autoKpiId] || null;
        };

        const value = {
            ...data,
            loading,
            refreshData: () => fetchData(true), // Force refresh
            refreshProducedVehicles, // Sadece produced vehicles'ı yenile
            refreshKpis, // Sadece KPI'ları yenile
            refreshAutoKpis, // Otomatik KPI'ların değerlerini güncelle
            logAudit,
        };

        return (
            <DataContext.Provider value={value}>
                {children}
            </DataContext.Provider>
        );
    };
