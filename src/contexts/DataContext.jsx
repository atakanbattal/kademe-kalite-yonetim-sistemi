
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


        const fetchData = useCallback(async () => {
            if (!session) {
                setLoading(false);
                return;
            }

            setLoading(true);

            const promises = {
                qualityCosts: supabase.from('quality_costs').select('*, responsible_personnel:personnel!responsible_personnel_id(full_name), non_conformities(nc_number, id), supplier:suppliers!supplier_id(name)'),
                personnel: supabase.from('personnel').select('id, full_name, email, avatar_url, department, unit_id, is_active').order('full_name'),
                unitCostSettings: supabase.from('cost_settings').select('*'),
                materialCostSettings: supabase.from('material_costs').select('*'),
                producedVehicles: supabase.from('quality_inspections').select('*, quality_inspection_history(*), quality_inspection_faults(*, fault_category:fault_categories(name)), vehicle_timeline_events(*)'),
                productionDepartments: supabase.from('production_departments').select('*'),
                nonConformities: supabase.from('non_conformities').select('*'),
                suppliers: supabase.from('suppliers').select('*, alternative_supplier:suppliers!alternative_to_supplier_id(id, name), supplier_certificates(valid_until), supplier_audits(*), supplier_scores(final_score, grade, period), supplier_audit_plans(*)'),
                supplierNonConformities: supabase.from('supplier_non_conformities').select('*'),
                audits: supabase.from('audits').select('*, department:cost_settings(id, unit_name)'),
                auditFindings: supabase.from('audit_findings').select('*, audits(report_number), non_conformities!source_finding_id(id, nc_number, status)'),
                documents: supabase.from('documents').select('*, personnel(id, full_name), document_revisions:current_revision_id(*), valid_until'),
                equipments: supabase.from('equipments').select('*, equipment_calibrations(*), equipment_assignments(*, personnel(full_name))'),
                deviations: supabase.from('deviations').select('*, deviation_approvals(*), deviation_attachments(*), deviation_vehicles(*)'),
                quarantineRecords: supabase.from('quarantine_records_api').select('*'),
                incomingInspections: supabase.from('incoming_inspections_with_supplier').select('*'),
                kpis: supabase.from('kpis').select('*'),
                tasks: supabase.from('tasks').select('*, owner:owner_id(full_name, email), assignees:task_assignees(personnel(id, full_name, email, avatar_url)), tags:task_tag_relations(task_tags(id, name, color)), checklist:task_checklists(*)'),
                taskTags: supabase.from('task_tags').select('*'),
                incomingControlPlans: supabase.from('incoming_control_plans').select('part_code, is_current'),
                characteristics: supabase.from('characteristics').select('id, name, type, sampling_rate'),
                equipment: supabase.from('measurement_equipment').select('id, name').order('name', { ascending: true }),
                standards: supabase.from('tolerance_standards').select('id, name'),
                questions: supabase.from('supplier_audit_questions').select('*'),
                kaizenEntries: supabase.from('kaizen_entries').select('*, proposer:proposer_id(full_name), responsible_person:responsible_person_id(full_name), approver:approver_id(full_name), department:department_id(unit_name, cost_per_minute), supplier:supplier_id(name)'),
                auditLogs: supabase.from('audit_log_entries').select('*').order('created_at', { ascending: false }).limit(200),
                stockRiskControls: supabase.from('stock_risk_controls').select('*').order('created_at', { ascending: false }).limit(200),
                inkrReports: supabase.from('inkr_reports').select('*, supplier:supplier_id(name)').order('created_at', { ascending: false }).limit(200),
                customers: supabase.from('customers').select('*').order('name'),
                customerComplaints: supabase.from('customer_complaints').select('*, customer:customer_id(name, customer_code), responsible_person:responsible_personnel_id(full_name), assigned_to:assigned_to_id(full_name), responsible_department:responsible_department_id(unit_name)').order('complaint_date', { ascending: false }),
                complaintAnalyses: supabase.from('complaint_analyses').select('*'),
                complaintActions: supabase.from('complaint_actions').select('*, responsible_person:responsible_person_id(full_name), responsible_department:responsible_department_id(unit_name)'),
                complaintDocuments: supabase.from('complaint_documents').select('*')
            };

            try {
                const results = await Promise.all(Object.values(promises));
                const entries = Object.keys(promises);

                const newState = {};
                let hasErrors = false;
                
                results.forEach((result, index) => {
                    const key = entries[index];
                    if (result.error) {
                        console.error(`Error fetching ${key}:`, result.error);
                        hasErrors = true;
                        // Beklenebilir hatalar (boş sonuç) için toast gösterme
                        if (result.error.code !== 'PGRST100' && result.error.code !== 'PGRST204' && result.error.code !== 'PGRST116') {
                            // Kritik hatalar için
                            if (result.error.code !== 'PGRST301' && result.error.code !== 'PGRST302') {
                                console.warn(`Skipping toast for ${key} with code ${result.error.code}`);
                            }
                        }
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
                            newState[key] = result.data;
                        }
                    }
                });
                
                setData(newState);

            } catch (error) {
                console.error("General fetch error:", error);
                // Ağ hatasıysa, kullanıcıya bildir
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

        const value = {
            ...data,
            loading,
            refreshData: fetchData,
            logAudit,
        };

        return (
            <DataContext.Provider value={value}>
                {children}
            </DataContext.Provider>
        );
    };
