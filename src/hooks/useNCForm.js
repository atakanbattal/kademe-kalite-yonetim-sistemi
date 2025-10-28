import { useContext, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useDropzone } from 'react-dropzone';
    import { NCFormContext } from '@/contexts/NCFormContext';
    import { SLA_DURATIONS } from '@/lib/constants';
    import { format, parse, isValid, addMonths } from 'date-fns';

    const toInputDateString = (date) => {
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
            return format(d, 'yyyy-MM-dd');
        } catch (error) {
            console.warn('Date formatting error:', error);
            return '';
        }
    };

    const safeParseDate = (dateString, fallback = new Date()) => {
        if (!dateString) return fallback;
        
        try {
            let parsedDate;
            
            if (typeof dateString === 'string') {
                if (dateString.includes('T') || dateString.includes('Z')) {
                    parsedDate = new Date(dateString);
                } else {
                    parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
                }
            } else if (dateString instanceof Date) {
                parsedDate = dateString;
            } else {
                return fallback;
            }
            
            if (!isValid(parsedDate) || isNaN(parsedDate.getTime())) {
                return fallback;
            }
            
            return parsedDate;
        } catch (error) {
            console.warn('Date parsing error:', error);
            return fallback;
        }
    };

    export const defaultEightDSteps = {
        D1: { title: "Ekip Oluşturma", responsible: "", completionDate: "", description: "" },
        D2: { title: "Problemi Tanımlama", responsible: "", completionDate: "", description: "" },
        D3: { title: "Geçici Önlemler Alma", responsible: "", completionDate: "", description: "" },
        D4: { title: "Kök Neden Analizi", responsible: "", completionDate: "", description: "" },
        D5: { title: "Kalıcı Düzeltici Faaliyetleri Belirleme", responsible: "", completionDate: "", description: "" },
        D6: { title: "Kalıcı Düzeltici Faaliyetleri Uygulama", responsible: "", completionDate: "", description: "" },
        D7: { title: "Tekrarlanmayı Önleme", responsible: "", completionDate: "", description: "" },
        D8: { title: "Ekibi Takdir Etme", responsible: "", completionDate: "", description: "" },
    };

    export const useNCForm = () => {
        const { toast } = useToast();
        const { user } = useAuth();
        const { 
            formData, setFormData, files, setFiles,
            personnel, setPersonnel, departments, setDepartments, initializeForm, clearDraft
        } = useContext(NCFormContext);

        const DRAFT_KEY = `nc:draft:${user?.id}`;

        useEffect(() => {
            const fetchInitialData = async () => {
                if (departments.length === 0) {
                     const { data: depts, error: deptsError } = await supabase.from('personnel').select('department').neq('department', null);
                    if (deptsError) {
                        toast({ variant: 'destructive', title: 'Hata', description: 'Birimler yüklenemedi.' });
                    } else {
                        const uniqueDepartments = [...new Set(depts.map(d => d.department))].sort();
                        setDepartments(uniqueDepartments);
                    }
                }
               
                if (personnel.length === 0) {
                    const { data: personnelData, error: personnelError } = await supabase.from('personnel').select('id, full_name, department').eq('is_active', true).order('full_name');
                    if(personnelError) {
                        toast({ variant: 'destructive', title: 'Hata', description: 'Personel listesi yüklenemedi.' });
                    } else {
                        setPersonnel(personnelData);
                    }
                }
            };
            fetchInitialData();
        }, [toast, departments.length, personnel.length, setDepartments, setPersonnel]);

        const onDrop = useCallback(acceptedFiles => {
            setFiles(prev => [...prev, ...acceptedFiles]);
        }, [setFiles]);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

        const removeFile = (fileToRemove) => {
            setFiles(files.filter(file => file !== fileToRemove));
        };

        const handleInputChange = (e) => {
            const { id, value, type, checked } = e.target;
            const newFormData = { ...formData, [id]: type === 'checkbox' ? checked : value };

            if (id === 'due_date') {
                try {
                    newFormData.due_at = value ? new Date(value).toISOString() : null;
                } catch (error) {
                    console.warn('Due date conversion error:', error);
                    newFormData.due_at = null;
                }
            }

            setFormData(newFormData);
        };

        const handleOpeningDateChange = (e) => {
            const { value } = e.target;
            
            try {
                const newOpeningDate = safeParseDate(value);
                const newDueDate = addMonths(newOpeningDate, 1);
                const newDueDateString = toInputDateString(newDueDate);

                setFormData(prev => ({ 
                    ...prev, 
                    opening_date: value,
                    df_opened_at: newOpeningDate.toISOString(),
                    due_date: newDueDateString,
                    due_at: newDueDate.toISOString()
                }));

            } catch(error) {
                console.warn("Opening date change error:", error);
                toast({ variant: 'destructive', title: 'Hata', description: 'Geçersiz tarih formatı.' });
            }
        };

        const handleSelectChange = (id, value) => {
            const updates = { [id]: value };
            if(id === 'type') {
                try {
                    const openingDate = formData.opening_date ? safeParseDate(formData.opening_date) : new Date();
                    const newDueDate = addMonths(openingDate, 1);
                    const newDueDateString = toInputDateString(newDueDate);
                    updates.due_date = newDueDateString;
                    updates.due_at = newDueDate.toISOString();
                } catch (error) {
                    console.warn('Type change date calculation error:', error);
                }
            } else if (id === 'is_supplier_nc') {
                updates.department = value ? 'Tedarikçi' : '';
                updates.responsible_person = value ? null : formData.responsible_person;
            } else if (id === 'supplier_id') {
                const supplier = personnel.find(s => s.value === value);
                if (supplier) {
                    updates.supplier_status = supplier.status;
                }
            }
            setFormData(prev => ({ ...prev, ...updates }));
        };

        const handlePersonnelChange = (field, personName) => {
            const selectedPerson = personnel.find(p => p.full_name === personName);
            
            const updates = { [field]: personName };
            
            if (selectedPerson) {
                if (field === 'responsible_person') {
                    updates['department'] = selectedPerson.department;
                } else if (field === 'requesting_person') {
                    updates['requesting_unit'] = selectedPerson.department;
                }
            }

            setFormData(prev => ({ ...prev, ...updates }));
        };

        useEffect(() => {
            const isNewRecord = !formData?.id;
            if (isNewRecord && Object.keys(formData).length > 0) {
                const timeoutId = setTimeout(() => {
                    try {
                        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
                    } catch (error) {
                        console.warn('Draft save error:', error);
                    }
                }, 500);
                return () => clearTimeout(timeoutId);
            }
        }, [formData, DRAFT_KEY]);

        return {
            formData,
            setFormData,
            files,
            handleInputChange,
            handleOpeningDateChange,
            handleSelectChange,
            handlePersonnelChange,
            personnel,
            departments,
            getRootProps,
            getInputProps,
            isDragActive,
            removeFile,
            initializeForm,
            clearDraft,
            toInputDateString,
        };
    };