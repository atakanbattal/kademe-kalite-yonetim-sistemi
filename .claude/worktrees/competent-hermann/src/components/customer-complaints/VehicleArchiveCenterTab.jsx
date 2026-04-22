import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    Download,
    Eye,
    File,
    FileText,
    Image,
    Loader2,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { normalizeTurkishForSearch, sanitizeFileName } from '@/lib/utils';
import {
    CHASSIS_BRAND_OPTIONS,
    VEHICLE_CATEGORY_OPTIONS,
    VEHICLE_FILE_TYPES,
    formatBooleanLabel,
    getChassisModelsForBrand,
    getCustomerDisplayName,
    getVehicleModelsForCategory,
    requiresChassisSelection,
} from '@/components/customer-complaints/afterSalesConfig';

const EMPTY_VEHICLE_FORM = {
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
    factory_inspection_notes: '',
    factory_findings: '',
    factory_fault_summary: '',
    quality_gate_notes: '',
    warranty_document_no: '',
    notes: '',
};

const EMPTY_DOCUMENT_FORM = {
    scope_type: 'vehicle',
    vehicle_registry_id: '',
    customer_id: '',
    vehicle_serial_number: '',
    vehicle_category: '',
    vehicle_model_code: '',
    chassis_brand: '',
    chassis_model: '',
    document_type: 'Araç Kimlik Dosyası',
    document_group: '',
    revision_no: '',
    document_description: '',
};

const getFileIcon = (type) => {
    const normalized = type?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(normalized)) return <Image className="w-4 h-4" />;
    if (normalized === 'pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
};

