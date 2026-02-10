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
                console.log('💡 NCFormContext - initializeForm çağrıldı');
                console.log('💡 initialRecord:', initialRecord);
                console.log('💡 Koşul kontrolü:', {
                    source_cost_id: initialRecord?.source_cost_id,
                    source: initialRecord?.source,
                    cost_type: initialRecord?.cost_type,
                    amount: initialRecord?.amount,
                    description: initialRecord?.description
                });
                
                // Detaylı başlık oluştur
                generatedTitle = `Kalite Maliyeti: ${initialRecord.cost_type}${initialRecord.part_name ? ` - ${initialRecord.part_name}` : ''}${initialRecord.vehicle_type ? ` - ${initialRecord.vehicle_type}` : ''}`;
                
                // Tüm bilgileri içeren şeffaf açıklama oluştur
                let descParts = [];
                descParts.push('MALIYET KAYDI DETAYLARI\n');
                
                // Temel Bilgiler
                if (initialRecord.cost_type) descParts.push(`Maliyet Türü: ${initialRecord.cost_type}`);
                if (initialRecord.cost_date) descParts.push(`Tarih: ${new Date(initialRecord.cost_date).toLocaleDateString('tr-TR')}`);
                if (initialRecord.unit) descParts.push(`Birim: ${initialRecord.unit}`);
                
                // Parça/Ürün Bilgileri
                if (initialRecord.part_name) descParts.push(`Parça Adı: ${initialRecord.part_name}`);
                if (initialRecord.part_code) descParts.push(`Parça Kodu: ${initialRecord.part_code}`);
                if (initialRecord.vehicle_type) descParts.push(`Araç Tipi: ${initialRecord.vehicle_type}`);
                if (initialRecord.part_location) descParts.push(`Parça Lokasyonu: ${initialRecord.part_location}`);
                
                // Maliyet Bilgileri
                descParts.push('\nMALİYET BİLGİLERİ');
                if (initialRecord.amount) descParts.push(`Tutar: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(initialRecord.amount)}`);
                if (initialRecord.quantity) descParts.push(`Miktar: ${initialRecord.quantity}${initialRecord.measurement_unit ? ` ${initialRecord.measurement_unit}` : ''}`);
                if (initialRecord.scrap_weight) descParts.push(`Hurda Ağırlığı: ${initialRecord.scrap_weight} kg`);
                if (initialRecord.material_type) descParts.push(`Malzeme Tipi: ${initialRecord.material_type}`);
                if (initialRecord.affected_units) descParts.push(`Etkilenen Birimler: ${initialRecord.affected_units}`);
                
                // Süre Bilgileri
                if (initialRecord.rework_duration || initialRecord.quality_control_duration) {
                    descParts.push('\nSÜRE BİLGİLERİ');
                    if (initialRecord.rework_duration) {
                        const hours = Math.floor(initialRecord.rework_duration / 60);
                        const minutes = initialRecord.rework_duration % 60;
                        descParts.push(`Yeniden İşlem Süresi: ${hours > 0 ? `${hours} saat ` : ''}${minutes} dakika (Toplam: ${initialRecord.rework_duration} dakika)`);
                    }
                    if (initialRecord.quality_control_duration) {
                        const hours = Math.floor(initialRecord.quality_control_duration / 60);
                        const minutes = initialRecord.quality_control_duration % 60;
                        descParts.push(`Kalite Kontrol Süresi: ${hours > 0 ? `${hours} saat ` : ''}${minutes} dakika (Toplam: ${initialRecord.quality_control_duration} dakika)`);
                    }
                }
                
                // Açıklama
                if (initialRecord.description) {
                    descParts.push('\nAÇIKLAMA');
                    descParts.push(initialRecord.description);
                }
                
                generatedDescription = descParts.join('\n');
                
                console.log('💡 Oluşturulan descParts:', descParts);
                console.log('💡 Oluşturulan generatedDescription:', generatedDescription);
                
                sourceData = { 
                    source_cost_id: initialRecord.id, 
                    department: initialRecord.unit || '', 
                    requesting_unit: 'Kalite Maliyetleri',
                    requesting_person: profile?.full_name || '',
                    part_name: initialRecord.part_name || '', 
                    part_code: initialRecord.part_code || '', 
                    vehicle_type: initialRecord.vehicle_type || '', 
                    amount: initialRecord.amount || null, 
                    affected_units: initialRecord.affected_units || null, 
                    cost_date: initialRecord.cost_date || null, 
                    cost_type: initialRecord.cost_type || '', 
                    material_type: initialRecord.material_type || '', 
                    measurement_unit: initialRecord.measurement_unit || '',
                    part_location: initialRecord.part_location || '',
                    quantity: initialRecord.quantity || null,
                    scrap_weight: initialRecord.scrap_weight || null,
                    rework_duration: initialRecord.rework_duration || null,
                    quality_control_duration: initialRecord.quality_control_duration || null,
                    responsible_personnel_id: initialRecord.responsible_personnel_id || null
                };
            } else if (initialRecord?.source_quarantine_id || initialRecord?.source === 'quarantine') {
                generatedTitle = `Karantina: ${initialRecord.part_name || ''} (${initialRecord.part_code || 'Kodsuz'})`;
                generatedDescription = `Karantina Kaynağı: ${initialRecord.source_department}\nAçıklama: ${initialRecord.description || ''}`;
                sourceData = { source_quarantine_id: initialRecord.id, department: initialRecord.source_department, requesting_unit: 'Karantina', part_name: initialRecord.part_name, part_code: initialRecord.part_code };
            } else if (initialRecord?.source_supplier_nc_id || initialRecord?.source === 'supplier') {
                generatedTitle = initialRecord.title || `Tedarikçi Uygunsuzluğu`;
                generatedDescription = initialRecord.description || `Tedarikçi: ${initialRecord.supplier_name}\nAçıklama: ${initialRecord.description || ''}`;
                sourceData = { 
                    source_supplier_nc_id: initialRecord.source_supplier_nc_id || initialRecord.source_id, 
                    department: 'Tedarikçi', 
                    requesting_unit: 'Tedarikçi Kalite',
                    requesting_person: profile?.full_name || '',
                    supplier_id: initialRecord.supplier_id || null,
                    supplier_name: initialRecord.supplier_name || null,
                };
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
                eight_d_progress: Object.keys(defaultEightDSteps).reduce((acc, key) => {
                    acc[key] = {
                        completed: false,
                        responsible: null,
                        completionDate: null,
                        description: null,
                        evidenceFiles: []
                    };
                    return acc;
                }, {}),
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
                // Kaynak "cost" ise, her zaman generatedDescription kullan (detaylı bilgi için)
                if (initialRecord?.source === 'cost' || initialRecord?.source_cost_id) {
                    mergedRecord.description = generatedDescription;
                    mergedRecord.title = generatedTitle;
                } else {
                    mergedRecord.description = initialRecord.description || generatedDescription;
                    mergedRecord.title = initialRecord.title || generatedTitle;
                }

                const initialEightD = initialRecord.eight_d_steps || {};
                const mergedEightD = Object.keys(defaultEightDSteps).reduce((acc, key) => {
                    acc[key] = { ...defaultEightDSteps[key], ...(initialEightD[key] || {}) };
                    return acc;
                }, {});

                const openingDateValue = initialRecord.df_opened_at || initialRecord.opening_date || initialRecord.created_at;
                const parsedOpeningDate = safeParseDate(openingDateValue);
                
                // Termin tarihi: eğer initialRecord'da varsa onu kullan, yoksa açılış tarihinden 1 ay sonrasını hesapla
                let parsedDueDate;
                const dueDateValue = initialRecord.due_at || initialRecord.due_date;
                if (dueDateValue) {
                    parsedDueDate = safeParseDate(dueDateValue);
                    // Eğer termin tarihi açılış tarihinden önce veya aynı günse, açılış tarihinden 1 ay sonrasını kullan
                    if (parsedDueDate <= parsedOpeningDate) {
                        parsedDueDate = addMonths(parsedOpeningDate, 1);
                    }
                } else {
                    // Termin tarihi yoksa, açılış tarihinden 1 ay sonrasını hesapla
                    parsedDueDate = addMonths(parsedOpeningDate, 1);
                }

                // eight_d_progress'i yükle veya eight_d_steps'ten oluştur
                let eightDProgress = initialRecord.eight_d_progress;
                if (!eightDProgress && mergedEightD) {
                    eightDProgress = Object.keys(mergedEightD).reduce((acc, key) => {
                        const step = mergedEightD[key];
                        acc[key] = {
                            completed: step.completed || !!(step.responsible && step.completionDate && step.description),
                            responsible: step.responsible || null,
                            completionDate: step.completionDate || null,
                            description: step.description || null,
                            evidenceFiles: step.evidenceFiles || []
                        };
                        return acc;
                    }, {});
                }

                const closedAtValue = initialRecord.closed_at;
                
                finalData = {
                    ...mergedRecord,
                    type: initialRecord.type || 'DF',
                    opening_date: toISODateString(parsedOpeningDate),
                    df_opened_at: parsedOpeningDate.toISOString(),
                    due_date: toISODateString(parsedDueDate),
                    due_at: parsedDueDate.toISOString(),
                    closed_at: closedAtValue || null,
                    closing_date: closedAtValue ? toISODateString(safeParseDate(closedAtValue)) : '',
                    eight_d_steps: mergedEightD,
                    eight_d_progress: eightDProgress,
                    attachments: initialRecord.attachments || [],
                };
                
                // Eğer supplier_id varsa ama is_supplier_nc yoksa, is_supplier_nc'yi true yap
                if (finalData.supplier_id && !finalData.is_supplier_nc) {
                    finalData.is_supplier_nc = true;
                }
                
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