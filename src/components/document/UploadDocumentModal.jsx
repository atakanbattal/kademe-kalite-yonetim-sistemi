import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
    import { useDropzone } from 'react-dropzone';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Textarea } from '@/components/ui/textarea';
    import { UploadCloud, File, X, FileEdit } from 'lucide-react';
    import { v4 as uuidv4 } from 'uuid';
    import { sanitizeFileName } from '@/lib/utils';
    import { getPublishedAttachment, getSourceAttachments, SOURCE_FILE_ACCEPT } from '@/lib/documentRevisionAttachments';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';

    const BUCKET_NAME = 'documents';

    /** documents.department_id → cost_settings(id) FK; yalnızca geçerli UUID ve listedeki id kabul edilir */
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const CATEGORIES_REQUIRING_DEPARTMENT = [
        'Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar',
        'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler',
        'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler',
        'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar',
    ];

    // Doküman tipine göre klasör adı döndürür
    const getDocumentFolder = (documentType) => {
        const folderMap = {
            'Kalite Sertifikaları': 'Kalite-Sertifikalari',
            'Personel Sertifikaları': 'Personel-Sertifikalari',
            'Prosedürler': 'documents',
            'Talimatlar': 'documents',
            'Formlar': 'documents',
            'El Kitapları': 'documents',
            'Şemalar': 'documents',
            'Görev Tanımları': 'documents',
            'Süreçler': 'documents',
            'Planlar': 'documents',
            'Listeler': 'documents',
            'Şartnameler': 'documents',
            'Politikalar': 'documents',
            'Tablolar': 'documents',
            'Antetler': 'documents',
            'Sözleşmeler': 'documents',
            'Yönetmelikler': 'documents',
            'Kontrol Planları': 'documents',
            'FMEA Planları': 'documents',
            'Proses Kontrol Kartları': 'documents',
            'Görsel Yardımcılar': 'documents',
            'Diğer': 'documents',
        };
        return folderMap[documentType] || 'documents';
    };

    const UploadDocumentModal = ({ isOpen, setIsOpen, refreshDocuments, existingDocument, categories, preselectedCategory, isRevisionMode = false }) => {
        const { toast } = useToast();
        const { user, profile } = useAuth();
        const { personnel: personnelList, unitCostSettings } = useData();
        const isEditMode = !!existingDocument && !isRevisionMode;

        const validCostSettingIds = useMemo(
            () => new Set((unitCostSettings || []).map((u) => u.id).filter(Boolean)),
            [unitCostSettings]
        );

        const [formData, setFormData] = useState({});
        const [file, setFile] = useState(null);
        /** Mevcut revizyondan korunan kaynak ekleri (storage'da duran) */
        const [keptExistingSources, setKeptExistingSources] = useState([]);
        /** Bu oturumda eklenecek yeni kaynak dosyalar */
        const [newSourceFiles, setNewSourceFiles] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const initialLoadRef = useRef(true);

        // Revizyon modunda tüm revizyonları çek ve en yüksek numarayı bul, ilk yayın tarihini al
        useEffect(() => {
            if (isOpen && isRevisionMode && existingDocument?.id) {
                const fetchRevisionData = async () => {
                    try {
                        const { data: allRevisions, error: revError } = await supabase
                            .from('document_revisions')
                            .select('revision_number, publish_date, revision_date, created_at')
                            .eq('document_id', existingDocument.id)
                            .order('revision_number', { ascending: true }); // İlk revizyonu bulmak için ascending

                        if (revError) throw revError;

                        // En yüksek revizyon numarasını bul
                        let maxRevisionNumber = 0;
                        let firstPublishDate = null;
                        
                        if (allRevisions && allRevisions.length > 0) {
                            // İlk revizyonun publish_date'ini al (ilk yayın tarihi)
                            firstPublishDate = allRevisions[0].publish_date;
                            
                            // En yüksek revizyon numarasını bul
                            allRevisions.forEach(rev => {
                                const revNum = parseInt(rev.revision_number, 10);
                                if (!isNaN(revNum) && revNum > maxRevisionNumber) {
                                    maxRevisionNumber = revNum;
                                }
                            });
                        }
                        
                        const nextRevisionNumber = (maxRevisionNumber + 1).toString();
                        // Yeni revizyon için bugünün tarihini revizyon tarihi olarak ayarla
                        const todayDate = new Date().toISOString().slice(0, 10);
                        
                        // FormData'yı güncelle - revizyon numarası, ilk yayın tarihi ve bugünün revizyon tarihi
                        setFormData(prev => ({
                            ...prev,
                            revision_number: nextRevisionNumber,
                            publish_date: firstPublishDate || prev.publish_date, // İlk yayın tarihini koru
                            revision_date: todayDate // Yeni revizyon için bugünün tarihini kullan
                        }));
                    } catch (error) {
                        console.error('Revizyon verileri hesaplanamadı:', error);
                        // Hata durumunda mevcut revizyon numarasına +1 ekle ve mevcut publish_date'i koru
                        const revision = existingDocument.document_revisions;
                        const currentRevNum = parseInt(revision?.revision_number || '0', 10);
                        const todayDate = new Date().toISOString().slice(0, 10);
                        setFormData(prev => ({
                            ...prev,
                            revision_number: (currentRevNum + 1).toString(),
                            publish_date: revision?.publish_date || prev.publish_date, // Mevcut publish_date'i koru
                            revision_date: todayDate // Yeni revizyon için bugünün tarihini kullan
                        }));
                    }
                };
                
                fetchRevisionData();
            }
        }, [isOpen, isRevisionMode, existingDocument?.id]);

        useEffect(() => {
            if (isOpen) {
                if (initialLoadRef.current) {
                    const initialData = {
                        title: '', 
                        document_type: preselectedCategory || '', 
                        revision_number: '1', 
                        publish_date: new Date().toISOString().slice(0, 10), 
                        revision_date: '', // Yeni kayıtlarda revizyon tarihi boş bırakılacak (manuel girilecek)
                        personnel_id: null,
                        revision_reason: 'İlk Yayın',
                        valid_until: '',
                        status: 'Yayınlandı',
                        department_id: null,
                    };

                    if (existingDocument) {
                         const revision = existingDocument.document_revisions;
                         
                         // Revizyon modunda başlangıç değeri (async useEffect ile güncellenecek)
                         let nextRevisionNumber = revision?.revision_number || '1';
                         if (isRevisionMode) {
                             // Geçici olarak mevcut revizyon numarasını kullan
                             // Async useEffect ile doğru değer hesaplanacak
                             const currentRevNum = parseInt(revision?.revision_number || '0', 10);
                             nextRevisionNumber = currentRevNum.toString(); // Geçici değer
                         }
                         
                         // Revizyon modunda publish_date'i koru (ilk yayın tarihi)
                         const publishDate = isRevisionMode 
                             ? (revision?.publish_date ? new Date(revision.publish_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
                             : (revision?.publish_date ? new Date(revision.publish_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
                         
                         setFormData({
                            id: existingDocument.id,
                            title: existingDocument.title || '',
                            document_type: existingDocument.document_type || '',
                            personnel_id: existingDocument.personnel_id || null,
                            valid_until: existingDocument.valid_until ? new Date(existingDocument.valid_until).toISOString().slice(0, 10) : '',
                            revision_number: nextRevisionNumber,
                            publish_date: publishDate, // Revizyon modunda da ilk yayın tarihini koru
                            // Revizyon modunda: Revizyon tarihi async useEffect ile bugünün tarihi olarak ayarlanacak
                            // Düzenleme modunda: Mevcut revizyon tarihini göster
                            revision_date: isRevisionMode ? '' : (revision?.revision_date ? new Date(revision.revision_date).toISOString().slice(0, 10) : ''),
                            revision_reason: isRevisionMode ? '' : (revision?.revision_reason || ''),
                            file_name: getPublishedAttachment(revision?.attachments)?.name,
                            department_id: existingDocument.department_id || null,
                         });
                         setKeptExistingSources(getSourceAttachments(revision?.attachments || []));
                         setNewSourceFiles([]);
                    } else {
                        setFormData(initialData);
                        setKeptExistingSources([]);
                        setNewSourceFiles([]);
                    }
                    setFile(null);
                    initialLoadRef.current = false;
                }
            } else {
                initialLoadRef.current = true;
                setKeptExistingSources([]);
                setNewSourceFiles([]);
            }
        }, [isOpen, existingDocument, isEditMode, preselectedCategory, profile, isRevisionMode]);

        const onDrop = useCallback(acceptedFiles => {
            if (acceptedFiles.length > 0) {
                setFile(acceptedFiles[0]);
            }
        }, []);

        const onDropSource = useCallback((acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                setNewSourceFiles((prev) => [...prev, ...acceptedFiles].slice(0, 25));
            }
        }, []);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            onDrop,
            accept: { 'application/pdf': ['.pdf'] },
            maxFiles: 1
        });

        const { getRootProps: getSourceRootProps, getInputProps: getSourceInputProps, isDragActive: isSourceDragActive } = useDropzone({
            onDrop: onDropSource,
            accept: SOURCE_FILE_ACCEPT,
            maxFiles: 25,
            multiple: true,
        });

        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (id, value) => {
            setFormData((prev) => {
                const next = { ...prev, [id]: value };
                if (id === 'document_type' && !CATEGORIES_REQUIRING_DEPARTMENT.includes(value)) {
                    next.department_id = null;
                }
                return next;
            });
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!isEditMode && !isRevisionMode && !file) {
                toast({ variant: 'destructive', title: 'Dosya Eksik', description: 'Lütfen bir PDF dosyası seçin.' });
                return;
            }
            if (isRevisionMode && !file && !getPublishedAttachment(existingDocument?.document_revisions?.attachments)?.path) {
                toast({ variant: 'destructive', title: 'Dosya Eksik', description: 'Lütfen bir PDF dosyası seçin veya mevcut dosyayı kullanın.' });
                return;
            }
            if (!formData.title || !formData.document_type || !formData.publish_date) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm zorunlu alanları doldurun.' });
                return;
            }
            if (isRevisionMode && !formData.revision_reason?.trim()) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen revizyon nedenini belirtin.' });
                return;
            }
            const rawDept = formData.department_id;
            const deptStr = rawDept == null ? '' : String(rawDept).trim();
            let resolvedDepartmentId = null;
            if (deptStr && deptStr !== 'undefined' && deptStr !== 'null' && UUID_RE.test(deptStr)) {
                if (validCostSettingIds.has(deptStr)) {
                    resolvedDepartmentId = deptStr;
                } else if ((isEditMode || isRevisionMode) && existingDocument?.department_id === deptStr) {
                    resolvedDepartmentId = deptStr;
                }
            }

            if (CATEGORIES_REQUIRING_DEPARTMENT.includes(formData.document_type) && !resolvedDepartmentId) {
                const stale = deptStr && UUID_RE.test(deptStr);
                toast({
                    variant: 'destructive',
                    title: 'Eksik Bilgi',
                    description: stale
                        ? 'Seçilen birim artık geçerli değil veya listede yok. Sayfayı yenileyip birim seçimini tekrarlayın.'
                        : 'Lütfen birim seçiniz.',
                });
                return;
            }
            setIsSubmitting(true);

            try {
                const currentUserPersonnelRecord = personnelList.find(p => p.email === user.email);
                // Personel kaydı bulunamazsa null olarak devam et (prepared_by_id opsiyonel)
                if (!currentUserPersonnelRecord) {
                    console.warn(`Personel kaydı bulunamadı: ${user.email}. prepared_by_id null olarak kaydedilecek.`);
                }

                const documentId = (isEditMode || isRevisionMode) ? existingDocument.id : uuidv4();
                const folderName = getDocumentFolder(formData.document_type);

                let publishedMeta = null;
                if (file) {
                    const sanitizedFileName = sanitizeFileName(file.name);
                    let filePath;
                    if (isRevisionMode) {
                        const revisionNumber = formData.revision_number || '1';
                        const fileNameWithoutExt = sanitizedFileName.replace(/\.[^/.]+$/, '');
                        const fileExt = sanitizedFileName.substring(sanitizedFileName.lastIndexOf('.'));
                        filePath = `${folderName}/${documentId}-rev${revisionNumber}-${fileNameWithoutExt}${fileExt}`;
                    } else {
                        filePath = `${folderName}/${documentId}-${sanitizedFileName}`;
                    }
                    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
                        upsert: true
                    });
                    if (uploadError) throw uploadError;

                    publishedMeta = {
                        path: filePath,
                        name: file.name,
                        size: file.size,
                        type: file.type || 'application/pdf',
                        role: 'published',
                    };
                } else if (isEditMode || isRevisionMode) {
                    const prev = getPublishedAttachment(existingDocument.document_revisions?.attachments);
                    if (prev) {
                        publishedMeta = {
                            ...prev,
                            role: 'published',
                        };
                    }
                }

                const sourceMetas = keptExistingSources.map((s) => ({
                    path: s.path,
                    name: s.name,
                    size: s.size,
                    type: s.type || 'application/octet-stream',
                    role: 'source',
                }));

                for (const srcFile of newSourceFiles) {
                    const sanitizedSourceName = sanitizeFileName(srcFile.name);
                    const shortId = uuidv4().slice(0, 8);
                    let srcPath;
                    if (isRevisionMode) {
                        const revisionNumber = formData.revision_number || '1';
                        srcPath = `${folderName}/${documentId}-rev${revisionNumber}-src-${shortId}-${sanitizedSourceName}`;
                    } else if (isEditMode) {
                        const rev = String(formData.revision_number || '1');
                        srcPath = `${folderName}/${documentId}-rev${rev}-src-${shortId}-${sanitizedSourceName}`;
                    } else {
                        srcPath = `${folderName}/${documentId}-src-${shortId}-${sanitizedSourceName}`;
                    }
                    const { error: srcErr } = await supabase.storage.from(BUCKET_NAME).upload(srcPath, srcFile, {
                        upsert: true
                    });
                    if (srcErr) throw srcErr;
                    sourceMetas.push({
                        path: srcPath,
                        name: srcFile.name,
                        size: srcFile.size,
                        type: srcFile.type || 'application/octet-stream',
                        role: 'source',
                    });
                }

                const mergedAttachments = [];
                if (publishedMeta) mergedAttachments.push(publishedMeta);
                mergedAttachments.push(...sourceMetas);

                const documentPayload = {
                    title: formData.title,
                    document_type: formData.document_type,
                    status: 'Yayınlandı',
                    department_id: resolvedDepartmentId,
                    personnel_id: formData.document_type === 'Personel Sertifikaları' ? formData.personnel_id : null,
                    valid_until: formData.valid_until || null,
                    user_id: user.id,
                };

                const revisionPayload = {
                    revision_number: parseInt(formData.revision_number, 10) || 1,
                    revision_reason: formData.revision_reason || (isRevisionMode ? 'Revizyon' : 'İlk Yayın'),
                    publish_date: formData.publish_date,
                    revision_date: formData.revision_date || null, // Revizyon tarihi manuel girilecek (yeni kayıtlarda boş olabilir)
                    prepared_by_id: currentUserPersonnelRecord?.id || null,
                    user_id: user.id,
                    attachments: mergedAttachments.length > 0 ? mergedAttachments : null,
                };
                
                if (isRevisionMode) {
                    // Yeni revizyon oluştur
                    const { data: revData, error: revError } = await supabase
                        .from('document_revisions')
                        .insert({ ...revisionPayload, document_id: documentId })
                        .select('id')
                        .single();
                    if (revError) throw revError;

                    // Dokümanı güncelle ve current_revision_id'yi yeni revizyona ayarla
                    const { error: docUpdateError } = await supabase
                        .from('documents')
                        .update({ ...documentPayload, current_revision_id: revData.id })
                        .eq('id', documentId);
                    if (docUpdateError) throw docUpdateError;
                } else if (isEditMode) {
                    const { data: docUpdateData, error: docUpdateError } = await supabase
                        .from('documents')
                        .update(documentPayload)
                        .eq('id', documentId)
                        .select('id')
                        .single();
                    if (docUpdateError) throw docUpdateError;
                    
                    const { error: revUpdateError } = await supabase
                        .from('document_revisions')
                        .update(revisionPayload)
                        .eq('id', existingDocument.current_revision_id);
                     if (revUpdateError) throw revUpdateError;
                } else {
                    const { data: docData, error: docError } = await supabase
                        .from('documents')
                        .insert({ ...documentPayload, id: documentId })
                        .select('id, document_number')
                        .single();
                    if (docError) throw docError;

                    const { data: revData, error: revError } = await supabase
                        .from('document_revisions')
                        .insert({ ...revisionPayload, document_id: docData.id })
                        .select('id')
                        .single();
                    if (revError) throw revError;

                    const { error: updateDocError } = await supabase
                        .from('documents')
                        .update({ current_revision_id: revData.id })
                        .eq('id', docData.id);
                    if (updateDocError) throw updateDocError;
                }

                toast({ title: 'Başarılı!', description: `Doküman başarıyla ${isRevisionMode ? 'revize edildi' : (isEditMode ? 'güncellendi' : 'yüklendi')}.` });
                refreshDocuments();
                setIsOpen(false);
            } catch (error) {
                console.error("Submit Error:", error);
                toast({ variant: 'destructive', title: 'Hata!', description: `İşlem başarısız: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">{isRevisionMode ? 'Dokümanı Revize Et' : (isEditMode ? 'Dokümanı Düzenle' : 'Yeni Doküman Yükle')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {isRevisionMode 
                                ? 'Yayın PDF’ini ve isteğe bağlı olarak Word/Excel kaynaklarını yükleyin. Kaynaklar bu revizyonla birlikte saklanır; sonraki düzenlemeler için indirilebilir.' 
                                : (isEditMode ? 'Yayın PDF’i ve düzenlenebilir kaynak dosyalarını güncelleyebilirsiniz.' : 'Yayın için PDF yükleyin; düzenlenebilir asılları (Word, Excel vb.) ayrıca ekleyebilirsiniz.')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="md:col-span-2">
                            <Label htmlFor="title">Doküman Adı <span className="text-red-500">*</span></Label>
                            <Input id="title" autoFormat={false} value={formData.title || ''} onChange={handleInputChange} required />
                        </div>

                        <div>
                            <Label htmlFor="document_type">Kategori <span className="text-red-500">*</span></Label>
                            <Select value={formData.document_type || ''} onValueChange={(v) => handleSelectChange('document_type', v)} required>
                                <SelectTrigger><SelectValue placeholder="Kategori seçin..." /></SelectTrigger>
                                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        {formData.document_type === 'Personel Sertifikaları' && (
                             <div>
                                <Label htmlFor="personnel_id">Personel</Label>
                                 <Select
                                    value={formData.personnel_id || ''}
                                    onValueChange={(value) => handleSelectChange('personnel_id', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Personel seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {personnelList.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {CATEGORIES_REQUIRING_DEPARTMENT.includes(formData.document_type) && (
                            <div>
                                <Label htmlFor="department_id">Birim <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.department_id || ''}
                                    onValueChange={(value) => handleSelectChange('department_id', value)}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Birim seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unitCostSettings && unitCostSettings.length > 0 ? (
                                            unitCostSettings.map((dept) => (
                                                <SelectItem key={dept.id} value={dept.id}>
                                                    {dept.unit_name}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="" disabled>Birim bulunamadı</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        
                        <div>
                            <Label htmlFor="revision_number">Versiyon {isRevisionMode && <span className="text-xs text-muted-foreground">(Otomatik)</span>}</Label>
                            <Input id="revision_number" value={formData.revision_number || ''} onChange={handleInputChange} disabled={isRevisionMode} />
                        </div>

                        <div>
                            <Label htmlFor="publish_date">Yayın Tarihi <span className="text-red-500">*</span> {isRevisionMode && <span className="text-xs text-muted-foreground">(İlk Yayın Tarihi - Değiştirilemez)</span>}</Label>
                            <Input id="publish_date" type="date" value={formData.publish_date || ''} onChange={handleInputChange} required disabled={isRevisionMode} />
                        </div>

                        <div>
                            <Label htmlFor="revision_date">Revizyon Tarihi</Label>
                            <Input id="revision_date" type="date" value={formData.revision_date || ''} onChange={handleInputChange} />
                        </div>

                        <div>
                            <Label htmlFor="valid_until">Geçerlilik Süresi</Label>
                            <Input id="valid_until" type="date" value={formData.valid_until || ''} onChange={handleInputChange} />
                        </div>
                        
                        <div className="md:col-span-2">
                            <Label htmlFor="revision_reason">Revizyon Nedeni {isRevisionMode && <span className="text-red-500">*</span>}</Label>
                            <Textarea id="revision_reason" value={formData.revision_reason || ''} onChange={handleInputChange} rows={3} placeholder={isRevisionMode ? 'Revizyon nedenini açıklayın...' : ''} required={isRevisionMode} />
                        </div>

                        <div className="md:col-span-2">
                            <Label>Yayın dosyası (PDF) <span className="text-red-500">*</span></Label>
                            <p className="text-xs text-muted-foreground mt-0.5 mb-1">Dağıtım ve görüntüleme için nihai PDF; zorunludur (yeni kayıtta veya revizyonda yeni PDF ile).</p>
                            <div {...getRootProps()} className={`mt-1 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}>
                                <input {...getInputProps()} />
                                <div className="text-center">
                                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                        {isDragActive ? 'Dosyayı buraya bırakın...' : 'PDF’i sürükleyin veya seçmek için tıklayın'}
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">Sadece PDF.</p>
                                </div>
                            </div>
                             {(file || (isEditMode && formData.file_name) || (isRevisionMode && formData.file_name)) && (
                                <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary p-3">
                                    <div className="flex items-center gap-2">
                                        <File className="h-5 w-5 text-primary" />
                                        <span className="text-sm font-medium text-foreground">{file?.name || formData.file_name}</span>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setFile(null); setFormData(prev => ({...prev, file_name: null})); }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <Label className="flex items-center gap-2">
                                <FileEdit className="h-4 w-4" />
                                Düzenlenebilir kaynak dosyalar (isteğe bağlı)
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5 mb-1">Word, Excel, PowerPoint vb. — bir sonraki revizyonda bu dosyalar üzerinden çalışabilirsiniz. Birden fazla dosya ekleyebilirsiniz.</p>
                            <div {...getSourceRootProps()} className={`mt-1 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-8 transition-colors ${isSourceDragActive ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}>
                                <input {...getSourceInputProps()} />
                                <div className="text-center">
                                    <FileEdit className="mx-auto h-10 w-10 text-muted-foreground" />
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {isSourceDragActive ? 'Dosyaları buraya bırakın…' : 'Kaynak dosyaları sürükleyin veya seçin'}
                                    </p>
                                </div>
                            </div>
                            {(keptExistingSources.length > 0 || newSourceFiles.length > 0) && (
                                <ul className="mt-3 space-y-2">
                                    {keptExistingSources.map((s) => (
                                        <li key={s.path} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                                            <span className="truncate pr-2">{s.name}</span>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setKeptExistingSources((prev) => prev.filter((x) => x.path !== s.path))} aria-label="Kaldır">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                    {newSourceFiles.map((f, idx) => (
                                        <li key={`${f.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                                            <span className="truncate pr-2">{f.name} <span className="text-muted-foreground">(yeni)</span></span>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setNewSourceFiles((prev) => prev.filter((_, i) => i !== idx))} aria-label="Kaldır">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                         <DialogFooter className="md:col-span-2 mt-4">
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Dokümanı Kaydet')}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default UploadDocumentModal;