const VehicleArchiveCenterTab = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { customers } = useData();

    const [activeSubTab, setActiveSubTab] = useState('registry');
    const [vehicles, setVehicles] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
    const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
    const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM);
    const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT_FORM);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadArchive = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [{ data: vehicleData, error: vehicleError }, { data: documentData, error: documentError }] = await Promise.all([
                supabase
                    .from('after_sales_vehicle_registry')
                    .select('*, customer:customer_id(id, name, customer_name, customer_code)')
                    .order('delivery_date', { ascending: false }),
                supabase
                    .from('after_sales_vehicle_files')
                    .select(`
                        *,
                        customer:customer_id(id, name, customer_name, customer_code),
                        registry:vehicle_registry_id(id, vehicle_serial_number, vehicle_category, vehicle_model_code)
                    `)
                    .order('upload_date', { ascending: false }),
            ]);

            if (vehicleError) throw vehicleError;
            if (documentError) throw documentError;

            setVehicles(vehicleData || []);
            setDocuments(documentData || []);
        } catch (error) {
            console.error('Vehicle archive center load error:', error);
            if (['42P01', 'PGRST205'].includes(error.code)) {
                setLoadError('Araç ana arşivi tabloları henüz kurulmamış. Yeni migrasyon uygulandıktan sonra bu alan aktif olacaktır.');
            } else {
                setLoadError(error.message || 'Araç arşivi yüklenemedi.');
            }
            setVehicles([]);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadArchive();
    }, [loadArchive]);

    useEffect(() => {
        if (!requiresChassisSelection(vehicleForm.vehicle_category) && (vehicleForm.chassis_brand || vehicleForm.chassis_model)) {
            setVehicleForm((prev) => ({ ...prev, chassis_brand: '', chassis_model: '' }));
        }
    }, [vehicleForm.vehicle_category]);

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
            vehicles.map((vehicle) => ({
                value: vehicle.id,
                label: `${vehicle.vehicle_serial_number || '-'} - ${vehicle.vehicle_model_code || vehicle.vehicle_model_name || vehicle.vehicle_category}`,
            })),
        [vehicles]
    );

    const filteredVehicles = useMemo(() => {
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);
        return vehicles.filter((vehicle) => {
            if (!normalizedSearch) return true;
            return [
                vehicle.vehicle_serial_number,
                vehicle.vehicle_chassis_number,
                vehicle.vehicle_category,
                vehicle.vehicle_model_code,
                vehicle.chassis_brand,
                vehicle.chassis_model,
                vehicle.engine_model,
                getCustomerDisplayName(vehicle.customer),
                vehicle.factory_fault_summary,
                vehicle.factory_findings,
            ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearch));
        });
    }, [searchTerm, vehicles]);

    const filteredVehicleDocs = useMemo(
        () =>
            documents.filter((doc) => doc.scope_type !== 'model').filter((doc) => {
                const normalizedSearch = normalizeTurkishForSearch(searchTerm);
                if (!normalizedSearch) return true;
                return [
                    doc.document_name,
                    doc.document_type,
                    doc.vehicle_serial_number,
                    doc.vehicle_category,
                    doc.vehicle_model_code,
                    getCustomerDisplayName(doc.customer),
                ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearch));
            }),
        [documents, searchTerm]
    );

    const filteredModelDocs = useMemo(
        () =>
            documents.filter((doc) => doc.scope_type === 'model').filter((doc) => {
                const normalizedSearch = normalizeTurkishForSearch(searchTerm);
                if (!normalizedSearch) return true;
                return [
                    doc.document_name,
                    doc.document_type,
                    doc.vehicle_category,
                    doc.vehicle_model_code,
                    doc.chassis_brand,
                    doc.chassis_model,
                ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearch));
            }),
        [documents, searchTerm]
    );

    const handleVehicleInput = (field, value) => {
        setVehicleForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleDocumentInput = (field, value) => {
        setDocumentForm((prev) => ({ ...prev, [field]: value }));
    };

    const openVehicleDialog = () => {
        setVehicleForm(EMPTY_VEHICLE_FORM);
        setVehicleDialogOpen(true);
    };

    const openDocumentDialog = (scopeType) => {
        setDocumentForm({ ...EMPTY_DOCUMENT_FORM, scope_type: scopeType });
        setSelectedFiles([]);
        setDocumentDialogOpen(true);
    };

    const handleSaveVehicle = async () => {
        if (!vehicleForm.vehicle_category || !vehicleForm.vehicle_model_code) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Araç kategorisi ve model kodu zorunludur.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...vehicleForm,
                customer_id: vehicleForm.customer_id || null,
                vehicle_serial_number: vehicleForm.vehicle_serial_number || null,
                vehicle_chassis_number: vehicleForm.vehicle_chassis_number || null,
                chassis_brand: vehicleForm.chassis_brand || null,
                chassis_model: vehicleForm.chassis_model || null,
                engine_brand: vehicleForm.engine_brand || null,
                engine_model: vehicleForm.engine_model || null,
                engine_serial_number: vehicleForm.engine_serial_number || null,
                delivery_date: vehicleForm.delivery_date || null,
                production_date: vehicleForm.production_date || null,
                warranty_document_no: vehicleForm.warranty_document_no || null,
                created_by: user?.id || null,
            };

            const { error } = await supabase.from('after_sales_vehicle_registry').insert([payload]);
            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Araç ana kartı arşive eklendi.',
            });

            setVehicleDialogOpen(false);
            setVehicleForm(EMPTY_VEHICLE_FORM);
            loadArchive();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Kayıt Hatası',
                description: error.message || 'Araç kartı kaydedilemedi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUploadDocuments = async () => {
        if (selectedFiles.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Dosya Seçilmedi',
                description: 'Yüklemek için en az bir dosya seçin.',
            });
            return;
        }

        if (documentForm.scope_type === 'vehicle' && !documentForm.vehicle_registry_id && !documentForm.vehicle_serial_number) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Araç bazlı doküman için araç kartı veya seri numarası girin.',
            });
            return;
        }

        if (documentForm.scope_type === 'model' && (!documentForm.vehicle_category || !documentForm.vehicle_model_code)) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Model bazlı doküman için kategori ve model zorunludur.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const scopePrefix = documentForm.scope_type === 'model'
                ? sanitizeFileName(`${documentForm.vehicle_category}-${documentForm.vehicle_model_code}`)
                : sanitizeFileName(documentForm.vehicle_serial_number || 'vehicle');

            for (const file of selectedFiles) {
                const sanitizedFileName = sanitizeFileName(file.name);
                const filePath = `archive/${documentForm.scope_type}/${scopePrefix}/${Date.now()}-${sanitizedFileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('after_sales_files')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type || 'application/octet-stream',
                    });

                if (uploadError) throw uploadError;

                const { error: insertError } = await supabase
                    .from('after_sales_vehicle_files')
                    .insert({
                        scope_type: documentForm.scope_type,
                        vehicle_registry_id: documentForm.vehicle_registry_id || null,
                        customer_id: documentForm.customer_id || null,
                        vehicle_serial_number: documentForm.scope_type === 'vehicle' ? documentForm.vehicle_serial_number || null : null,
                        vehicle_category: documentForm.vehicle_category || null,
                        vehicle_model_code: documentForm.vehicle_model_code || null,
                        chassis_brand: documentForm.chassis_brand || null,
                        chassis_model: documentForm.chassis_model || null,
                        document_type: documentForm.document_type,
                        document_group: documentForm.document_group || null,
                        document_name: file.name,
                        document_description: documentForm.document_description || null,
                        file_path: filePath,
                        file_type: file.name.split('.').pop() || null,
                        file_size: file.size,
                        revision_no: documentForm.revision_no || null,
                        uploaded_by: user?.id || null,
                    });

                if (insertError) throw insertError;
            }

            toast({
                title: 'Başarılı',
                description: `${selectedFiles.length} doküman arşive yüklendi.`,
            });

            setDocumentDialogOpen(false);
            setDocumentForm(EMPTY_DOCUMENT_FORM);
            setSelectedFiles([]);
            loadArchive();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Yükleme Hatası',
                description: error.message || 'Dokümanlar yüklenemedi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDocument = async (doc, download = false) => {
        try {
            const { data, error } = await supabase.storage.from('after_sales_files').download(doc.file_path);
            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            if (download) {
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = doc.document_name;
                anchor.click();
            } else {
                window.open(url, '_blank');
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: download ? 'İndirme Hatası' : 'Görüntüleme Hatası',
                description: error.message || 'Dosya açılamadı.',
            });
        }
    };

    const deleteDocument = async (doc) => {
        try {
            await supabase.storage.from('after_sales_files').remove([doc.file_path]);
            const { error } = await supabase.from('after_sales_vehicle_files').delete().eq('id', doc.id);
            if (error) throw error;
            toast({ title: 'Silindi', description: 'Doküman arşivden kaldırıldı.' });
            loadArchive();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Silme Hatası',
                description: error.message || 'Doküman silinemedi.',
            });
        }
    };

    const renderDocumentList = (items, emptyText) => {
        if (items.length === 0) {
            return (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        {emptyText}
                    </CardContent>
                </Card>
            );
        }

        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {items.map((doc) => (
                    <Card key={doc.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline">{doc.document_type}</Badge>
                                        {doc.scope_type === 'model' && <Badge variant="secondary">Model Bazlı</Badge>}
                                        {doc.scope_type !== 'model' && <Badge variant="secondary">Araç Bazlı</Badge>}
                                    </div>
                                    <CardTitle className="text-base mt-2">{doc.document_name}</CardTitle>
                                    <CardDescription className="mt-1">
                                        {doc.scope_type === 'model'
                                            ? `${doc.vehicle_category || '-'} • ${doc.vehicle_model_code || '-'}`
                                            : `${doc.vehicle_serial_number || '-'} • ${getCustomerDisplayName(doc.customer)}`}
                                    </CardDescription>
                                </div>
                                <div className="rounded-lg bg-muted/60 p-2">
                                    {getFileIcon(doc.file_type)}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {doc.document_group && (
                                <div className="text-sm text-muted-foreground">
                                    Grup: {doc.document_group}
                                </div>
                            )}
                            {doc.revision_no && (
                                <div className="text-sm text-muted-foreground">
                                    Revizyon: {doc.revision_no}
                                </div>
                            )}
                            {doc.document_description && (
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {doc.document_description}
                                </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                                {new Date(doc.upload_date || doc.created_at).toLocaleString('tr-TR')}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => openDocument(doc, false)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Görüntüle
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openDocument(doc, true)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    İndir
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteDocument(doc)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Sil
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Araç Ana Arşivi</h3>
                    <p className="text-sm text-muted-foreground">
                        Sevk edilen tüm araçların kimlik kartı, fabrika bulguları, araç bazlı dosyaları ve model doküman kütüphanesi.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openDocumentDialog('model')}>
                        <Upload className="w-4 h-4 mr-2" />
                        Model Dokümanı
                    </Button>
                    <Button variant="outline" onClick={() => openDocumentDialog('vehicle')}>
                        <Upload className="w-4 h-4 mr-2" />
                        Araç Dokümanı
                    </Button>
                    <Button onClick={openVehicleDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Araç Kartı
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                        <Input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="pl-9"
                            placeholder="Seri no, şasi, model, müşteri, motor veya fabrika bulgusu ile ara..."
                        />
                    </div>
                </CardContent>
            </Card>

            {loadError && (
                <Card className="border-amber-200 bg-amber-50/60">
                    <CardContent className="pt-6 text-sm text-amber-900">{loadError}</CardContent>
                </Card>
            )}

            <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="registry">Araç Kartları</TabsTrigger>
                    <TabsTrigger value="vehicle-docs">Araç Dokümanları</TabsTrigger>
                    <TabsTrigger value="model-docs">Model Dokümanları</TabsTrigger>
                </TabsList>

                <TabsContent value="registry" className="mt-6">
                    {loading ? (
                        <Card>
                            <CardContent className="py-12 text-muted-foreground flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Araç kartları yükleniyor...
                            </CardContent>
                        </Card>
                    ) : filteredVehicles.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                Henüz araç ana kartı bulunmuyor.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredVehicles.map((vehicle) => (
                                <Card key={vehicle.id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline">{vehicle.vehicle_category}</Badge>
                                                    <Badge variant="secondary">{vehicle.vehicle_model_code}</Badge>
                                                </div>
                                                <CardTitle className="text-base mt-2">
                                                    {vehicle.vehicle_serial_number || '-'} • {vehicle.vehicle_model_name || vehicle.vehicle_model_code}
                                                </CardTitle>
                                                <CardDescription>
                                                    {getCustomerDisplayName(vehicle.customer)}
                                                </CardDescription>
                                            </div>
                                            {vehicle.warranty_document_no && (
                                                <Badge variant="outline">
                                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                                    Garanti
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-muted-foreground">Şasi</div>
                                                <div className="font-medium">{vehicle.vehicle_chassis_number || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Şase Sağlayıcısı</div>
                                                <div className="font-medium">{vehicle.chassis_brand || '-'} {vehicle.chassis_model ? `• ${vehicle.chassis_model}` : ''}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Motor</div>
                                                <div className="font-medium">{vehicle.engine_brand || '-'} {vehicle.engine_model ? `• ${vehicle.engine_model}` : ''}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Teslim Tarihi</div>
                                                <div className="font-medium">{vehicle.delivery_date || '-'}</div>
                                            </div>
                                        </div>

                                        {vehicle.factory_fault_summary && (
                                            <div className="rounded-lg border bg-muted/30 p-3">
                                                <div className="font-medium">Fabrikada Tespit Edilen Bulgular</div>
                                                <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                                    {vehicle.factory_fault_summary}
                                                </div>
                                            </div>
                                        )}

                                        {(vehicle.factory_findings || vehicle.factory_inspection_notes || vehicle.quality_gate_notes) && (
                                            <div className="space-y-2 text-sm">
                                                {vehicle.factory_findings && (
                                                    <div>
                                                        <div className="text-muted-foreground">Fabrika Bulguları</div>
                                                        <div className="whitespace-pre-wrap">{vehicle.factory_findings}</div>
                                                    </div>
                                                )}
                                                {vehicle.factory_inspection_notes && (
                                                    <div>
                                                        <div className="text-muted-foreground">Kontrol Notları</div>
                                                        <div className="whitespace-pre-wrap">{vehicle.factory_inspection_notes}</div>
                                                    </div>
                                                )}
                                                {vehicle.quality_gate_notes && (
                                                    <div>
                                                        <div className="text-muted-foreground">Kalite Kapısı Notları</div>
                                                        <div className="whitespace-pre-wrap">{vehicle.quality_gate_notes}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="vehicle-docs" className="mt-6">
                    {renderDocumentList(filteredVehicleDocs, 'Henüz araç bazlı doküman yüklenmemiş.')}
                </TabsContent>

                <TabsContent value="model-docs" className="mt-6">
                    {renderDocumentList(filteredModelDocs, 'Henüz model bazlı doküman yüklenmemiş.')}
                </TabsContent>
            </Tabs>

            <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
                <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Yeni Araç Ana Kartı</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Müşteri</Label>
                            <SearchableSelectDialog
                                options={customerOptions}
                                value={vehicleForm.customer_id}
                                onChange={(value) => handleVehicleInput('customer_id', value)}
                                triggerPlaceholder="Müşteri seçin..."
                                dialogTitle="Müşteri Seç"
                                searchPlaceholder="Müşteri ara..."
                                notFoundText="Müşteri bulunamadı."
                                allowClear
                            />
                        </div>
                        <div>
                            <Label>Araç Kategorisi</Label>
                            <Select value={vehicleForm.vehicle_category || 'none'} onValueChange={(value) => handleVehicleInput('vehicle_category', value === 'none' ? '' : value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Araç kategorisi seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                    {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Model Kodu</Label>
                            <Select value={vehicleForm.vehicle_model_code || 'none'} onValueChange={(value) => handleVehicleInput('vehicle_model_code', value === 'none' ? '' : value)} disabled={!vehicleForm.vehicle_category}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Önce kategori seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                    {getVehicleModelsForCategory(vehicleForm.vehicle_category).map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="vehicle_model_name">Model Açıklaması</Label>
                            <Input id="vehicle_model_name" value={vehicleForm.vehicle_model_name} onChange={(event) => handleVehicleInput('vehicle_model_name', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="vehicle_serial_number">Seri No</Label>
                            <Input id="vehicle_serial_number" value={vehicleForm.vehicle_serial_number} onChange={(event) => handleVehicleInput('vehicle_serial_number', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="vehicle_chassis_number">Şasi No</Label>
                            <Input id="vehicle_chassis_number" value={vehicleForm.vehicle_chassis_number} onChange={(event) => handleVehicleInput('vehicle_chassis_number', event.target.value)} />
                        </div>
                        {requiresChassisSelection(vehicleForm.vehicle_category) && (
                            <>
                                <div>
                                    <Label>Şase Sağlayıcısı</Label>
                                    <Select value={vehicleForm.chassis_brand || 'none'} onValueChange={(value) => handleVehicleInput('chassis_brand', value === 'none' ? '' : value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Şase markası seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belirtilmedi</SelectItem>
                                            {CHASSIS_BRAND_OPTIONS.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Şase Modeli</Label>
                                    <Select value={vehicleForm.chassis_model || 'none'} onValueChange={(value) => handleVehicleInput('chassis_model', value === 'none' ? '' : value)} disabled={!vehicleForm.chassis_brand}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Önce şase markası seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belirtilmedi</SelectItem>
                                            {getChassisModelsForBrand(vehicleForm.chassis_brand).map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                        <div>
                            <Label htmlFor="engine_brand">Motor Markası</Label>
                            <Input id="engine_brand" value={vehicleForm.engine_brand} onChange={(event) => handleVehicleInput('engine_brand', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="engine_model">Motor Modeli</Label>
                            <Input id="engine_model" value={vehicleForm.engine_model} onChange={(event) => handleVehicleInput('engine_model', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="engine_serial_number">Motor Seri No</Label>
                            <Input id="engine_serial_number" value={vehicleForm.engine_serial_number} onChange={(event) => handleVehicleInput('engine_serial_number', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="delivery_date">Teslim Tarihi</Label>
                            <Input id="delivery_date" type="date" value={vehicleForm.delivery_date} onChange={(event) => handleVehicleInput('delivery_date', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="production_date">Üretim Tarihi</Label>
                            <Input id="production_date" type="date" value={vehicleForm.production_date} onChange={(event) => handleVehicleInput('production_date', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="warranty_document_no">Garanti Belge No</Label>
                            <Input id="warranty_document_no" value={vehicleForm.warranty_document_no} onChange={(event) => handleVehicleInput('warranty_document_no', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="factory_fault_summary">Fabrikada Tespit Edilen Hatalar</Label>
                            <Textarea id="factory_fault_summary" rows={3} value={vehicleForm.factory_fault_summary} onChange={(event) => handleVehicleInput('factory_fault_summary', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="factory_findings">Fabrika Bulguları</Label>
                            <Textarea id="factory_findings" rows={3} value={vehicleForm.factory_findings} onChange={(event) => handleVehicleInput('factory_findings', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="factory_inspection_notes">Kontrol ve Kimlik Notları</Label>
                            <Textarea id="factory_inspection_notes" rows={3} value={vehicleForm.factory_inspection_notes} onChange={(event) => handleVehicleInput('factory_inspection_notes', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="quality_gate_notes">Kalite Kapısı Notları</Label>
                            <Textarea id="quality_gate_notes" rows={3} value={vehicleForm.quality_gate_notes} onChange={(event) => handleVehicleInput('quality_gate_notes', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="notes">Ek Notlar</Label>
                            <Textarea id="notes" rows={3} value={vehicleForm.notes} onChange={(event) => handleVehicleInput('notes', event.target.value)} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVehicleDialogOpen(false)} disabled={isSubmitting}>
                            İptal
                        </Button>
                        <Button onClick={handleSaveVehicle} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Kaydediliyor...
                                </>
                            ) : (
                                'Kaydet'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {documentForm.scope_type === 'model' ? 'Model Dokümanı Yükle' : 'Araç Dokümanı Yükle'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documentForm.scope_type === 'vehicle' ? (
                            <>
                                <div>
                                    <Label>Araç Kartı</Label>
                                    <SearchableSelectDialog
                                        options={registryOptions}
                                        value={documentForm.vehicle_registry_id}
                                        onChange={(value) => {
                                            const registry = vehicles.find((item) => item.id === value);
                                            setDocumentForm((prev) => ({
                                                ...prev,
                                                vehicle_registry_id: value,
                                                customer_id: registry?.customer_id || '',
                                                vehicle_serial_number: registry?.vehicle_serial_number || '',
                                                vehicle_category: registry?.vehicle_category || '',
                                                vehicle_model_code: registry?.vehicle_model_code || '',
                                                chassis_brand: registry?.chassis_brand || '',
                                                chassis_model: registry?.chassis_model || '',
                                            }));
                                        }}
                                        triggerPlaceholder="Araç kartı seçin..."
                                        dialogTitle="Araç Kartı Seç"
                                        searchPlaceholder="Araç ara..."
                                        notFoundText="Araç bulunamadı."
                                        allowClear
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="vehicle_serial_number_doc">Seri No</Label>
                                    <Input id="vehicle_serial_number_doc" value={documentForm.vehicle_serial_number} onChange={(event) => handleDocumentInput('vehicle_serial_number', event.target.value)} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <Label>Araç Kategorisi</Label>
                                    <Select value={documentForm.vehicle_category || 'none'} onValueChange={(value) => handleDocumentInput('vehicle_category', value === 'none' ? '' : value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Kategori seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belirtilmedi</SelectItem>
                                            {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Model Kodu</Label>
                                    <Select value={documentForm.vehicle_model_code || 'none'} onValueChange={(value) => handleDocumentInput('vehicle_model_code', value === 'none' ? '' : value)} disabled={!documentForm.vehicle_category}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Önce kategori seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belirtilmedi</SelectItem>
                                            {getVehicleModelsForCategory(documentForm.vehicle_category).map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {requiresChassisSelection(documentForm.vehicle_category) && (
                                    <>
                                        <div>
                                            <Label>Şase Sağlayıcısı</Label>
                                            <Select value={documentForm.chassis_brand || 'none'} onValueChange={(value) => handleDocumentInput('chassis_brand', value === 'none' ? '' : value)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Şase markası seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                                    {CHASSIS_BRAND_OPTIONS.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Şase Modeli</Label>
                                            <Select value={documentForm.chassis_model || 'none'} onValueChange={(value) => handleDocumentInput('chassis_model', value === 'none' ? '' : value)} disabled={!documentForm.chassis_brand}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Önce şase markası seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                                    {getChassisModelsForBrand(documentForm.chassis_brand).map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        <div>
                            <Label>Doküman Tipi</Label>
                            <Select value={documentForm.document_type} onValueChange={(value) => handleDocumentInput('document_type', value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {VEHICLE_FILE_TYPES.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="document_group">Doküman Grubu</Label>
                            <Input id="document_group" value={documentForm.document_group} onChange={(event) => handleDocumentInput('document_group', event.target.value)} placeholder="Garanti, katalog, kontrol formu..." />
                        </div>
                        <div>
                            <Label htmlFor="revision_no_doc">Revizyon No</Label>
                            <Input id="revision_no_doc" value={documentForm.revision_no} onChange={(event) => handleDocumentInput('revision_no', event.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="document_description_doc">Açıklama</Label>
                            <Input id="document_description_doc" value={documentForm.document_description} onChange={(event) => handleDocumentInput('document_description', event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="archive_files">Dosyalar</Label>
                            <Input id="archive_files" type="file" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDocumentDialogOpen(false)} disabled={isSubmitting}>
                            İptal
                        </Button>
                        <Button onClick={handleUploadDocuments} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Yükleniyor...
                                </>
                            ) : (
                                'Yükle'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VehicleArchiveCenterTab;
