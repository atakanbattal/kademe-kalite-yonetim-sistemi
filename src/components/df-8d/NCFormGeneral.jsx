import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UploadCloud, File as FileIcon, X as XIcon, AlertCircle, Briefcase, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/lib/customSupabaseClient';
import { useNCForm, ncOrganizationalUnitFromPersonnel } from '@/hooks/useNCForm';
import { useData } from '@/contexts/DataContext';
import Df8dImageLightbox from '@/components/df-8d/Df8dImageLightbox';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import { Loader2 } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { normalizeNcAttachmentPath, normalizeNcAttachmentPathsList, fetchNcAttachmentAsBlob, prepareNcAttachmentPreviewBlob } from '@/lib/df8dAttachmentUtils';

const AttachmentItem = ({ path, onRemove, onPreview }) => {
    const [displayUrl, setDisplayUrl] = React.useState(null);
    const [pdfViewerState, setPdfViewerState] = React.useState({ isOpen: false, url: null, title: null });
    const [isLoading, setIsLoading] = React.useState(true);
    const [pdfOpening, setPdfOpening] = React.useState(false);
    const [blobLooksImage, setBlobLooksImage] = React.useState(false);
    const [noInlineImgPreview, setNoInlineImgPreview] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);
    const blobPreviewRef = React.useRef(null);

    React.useEffect(() => {
        let cancelled = false;
        const revokeBlob = () => {
            if (blobPreviewRef.current) {
                URL.revokeObjectURL(blobPreviewRef.current);
                blobPreviewRef.current = null;
            }
        };

        const loadPreview = async () => {
            revokeBlob();
            setDisplayUrl(null);
            setIsLoading(true);
            setBlobLooksImage(false);
            setNoInlineImgPreview(false);
            setImageError(false);
            const storagePath = normalizeNcAttachmentPath(path) || '';
            if (!storagePath) {
                if (!cancelled) setIsLoading(false);
                return;
            }
            try {
                const { blob, error } = await fetchNcAttachmentAsBlob(supabase, path);
                if (cancelled) return;
                if (blob && blob.size > 0) {
                    const prep = await prepareNcAttachmentPreviewBlob(blob, storagePath);
                    if (cancelled) return;
                    const url = URL.createObjectURL(prep.outBlob);
                    blobPreviewRef.current = url;
                    setBlobLooksImage(prep.blobLooksImage);
                    setNoInlineImgPreview(prep.noInlineImgPreview);
                    setDisplayUrl(url);
                } else if (error) {
                    console.error('Ek önizleme:', storagePath, error.message);
                }
            } catch (err) {
                console.error('Ek önizleme yüklenemedi:', storagePath, err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        if (path) loadPreview();
        else setIsLoading(false);

        return () => {
            cancelled = true;
            revokeBlob();
        };
    }, [path]);

    const pathStr = normalizeNcAttachmentPath(path) || (typeof path === 'string' ? path : '');
    const pathSuggestsImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif|heic|heif|avif)$/i.test(pathStr);
    const isPdf = /\.pdf$/i.test(pathStr);
    const fileName = pathStr.split('/').pop() || 'ek';

    const handlePdfClick = async (e) => {
        e.preventDefault();
        if (!path) return;

        setPdfOpening(true);
        try {
            const { blob, error } = await fetchNcAttachmentAsBlob(supabase, path);
            if (blob && blob.size > 0) {
                const pdfBlob = String(blob.type || '').includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' });
                const blobUrl = window.URL.createObjectURL(pdfBlob);
                setPdfViewerState({ isOpen: true, url: blobUrl, title: fileName });
                return;
            }
            console.error('PDF indirme hatası:', error);
            if (displayUrl) {
                setPdfViewerState({ isOpen: true, url: displayUrl, title: fileName });
            }
        } catch (err) {
            console.error('PDF açılırken hata:', err);
            if (displayUrl) {
                setPdfViewerState({ isOpen: true, url: displayUrl, title: fileName });
            }
        } finally {
            setPdfOpening(false);
        }
    };

    // Modal kapandığında blob URL'i temizle
    const handlePdfViewerClose = () => {
        if (pdfViewerState.url && pdfViewerState.url.startsWith('blob:')) {
            window.URL.revokeObjectURL(pdfViewerState.url);
        }
        setPdfViewerState({ isOpen: false, url: null, title: null });
    };

    if (isLoading) {
        return (
            <div className="relative group w-24 h-24 flex items-center justify-center bg-muted/30 rounded-lg">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" aria-hidden />
            </div>
        );
    }

    if (!isLoading && !displayUrl && isPdf) {
        return (
            <>
                <div className="relative group w-24 h-24">
                    <div
                        className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all cursor-pointer hover:bg-secondary transition-colors"
                        onClick={handlePdfClick}
                    >
                        {pdfOpening ? (
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                        ) : (
                            <>
                                <FileIcon className="w-6 h-6 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
                            </>
                        )}
                    </div>
                    {typeof onRemove === 'function' && (
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemove(path)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    )}
                </div>
                {pdfViewerState.isOpen && (
                    <PdfViewerModal
                        isOpen={pdfViewerState.isOpen}
                        setIsOpen={handlePdfViewerClose}
                        pdfUrl={pdfViewerState.url}
                        title={pdfViewerState.title}
                    />
                )}
            </>
        );
    }

    if (!displayUrl && pathSuggestsImage && !isPdf) {
        return (
            <div className="relative group w-24 h-24 flex flex-col items-center justify-center gap-1 p-2 bg-muted/30 rounded-lg text-center">
                <FileIcon className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] text-orange-500 leading-tight">Yüklenemedi</span>
            </div>
        );
    }

    if (!displayUrl) return null;

    if (noInlineImgPreview) {
        return (
            <div className="relative group w-24 h-24">
                <a
                    href={displayUrl}
                    download={fileName}
                    className="flex flex-col items-center justify-center gap-1 p-2 bg-background rounded-lg h-full text-center break-all hover:bg-secondary transition-colors"
                >
                    <FileIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-[10px] text-primary font-medium leading-tight">HEIC — indir</span>
                </a>
                {typeof onRemove === 'function' && (
                <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(path)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="relative group w-24 h-24">
                {blobLooksImage && !imageError ? (
                    <img
                        src={displayUrl}
                        alt="Ek"
                        className="rounded-lg object-cover w-full h-full cursor-pointer"
                        onClick={() => onPreview(displayUrl)}
                        onError={() => setImageError(true)}
                    />
                ) : blobLooksImage && imageError ? (
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all hover:bg-secondary transition-colors">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-[10px] text-orange-500">Önizleme yok</span>
                    </a>
                ) : isPdf ? (
                    <div 
                        className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all cursor-pointer hover:bg-secondary transition-colors"
                        onClick={handlePdfClick}
                    >
                        {pdfOpening ? (
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                        ) : (
                            <>
                                <FileIcon className="w-6 h-6 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
                            </>
                        )}
                    </div>
                ) : (
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all hover:bg-secondary transition-colors">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
                    </a>
                )}
                {typeof onRemove === 'function' && (
                <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(path)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
                )}
            </div>
            {pdfViewerState.isOpen && (
                <PdfViewerModal
                    isOpen={pdfViewerState.isOpen}
                    setIsOpen={handlePdfViewerClose}
                    pdfUrl={pdfViewerState.url}
                    title={pdfViewerState.title}
                />
            )}
        </>
    );
};


const NCFormGeneral = ({
    formData,
    setFormData,
    handleInputChange,
    handleSelectChange,
    handleOpeningDateChange,
    handlePersonnelChange,
    personnel,
    getRootProps,
    getInputProps,
    isDragActive,
    files,
    removeFile,
    record,
}) => {
    const isEditMode = !!record?.id;
    const [isSupplierNC, setIsSupplierNC] = useState(!!(formData.is_supplier_nc || formData.supplier_id));
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplierStatus, setSelectedSupplierStatus] = useState(null);
    const { toInputDateString } = useNCForm();
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const { unitCostSettings } = useData();

    const organizationUnitOptions = useMemo(() => {
        const fromSettings = (unitCostSettings || [])
            .map((u) => u.unit_name)
            .filter(Boolean);
        const names = new Set(fromSettings);
        const extra = [];
        if (formData.requesting_unit && !names.has(formData.requesting_unit)) {
            extra.push(formData.requesting_unit);
            names.add(formData.requesting_unit);
        }
        if (formData.department && !names.has(formData.department)) {
            extra.push(formData.department);
        }
        const merged = [...extra, ...fromSettings];
        return merged.map((name) => ({ value: name, label: name }));
    }, [unitCostSettings, formData.requesting_unit, formData.department]);

    useEffect(() => {
        // Tedarikçi DF kontrolü: hem is_supplier_nc hem de supplier_id ile kontrol et
        const shouldBeSupplierNC = !!(formData.is_supplier_nc || formData.supplier_id);
        setIsSupplierNC(shouldBeSupplierNC);
    }, [formData.is_supplier_nc, formData.supplier_id]);
    
    useEffect(() => {
        if (formData.supplier_id) {
            const supplier = suppliers.find(s => s.value === formData.supplier_id);
            if (supplier) {
                setSelectedSupplierStatus(supplier.status);
            }
        } else {
            setSelectedSupplierStatus(null);
        }
    }, [formData.supplier_id, suppliers]);

    // Personnel listesi yüklendikten sonra requesting_person ile requesting_unit'i hizala
    // (Üst departman/müdürlük; yoksa personel birimi — useNCForm ile aynı kural)
    useEffect(() => {
        if (personnel && personnel.length > 0 && formData.requesting_person) {
            const selectedPerson = personnel.find(p => p.full_name === formData.requesting_person);
            const targetUnit = ncOrganizationalUnitFromPersonnel(selectedPerson);
            if (selectedPerson && targetUnit && formData.requesting_unit !== targetUnit) {
                setFormData(prev => ({
                    ...prev,
                    requesting_unit: targetUnit
                }));
            }
        }
    }, [personnel, formData.requesting_person, formData.requesting_unit, setFormData]);

    // Sorumlu kişi ile ilgili birimi hizala (üst departman / birim — kaydet ile aynı kural)
    useEffect(() => {
        if (!personnel?.length || !formData.responsible_person || isSupplierNC) return;
        if (formData.department === 'Tedarikçi' || formData.department === 'Girdi Kalite') return;
        const selectedPerson = personnel.find((p) => p.full_name === formData.responsible_person);
        const targetUnit = ncOrganizationalUnitFromPersonnel(selectedPerson);
        if (selectedPerson && targetUnit && formData.department !== targetUnit) {
            setFormData((prev) => ({ ...prev, department: targetUnit }));
        }
    }, [personnel, formData.responsible_person, formData.department, isSupplierNC, setFormData]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name, status');
            if (!error) {
                setSuppliers(data.map(s => ({ value: s.id, label: s.name, status: s.status })));
            }
        };
        fetchSuppliers();
    }, []);

    const handleSupplierToggle = (checked) => {
        setIsSupplierNC(checked);
        
        setFormData(prev => {
            const updates = {
                is_supplier_nc: checked,
            };
            
            if (checked) {
                // Toggle açıldığında: supplier_id varsa koru, yoksa null bırak
                updates.supplier_id = prev.supplier_id || null;
                updates.department = 'Tedarikçi';
                updates.responsible_person = null;
                updates.responsible_personnel_id = null;
            } else {
                // Toggle kapatıldığında: düzenleme modunda supplier_id'yi koru, yeni kayıtta temizle
                if (isEditMode && prev.supplier_id) {
                    // Düzenleme modunda: supplier_id'yi koru ama is_supplier_nc'yi false yap
                    updates.supplier_id = prev.supplier_id;
                } else {
                    // Yeni kayıt: supplier_id'yi temizle
                    updates.supplier_id = null;
                }
                updates.department = '';
                // responsible_person ve responsible_personnel_id'yi sadece yeni kayıtta temizle
                if (!isEditMode) {
                    updates.responsible_person = null;
                    updates.responsible_personnel_id = null;
                }
            }
            
            return { ...prev, ...updates };
        });
    };

    const personnelOptions = (personnel || []).length > 0 
        ? personnel.map(p => ({ value: p.full_name, label: p.full_name }))
        : [];

    const handleRemoveExistingAttachment = (pathToRemove) => {
        const norm = normalizeNcAttachmentPath(pathToRemove);
        setFormData((prev) => ({
            ...prev,
            attachments: (prev.attachments || []).filter((entry) => normalizeNcAttachmentPath(entry) !== norm),
        }));
    };

    const openingAttachmentPaths = useMemo(
        () => normalizeNcAttachmentPathsList(formData.attachments || []),
        [formData.attachments]
    );
    const closingAttachmentPaths = useMemo(
        () => normalizeNcAttachmentPathsList(formData.closing_attachments || []),
        [formData.closing_attachments]
    );

    return (
        <>
        <Df8dImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-1">
            <div className="md:col-span-2 flex items-center space-x-2 bg-muted/50 p-3 rounded-lg">
                <Switch id="is_supplier_nc" checked={isSupplierNC} onCheckedChange={handleSupplierToggle} />
                <Label htmlFor="is_supplier_nc" className="flex items-center gap-2 cursor-pointer text-md font-semibold">
                    <Briefcase className="w-5 h-5 text-primary" /> Tedarikçi Uygunsuzluğu
                </Label>
            </div>

            {isSupplierNC && (
                <div className="md:col-span-2 space-y-2">
                     <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Tedarikçi Modu Aktif</AlertTitle>
                        <AlertDescription>
                            Bu uygunsuzluk doğrudan seçilen tedarikçiye açılacaktır; iç sorumlu seçimi gerekmiyor.
                        </AlertDescription>
                    </Alert>

                    {selectedSupplierStatus && selectedSupplierStatus !== 'Onaylı' && (
                        <Alert variant="warning" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Uyarı: Tedarikçi Statüsü</AlertTitle>
                            <AlertDescription>
                                Bu tedarikçi "{selectedSupplierStatus}" statüsündedir. Kayıt açılabilir; puanlama ve risk hesaplarına yansıyacaktır.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Label htmlFor="supplier_id">Tedarikçi <span className="text-red-500">*</span></Label>
                    <Combobox
                        id="supplier_id"
                        options={suppliers.map((s) => ({ value: s.value, label: s.label }))}
                        value={formData.supplier_id ?? ''}
                        onChange={(v) => handleSelectChange('supplier_id', v)}
                        placeholder="Tedarikçi seçin..."
                        searchPlaceholder="Tedarikçi ara..."
                        notFoundText="Tedarikçi bulunamadı."
                        allowClear={false}
                        modal={false}
                    />
                </div>
            )}
            
            <div className="md:col-span-2">
                <Label htmlFor="title">Uygunsuzluk Başlığı <span className="text-red-500">*</span></Label>
                <Input id="title" value={formData.title || ''} onChange={handleInputChange} required />
            </div>
            <div className="md:col-span-2">
                <Label htmlFor="description">Açıklama / Problem Tanımı <span className="text-red-500">*</span></Label>
                <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} required autoFormat={false} />
            </div>
            <div>
                <Label htmlFor="type">Tip <span className="text-red-500">*</span></Label>
                <Select value={formData.type || ''} onValueChange={(v) => handleSelectChange('type', v)} required disabled={isEditMode || (record && record.source_finding_id)}>
                    <SelectTrigger><SelectValue placeholder="Tip seçin..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="DF">DF (Düzeltici Faaliyet)</SelectItem>
                        <SelectItem value="8D">8D</SelectItem>
                        <SelectItem value="MDI">MDI</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {formData.type === 'MDI' && (
                <div>
                    <Label htmlFor="mdi_no">MDI Numarası <span className="text-red-500">*</span></Label>
                    <Input id="mdi_no" value={formData.mdi_no || ''} onChange={handleInputChange} required />
                </div>
            )}
            <div>
                 <Label htmlFor="priority">Öncelik</Label>
                 <Select value={formData.priority || ''} onValueChange={(v) => handleSelectChange('priority', v)}>
                    <SelectTrigger><SelectValue placeholder="Öncelik seçin..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Düşük">Düşük</SelectItem>
                        <SelectItem value="Orta">Orta</SelectItem>
                        <SelectItem value="Yüksek">Yüksek</SelectItem>
                        <SelectItem value="Kritik">Kritik</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="requesting_person">Talep Eden Kişi <span className="text-red-500">*</span></Label>
                {personnelOptions.length > 0 ? (
                    <Combobox
                        id="requesting_person"
                        options={personnel.map((p) => ({ value: p.full_name, label: p.full_name }))}
                        value={formData.requesting_person || ''}
                        onChange={(v) => handlePersonnelChange('requesting_person', v)}
                        placeholder="Talep eden kişiyi seçin..."
                        searchPlaceholder="Personel ara..."
                        notFoundText="Personel bulunamadı."
                        allowClear={false}
                        modal={false}
                    />
                ) : (
                    <div className="flex items-center gap-2 p-2 border border-destructive/50 rounded-md bg-destructive/10">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">Personel listesi yükleniyor... Lütfen bekleyin.</span>
                    </div>
                )}
            </div>
            <div>
                <Label htmlFor="requesting_unit">Talep Eden Birim</Label>
                {organizationUnitOptions.length > 0 ? (
                    <Combobox
                        id="requesting_unit"
                        options={organizationUnitOptions}
                        value={formData.requesting_unit || ''}
                        onChange={(v) => setFormData((prev) => ({ ...prev, requesting_unit: v ?? '' }))}
                        placeholder="Birim seçin..."
                        searchPlaceholder="Birim ara..."
                        notFoundText="Birim bulunamadı. Ayarlardan birim ekleyin."
                        allowClear
                        modal={false}
                    />
                ) : (
                    <Input id="requesting_unit" value={formData.requesting_unit || ''} onChange={handleInputChange} />
                )}
            </div>

            {!isSupplierNC && (
                <>
                    <div>
                        <Label htmlFor="responsible_person">Sorumlu Kişi <span className="text-red-500">*</span></Label>
                        {personnelOptions.length > 0 ? (
                            <Combobox
                                id="responsible_person"
                                options={personnel.map((p) => ({ value: p.full_name, label: p.full_name }))}
                                value={formData.responsible_person || ''}
                                onChange={(v) => handlePersonnelChange('responsible_person', v)}
                                placeholder="Sorumlu kişiyi seçin..."
                                searchPlaceholder="Personel ara..."
                                notFoundText="Personel bulunamadı."
                                allowClear={false}
                                modal={false}
                            />
                        ) : (
                            <div className="flex items-center gap-2 p-2 border border-destructive/50 rounded-md bg-destructive/10">
                                <AlertCircle className="w-4 h-4 text-destructive" />
                                <span className="text-sm text-destructive">Personel listesi yükleniyor... Lütfen bekleyin.</span>
                            </div>
                        )}
                    </div>
                     <div>
                        <Label htmlFor="department">İlgili Birim <span className="text-red-500">*</span></Label>
                        {organizationUnitOptions.length > 0 ? (
                            <Combobox
                                id="department"
                                options={organizationUnitOptions}
                                value={formData.department || ''}
                                onChange={(v) => setFormData((prev) => ({ ...prev, department: v ?? '' }))}
                                placeholder="İlgili birimi seçin..."
                                searchPlaceholder="Birim ara..."
                                notFoundText="Birim bulunamadı. Ayarlardan birim ekleyin."
                                allowClear={false}
                                modal={false}
                            />
                        ) : (
                            <Input id="department" value={formData.department || ''} onChange={handleInputChange} required />
                        )}
                    </div>
                </>
            )}

            <div>
                <Label htmlFor="opening_date">Açılış Tarihi</Label>
                <Input id="opening_date" type="date" value={toInputDateString(formData.opening_date)} onChange={handleOpeningDateChange} />
            </div>
            <div>
                <Label htmlFor="due_date">Termin Tarihi <span className="text-red-500">*</span></Label>
                <Input id="due_date" type="date" value={toInputDateString(formData.due_date)} onChange={handleInputChange} required />
            </div>
            {isEditMode && formData.status === 'Kapatıldı' && (
                <div>
                    <Label htmlFor="closing_date">Kapanış Tarihi</Label>
                    <Input id="closing_date" type="date" value={toInputDateString(formData.closing_date || formData.closed_at)} onChange={handleInputChange} />
                </div>
            )}
             <div className="flex items-center space-x-2">
                <Switch id="shipment_impact" checked={!!formData.shipment_impact} onCheckedChange={(checked) => setFormData(prev => ({...prev, shipment_impact: checked}))} />
                <Label htmlFor="shipment_impact">Sevkiyat Etkisi Var</Label>
            </div>
            
            <div className="md:col-span-2">
                <Label>Kanıt Dokümanı</Label>
                {isEditMode && openingAttachmentPaths.length > 0 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Mevcut dokümanlar (kayıt / açılış)</p>
                        <div className="flex flex-wrap gap-4">
                            {openingAttachmentPaths.map((path, index) => (
                                <AttachmentItem key={`open-${index}`} path={path} onRemove={handleRemoveExistingAttachment} onPreview={setLightboxUrl} />
                            ))}
                        </div>
                    </div>
                )}
                {isEditMode && closingAttachmentPaths.length > 0 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Kapanış kanıt dokümanları</p>
                        <p className="text-xs text-muted-foreground mb-2">
                            Kayıt kapatılırken veya işlem sırasında eklenen dosyalar. Bu listeden silme desteklenmez; gerekirse kayıt durumunu güncelleyerek kapatma akışından yönetin.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {closingAttachmentPaths.map((path, index) => (
                                <AttachmentItem key={`close-${index}`} path={path} onPreview={setLightboxUrl} />
                            ))}
                        </div>
                    </div>
                )}
                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <input {...getInputProps()} />
                    <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Yeni dokümanları buraya sürükleyin veya seçmek için tıklayın.</p>
                </div>
                {files.length > 0 && (
                    <div className="mt-2 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Yeni Yüklenecekler</p>
                        {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                                <div className="flex items-center gap-2"><FileIcon className="w-4 h-4" /><span className="text-sm">{file.name}</span></div>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file)}><XIcon className="w-4 h-4" /></Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default NCFormGeneral;