import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UploadCloud, File as FileIcon, X as XIcon, AlertCircle, Briefcase, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { useNCForm } from '@/hooks/useNCForm';
import { Lightbox } from 'react-modal-image';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import { Loader2 } from 'lucide-react';

const getStatusBadgeVariant = (status) => {
    switch (status) {
        case 'Onaylı': return 'success';
        case 'Askıya Alınmış': return 'warning';
        case 'Red': return 'destructive';
        default: return 'secondary';
    }
};

const AttachmentItem = ({ path, onRemove, onPreview }) => {
    const [signedUrl, setSignedUrl] = React.useState(null);
    const [pdfViewerState, setPdfViewerState] = React.useState({ isOpen: false, url: null, title: null });
    const [isLoading, setIsLoading] = React.useState(false);
    
    React.useEffect(() => {
        const fetchSignedUrl = async () => {
            try {
                const { data, error } = await supabase.storage.from('df_attachments').createSignedUrl(path, 3600);
                if (!error && data?.signedUrl) {
                    setSignedUrl(data.signedUrl);
                }
            } catch (err) {
                console.error('Signed URL fetch error:', err);
            }
        };
        
        if (path) {
            fetchSignedUrl();
        }
    }, [path]);

    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(path);
    const isPdf = /\.pdf$/i.test(path);
    const fileName = path.split('/').pop();
    const [imageBlobUrl, setImageBlobUrl] = React.useState(null);
    const imageBlobUrlRef = React.useRef(null);

    // Görsel dosyaları blob olarak indir ve blob URL oluştur
    React.useEffect(() => {
        if (!isImage || !path) return;
        
        const loadImageAsBlob = async () => {
            try {
                const { data, error } = await supabase.storage.from('df_attachments').download(path);
                if (error) {
                    console.error('Görsel indirme hatası:', error);
                    return;
                }
                
                // Dosya uzantısına göre MIME type belirle
                const extension = path.split('.').pop().toLowerCase();
                const mimeTypes = {
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'bmp': 'image/bmp'
                };
                const mimeType = mimeTypes[extension] || 'image/jpeg';
                
                const blob = new Blob([data], { type: mimeType });
                const blobUrl = window.URL.createObjectURL(blob);
                
                // Eski blob URL'i temizle
                if (imageBlobUrlRef.current && imageBlobUrlRef.current.startsWith('blob:')) {
                    window.URL.revokeObjectURL(imageBlobUrlRef.current);
                }
                
                imageBlobUrlRef.current = blobUrl;
                setImageBlobUrl(blobUrl);
            } catch (err) {
                console.error('Görsel yüklenirken hata:', err);
            }
        };
        
        loadImageAsBlob();
        
        // Cleanup: blob URL'i temizle
        return () => {
            if (imageBlobUrlRef.current && imageBlobUrlRef.current.startsWith('blob:')) {
                window.URL.revokeObjectURL(imageBlobUrlRef.current);
                imageBlobUrlRef.current = null;
            }
        };
    }, [isImage, path]);

    const handlePdfClick = async (e) => {
        e.preventDefault();
        if (!path) return;
        
        setIsLoading(true);
        try {
            // PDF'i blob olarak indir ve blob URL oluştur
            const { data, error } = await supabase.storage.from('df_attachments').download(path);
            if (error) {
                console.error('PDF indirme hatası:', error);
                // Hata durumunda signed URL'i kullan
                if (signedUrl) {
                    setPdfViewerState({ isOpen: true, url: signedUrl, title: fileName });
                }
                return;
            }
            
            const blob = new Blob([data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfViewerState({ isOpen: true, url: blobUrl, title: fileName });
        } catch (err) {
            console.error('PDF açılırken hata:', err);
            // Hata durumunda signed URL'i kullan
            if (signedUrl) {
                setPdfViewerState({ isOpen: true, url: signedUrl, title: fileName });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Modal kapandığında blob URL'i temizle
    const handlePdfViewerClose = () => {
        if (pdfViewerState.url && pdfViewerState.url.startsWith('blob:')) {
            window.URL.revokeObjectURL(pdfViewerState.url);
        }
        setPdfViewerState({ isOpen: false, url: null, title: null });
    };

    if (!signedUrl && !isLoading) return null;

    return (
        <>
            <div className="relative group w-24 h-24">
                {isImage ? (
                    <img
                        src={imageBlobUrl || signedUrl}
                        alt="Ek"
                        className="rounded-lg object-cover w-full h-full cursor-pointer"
                        onClick={() => onPreview(imageBlobUrl || signedUrl)}
                        onError={(e) => {
                            // Blob URL başarısız olursa signed URL'e geri dön
                            if (imageBlobUrl && imageBlobUrl !== signedUrl) {
                                e.target.src = signedUrl;
                            }
                        }}
                    />
                ) : isPdf ? (
                    <div 
                        className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all cursor-pointer hover:bg-secondary transition-colors"
                        onClick={handlePdfClick}
                    >
                        {isLoading ? (
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                        ) : (
                            <>
                                <FileIcon className="w-6 h-6 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
                            </>
                        )}
                    </div>
                ) : (
                    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all hover:bg-secondary transition-colors">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
                    </a>
                )}
                <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(path)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
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
    const [isSupplierNC, setIsSupplierNC] = useState(formData.supplier_id || false);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplierStatus, setSelectedSupplierStatus] = useState(null);
    const { toInputDateString } = useNCForm();
    const [lightboxUrl, setLightboxUrl] = useState(null);

    useEffect(() => {
        setIsSupplierNC(!!formData.is_supplier_nc);
    }, [formData.is_supplier_nc]);
    
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
        setFormData(prev => ({
            ...prev,
            is_supplier_nc: checked,
            supplier_id: checked ? prev.supplier_id : null,
            department: checked ? 'Tedarikçi' : '',
            responsible_person: checked ? null : prev.responsible_person,
            responsible_personnel_id: checked ? null : prev.responsible_personnel_id,
        }));
    };

    const supplierOptions = suppliers.map(s => ({
        ...s,
        label: (
            <div className="flex items-center justify-between w-full">
                <span>{s.label}</span>
                <Badge variant={getStatusBadgeVariant(s.status)}>{s.status}</Badge>
            </div>
        )
    }));

    const personnelOptions = (personnel || []).length > 0 
        ? personnel.map(p => ({ value: p.full_name, label: p.full_name }))
        : [];

    const handleRemoveExistingAttachment = (pathToRemove) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(path => path !== pathToRemove)
        }));
    };

    return (
        <>
        {lightboxUrl && (
            <Lightbox
              large={lightboxUrl}
              onClose={() => setLightboxUrl(null)}
              hideDownload={true}
              hideZoom={true}
            />
        )}
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
                    <SearchableSelectDialog
                        options={supplierOptions}
                        value={formData.supplier_id}
                        onChange={(value) => handleSelectChange('supplier_id', value)}
                        triggerPlaceholder="Tedarikçi seçin..."
                        dialogTitle="Tedarikçi Seç"
                        searchPlaceholder="Tedarikçi ara..."
                        notFoundText="Tedarikçi bulunamadı."
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
                    <SearchableSelectDialog
                        options={personnelOptions}
                        value={formData.requesting_person}
                        onChange={(value) => handlePersonnelChange('requesting_person', value)}
                        triggerPlaceholder="Talep eden kişiyi seçin..."
                        dialogTitle="Talep Eden Seç"
                        searchPlaceholder="Personel ara..."
                        notFoundText="Personel bulunamadı."
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
                <Input id="requesting_unit" value={formData.requesting_unit || ''} onChange={handleInputChange} disabled />
            </div>

            {!isSupplierNC && (
                <>
                    <div>
                        <Label htmlFor="responsible_person">Sorumlu Kişi <span className="text-red-500">*</span></Label>
                        {personnelOptions.length > 0 ? (
                            <SearchableSelectDialog
                                options={personnelOptions}
                                value={formData.responsible_person}
                                onChange={(value) => handlePersonnelChange('responsible_person', value)}
                                triggerPlaceholder="Sorumlu kişiyi seçin..."
                                dialogTitle="Sorumlu Seç"
                                searchPlaceholder="Personel ara..."
                                notFoundText="Personel bulunamadı."
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
                        <Input id="department" value={formData.department || ''} onChange={handleInputChange} disabled />
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
                {isEditMode && formData.attachments && formData.attachments.length > 0 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Mevcut Dokümanlar</p>
                        <div className="flex flex-wrap gap-4">
                            {formData.attachments.map((path, index) => (
                                <AttachmentItem key={index} path={path} onRemove={handleRemoveExistingAttachment} onPreview={setLightboxUrl} />
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