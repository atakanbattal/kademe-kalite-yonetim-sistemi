import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    CarFront,
    Download,
    Eye,
    File,
    FileText,
    FolderKanban,
    Image,
    Loader2,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    Upload,
    Wrench,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { normalizeTurkishForSearch, sanitizeFileName } from '@/lib/utils';
import {
    CHASSIS_BRAND_OPTIONS,
    DOCUMENT_GROUP_OPTIONS,
    VEHICLE_CATEGORY_OPTIONS,
    VEHICLE_FILE_TYPES,
    getAfterSalesCaseNumber,
    getChassisModelsForBrand,
    getCustomerDisplayName,
    getVehicleModelsForCategory,
    requiresChassisSelection,
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
    warranty_document_no: '',
    notes: '',
};

const EMPTY_REGISTRY_FILE_META = {
    document_type: 'Logbook',
    document_group: 'Logbook ve Saha Defteri',
    document_description: '',
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
    const [registryFileMeta, setRegistryFileMeta] = useState(EMPTY_REGISTRY_FILE_META);

    const [isUploadOpen, setUploadOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD_FORM);
    const [isUploading, setIsUploading] = useState(false);

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
                setFilesError(error.code === '42703' ? 'Model dokümanı ve araç sicili bağlantıları için ikinci migrasyon bekleniyor. Mevcut araç dosyaları yine de görüntülenebilir.' : null);
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

    const caseOptions = useMemo(
        () =>
            (customerComplaints || []).map((record) => ({
                value: record.id,
                label: `${getAfterSalesCaseNumber(record)} - ${truncateLabel(record.title || '-', 72)}`,
            })),
        [customerComplaints]
    );

    const registryOptions = useMemo(
        () =>
            registryRecords.map((record) => ({
                value: record.id,
                label: `${record.vehicle_serial_number || '-'} • ${record.vehicle_model_code || record.vehicle_model_name || '-'} • ${getCustomerDisplayName(record.customer)}`,
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
                record.vehicle_category,
                record.vehicle_model_code,
                record.vehicle_model_name,
                record.chassis_brand,
                record.chassis_model,
                record.engine_brand,
                record.engine_model,
                record.engine_serial_number,
                record.notes,
                getCustomerDisplayName(record.customer),
            ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearch));
        });
    }, [registryRecords, searchTerm, customerFilter, categoryFilter]);

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

    const modelDocuments = useMemo(
        () => filteredFiles.filter((record) => record.scope_type === 'model'),
        [filteredFiles]
    );

    const stats = useMemo(() => ({
        totalVehicles: registryRecords.length,
        linkedVehicleDocs: files.filter((record) => (record.scope_type || 'vehicle') !== 'model' && record.vehicle_registry_id).length,
        totalVehicleDocs: files.filter((record) => (record.scope_type || 'vehicle') !== 'model').length,
        totalModelDocs: files.filter((record) => record.scope_type === 'model').length,
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

    const openNewRegistryDialog = () => {
        setEditingRegistry(null);
        setRegistryForm(EMPTY_REGISTRY_FORM);
        setRegistrySelectedFiles([]);
        setRegistryFileMeta(EMPTY_REGISTRY_FILE_META);
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
            warranty_document_no: record.warranty_document_no || '',
            notes: record.notes || '',
        });
        setRegistrySelectedFiles([]);
        setRegistryFileMeta(EMPTY_REGISTRY_FILE_META);
        setRegistryDialogOpen(true);
    };

    const openUploadDialog = (scopeType = 'vehicle', registryRecord = null) => {
        if (registryRecord) {
            setUploadForm({
                ...EMPTY_UPLOAD_FORM,
                scope_type: scopeType,
                customer_id: registryRecord.customer_id || '',
                vehicle_registry_id: registryRecord.id || '',
                vehicle_serial_number: registryRecord.vehicle_serial_number || '',
                vehicle_chassis_number: registryRecord.vehicle_chassis_number || '',
                vehicle_model: registryRecord.vehicle_model_name || registryRecord.vehicle_model_code || '',
                vehicle_category: registryRecord.vehicle_category || '',
                vehicle_model_code: registryRecord.vehicle_model_code || '',
                chassis_brand: registryRecord.chassis_brand || '',
                chassis_model: registryRecord.chassis_model || '',
                delivery_date: registryRecord.delivery_date || '',
                document_type: scopeType === 'model' ? 'Kullanıcı Kitapçığı' : 'Araç Kimlik Dosyası',
                document_group: scopeType === 'model' ? 'Kullanıcı Kitapçıkları ve Kataloglar' : 'Araç Kimlik Kartı',
            });
        } else {
            setUploadForm({
                ...EMPTY_UPLOAD_FORM,
                scope_type: scopeType,
                document_type: scopeType === 'model' ? 'Kullanıcı Kitapçığı' : 'Araç Kimlik Dosyası',
                document_group: scopeType === 'model' ? 'Kullanıcı Kitapçıkları ve Kataloglar' : 'Araç Kimlik Kartı',
            });
        }

        setSelectedFiles([]);
        setUploadOpen(true);
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
                vehicle_model_name: registryForm.vehicle_model_name?.trim() || null,
                chassis_brand: registryForm.chassis_brand || null,
                chassis_model: registryForm.chassis_model || null,
                engine_brand: registryForm.engine_brand?.trim() || null,
                engine_model: registryForm.engine_model?.trim() || null,
                engine_serial_number: registryForm.engine_serial_number?.trim() || null,
                delivery_date: registryForm.delivery_date || null,
                production_date: registryForm.production_date || null,
                warranty_document_no: registryForm.warranty_document_no?.trim() || null,
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
                        vehicle_plate_number: null,
                        vehicle_model: savedRegistry.vehicle_model_name || savedRegistry.vehicle_model_code || null,
                        delivery_date: savedRegistry.delivery_date || null,
                        vehicle_category: savedRegistry.vehicle_category || null,
                        vehicle_model_code: savedRegistry.vehicle_model_code || null,
                        chassis_brand: savedRegistry.chassis_brand || null,
                        chassis_model: savedRegistry.chassis_model || null,
                        document_type: registryFileMeta.document_type,
                        document_group: registryFileMeta.document_group,
                        document_description: registryFileMeta.document_description?.trim() || null,
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
            setRegistryFileMeta(EMPTY_REGISTRY_FILE_META);
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
    }, [editingRegistry, loadAll, registryFileMeta, registryForm, registrySelectedFiles, toast, uploadArchiveFiles, user?.id]);

    const handleUpload = async () => {
        if (uploadForm.scope_type === 'vehicle' && !uploadForm.vehicle_serial_number?.trim() && !uploadForm.vehicle_registry_id) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Araç dosyası için seri numarası veya araç sicil kaydı gereklidir.',
            });
            return;
        }

        if (uploadForm.scope_type === 'model' && (!uploadForm.vehicle_category || !uploadForm.vehicle_model_code)) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Model bazlı dokümanlar için araç kategorisi ve model kodu zorunludur.',
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
                revision_no: uploadForm.revision_no?.trim() || null,
                document_description: uploadForm.document_description?.trim() || null,
            };

            const scopePath = uploadForm.scope_type === 'model'
                ? `models/${sanitizeFileName(uploadForm.vehicle_category || 'genel')}/${sanitizeFileName(uploadForm.vehicle_model_code || 'model')}`
                : `vehicles/${sanitizeFileName(uploadForm.vehicle_serial_number || uploadForm.vehicle_registry_id || 'genel')}`;

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
            setUploadOpen(false);
            loadFiles();
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
                        Fabrikadan sevk edilen tüm araçların kimlik kartlarını, logbook taramalarını, garanti evraklarını ve model bazlı kullanıcı dokümanlarını tek merkezde yönetin.
                    </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                    <Button variant="outline" className="h-11 px-5" onClick={() => openUploadDialog('model')}>
                        <FolderKanban className="w-4 h-4 mr-2" />
                        Model Dokümanı Yükle
                    </Button>
                    <Button className="h-11 px-5" onClick={openNewRegistryDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Araç Sicili ve Dosya Ekle
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Sevk Edilen Araç</div><div className="text-3xl font-bold mt-2">{stats.totalVehicles}</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Sicile Bağlı Dosya</div><div className="text-3xl font-bold mt-2 text-amber-600">{stats.linkedVehicleDocs}</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Araç Dosyaları</div><div className="text-3xl font-bold mt-2 text-blue-600">{stats.totalVehicleDocs}</div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Model Dokümanları</div><div className="text-3xl font-bold mt-2 text-emerald-600">{stats.totalModelDocs}</div></CardContent></Card>
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
                    <TabsTrigger value="registry">
                        <CarFront className="w-4 h-4 mr-2" />
                        Araç Sicili
                    </TabsTrigger>
                    <TabsTrigger value="vehicle-files">
                        <Archive className="w-4 h-4 mr-2" />
                        Araç Dosyaları
                    </TabsTrigger>
                    <TabsTrigger value="model-docs">
                        <FolderKanban className="w-4 h-4 mr-2" />
                        Model Dokümanları
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="registry" className="space-y-4 mt-6">
                    {filteredRegistryRecords.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                {registryRecords.length === 0 ? 'Henüz araç sicil kaydı oluşturulmamış.' : 'Filtreye uyan araç sicil kaydı bulunamadı.'}
                            </CardContent>
                        </Card>
                    ) : (
                        filteredRegistryRecords.map((record) => {
                            const relatedComplaintCount = customerComplaints.filter((complaint) =>
                                (record.vehicle_serial_number && complaint.vehicle_serial_number === record.vehicle_serial_number) ||
                                (record.vehicle_chassis_number && complaint.vehicle_chassis_number === record.vehicle_chassis_number)
                            ).length;
                            const relatedDocumentCount = files.filter((file) =>
                                file.vehicle_registry_id === record.id ||
                                (record.vehicle_serial_number && file.vehicle_serial_number === record.vehicle_serial_number)
                            ).length;

                            return (
                                <Card key={record.id} className="border-muted/70">
                                    <CardHeader>
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline">{record.vehicle_category}</Badge>
                                                    <Badge variant="secondary">{record.vehicle_model_code}</Badge>
                                                    {record.chassis_brand && <Badge variant="outline">{record.chassis_brand}</Badge>}
                                                </div>
                                                <CardTitle>{record.vehicle_model_name || record.vehicle_model_code}</CardTitle>
                                                <CardDescription>
                                                    {getCustomerDisplayName(record.customer)}{record.customer?.customer_code ? ` • ${record.customer.customer_code}` : ''}
                                                </CardDescription>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" onClick={() => openEditRegistryDialog(record)}>
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Sicili ve Dosyaları Yönet
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                                            <div className="rounded-lg border p-3"><div className="text-muted-foreground">Seri No</div><div className="font-medium mt-1">{record.vehicle_serial_number || '-'}</div></div>
                                            <div className="rounded-lg border p-3"><div className="text-muted-foreground">Şasi No</div><div className="font-medium mt-1">{record.vehicle_chassis_number || '-'}</div></div>
                                            <div className="rounded-lg border p-3"><div className="text-muted-foreground">Şase Sağlayıcısı</div><div className="font-medium mt-1">{record.chassis_brand || '-'}{record.chassis_model ? ` • ${record.chassis_model}` : ''}</div></div>
                                            <div className="rounded-lg border p-3"><div className="text-muted-foreground">Motor</div><div className="font-medium mt-1">{record.engine_brand || '-'}{record.engine_model ? ` • ${record.engine_model}` : ''}</div></div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                                            <div className="rounded-lg bg-muted/40 p-3"><div className="text-muted-foreground">Motor Seri No</div><div className="font-medium mt-1">{record.engine_serial_number || '-'}</div></div>
                                            <div className="rounded-lg bg-muted/40 p-3"><div className="text-muted-foreground">Teslim Tarihi</div><div className="font-medium mt-1">{formatDate(record.delivery_date)}</div></div>
                                            <div className="rounded-lg bg-muted/40 p-3"><div className="text-muted-foreground">Üretim Tarihi</div><div className="font-medium mt-1">{formatDate(record.production_date)}</div></div>
                                            <div className="rounded-lg bg-muted/40 p-3"><div className="text-muted-foreground">Bağlı Vaka</div><div className="font-medium mt-1">{relatedComplaintCount}</div></div>
                                        </div>

                                        {(record.warranty_document_no || record.notes) && (
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                {record.warranty_document_no && <div>Garanti Belge No: {record.warranty_document_no}</div>}
                                                {record.notes && <div className="mt-1 whitespace-pre-wrap">{record.notes}</div>}
                                            </div>
                                        )}

                                        <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                            Bu araç için arşivde <span className="font-semibold text-foreground">{relatedDocumentCount}</span> dosya bulunuyor. Logbook, araç kimlik kartı ve servis dokümanlarını doğrudan bu sicile bağlayabilirsin.
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </TabsContent>

                <TabsContent value="vehicle-files" className="space-y-4 mt-6">
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
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(record)}><Trash2 className="w-4 h-4 mr-2" />Sil</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="model-docs" className="space-y-4 mt-6">
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

                                <Button className="justify-self-start md:justify-self-end" onClick={() => openUploadDialog('model')}>
                                    <FolderKanban className="w-4 h-4 mr-2" />
                                    Model Dokümanı Yükle
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {modelDocuments.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-muted-foreground">{files.filter((record) => record.scope_type === 'model').length === 0 ? 'Henüz model bazlı doküman eklenmemiş.' : 'Filtreye uyan model dokümanı bulunamadı.'}</CardContent></Card>
                    ) : (
                        <div className="space-y-4">
                            {modelDocuments.map((record) => (
                                <Card key={record.id}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline">{record.vehicle_category || '-'}</Badge>
                                                    <Badge variant="secondary">{record.vehicle_model_code || '-'}</Badge>
                                                    {record.document_group && <Badge variant="outline">{record.document_group}</Badge>}
                                                </div>
                                                <CardTitle className="text-base mt-2">{record.document_name}</CardTitle>
                                                <CardDescription>
                                                    {record.document_type}
                                                    {record.chassis_brand ? ` • ${record.chassis_brand}` : ''}
                                                    {record.chassis_model ? ` / ${record.chassis_model}` : ''}
                                                </CardDescription>
                                            </div>
                                            <div className="p-2 rounded-lg bg-muted/60">
                                                {getFileIcon(record.file_type)}
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {record.document_description && (
                                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{record.document_description}</div>
                                        )}

                                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                            <span>{new Date(record.upload_date || record.created_at).toLocaleString('tr-TR')}</span>
                                            {record.revision_no && <span>Revizyon: {record.revision_no}</span>}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" onClick={() => openFile(record, false)}><Eye className="w-4 h-4 mr-2" />Görüntüle</Button>
                                            <Button size="sm" variant="outline" onClick={() => openFile(record, true)}><Download className="w-4 h-4 mr-2" />İndir</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(record)}><Trash2 className="w-4 h-4 mr-2" />Sil</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isRegistryDialogOpen} onOpenChange={setRegistryDialogOpen}>
                <DialogContent className="sm:max-w-6xl w-[96vw] max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRegistry ? 'Araç Sicili ve Dosyalarını Yönet' : 'Yeni Araç Sicili ve Dosya Oluştur'}</DialogTitle>
                    </DialogHeader>

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
                            <div><Label htmlFor="warranty_document_no">Garanti Belge No</Label><Input id="warranty_document_no" value={registryForm.warranty_document_no} onChange={(event) => handleRegistryInputChange('warranty_document_no', event.target.value)} /></div>

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
                        </div>

                        <div>
                            <Label htmlFor="notes">Ek Notlar</Label>
                            <Textarea id="notes" rows={4} value={registryForm.notes} onChange={(event) => handleRegistryInputChange('notes', event.target.value)} placeholder="Araç kimlik kartına eklemek istediğiniz diğer bilgiler..." />
                        </div>

                        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-4">
                            <div>
                                <div className="font-medium">Yeni Sicille Birlikte Dosya Ekle</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    Logbook, araç kimlik dosyası veya garanti belgesini araç sicili kaydolurken aynı anda yükleyebilirsin.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                <div>
                                    <Label>Doküman Tipi</Label>
                                    <Select value={registryFileMeta.document_type} onValueChange={(value) => setRegistryFileMeta((prev) => ({ ...prev, document_type: value }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {VEHICLE_FILE_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Doküman Grubu</Label>
                                    <Select value={registryFileMeta.document_group} onValueChange={(value) => setRegistryFileMeta((prev) => ({ ...prev, document_group: value }))}>
                                        <SelectTrigger className="h-auto min-h-11"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {DOCUMENT_GROUP_OPTIONS.map((group) => (
                                                <SelectItem key={group} value={group}>{group}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="registry_files">Dosyalar</Label>
                                    <Input id="registry_files" type="file" multiple onChange={(event) => setRegistrySelectedFiles(Array.from(event.target.files || []))} />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="registry_document_description">Dosya Açıklaması</Label>
                                <Textarea id="registry_document_description" rows={3} value={registryFileMeta.document_description} onChange={(event) => setRegistryFileMeta((prev) => ({ ...prev, document_description: event.target.value }))} placeholder="Örn. sevk logbook taraması, araç kimlik kartı, garanti teslim belgesi..." />
                            </div>

                            {registrySelectedFiles.length > 0 && (
                                <div className="space-y-1 text-sm text-muted-foreground">
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRegistryDialogOpen(false)} disabled={isSavingRegistry}>İptal</Button>
                        <Button onClick={handleSaveRegistry} disabled={isSavingRegistry}>
                            {isSavingRegistry ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Kaydediliyor...</> : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isUploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="sm:max-w-6xl w-[96vw] max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{uploadForm.scope_type === 'model' ? 'Model Dokümanı Yükle' : 'Araç Dosyası Yükle'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div>
                                <Label>Doküman Kapsamı</Label>
                                <Select value={uploadForm.scope_type} onValueChange={(value) => handleUploadInputChange('scope_type', value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vehicle">Araç Dosyası</SelectItem>
                                        <SelectItem value="model">Model Bazlı Doküman</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Doküman Tipi</Label>
                                <Select value={uploadForm.document_type} onValueChange={(value) => handleUploadInputChange('document_type', value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {VEHICLE_FILE_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Doküman Grubu</Label>
                                <Select value={uploadForm.document_group} onValueChange={(value) => handleUploadInputChange('document_group', value)}>
                                    <SelectTrigger className="h-auto min-h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_GROUP_OPTIONS.map((group) => (
                                            <SelectItem key={group} value={group}>{group}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="revision_no">Revizyon No</Label>
                                <Input id="revision_no" value={uploadForm.revision_no} onChange={(event) => handleUploadInputChange('revision_no', event.target.value)} />
                            </div>

                            {uploadForm.scope_type === 'vehicle' ? (
                                <>
                                    <div className="xl:col-span-2">
                                        <Label>Araç Sicil Kaydı</Label>
                                        <SearchableSelectDialog
                                            options={registryOptions}
                                            value={uploadForm.vehicle_registry_id}
                                            onChange={(value) => handleUploadInputChange('vehicle_registry_id', value)}
                                            triggerPlaceholder="Araç sicil kaydı seçin..."
                                            dialogTitle="Araç Sicili Seç"
                                            searchPlaceholder="Seri no veya model ile ara..."
                                            notFoundText="Araç bulunamadı."
                                            allowClear
                                        />
                                    </div>
                                    <div>
                                        <Label>Müşteri</Label>
                                        <SearchableSelectDialog
                                            options={customerOptions}
                                            value={uploadForm.customer_id}
                                            onChange={(value) => handleUploadInputChange('customer_id', value)}
                                            triggerPlaceholder="Müşteri seçin..."
                                            dialogTitle="Müşteri Seç"
                                            searchPlaceholder="Müşteri ara..."
                                            notFoundText="Müşteri bulunamadı."
                                            allowClear
                                        />
                                    </div>
                                    <div className="xl:col-span-3">
                                        <Label>İlişkili Vaka</Label>
                                        <SearchableSelectDialog
                                            options={caseOptions}
                                            value={uploadForm.related_complaint_id}
                                            onChange={(value) => handleUploadInputChange('related_complaint_id', value)}
                                            triggerPlaceholder="Vaka seçin..."
                                            dialogTitle="Vaka Seç"
                                            searchPlaceholder="Vaka ara..."
                                            notFoundText="Vaka bulunamadı."
                                            allowClear
                                        />
                                    </div>

                                    <div><Label htmlFor="vehicle_serial_number">Seri No *</Label><Input id="vehicle_serial_number" value={uploadForm.vehicle_serial_number} onChange={(event) => handleUploadInputChange('vehicle_serial_number', event.target.value)} /></div>
                                    <div><Label htmlFor="vehicle_chassis_number">Şasi No</Label><Input id="vehicle_chassis_number" value={uploadForm.vehicle_chassis_number} onChange={(event) => handleUploadInputChange('vehicle_chassis_number', event.target.value)} /></div>
                                    <div><Label htmlFor="vehicle_model">Araç / Model</Label><Input id="vehicle_model" value={uploadForm.vehicle_model} onChange={(event) => handleUploadInputChange('vehicle_model', event.target.value)} /></div>
                                    <div><Label htmlFor="vehicle_plate_number">Plaka</Label><Input id="vehicle_plate_number" value={uploadForm.vehicle_plate_number} onChange={(event) => handleUploadInputChange('vehicle_plate_number', event.target.value)} /></div>
                                    <div><Label htmlFor="delivery_date">Teslim Tarihi</Label><Input id="delivery_date" type="date" value={uploadForm.delivery_date} onChange={(event) => handleUploadInputChange('delivery_date', event.target.value)} /></div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <Label>Araç Kategorisi</Label>
                                        <Select value={uploadForm.vehicle_category || 'none'} onValueChange={(value) => handleUploadInputChange('vehicle_category', value === 'none' ? '' : value)}>
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
                                        <Select value={uploadForm.vehicle_model_code || 'none'} onValueChange={(value) => handleUploadInputChange('vehicle_model_code', value === 'none' ? '' : value)} disabled={!uploadForm.vehicle_category}>
                                            <SelectTrigger><SelectValue placeholder="Önce kategori seçin" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Belirtilmedi</SelectItem>
                                                {getVehicleModelsForCategory(uploadForm.vehicle_category).map((option) => (
                                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {requiresChassisSelection(uploadForm.vehicle_category) && (
                                        <>
                                            <div>
                                                <Label>Şase Sağlayıcısı</Label>
                                                <Select value={uploadForm.chassis_brand || 'none'} onValueChange={(value) => handleUploadInputChange('chassis_brand', value === 'none' ? '' : value)}>
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
                                                <Select value={uploadForm.chassis_model || 'none'} onValueChange={(value) => handleUploadInputChange('chassis_model', value === 'none' ? '' : value)} disabled={!uploadForm.chassis_brand}>
                                                    <SelectTrigger><SelectValue placeholder="Önce şase markası seçin" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Belirtilmedi</SelectItem>
                                                        {getChassisModelsForBrand(uploadForm.chassis_brand).map((option) => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="document_description">Açıklama</Label>
                            <Textarea id="document_description" rows={4} value={uploadForm.document_description} onChange={(event) => handleUploadInputChange('document_description', event.target.value)} placeholder="Doküman içeriği, kapsamı ve kullanım amacı..." />
                        </div>

                        <div>
                            <Label htmlFor="vehicle_files">Dosyalar</Label>
                            <Input id="vehicle_files" type="file" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
                            {selectedFiles.length > 0 && (
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                    {selectedFiles.map((file) => (
                                        <div key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                                            <Wrench className="w-4 h-4" />
                                            <span>{file.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>İptal</Button>
                        <Button onClick={handleUpload} disabled={isUploading}>
                            {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Yükleniyor...</> : <><Upload className="w-4 h-4 mr-2" />Arşive Ekle</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VehicleFileArchiveTab;
