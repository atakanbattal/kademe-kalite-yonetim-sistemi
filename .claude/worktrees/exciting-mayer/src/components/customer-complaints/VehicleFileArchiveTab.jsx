import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    CarFront,
    Download,
    Eye,
    File,
    FileText,
    Image,
    Loader2,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    Upload,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { normalizeTurkishForSearch, sanitizeFileName } from '@/lib/utils';
import {
    CHASSIS_BRAND_OPTIONS,
    REGISTRY_VEHICLE_FILE_DEFAULTS,
    VEHICLE_CATEGORY_OPTIONS,
    VEHICLE_FILE_TYPES,
    computeNextWarrantyDocumentNo,
    getAfterSalesCaseNumber,
    getChassisModelsForBrand,
    getCustomerDisplayName,
    getVehicleModelsForCategory,
    getWarrantyStatusVariant,
    requiresChassisSelection,
    WARRANTY_STATUS_OPTIONS,
} from '@/components/customer-complaints/afterSalesConfig';

const EMPTY_REGISTRY_FORM = {
    customer_id: '',
    vehicle_serial_number: '',
    vehicle_chassis_number: '',
    vehicle_category: '',
    vehicle_model_code: '',
    vehicle_model_name: '',
    chassis_brand: '',
    chassis_model: '',
    engine_brand: '',
    engine_model: '',
    engine_serial_number: '',
    delivery_date: '',
    production_date: '',
    vehicle_plate_number: '',
    warranty_document_no: '',
    warranty_status: '',
    warranty_start_date: '',
    warranty_end_date: '',
    notes: '',
};

const EMPTY_UPLOAD_FORM = {
    scope_type: 'vehicle',
    customer_id: '',
    related_complaint_id: '',
    vehicle_registry_id: '',
    vehicle_serial_number: '',
    vehicle_chassis_number: '',
    vehicle_plate_number: '',
    vehicle_model: '',
    delivery_date: '',
    vehicle_category: '',
    vehicle_model_code: '',
    chassis_brand: '',
    chassis_model: '',
    document_type: 'Araç Kimlik Dosyası',
    document_group: 'Araç Kimlik Kartı',
    revision_no: '',
    document_description: '',
};

const getFileIcon = (type) => {
    const normalized = type?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(normalized)) return <Image className="w-4 h-4" />;
    if (normalized === 'pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
};

const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '-');
const truncateLabel = (value, limit = 72) =>
    value && value.length > limit ? `${value.slice(0, limit).trim()}...` : value;

