import React, { createContext, useState, useContext, useCallback } from 'react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { defaultEightDSteps } from '@/hooks/useNCForm';
    import { addMonths } from 'date-fns';

    export const NCFormContext = createContext();

    const toISODateString = (date) => {
        if (!date) return '';
        try {
            let d;
            if (typeof date === 'string') {
                d = new Date(date);
            } else if (date instanceof Date) {
                d = date;
            } else {
                return '';
            }
            
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
        } catch (error) {
            console.warn('Date conversion error:', error);
            return '';
        }
    };

    const safeParseDate = (dateValue) => {
        if (!dateValue) return new Date();
        
        try {
            let parsedDate;
            if (typeof dateValue === 'string') {
                parsedDate = new Date(dateValue);
            } else if (dateValue instanceof Date) {
                parsedDate = dateValue;
            } else {
                return new Date();
            }
            
            if (isNaN(parsedDate.getTime())) {
                return new Date();
            }
            
            return parsedDate;
        } catch (error) {
            console.warn('Date parsing error:', error);
            return new Date();
        }
    };

    export const NCFormProvider = ({ children }) => {
        const { user, profile } = useAuth();
        const [formData, setFormData] = useState({});
        const [files, setFiles] = useState([]);
        const [departments, setDepartments] = useState([]);
        const [personnel, setPersonnel] = useState([]);

        const DRAFT_KEY = `nc:draft:${user?.id}`;

        const clearDraft = useCallback(() => {
            localStorage.removeItem(DRAFT_KEY);
        }, [DRAFT_KEY]);

        const initializeForm = useCallback((initialRecord) => {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (!initialRecord && draft) {
                try {
                    setFormData(JSON.parse(draft));
                    setFiles([]);
                    return;
                } catch (error) {
                    console.warn('Draft parsing error:', error);
                    localStorage.removeItem(DRAFT_KEY);
                }
            }

            const today = new Date();
            const dueDate = addMonths(today, 1);

            let generatedTitle = '';
            let generatedDescription = '';
            let sourceData = {};

            if (initialRecord?.source_cost_id || initialRecord?.source === 'cost') {
                generatedTitle = `${initialRecord.part_name || initialRecord.vehicle_type || 'Genel'} - ${initialRecord.cost_type}`;
                generatedDescription = `Kaynak Maliyet Kaydı Açıklaması: ${initialRecord.description || ''}`;
                sourceData = { 
                    source_cost_id: initialRecord.id, 
                    department: initialRecord.unit, 
                    requesting_unit: 'Kalitesizlik Maliyetleri',
                    requesting_person: profile?.full_name || '',
                    part_name: initialRecord.part_name, 
                    part_code: initialRecord.part_code, 
                    vehicle_type: initialRecord.vehicle_type, 
                    amount: initialRecord.amount, 
                    affected_units: initialRecord.affected_units, 
                    cost_date: initialRecord.cost_date, 
                    cost_type: initialRecord.cost_type, 
                    material_type: initialRecord.material_type, 
                    measurement_unit: initialRecord.measurement_unit,
                    part_location: initialRecord.part_location,
                    quantity: initialRecord.quantity,
                    scrap_weight: initialRecord.scrap_weight,
                    rework_duration: initialRecord.rework_duration,
                    quality_control_duration: initialRecord.quality_control_duration,
                    responsible_personnel_id: initialRecord.responsible_personnel_id
                };
            } else if (initialRecord?.source_quarantine_id || initialRecord?.source === 'quarantine') {
                generatedTitle = `Karantina: ${initialRecord.part_name || ''} (${initialRecord.part_code || 'Kodsuz'})`;
                generatedDescription = `Karantina Kaynağı: ${initialRecord.source_department}\nAçıklama: ${initialRecord.description || ''}`;
                sourceData = { source_quarantine_id: initialRecord.id, department: initialRecord.source_department, requesting_unit: 'Karantina', part_name: initialRecord.part_name, part_code: initialRecord.part_code };
            } else if (initialRecord?.source_supplier_nc_id || initialRecord?.source === 'supplier') {
                generatedTitle = `Tedarikçi Uygunsuzluğu: ${initialRecord.title}`;
                generatedDescription = `Tedarikçi: ${initialRecord.supplier_name}\nAçıklama: ${initialRecord.description || ''}`;
                sourceData = { source_supplier_nc_id: initialRecord.source_id, department: 'Tedarikçi', requesting_unit: 'Tedarikçi Kalite' };
            } else if (initialRecord?.source_inspection_id || initialRecord?.source === 'inspection' || initialRecord?.source === 'incoming_inspection') {
                generatedTitle = initialRecord.title || `Girdi Kontrol: ${initialRecord.part_name} (${initialRecord.part_code})`;
                
                // Eğer description verilmişse onu kullan, yoksa eski formatı kullan
                if (initialRecord.description) {
                    generatedDescription = initialRecord.description;
                } else {
                    const defectsDescription = (initialRecord.defects || []).map(d => `- ${d.defect_description} (Miktar: ${d.quantity})`).join('\n');
                    generatedDescription = `Tedarikçi: ${initialRecord.supplier_name}\nTeslimat No: ${initialRecord.inspection_record_no || initialRecord.record_no}\nUygunsuzluklar:\n${defectsDescription}`;
                }
                
                sourceData = { 
                    source_inspection_id: initialRecord.source_inspection_id || initialRecord.id, 
                    department: 'Girdi Kalite', 
                    requesting_unit: 'Girdi Kalite', 
                    requesting_person: profile?.full_name || '',
                    part_name: initialRecord.part_name, 
                    part_code: initialRecord.part_code,
                    supplier_id: initialRecord.supplier_id || null,
                    supplier_name: initialRecord.supplier_name || null,
                };
            } else if (initialRecord?.source_finding_id || initialRecord?.source === 'audit') {
                generatedTitle = initialRecord.title || '';
                generatedDescription = `Bulgu: ${initialRecord.description || ''}`;
                sourceData = { 
                    source_finding_id: initialRecord.source_finding_id, 
                    requesting_unit: 'Kalite Birimi',
                    requesting_person: profile?.full_name || '',
                    audit_title: initialRecord.audit_title,
                    department: initialRecord.department,
                };
            } else if (initialRecord?.source_inspection_fault_id || initialRecord?.source === 'vehicle_fault') {
                generatedTitle = initialRecord.title;
                generatedDescription = initialRecord.description;
                sourceData = { source_inspection_fault_id: initialRecord.id, department: initialRecord.department, requesting_unit: initialRecord.requesting_unit, vehicle_type: initialRecord.vehicle_type };
            }

            const baseData = {
                type: 'DF',
                title: '',
                description: '',
                status: 'Açık',
                priority: 'Orta',
                department: '',
                responsible_person: '',
                requesting_unit: profile?.department || '',
                requesting_person: profile?.full_name || '',
                opening_date: toISODateString(today),
                df_opened_at: today.toISOString(),
                due_date: toISODateString(dueDate),
                due_at: dueDate.toISOString(),
                mdi_no: '',
                user_id: user?.id || '',
                eight_d_steps: defaultEightDSteps,
                attachments: [],
                part_name: '',
                part_code: '',
                vehicle_type: '',
                amount: null,
                affected_units: null,
                cost_date: null,
                cost_type: '',
                material_type: '',
                measurement_unit: '',
                part_location: '',
                quantity: null,
                scrap_weight: null,
                rework_duration: null,
                quality_control_duration: null,
                responsible_personnel_id: null,
                audit_title: ''
            };
            
            let finalData;
            if (initialRecord) {
                const mergedRecord = { ...baseData, ...initialRecord, ...sourceData };
                mergedRecord.description = initialRecord.description || generatedDescription;
                mergedRecord.title = initialRecord.title || generatedTitle;

                const initialEightD = initialRecord.eight_d_steps || {};
                const mergedEightD = Object.keys(defaultEightDSteps).reduce((acc, key) => {
                    acc[key] = { ...defaultEightDSteps[key], ...(initialEightD[key] || {}) };
                    return acc;
                }, {});

                const openingDateValue = initialRecord.df_opened_at || initialRecord.opening_date || initialRecord.created_at;
                const dueDateValue = initialRecord.due_at || initialRecord.due_date;

                finalData = {
                    ...mergedRecord,
                    type: initialRecord.type || 'DF',
                    opening_date: toISODateString(safeParseDate(openingDateValue)),
                    df_opened_at: safeParseDate(openingDateValue).toISOString(),
                    due_date: toISODateString(safeParseDate(dueDateValue)),
                    due_at: safeParseDate(dueDateValue).toISOString(),
                    eight_d_steps: mergedEightD,
                    attachments: initialRecord.attachments || [],
                };
                delete finalData.source;
            } else {
                finalData = baseData;
            }

            setFormData(finalData);
            setFiles([]);
        }, [user, DRAFT_KEY, profile]);

        return (
            <NCFormContext.Provider value={{
                formData, setFormData,
                files, setFiles,
                departments, setDepartments,
                personnel, setPersonnel,
                initializeForm,
                clearDraft
            }}>
                {children}
            </NCFormContext.Provider>
        );
    };

    export const useNCFormContext = () => useContext(NCFormContext);