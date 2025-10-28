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

const getStatusBadgeVariant = (status) => {
    switch (status) {
        case 'Onaylı': return 'success';
        case 'Askıya Alınmış': return 'warning';
        case 'Red': return 'destructive';
        default: return 'secondary';
    }
};

const AttachmentItem = ({ path, onRemove, onPreview }) => {
    const { data } = supabase.storage.from('df_attachments').getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) return null;

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

    return (
        <div className="relative group w-24 h-24">
            {isImage ? (
                <img
                    src={publicUrl}
                    alt="Ek"
                    className="rounded-lg object-cover w-full h-full cursor-pointer"
                    onClick={() => onPreview(publicUrl)}
                />
            ) : (
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center break-all">
                    <FileIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate w-full">{path.split('/').pop()}</span>
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

    const personnelOptions = personnel.map(p => ({ value: p.full_name, label: p.full_name }));

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
                <Textarea id="description" value={formData.description || ''} onChange={handleInputChange} required />
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
                <SearchableSelectDialog
                    options={personnelOptions}
                    value={formData.requesting_person}
                    onChange={(value) => handlePersonnelChange('requesting_person', value)}
                    triggerPlaceholder="Talep eden kişiyi seçin..."
                    dialogTitle="Talep Eden Seç"
                    searchPlaceholder="Personel ara..."
                    notFoundText="Personel bulunamadı."
                />
            </div>
            <div>
                <Label htmlFor="requesting_unit">Talep Eden Birim</Label>
                <Input id="requesting_unit" value={formData.requesting_unit || ''} onChange={handleInputChange} disabled />
            </div>

            {!isSupplierNC && (
                <>
                    <div>
                        <Label htmlFor="responsible_person">Sorumlu Kişi <span className="text-red-500">*</span></Label>
                        <SearchableSelectDialog
                            options={personnelOptions}
                            value={formData.responsible_person}
                            onChange={(value) => handlePersonnelChange('responsible_person', value)}
                            triggerPlaceholder="Sorumlu kişiyi seçin..."
                            dialogTitle="Sorumlu Seç"
                            searchPlaceholder="Personel ara..."
                            notFoundText="Personel bulunamadı."
                        />
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