const VehicleFileArchiveTab = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { customers, customerComplaints } = useData();

    const [activeTab, setActiveTab] = useState('registry');
    const [registryRecords, setRegistryRecords] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [registryError, setRegistryError] = useState(null);
    const [filesError, setFilesError] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [customerFilter, setCustomerFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [documentTypeFilter, setDocumentTypeFilter] = useState('all');

    const [isRegistryDialogOpen, setRegistryDialogOpen] = useState(false);
    const [editingRegistry, setEditingRegistry] = useState(null);
    const [registryForm, setRegistryForm] = useState(EMPTY_REGISTRY_FORM);
    const [isSavingRegistry, setIsSavingRegistry] = useState(false);
    const [registrySelectedFiles, setRegistrySelectedFiles] = useState([]);

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD_FORM);
    const [isUploading, setIsUploading] = useState(false);

    const generateNextWarrantyDocumentNo = useCallback(async () => {
        try {
            const year = new Date().getFullYear();
            const prefix = `GB-${year}-`;
            const [reg, comp] = await Promise.all([
                supabase.from('after_sales_vehicle_registry').select('warranty_document_no').like('warranty_document_no', `${prefix}%`),
                supabase.from('customer_complaints').select('warranty_document_no').like('warranty_document_no', `${prefix}%`),
            ]);
            if (reg.error) throw reg.error;
            if (comp.error) throw comp.error;
            const vals = [...(reg.data || []), ...(comp.data || [])].map((r) => r.warranty_document_no);
            return computeNextWarrantyDocumentNo(year, vals);
        } catch {
            return `GB-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        }
    }, []);

    const loadRegistryRecords = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('after_sales_vehicle_registry')
                .select(`
                    *,
                    customer:customer_id(id, name, customer_name, customer_code)
                `)
                .order('delivery_date', { ascending: false });

            if (error) throw error;
            setRegistryRecords(data || []);
            setRegistryError(null);
        } catch (error) {
            console.error('Vehicle registry load error:', error);
            setRegistryRecords([]);
            if (['42P01', 'PGRST205'].includes(error.code)) {
                setRegistryError('Araç sicil tablosu henüz kurulmamış. İkinci satış sonrası migrasyonu uygulandığında sevk edilen tüm araçlar burada yönetilecek.');
            } else {
                setRegistryError(error.message || 'Araç sicili yüklenemedi.');
            }
        }
    }, []);

    const loadFiles = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('after_sales_vehicle_files')
                .select(`
                    *,
                    customer:customer_id(id, name, customer_name, customer_code),
                    related_case:related_complaint_id(id, title, case_type),
                    registry:vehicle_registry_id(id, vehicle_serial_number, vehicle_chassis_number, vehicle_model_code, vehicle_model_name)
                `)
                .order('upload_date', { ascending: false })
                .limit(500);

            if (error) throw error;
            setFiles(data || []);
            setFilesError(null);
        } catch (error) {
            console.warn('Enhanced file archive load failed, fallback is being used:', error);

            try {
                const { data, error: fallbackError } = await supabase
                    .from('after_sales_vehicle_files')
                    .select(`
                        *,
                        customer:customer_id(id, name, customer_name, customer_code),
                        related_case:related_complaint_id(id, title, case_type)
                    `)
                    .order('upload_date', { ascending: false })
                    .limit(500);

                if (fallbackError) throw fallbackError;
                setFiles((data || []).map((item) => ({ ...item, scope_type: item.scope_type || 'vehicle' })));
                setFilesError(error.code === '42703' ? 'Araç sicili bağlantıları için migrasyon bekleniyor. Mevcut araç dosyaları yine de görüntülenebilir.' : null);
            } catch (fallbackError) {
                console.error('Vehicle archive fallback load error:', fallbackError);
                setFiles([]);
                if (['42P01', 'PGRST205'].includes(fallbackError.code)) {
                    setFilesError('Araç dosya arşivi tablosu henüz kurulmamış. Satış sonrası migrasyonu uygulandıktan sonra bu alan aktif olacaktır.');
                } else {
                    setFilesError(fallbackError.message || 'Araç dosya arşivi yüklenemedi.');
                }
            }
        }
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadRegistryRecords(), loadFiles()]);
        setLoading(false);
    }, [loadFiles, loadRegistryRecords]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useEffect(() => {
        const validModels = getVehicleModelsForCategory(registryForm.vehicle_category);
        if (registryForm.vehicle_model_code && !validModels.includes(registryForm.vehicle_model_code)) {
            setRegistryForm((prev) => ({ ...prev, vehicle_model_code: '' }));
        }
        if (!requiresChassisSelection(registryForm.vehicle_category) && (registryForm.chassis_brand || registryForm.chassis_model)) {
            setRegistryForm((prev) => ({ ...prev, chassis_brand: '', chassis_model: '' }));
        }
    }, [registryForm.vehicle_category]);

    useEffect(() => {
        const validModels = getVehicleModelsForCategory(uploadForm.vehicle_category);
        if (uploadForm.vehicle_model_code && !validModels.includes(uploadForm.vehicle_model_code)) {
            setUploadForm((prev) => ({ ...prev, vehicle_model_code: '' }));
        }
        if (!requiresChassisSelection(uploadForm.vehicle_category) && (uploadForm.chassis_brand || uploadForm.chassis_model)) {
            setUploadForm((prev) => ({ ...prev, chassis_brand: '', chassis_model: '' }));
        }
    }, [uploadForm.vehicle_category]);

    const customerOptions = useMemo(
        () =>
            (customers || []).map((customer) => ({
                value: customer.id,
                label: `${getCustomerDisplayName(customer)}${customer.customer_code ? ` (${customer.customer_code})` : ''}`,
            })),
        [customers]
    );

    const registryOptions = useMemo(
        () =>
            registryRecords.map((record) => ({
                value: record.id,
                label: `${record.vehicle_serial_number || '-'}${record.vehicle_plate_number ? ` • ${record.vehicle_plate_number}` : ''} • ${record.vehicle_model_code || record.vehicle_model_name || '-'} • ${getCustomerDisplayName(record.customer)}`,
            })),
        [registryRecords]
    );

    const filteredRegistryRecords = useMemo(() => {
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);
        return registryRecords.filter((record) => {
            const matchesCustomer = customerFilter === 'all' || record.customer_id === customerFilter;
            const matchesCategory = categoryFilter === 'all' || record.vehicle_category === categoryFilter;
            if (!matchesCustomer || !matchesCategory) return false;
            if (!normalizedSearch) return true;

            return [
                record.vehicle_serial_number,
                record.vehicle_chassis_number,
                record.vehicle_plate_number,
                record.vehicle_category,
                record.vehicle_model_code,
                record.vehicle_model_name,
                record.chassis_brand,
                record.chassis_model,
                record.engine_brand,
                record.engine_model,
                record.engine_serial_number,
                record.notes,
                record.warranty_status,
                record.warranty_document_no,
                getCustomerDisplayName(record.customer),
            ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearch));
        });
    }, [registryRecords, searchTerm, customerFilter, categoryFilter]);

    const registryTableMeta = useMemo(() => {
        const meta = new Map();
        for (const record of filteredRegistryRecords) {
            const relatedComplaintCount = (customerComplaints || []).filter(
                (complaint) =>
                    (record.vehicle_serial_number && complaint.vehicle_serial_number === record.vehicle_serial_number) ||
                    (record.vehicle_chassis_number && complaint.vehicle_chassis_number === record.vehicle_chassis_number)
            ).length;
            const relatedDocumentCount = files.filter(
                (file) =>
                    file.vehicle_registry_id === record.id ||
                    (record.vehicle_serial_number && file.vehicle_serial_number === record.vehicle_serial_number)
            ).length;
            meta.set(record.id, { relatedComplaintCount, relatedDocumentCount });
        }
        return meta;
    }, [filteredRegistryRecords, customerComplaints, files]);

    const filteredFiles = useMemo(() => {
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);
        return files.filter((record) => {
            const matchesCustomer = customerFilter === 'all' || record.customer_id === customerFilter;
            const matchesCategory = categoryFilter === 'all' || record.vehicle_category === categoryFilter || record.registry?.vehicle_category === categoryFilter;
            const matchesDocType = documentTypeFilter === 'all' || record.document_type === documentTypeFilter;
            if (!matchesCustomer || !matchesCategory || !matchesDocType) return false;
            if (!normalizedSearch) return true;

            return [
                record.vehicle_serial_number,
                record.vehicle_chassis_number,
                record.vehicle_plate_number,
                record.vehicle_model,
                record.vehicle_category,
                record.vehicle_model_code,
                record.chassis_brand,
                record.chassis_model,
                record.document_name,
                record.document_description,
                record.document_group,
                getCustomerDisplayName(record.customer),
                getAfterSalesCaseNumber(record.related_case),
                record.related_case?.title,
            ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearch));
        });
    }, [files, searchTerm, customerFilter, categoryFilter, documentTypeFilter]);

    const vehicleFiles = useMemo(
        () => filteredFiles.filter((record) => (record.scope_type || 'vehicle') !== 'model'),
        [filteredFiles]
    );

    const stats = useMemo(() => ({
        totalVehicles: registryRecords.length,
        linkedVehicleDocs: files.filter((record) => (record.scope_type || 'vehicle') !== 'model' && record.vehicle_registry_id).length,
        totalVehicleDocs: files.filter((record) => (record.scope_type || 'vehicle') !== 'model').length,
        logbooks: files.filter((record) => record.document_type === 'Logbook').length,
    }), [registryRecords, files]);

    const handleRegistryInputChange = (field, value) => {
        setRegistryForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleUploadInputChange = (field, value) => {
        if (field === 'vehicle_registry_id') {
            const selectedRegistry = registryRecords.find((record) => record.id === value);
            if (selectedRegistry) {
                setUploadForm((prev) => ({
                    ...prev,
                    vehicle_registry_id: value,
                    customer_id: selectedRegistry.customer_id || prev.customer_id,
                    vehicle_serial_number: selectedRegistry.vehicle_serial_number || '',
                    vehicle_chassis_number: selectedRegistry.vehicle_chassis_number || '',
                    vehicle_plate_number: selectedRegistry.vehicle_plate_number || '',
                    vehicle_model: selectedRegistry.vehicle_model_name || selectedRegistry.vehicle_model_code || '',
                    vehicle_category: selectedRegistry.vehicle_category || '',
                    vehicle_model_code: selectedRegistry.vehicle_model_code || '',
                    chassis_brand: selectedRegistry.chassis_brand || '',
                    chassis_model: selectedRegistry.chassis_model || '',
                    delivery_date: selectedRegistry.delivery_date || '',
                }));
                return;
            }
        }

        setUploadForm((prev) => ({ ...prev, [field]: value }));
    };

    const openNewRegistryDialog = async () => {
        setEditingRegistry(null);
        setRegistryForm({
            ...EMPTY_REGISTRY_FORM,
            warranty_document_no: await generateNextWarrantyDocumentNo(),
        });
        setRegistrySelectedFiles([]);
        setUploadForm({ ...EMPTY_UPLOAD_FORM });
        setSelectedFiles([]);
        setRegistryDialogOpen(true);
    };

    const openEditRegistryDialog = (record) => {
        setEditingRegistry(record);
        setRegistryForm({
            customer_id: record.customer_id || '',
            vehicle_serial_number: record.vehicle_serial_number || '',
            vehicle_chassis_number: record.vehicle_chassis_number || '',
            vehicle_category: record.vehicle_category || '',
            vehicle_model_code: record.vehicle_model_code || '',
            vehicle_model_name: record.vehicle_model_name || '',
            chassis_brand: record.chassis_brand || '',
            chassis_model: record.chassis_model || '',
            engine_brand: record.engine_brand || '',
            engine_model: record.engine_model || '',
            engine_serial_number: record.engine_serial_number || '',
            delivery_date: record.delivery_date || '',
            production_date: record.production_date || '',
            vehicle_plate_number: record.vehicle_plate_number || '',
            warranty_document_no: record.warranty_document_no || '',
            warranty_status: record.warranty_status || '',
            warranty_start_date: record.warranty_start_date || '',
            warranty_end_date: record.warranty_end_date || '',
            notes: record.notes || '',
        });
        setRegistrySelectedFiles([]);
        setUploadForm({ ...EMPTY_UPLOAD_FORM });
        setSelectedFiles([]);
        setRegistryDialogOpen(true);
    };

    const uploadArchiveFiles = useCallback(async ({ filesToUpload, metadata, scopePath }) => {
        for (const file of filesToUpload) {
            const filePath = `${scopePath}/${Date.now()}-${sanitizeFileName(file.name)}`;

            const { error: uploadError } = await supabase.storage
                .from('after_sales_files')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type || 'application/octet-stream',
                });

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
                .from('after_sales_vehicle_files')
                .insert({
                    ...metadata,
                    document_name: file.name,
                    file_path: filePath,
                    file_type: file.name.split('.').pop() || null,
                    file_size: file.size,
                    uploaded_by: user?.id || null,
                });

            if (dbError) throw dbError;
        }
    }, [user?.id]);

    const handleSaveRegistry = useCallback(async () => {
        if (!registryForm.vehicle_category || !registryForm.vehicle_model_code) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Araç kategorisi ve model kodu zorunludur.',
            });
            return;
        }

        setIsSavingRegistry(true);

        try {
            const payload = {
                ...registryForm,
                customer_id: registryForm.customer_id || null,
                vehicle_serial_number: registryForm.vehicle_serial_number?.trim() || null,
                vehicle_chassis_number: registryForm.vehicle_chassis_number?.trim() || null,
                vehicle_plate_number: registryForm.vehicle_plate_number?.trim() || null,
                vehicle_model_name: registryForm.vehicle_model_name?.trim() || null,
                chassis_brand: registryForm.chassis_brand || null,
                chassis_model: registryForm.chassis_model || null,
                engine_brand: registryForm.engine_brand?.trim() || null,
                engine_model: registryForm.engine_model?.trim() || null,
                engine_serial_number: registryForm.engine_serial_number?.trim() || null,
                delivery_date: registryForm.delivery_date || null,
                production_date: registryForm.production_date || null,
                warranty_document_no: registryForm.warranty_document_no?.trim() || null,
                warranty_status: registryForm.warranty_status?.trim() || null,
                warranty_start_date: registryForm.warranty_start_date || null,
                warranty_end_date: registryForm.warranty_end_date || null,
                notes: registryForm.notes?.trim() || null,
                created_by: user?.id || null,
            };

            let error;
            let savedRegistry;
            if (editingRegistry) {
                const result = await supabase
                    .from('after_sales_vehicle_registry')
                    .update(payload)
                    .eq('id', editingRegistry.id)
                    .select()
                    .single();
                error = result.error;
                savedRegistry = result.data;
            } else {
                const result = await supabase
                    .from('after_sales_vehicle_registry')
                    .insert([payload])
                    .select()
                    .single();
                error = result.error;
                savedRegistry = result.data;
            }

            if (error) throw error;

            if (registrySelectedFiles.length > 0 && savedRegistry) {
                await uploadArchiveFiles({
                    filesToUpload: registrySelectedFiles,
                    metadata: {
                        scope_type: 'vehicle',
                        customer_id: savedRegistry.customer_id || null,
                        related_complaint_id: null,
                        vehicle_registry_id: savedRegistry.id,
                        vehicle_serial_number: savedRegistry.vehicle_serial_number || null,
                        vehicle_chassis_number: savedRegistry.vehicle_chassis_number || null,
                        vehicle_plate_number: savedRegistry.vehicle_plate_number || null,
                        vehicle_model: savedRegistry.vehicle_model_name || savedRegistry.vehicle_model_code || null,
                        delivery_date: savedRegistry.delivery_date || null,
                        vehicle_category: savedRegistry.vehicle_category || null,
                        vehicle_model_code: savedRegistry.vehicle_model_code || null,
                        chassis_brand: savedRegistry.chassis_brand || null,
                        chassis_model: savedRegistry.chassis_model || null,
                        document_type: REGISTRY_VEHICLE_FILE_DEFAULTS.document_type,
                        document_group: REGISTRY_VEHICLE_FILE_DEFAULTS.document_group,
                        document_description: null,
                    },
                    scopePath: `vehicles/${sanitizeFileName(savedRegistry.vehicle_serial_number || savedRegistry.id)}`,
                });
            }

            toast({
                title: 'Başarılı',
                description: `Araç sicil kaydı ${editingRegistry ? 'güncellendi' : 'oluşturuldu'}${registrySelectedFiles.length > 0 ? ' ve dosyalar eklendi' : ''}.`,
            });

            setRegistryDialogOpen(false);
            setRegistryForm(EMPTY_REGISTRY_FORM);
            setRegistrySelectedFiles([]);
            setEditingRegistry(null);
            loadAll();
        } catch (error) {
            console.error('Vehicle registry save error:', error);
            toast({
                variant: 'destructive',
                title: 'Kayıt Hatası',
                description: error.message || 'Araç sicili kaydedilemedi.',
            });
        } finally {
            setIsSavingRegistry(false);
        }
    }, [editingRegistry, loadAll, registryForm, registrySelectedFiles, toast, uploadArchiveFiles, user?.id]);

    const handleUpload = async () => {
        if (!uploadForm.vehicle_registry_id) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Önce araç sicil kaydını seçin.',
            });
            return;
        }

        if (selectedFiles.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Dosya Seçilmedi',
                description: 'Yüklemek için en az bir dosya seçin.',
            });
            return;
        }

        setIsUploading(true);

        try {
            const safeForm = {
                ...uploadForm,
                customer_id: uploadForm.customer_id || null,
                related_complaint_id: uploadForm.related_complaint_id || null,
                vehicle_registry_id: uploadForm.vehicle_registry_id || null,
                vehicle_serial_number: uploadForm.vehicle_serial_number?.trim() || null,
                vehicle_chassis_number: uploadForm.vehicle_chassis_number?.trim() || null,
                vehicle_plate_number: uploadForm.vehicle_plate_number?.trim() || null,
                vehicle_model: uploadForm.vehicle_model?.trim() || null,
                delivery_date: uploadForm.delivery_date || null,
                vehicle_category: uploadForm.vehicle_category || null,
                vehicle_model_code: uploadForm.vehicle_model_code || null,
                chassis_brand: uploadForm.chassis_brand || null,
                chassis_model: uploadForm.chassis_model || null,
                revision_no: null,
                document_type: REGISTRY_VEHICLE_FILE_DEFAULTS.document_type,
                document_group: REGISTRY_VEHICLE_FILE_DEFAULTS.document_group,
                document_description: uploadForm.document_description?.trim() || null,
            };

            const scopePath = `vehicles/${sanitizeFileName(uploadForm.vehicle_serial_number || uploadForm.vehicle_registry_id || 'genel')}`;

            for (const file of selectedFiles) {
                const filePath = `${scopePath}/${Date.now()}-${sanitizeFileName(file.name)}`;

                const { error: uploadError } = await supabase.storage
                    .from('after_sales_files')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type || 'application/octet-stream',
                    });

                if (uploadError) throw uploadError;

                const { error: dbError } = await supabase
                    .from('after_sales_vehicle_files')
                    .insert({
                        ...safeForm,
                        document_name: file.name,
                        file_path: filePath,
                        file_type: file.name.split('.').pop() || null,
                        file_size: file.size,
                        uploaded_by: user?.id || null,
                    });

                if (dbError) throw dbError;
            }

            toast({
                title: 'Başarılı',
                description: `${selectedFiles.length} doküman arşive eklendi.`,
            });

            setUploadForm(EMPTY_UPLOAD_FORM);
            setSelectedFiles([]);
            setRegistryDialogOpen(false);
            loadAll();
        } catch (error) {
            console.error('Vehicle archive upload error:', error);
            toast({
                variant: 'destructive',
                title: 'Yükleme Hatası',
                description: error.message || 'Dosyalar yüklenemedi.',
            });
        } finally {
            setIsUploading(false);
        }
    };

    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: null, target: null });

    const handleDelete = async (record) => {
        try {
            const { error: storageError } = await supabase.storage
                .from('after_sales_files')
                .remove([record.file_path]);

            if (storageError) throw storageError;

            const { error: dbError } = await supabase
                .from('after_sales_vehicle_files')
                .delete()
                .eq('id', record.id);

            if (dbError) throw dbError;

            toast({
                title: 'Silindi',
                description: 'Doküman arşivden kaldırıldı.',
            });

            loadFiles();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Silme Hatası',
                description: error.message || 'Dosya silinemedi.',
            });
        }
    };

    const confirmDeleteFile = (record) => {
        setDeleteConfirm({ open: true, type: 'file', target: record });
    };

    const handleDeleteRegistry = async (registryRecord) => {
        try {
            const linkedFiles = files.filter((f) => f.vehicle_registry_id === registryRecord.id);
            for (const f of linkedFiles) {
                await supabase.storage.from('after_sales_files').remove([f.file_path]);
                await supabase.from('after_sales_vehicle_files').delete().eq('id', f.id);
            }
            const { error } = await supabase.from('after_sales_vehicle_registry').delete().eq('id', registryRecord.id);
            if (error) throw error;
            toast({ title: 'Silindi', description: 'Araç sicil kaydı ve bağlı dosyalar silindi.' });
            loadAll();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Silme Hatası', description: error.message || 'Araç sicil kaydı silinemedi.' });
        }
    };

    const confirmDeleteRegistry = (record) => {
        setDeleteConfirm({ open: true, type: 'registry', target: record });
    };

    const executeDeleteConfirm = async () => {
        if (deleteConfirm.type === 'file') {
            await handleDelete(deleteConfirm.target);
        } else if (deleteConfirm.type === 'registry') {
            await handleDeleteRegistry(deleteConfirm.target);
        }
        setDeleteConfirm({ open: false, type: null, target: null });
    };

    const openFile = async (record, download = false) => {
        try {
            const { data, error } = await supabase.storage
                .from('after_sales_files')
                .download(record.file_path);

            if (error) throw error;

            const url = window.URL.createObjectURL(data);

            if (download) {
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = record.document_name;
                anchor.click();
                return;
            }

            window.open(url, '_blank');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: download ? 'İndirme Hatası' : 'Görüntüleme Hatası',
                description: error.message || 'Dosya açılamadı.',
            });
        }
    };

    const selectedUploadRegistry = useMemo(
        () => registryRecords.find((r) => r.id === uploadForm.vehicle_registry_id),
        [registryRecords, uploadForm.vehicle_registry_id]
    );

    const registryFormContent = (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                    <Label>Müşteri</Label>
                    <SearchableSelectDialog
                        options={customerOptions}
                        value={registryForm.customer_id}
                        onChange={(value) => handleRegistryInputChange('customer_id', value)}
                        triggerPlaceholder="Müşteri seçin..."
                        dialogTitle="Müşteri Seç"
                        searchPlaceholder="Müşteri ara..."
                        notFoundText="Müşteri bulunamadı."
                        allowClear
                    />
                </div>
                <div>
                    <Label>Araç Kategorisi</Label>
                    <Select value={registryForm.vehicle_category || 'none'} onValueChange={(value) => handleRegistryInputChange('vehicle_category', value === 'none' ? '' : value)}>
                        <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Belirtilmedi</SelectItem>
                            {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Model Kodu</Label>
                    <Select value={registryForm.vehicle_model_code || 'none'} onValueChange={(value) => handleRegistryInputChange('vehicle_model_code', value === 'none' ? '' : value)} disabled={!registryForm.vehicle_category}>
                        <SelectTrigger><SelectValue placeholder="Önce kategori seçin" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Belirtilmedi</SelectItem>
                            {getVehicleModelsForCategory(registryForm.vehicle_category).map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div><Label htmlFor="vehicle_serial_number">Seri No</Label><Input id="vehicle_serial_number" value={registryForm.vehicle_serial_number} onChange={(event) => handleRegistryInputChange('vehicle_serial_number', event.target.value)} /></div>
                <div><Label htmlFor="vehicle_chassis_number">Şasi No</Label><Input id="vehicle_chassis_number" value={registryForm.vehicle_chassis_number} onChange={(event) => handleRegistryInputChange('vehicle_chassis_number', event.target.value)} /></div>
                <div><Label htmlFor="vehicle_plate_number">Plaka</Label><Input id="vehicle_plate_number" value={registryForm.vehicle_plate_number} onChange={(event) => handleRegistryInputChange('vehicle_plate_number', event.target.value)} placeholder="Örn. 34 ABC 123" /></div>
                <div>
                    <Label htmlFor="warranty_document_no">Garanti Belge No</Label>
                    {editingRegistry ? (
                        <Input id="warranty_document_no" value={registryForm.warranty_document_no} onChange={(event) => handleRegistryInputChange('warranty_document_no', event.target.value)} />
                    ) : (
                        <>
                            <Input id="warranty_document_no" readOnly value={registryForm.warranty_document_no} className="bg-muted" />
                            <p className="text-xs text-muted-foreground mt-1">GB-YYYY-#### sırası otomatik; vaka kayıtlarıyla aynı numaralandırma.</p>
                        </>
                    )}
                </div>

                {requiresChassisSelection(registryForm.vehicle_category) && (
                    <>
                        <div>
                            <Label>Şase Sağlayıcısı</Label>
                            <Select value={registryForm.chassis_brand || 'none'} onValueChange={(value) => handleRegistryInputChange('chassis_brand', value === 'none' ? '' : value)}>
                                <SelectTrigger><SelectValue placeholder="Şase markası seçin" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                    {CHASSIS_BRAND_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Şase Modeli</Label>
                            <Select value={registryForm.chassis_model || 'none'} onValueChange={(value) => handleRegistryInputChange('chassis_model', value === 'none' ? '' : value)} disabled={!registryForm.chassis_brand}>
                                <SelectTrigger><SelectValue placeholder="Önce şase markası seçin" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                    {getChassisModelsForBrand(registryForm.chassis_brand).map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}

                <div><Label htmlFor="engine_brand">Motor Markası</Label><Input id="engine_brand" value={registryForm.engine_brand} onChange={(event) => handleRegistryInputChange('engine_brand', event.target.value)} /></div>
                <div><Label htmlFor="engine_model">Motor Modeli</Label><Input id="engine_model" value={registryForm.engine_model} onChange={(event) => handleRegistryInputChange('engine_model', event.target.value)} /></div>
                <div><Label htmlFor="engine_serial_number">Motor Seri No</Label><Input id="engine_serial_number" value={registryForm.engine_serial_number} onChange={(event) => handleRegistryInputChange('engine_serial_number', event.target.value)} /></div>
                <div><Label htmlFor="production_date">Üretim Tarihi</Label><Input id="production_date" type="date" value={registryForm.production_date} onChange={(event) => handleRegistryInputChange('production_date', event.target.value)} /></div>
                <div><Label htmlFor="delivery_date">Teslim Tarihi</Label><Input id="delivery_date" type="date" value={registryForm.delivery_date} onChange={(event) => handleRegistryInputChange('delivery_date', event.target.value)} /></div>

                <div>
                    <Label>Garanti durumu</Label>
                    <Select value={registryForm.warranty_status || 'none'} onValueChange={(value) => handleRegistryInputChange('warranty_status', value === 'none' ? '' : value)}>
                        <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Belirtilmedi</SelectItem>
                            {WARRANTY_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div><Label htmlFor="warranty_start_date">Garanti başlangıç</Label><Input id="warranty_start_date" type="date" value={registryForm.warranty_start_date} onChange={(event) => handleRegistryInputChange('warranty_start_date', event.target.value)} /></div>
                <div><Label htmlFor="warranty_end_date">Garanti bitiş</Label><Input id="warranty_end_date" type="date" value={registryForm.warranty_end_date} onChange={(event) => handleRegistryInputChange('warranty_end_date', event.target.value)} /></div>
            </div>

            <div>
                <Label htmlFor="notes">Ek Notlar</Label>
                <Textarea id="notes" rows={4} value={registryForm.notes} onChange={(event) => handleRegistryInputChange('notes', event.target.value)} placeholder="Araç kimlik kartına eklemek istediğiniz diğer bilgiler..." />
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2">
                <p className="text-sm font-medium">PDF (isteğe bağlı)</p>
                <p className="text-xs text-muted-foreground">Kayıtla birlikte yüklenir; ek seçim gerekmez.</p>
                <Input
                    id="registry_files"
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    onChange={(event) => setRegistrySelectedFiles(Array.from(event.target.files || []))}
                />
                {registrySelectedFiles.length > 0 && (
                    <div className="space-y-1 text-sm text-muted-foreground pt-1">
                        {registrySelectedFiles.map((file) => (
                            <div key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span>{file.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 flex items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Araç arşivi yükleniyor...
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Araç Arşivi ve Doküman Merkezi</h3>
                    <p className="text-sm text-muted-foreground">
                        Araç kimliği, logbook ve sicile özel tüm evrakları <span className="font-medium text-foreground">Araç Sicili</span> kayıtları üzerinden yükleyip takip edin.
                    </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                    <Button className="h-11 px-5" onClick={openNewRegistryDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Sicil ve Dosya
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Sevk Edilen Araç</div><div className="text-3xl font-bold mt-2">{stats.totalVehicles}</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Sicile Bağlı Dosya</div><div className="text-3xl font-bold mt-2 text-amber-600">{stats.linkedVehicleDocs}</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Araç Dosyaları</div><div className="text-3xl font-bold mt-2 text-blue-600">{stats.totalVehicleDocs}</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Logbook Taraması</div><div className="text-3xl font-bold mt-2 text-violet-600">{stats.logbooks}</div></CardContent></Card>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <div className="flex h-12 items-center gap-3 rounded-xl border bg-background px-4">
                                <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Müşteri, seri no, şasi, motor, parça veya doküman adı ile ara..."
                                    className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                        </div>

                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                            <SelectTrigger><SelectValue placeholder="Tüm Müşteriler" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Müşteriler</SelectItem>
                                {customerOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger><SelectValue placeholder="Tüm Kategoriler" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                                {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {(registryError || filesError) && (
                <Card className="border-amber-300 bg-amber-50/60">
                    <CardContent className="pt-6">
                        <div className="flex gap-3">
                            <ShieldCheck className="w-5 h-5 text-amber-700 mt-0.5" />
                            <div className="space-y-2 text-sm text-amber-900">
                                {registryError && <div>{registryError}</div>}
                                {filesError && <div>{filesError}</div>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-4">
                <Badge variant={activeTab === 'registry' ? 'default' : 'outline'} className="cursor-pointer px-3 py-1.5 text-sm" onClick={() => setActiveTab('registry')}>
                    <CarFront className="w-3.5 h-3.5 mr-1.5" /> Araç Sicili ({filteredRegistryRecords.length})
                </Badge>
                <Badge variant={activeTab === 'vehicle-files' ? 'default' : 'outline'} className="cursor-pointer px-3 py-1.5 text-sm" onClick={() => setActiveTab('vehicle-files')}>
                    <Archive className="w-3.5 h-3.5 mr-1.5" /> Araç Dosyaları ({vehicleFiles.length})
                </Badge>
            </div>

            {activeTab === 'registry' && (
                <div className="space-y-4">
                    {filteredRegistryRecords.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                {registryRecords.length === 0 ? 'Henüz araç sicil kaydı oluşturulmamış.' : 'Filtreye uyan araç sicil kaydı bulunamadı.'}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="overflow-hidden border-muted/60 shadow-sm">
                            <CardContent className="p-0">
                                <Table className="min-w-[1200px]">
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="min-w-[140px]">Araç</TableHead>
                                            <TableHead className="min-w-[120px]">Müşteri</TableHead>
                                            <TableHead className="min-w-[100px] whitespace-nowrap">Seri no</TableHead>
                                            <TableHead className="min-w-[100px]">Şasi</TableHead>
                                            <TableHead className="min-w-[88px] font-semibold text-foreground">Plaka</TableHead>
                                            <TableHead className="min-w-[120px]">Motor</TableHead>
                                            <TableHead className="min-w-[88px] whitespace-nowrap">Teslim</TableHead>
                                            <TableHead className="min-w-[100px]">Garanti no</TableHead>
                                            <TableHead className="min-w-[110px]">Garanti durumu</TableHead>
                                            <TableHead className="min-w-[92px] whitespace-nowrap">Bitiş</TableHead>
                                            <TableHead className="w-14 text-center">Dosya</TableHead>
                                            <TableHead className="w-12 text-center">Vaka</TableHead>
                                            <TableHead className="w-[84px] text-right pr-3">İşlem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRegistryRecords.map((record) => {
                                            const { relatedComplaintCount, relatedDocumentCount } =
                                                registryTableMeta.get(record.id) || { relatedComplaintCount: 0, relatedDocumentCount: 0 };
                                            const motorLabel = [record.engine_brand, record.engine_model].filter(Boolean).join(' · ') || '—';
                                            const customerLabel = getCustomerDisplayName(record.customer);
                                            const endRaw = record.warranty_end_date ? new Date(record.warranty_end_date) : null;
                                            const warrantyExpired =
                                                endRaw &&
                                                !Number.isNaN(endRaw.getTime()) &&
                                                endRaw < new Date(new Date().toDateString());
                                            return (
                                                <TableRow key={record.id} className="group">
                                                    <TableCell>
                                                        <div className="font-medium leading-tight">{record.vehicle_model_name || record.vehicle_model_code || '—'}</div>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {record.vehicle_category && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                                                    {record.vehicle_category}
                                                                </Badge>
                                                            )}
                                                            {record.vehicle_model_code && (
                                                                <span className="text-[11px] text-muted-foreground">{record.vehicle_model_code}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="line-clamp-2 text-muted-foreground" title={customerLabel}>
                                                            {customerLabel}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-[11px] sm:text-xs tabular-nums">
                                                        {record.vehicle_serial_number || '—'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-[11px] sm:text-xs max-w-[120px] truncate" title={record.vehicle_chassis_number || ''}>
                                                        {record.vehicle_chassis_number || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-medium tabular-nums tracking-wide">
                                                            {record.vehicle_plate_number || '—'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="max-w-[180px]">
                                                        <span className="line-clamp-2 text-muted-foreground text-xs" title={motorLabel}>
                                                            {motorLabel}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                                                        {formatDate(record.delivery_date)}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-[11px] max-w-[120px]">
                                                        <span className="line-clamp-1 block" title={record.warranty_document_no || ''}>
                                                            {record.warranty_document_no || '—'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {record.warranty_status ? (
                                                            <Badge variant={getWarrantyStatusVariant(record.warranty_status)} className="text-[10px] font-normal whitespace-nowrap">
                                                                {record.warranty_status}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-xs">
                                                        {record.warranty_end_date ? (
                                                            <span
                                                                className={warrantyExpired ? 'text-destructive font-medium tabular-nums' : 'text-muted-foreground tabular-nums'}
                                                                title={warrantyExpired ? 'Garanti bitiş tarihi geçmiş' : undefined}
                                                            >
                                                                {formatDate(record.warranty_end_date)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary" className="tabular-nums font-normal text-xs">
                                                            {relatedDocumentCount}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center text-muted-foreground tabular-nums text-xs">
                                                        {relatedComplaintCount}
                                                    </TableCell>
                                                    <TableCell className="text-right p-1.5 sm:p-2">
                                                        <div className="flex items-center justify-end gap-0.5">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                                                                title="Sicil ve dosyalar"
                                                                onClick={() => openEditRegistryDialog(record)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                                title="Sicili sil"
                                                                onClick={() => confirmDeleteRegistry(record)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {activeTab === 'vehicle-files' && (
                <div className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                                    <SelectTrigger><SelectValue placeholder="Tüm Doküman Tipleri" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Doküman Tipleri</SelectItem>
                                        {VEHICLE_FILE_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                    Yeni araç dosyalarını <span className="mx-1 font-medium text-foreground">Araç Sicili</span> sekmesinden ilgili sicile girerek ekleyebilirsin.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {vehicleFiles.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-muted-foreground">{files.length === 0 ? 'Henüz araç dosyası eklenmemiş.' : 'Filtreye uyan araç dosyası bulunamadı.'}</CardContent></Card>
                    ) : (
                        <div className="space-y-4">
                            {vehicleFiles.map((record) => (
                                <Card key={record.id} className="border-muted/70">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline">{record.document_type}</Badge>
                                                    {record.document_group && <Badge variant="secondary">{record.document_group}</Badge>}
                                                    {record.revision_no && <Badge variant="secondary">Rev. {record.revision_no}</Badge>}
                                                </div>
                                                <CardTitle className="text-base">{record.document_name}</CardTitle>
                                                <CardDescription>
                                                    {getCustomerDisplayName(record.customer)}{record.customer?.customer_code ? ` • ${record.customer.customer_code}` : ''}
                                                </CardDescription>
                                            </div>

                                            <div className="p-2 rounded-lg bg-muted/60">
                                                {getFileIcon(record.file_type)}
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                                            <div><div className="text-muted-foreground">Seri No</div><div className="font-semibold">{record.vehicle_serial_number || '-'}</div></div>
                                            <div><div className="text-muted-foreground">Şasi No</div><div className="font-semibold">{record.vehicle_chassis_number || '-'}</div></div>
                                            <div><div className="text-muted-foreground">Araç / Model</div><div>{record.vehicle_model || record.vehicle_model_code || '-'}</div></div>
                                            <div><div className="text-muted-foreground">Boyut</div><div>{formatFileSize(record.file_size)}</div></div>
                                        </div>

                                        {record.related_case && (
                                            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                                                <div className="text-muted-foreground">İlişkili Vaka</div>
                                                <div className="font-medium">
                                                    {getAfterSalesCaseNumber(record.related_case)} - {record.related_case.title}
                                                </div>
                                            </div>
                                        )}

                                        {record.document_description && (
                                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{record.document_description}</div>
                                        )}

                                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                            <span>{new Date(record.upload_date || record.created_at).toLocaleString('tr-TR')}</span>
                                            {record.delivery_date && <span>Teslim: {formatDate(record.delivery_date)}</span>}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" onClick={() => openFile(record, false)}><Eye className="w-4 h-4 mr-2" />Görüntüle</Button>
                                            <Button size="sm" variant="outline" onClick={() => openFile(record, true)}><Download className="w-4 h-4 mr-2" />İndir</Button>
                                            <Button size="sm" variant="destructive" onClick={() => confirmDeleteFile(record)}><Trash2 className="w-4 h-4 mr-2" />Sil</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Dialog
                open={isRegistryDialogOpen}
                onOpenChange={(open) => {
                    setRegistryDialogOpen(open);
                    if (!open) {
                        setEditingRegistry(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-6xl w-[96vw] max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRegistry ? 'Araç Sicili ve Dosyalarını Yönet' : 'Sicil ve Dosya'}</DialogTitle>
                    </DialogHeader>

                    {editingRegistry ? (
                        registryFormContent
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <Label>Kayıtlı sicil</Label>
                                <SearchableSelectDialog
                                    options={registryOptions}
                                    value={uploadForm.vehicle_registry_id}
                                    onChange={(value) => handleUploadInputChange('vehicle_registry_id', value)}
                                    triggerPlaceholder="Seçin veya boş bırakın…"
                                    dialogTitle="Araç Sicili Seç"
                                    searchPlaceholder="Seri no, plaka veya model ile ara…"
                                    notFoundText="Araç bulunamadı."
                                    allowClear
                                />
                                <p className="text-xs text-muted-foreground mt-1.5">
                                    PDF yüklemek için sicil seçin; yeni sicil oluşturmak için boş bırakın.
                                </p>
                            </div>

                            {!uploadForm.vehicle_registry_id ? (
                                registryFormContent
                            ) : (
                                <div className="space-y-4">
                                    {selectedUploadRegistry && (
                                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground space-y-1.5">
                                            <div>
                                                <span className="font-semibold text-foreground">{selectedUploadRegistry.warranty_document_no || '—'}</span>
                                                {' · '}
                                                {selectedUploadRegistry.vehicle_serial_number || '—'}
                                                {selectedUploadRegistry.vehicle_plate_number ? ` · ${selectedUploadRegistry.vehicle_plate_number}` : ''}
                                                {' · '}
                                                {selectedUploadRegistry.vehicle_model_code || selectedUploadRegistry.vehicle_model_name || '—'}
                                            </div>
                                            {(selectedUploadRegistry.warranty_status || selectedUploadRegistry.warranty_end_date) && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {selectedUploadRegistry.warranty_status && (
                                                        <Badge variant={getWarrantyStatusVariant(selectedUploadRegistry.warranty_status)} className="text-[10px] font-normal">
                                                            {selectedUploadRegistry.warranty_status}
                                                        </Badge>
                                                    )}
                                                    {selectedUploadRegistry.warranty_end_date && (
                                                        <span className="text-xs">
                                                            Bitiş: <span className="font-medium text-foreground tabular-nums">{formatDate(selectedUploadRegistry.warranty_end_date)}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div>
                                        <Label htmlFor="add_pdf">PDF</Label>
                                        <Input id="add_pdf" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
                                        {selectedFiles.length > 0 && (
                                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                {selectedFiles.map((file) => (
                                                    <div key={`${file.name}-${file.size}`}>{file.name}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="add_pdf_note">Kısa açıklama (isteğe bağlı)</Label>
                                        <Input id="add_pdf_note" value={uploadForm.document_description} onChange={(e) => handleUploadInputChange('document_description', e.target.value)} placeholder="İsteğe bağlı not" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRegistryDialogOpen(false)} disabled={isSavingRegistry || isUploading}>İptal</Button>
                        {editingRegistry || !uploadForm.vehicle_registry_id ? (
                            <Button onClick={handleSaveRegistry} disabled={isSavingRegistry}>
                                {isSavingRegistry ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
                            </Button>
                        ) : (
                            <Button onClick={handleUpload} disabled={isUploading}>
                                {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</> : <><Upload className="w-4 h-4 mr-2" />PDF Yükle</>}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => { if (!open) setDeleteConfirm({ open: false, type: null, target: null }); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteConfirm.type === 'registry' ? 'Araç Sicil Kaydını Sil' : 'Dosyayı Sil'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfirm.type === 'registry'
                                ? <>Bu araç sicil kaydı ve bağlı tüm dosyalar kalıcı olarak silinecektir. Bu işlem geri alınamaz.</>
                                : <><strong>{deleteConfirm.target?.document_name}</strong> dosyası kalıcı olarak silinecektir.</>}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default VehicleFileArchiveTab;
