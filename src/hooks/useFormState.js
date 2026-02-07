/**
 * useFormState - Generic form state yönetimi hook'u
 * Tüm modüllerde tekrar eden form state pattern'ini birleştirir.
 * Mevcut kodları BOZMAZ - yeni modüllerde ve refactor'larda kullanılabilir.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * @param {Object} options
 * @param {Object} options.initialState - Formun başlangıç state'i
 * @param {Function} options.validate - Validation fonksiyonu (formData => errors)
 * @param {Function} options.onSubmit - Submit fonksiyonu (async formData => result)
 * @param {Function} options.onSuccess - Başarılı submit sonrası callback
 * @param {Function} options.onError - Hata durumunda callback
 * @param {string} options.draftKey - LocalStorage draft key (null ise draft kaydedilmez)
 * @param {number} options.draftDelay - Draft kaydetme gecikmesi (ms)
 */
export function useFormState({
    initialState = {},
    validate = null,
    onSubmit = null,
    onSuccess = null,
    onError = null,
    draftKey = null,
    draftDelay = 500,
} = {}) {
    const [formData, setFormData] = useState(initialState);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const draftTimerRef = useRef(null);

    // Form alanı güncelle
    const handleChange = useCallback((fieldOrEvent, value) => {
        setIsDirty(true);
        
        // Event nesnesi mi yoksa doğrudan field-value mi?
        if (fieldOrEvent && typeof fieldOrEvent === 'object' && fieldOrEvent.target) {
            const { id, name, value: inputValue, type, checked } = fieldOrEvent.target;
            const fieldName = id || name;
            const fieldValue = type === 'checkbox' ? checked : inputValue;
            setFormData(prev => ({ ...prev, [fieldName]: fieldValue }));
            // Field-level error temizleme
            if (errors[fieldName]) {
                setErrors(prev => ({ ...prev, [fieldName]: undefined }));
            }
        } else if (typeof fieldOrEvent === 'string') {
            setFormData(prev => ({ ...prev, [fieldOrEvent]: value }));
            if (errors[fieldOrEvent]) {
                setErrors(prev => ({ ...prev, [fieldOrEvent]: undefined }));
            }
        }
    }, [errors]);

    // Select alanı güncelle
    const handleSelect = useCallback((field, value) => {
        setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    }, [errors]);

    // Birden fazla alan güncelle
    const updateFields = useCallback((updates) => {
        setIsDirty(true);
        setFormData(prev => ({ ...prev, ...updates }));
    }, []);

    // Form sıfırla
    const resetForm = useCallback((newState) => {
        setFormData(newState || initialState);
        setErrors({});
        setIsDirty(false);
        setIsSubmitting(false);
    }, [initialState]);

    // Mevcut kayıtla formu başlat
    const initializeWithRecord = useCallback((record) => {
        if (record) {
            setFormData({ ...initialState, ...record });
        } else {
            setFormData(initialState);
        }
        setErrors({});
        setIsDirty(false);
    }, [initialState]);

    // Validation
    const validateForm = useCallback(() => {
        if (!validate) return true;
        
        const validationErrors = validate(formData);
        if (validationErrors && Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return false;
        }
        setErrors({});
        return true;
    }, [formData, validate]);

    // Submit
    const handleSubmit = useCallback(async (e) => {
        if (e) e.preventDefault();
        
        // Validation kontrolü
        if (!validateForm()) return { success: false, errors };
        
        if (!onSubmit) return { success: false, errors: { _form: 'Submit handler tanımlı değil' } };

        setIsSubmitting(true);
        try {
            const result = await onSubmit(formData);
            
            if (result?.error) {
                const errorMsg = result.error.message || 'Bir hata oluştu';
                setErrors({ _form: errorMsg });
                if (onError) onError(result.error);
                return { success: false, error: result.error };
            }

            setIsDirty(false);
            
            // Draft temizle
            if (draftKey) {
                try { localStorage.removeItem(draftKey); } catch {}
            }
            
            if (onSuccess) onSuccess(result?.data || result);
            return { success: true, data: result?.data || result };
        } catch (err) {
            const errorMsg = err.message || 'Beklenmeyen bir hata oluştu';
            setErrors({ _form: errorMsg });
            if (onError) onError(err);
            return { success: false, error: err };
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, validateForm, onSubmit, onSuccess, onError, draftKey, errors]);

    // Draft kaydetme (auto-save)
    useEffect(() => {
        if (!draftKey || !isDirty) return;
        
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        
        draftTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify(formData));
            } catch (error) {
                console.warn('Draft kaydetme hatası:', error);
            }
        }, draftDelay);

        return () => {
            if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        };
    }, [formData, draftKey, draftDelay, isDirty]);

    // Draft yükle
    const loadDraft = useCallback(() => {
        if (!draftKey) return null;
        try {
            const draft = localStorage.getItem(draftKey);
            if (draft) {
                const parsed = JSON.parse(draft);
                setFormData(parsed);
                return parsed;
            }
        } catch (error) {
            console.warn('Draft yükleme hatası:', error);
        }
        return null;
    }, [draftKey]);

    // Draft temizle
    const clearDraft = useCallback(() => {
        if (!draftKey) return;
        try {
            localStorage.removeItem(draftKey);
        } catch {}
    }, [draftKey]);

    return {
        // State
        formData,
        errors,
        isSubmitting,
        isDirty,
        // Setters
        setFormData,
        setErrors,
        // Handlers
        handleChange,
        handleSelect,
        updateFields,
        resetForm,
        initializeWithRecord,
        handleSubmit,
        validateForm,
        // Draft
        loadDraft,
        clearDraft,
    };
}
