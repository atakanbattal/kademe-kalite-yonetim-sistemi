
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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


        const fetchData = useCallback(async (forceFetch = false) => {
            if (!session) {
                setLoading(false);
                return;
            }

            // Cache kontrolü - 5 dakika cache
            const cacheKey = 'app_data_cache';
            const cacheTimeKey = 'app_data_cache_time';
            const cacheExpiry = 5 * 60 * 1000; // 5 dakika
            
            if (!forceFetch) {
                const cachedTime = sessionStorage.getItem(cacheTimeKey);
                const cachedData = sessionStorage.getItem(cacheKey);
                
                if (cachedTime && cachedData) {
                    const timeDiff = Date.now() - parseInt(cachedTime);
                    if (timeDiff < cacheExpiry) {
                        console.log('📦 Cache\'den veri yüklendi (', Math.round(timeDiff / 1000), 'saniye önce)');
                        setData(JSON.parse(cachedData));
                        setLoading(false);
                        return;
                    }
                }
            }

            setLoading(true);
            console.log('🔄 Veritabanından yeni veri çekiliyor...');

            // SADECE KRİTİK VERİLERİ ÇEK - Diğerleri lazy load edilecek
            const promises = {
                // Core data - Her zaman gerekli
                personnel: supabase.from('personnel').select('id, full_name, email, avatar_url, department, unit_id, is_active').eq('is_active', true).order('full_name'),
                unitCostSettings: supabase.from('cost_settings').select('*'),
                suppliers: supabase.from('suppliers').select('id, name, status, category').order('name'),
                productionDepartments: supabase.from('production_departments').select('*'),
                
                // Frequently accessed data
                nonConformities: supabase.from('non_conformities').select('id, nc_number, title, status, type, severity').order('created_at', { ascending: false }).limit(100),
                tasks: supabase.from('tasks').select('id, title, status, priority, due_date, owner_id').order('created_at', { ascending: false }).limit(50),
                
                // Dropdown data
                characteristics: supabase.from('characteristics').select('id, name, type, sampling_rate'),
                equipment: supabase.from('measurement_equipment').select('id, name').order('name', { ascending: true }),
                standards: supabase.from('tolerance_standards').select('id, name'),
                taskTags: supabase.from('task_tags').select('*'),
                customers: supabase.from('customers').select('*').order('customer_name'),
            };

            try {
                const results = await Promise.all(Object.values(promises));
                const entries = Object.keys(promises);

                const newState = {
                    // Initialize lazy-loaded data as empty arrays
                    qualityCosts: [],
                    materialCostSettings: [],
                    producedVehicles: [],
                    supplierNonConformities: [],
                    audits: [],
                    auditFindings: [],
                    documents: [],
                    equipments: [],
                    deviations: [],
                    quarantineRecords: [],
                    incomingInspections: [],
                    kpis: [],
                    incomingControlPlans: [],
                    questions: [],
                    kaizenEntries: [],
                    auditLogs: [],
                    stockRiskControls: [],
                    inkrReports: [],
                    customerComplaints: [],
                    complaintAnalyses: [],
                    complaintActions: [],
                    complaintDocuments: [],
                };
                
                results.forEach((result, index) => {
                    const key = entries[index];
                    if (result.error) {
                        console.error(`Error fetching ${key}:`, result.error);
                        newState[key] = [];
                    } else {
                        // Transform karakteristikleri, ekipmanları ve standartları
                        if (key === 'characteristics' && result.data) {
                            newState[key] = result.data.map(c => ({ value: c.id, label: c.name, type: c.type, sampling_rate: c.sampling_rate }));
                        } else if (key === 'equipment' && result.data) {
                            newState[key] = result.data.map(e => ({ value: e.id, label: e.name }));
                        } else if (key === 'standards' && result.data) {
                            newState[key] = result.data.map(s => ({ value: s.id, label: s.name }));
                        } else {
                            newState[key] = result.data || [];
                        }
                    }
                });
                
                setData(newState);
                
                // Cache'e kaydet
                sessionStorage.setItem(cacheKey, JSON.stringify(newState));
                sessionStorage.setItem(cacheTimeKey, Date.now().toString());
                console.log('✅ Veri cache\'e kaydedildi');

            } catch (error) {
                console.error("General fetch error:", error);
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    toast({
                        variant: 'destructive',
                        title: 'Bağlantı Hatası',
                        description: 'İnternet bağlantınızı kontrol edin.',
                    });
                }
            } finally {
                setLoading(false);
            }
        }, [session, toast]);

        useEffect(() => {
            if (session) {
                fetchData();
            } else {
                setLoading(false);
            }
        }, [session, fetchData]);

        useEffect(() => {
            if (!session) return;
        
            const handleDbChanges = (payload) => {
                // Unnecessary fetches ekrandan kaldır - sadece ilgili tabloyu güncelle
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
                // Only log audit, don't refetch everything
                if (!['quality_inspection_history', 'vehicle_timeline_events'].includes(table)) {
                  logAudit(action, details, table);
                }
            };
        
            const subscription = supabase.channel('public-db-changes')
                .on('postgres_changes', { event: '*', schema: 'public' }, handleDbChanges)
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Connected to DB changes channel.');
                    }
                    if (status === 'CHANNEL_ERROR') {
                        console.error('DB changes channel error:', err);
                        // Sadece gerçek ağ hatalarıysa bildirim göster
                        if (err && err.code && err.code !== 'REALTIME_DISCONNECT') {
                            toast({
                                variant: 'destructive',
                                title: 'Bağlantı Hatası',
                                description: 'Veritabanı değişiklikleri izlenemiyor. Lütfen sayfayı yenileyin.',
                                duration: 10000,
                            });
                        }
                    }
                });
        
            return () => {
                supabase.removeChannel(subscription);
            };
        }, [session, logAudit, toast]);

        // Lazy load fonksiyonu - Belirli bir modülün verilerini on-demand çekme
        const loadModuleData = useCallback(async (moduleName) => {
            console.log(`🔄 ${moduleName} modül verisi yükleniyor...`);
            
            const moduleDataLoaders = {
                'quality-cost': async () => {
                    const [costsRes, materialsRes] = await Promise.all([
                        supabase.from('quality_costs').select('*, responsible_personnel:personnel!responsible_personnel_id(full_name), non_conformities(nc_number, id), supplier:suppliers!supplier_id(name)').order('cost_date', { ascending: false }).limit(200),
                        supabase.from('material_costs').select('*')
                    ]);
                    return { qualityCosts: costsRes.data || [], materialCostSettings: materialsRes.data || [] };
                },
                'produced-vehicles': async () => {
                    const res = await supabase.from('quality_inspections').select('*, quality_inspection_history(*), quality_inspection_faults(*, fault_category:fault_categories(name)), vehicle_timeline_events(*)').order('created_at', { ascending: false }).limit(100);
                    return { producedVehicles: res.data || [] };
                },
                'supplier-quality': async () => {
                    const [suppliersRes, sncsRes] = await Promise.all([
                        supabase.from('suppliers').select('*, alternative_supplier:suppliers!alternative_to_supplier_id(id, name), supplier_certificates(valid_until), supplier_audits(*), supplier_scores(final_score, grade, period), supplier_audit_plans(*)'),
                        supabase.from('supplier_non_conformities').select('*')
                    ]);
                    return { suppliers: suppliersRes.data || [], supplierNonConformities: sncsRes.data || [] };
                },
                'internal-audit': async () => {
                    const [auditsRes, findingsRes] = await Promise.all([
                        supabase.from('audits').select('*, department:cost_settings(id, unit_name)'),
                        supabase.from('audit_findings').select('*, audits(report_number), non_conformities!source_finding_id(id, nc_number, status)')
                    ]);
                    return { audits: auditsRes.data || [], auditFindings: findingsRes.data || [] };
                },
                'document': async () => {
                    const res = await supabase.from('documents').select('*, personnel(id, full_name), document_revisions:current_revision_id(*), valid_until');
                    return { documents: res.data || [] };
                },
                'equipment': async () => {
                    const res = await supabase.from('equipments').select('*, equipment_calibrations(*), equipment_assignments(*, personnel(full_name))');
                    return { equipments: res.data || [] };
                },
                'deviation': async () => {
                    const res = await supabase.from('deviations').select('*, deviation_approvals(*), deviation_attachments(*), deviation_vehicles(*)');
                    return { deviations: res.data || [] };
                },
                'quarantine': async () => {
                    const res = await supabase.from('quarantine_records_api').select('*');
                    return { quarantineRecords: res.data || [] };
                },
                'incoming-quality': async () => {
                    const [inspectionsRes, plansRes] = await Promise.all([
                        supabase.from('incoming_inspections_with_supplier').select('*'),
                        supabase.from('incoming_control_plans').select('part_code, is_current')
                    ]);
                    return { incomingInspections: inspectionsRes.data || [], incomingControlPlans: plansRes.data || [] };
                },
                'kaizen': async () => {
                    const res = await supabase.from('kaizen_entries').select('*, proposer:proposer_id(full_name), responsible_person:responsible_person_id(full_name), approver:approver_id(full_name), department:department_id(unit_name, cost_per_minute), supplier:supplier_id(name)');
                    return { kaizenEntries: res.data || [] };
                },
                'kpi': async () => {
                    const res = await supabase.from('kpis').select('*');
                    return { kpis: res.data || [] };
                },
                'audit-logs': async () => {
                    const res = await supabase.from('audit_log_entries').select('*').order('created_at', { ascending: false }).limit(200);
                    return { auditLogs: res.data || [] };
                },
                'customer-complaints': async () => {
                    const [complaintsRes, analysesRes, actionsRes, docsRes] = await Promise.all([
                        supabase.from('customer_complaints').select('*, customer:customer_id(customer_name, customer_code), responsible_person:responsible_personnel_id(full_name), assigned_to:assigned_to_id(full_name), responsible_department:responsible_department_id(unit_name)').order('complaint_date', { ascending: false }),
                        supabase.from('complaint_analyses').select('*'),
                        supabase.from('complaint_actions').select('*, responsible_person:responsible_person_id(full_name), responsible_department:responsible_department_id(unit_name)'),
                        supabase.from('complaint_documents').select('*')
                    ]);
                    return { 
                        customerComplaints: complaintsRes.data || [], 
                        complaintAnalyses: analysesRes.data || [],
                        complaintActions: actionsRes.data || [],
                        complaintDocuments: docsRes.data || []
                    };
                },
            };
            
            const loader = moduleDataLoaders[moduleName];
            if (loader) {
                try {
                    const moduleData = await loader();
                    setData(prev => ({ ...prev, ...moduleData }));
                    console.log(`✅ ${moduleName} modül verisi yüklendi`);
                } catch (error) {
                    console.error(`❌ ${moduleName} modül verisi yüklenemedi:`, error);
                }
            }
        }, []);

        const value = {
            ...data,
            loading,
            refreshData: fetchData,
            loadModuleData,
            logAudit,
        };

        return (
            <DataContext.Provider value={value}>
                {children}
            </DataContext.Provider>
        );
    };
