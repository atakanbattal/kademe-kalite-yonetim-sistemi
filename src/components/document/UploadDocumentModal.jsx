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
    import {
        buildEditableSourceFileName,
        getPublishedAttachment,
        getSourceAttachments,
        SOURCE_FILE_ACCEPT,
    } from '@/lib/documentRevisionAttachments';
    import { hasRevisionInFileName } from '@/lib/documentCompliance';
    import {
        buildDocumentCodeReplacements,
        isDocxAttachment,
        replaceDocumentCodeInDocx,
    } from '@/lib/docxDocumentCodeReplace';
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
        /** PDF olmadan oluşturulan taslak — modal kapanmadan dosya yüklenebilir */
        const [draftDocument, setDraftDocument] = useState(null);
        /** Düzenlemede açılış anındaki birim/kategori (yeniden sınıflandırma tespiti) */
        const [originalClassification, setOriginalClassification] = useState(null);
        const [previewDocumentNumber, setPreviewDocumentNumber] = useState('');
        const [isLoadingPreviewNumber, setIsLoadingPreviewNumber] = useState(false);

        const effectiveDocument = existingDocument || draftDocument;
        const isEditMode = !!effectiveDocument && !isRevisionMode;

        const initialLoadRef = useRef(true);

        const isReclassifying = useMemo(() => {
            if (!isEditMode || !originalClassification) return false;
            const deptChanged = (formData.department_id || null) !== (originalClassification.department_id || null);
            const typeChanged = (formData.document_type || '') !== (originalClassification.document_type || '');
            return deptChanged || typeChanged;
        }, [isEditMode, originalClassification, formData.department_id, formData.document_type]);

        const displayDocumentNumber = isReclassifying && previewDocumentNumber
            ? previewDocumentNumber
            : (formData.document_number || '');

        useEffect(() => {
            if (!isOpen || !isEditMode || !originalClassification) {
                setPreviewDocumentNumber('');
                return;
            }

            const deptChanged = (formData.department_id || null) !== (originalClassification.department_id || null);
            const typeChanged = (formData.document_type || '') !== (originalClassification.document_type || '');
            if (!deptChanged && !typeChanged) {
                setPreviewDocumentNumber('');
                return;
            }

            const rawDept = formData.department_id;
            const deptStr = rawDept == null ? '' : String(rawDept).trim();
            const needsDepartment = CATEGORIES_REQUIRING_DEPARTMENT.includes(formData.document_type);
            if (needsDepartment && (!deptStr || !UUID_RE.test(deptStr) || !validCostSettingIds.has(deptStr))) {
                setPreviewDocumentNumber('');
                return;
            }
            if (!formData.document_type) {
                setPreviewDocumentNumber('');
                return;
            }

            let cancelled = false;
            setIsLoadingPreviewNumber(true);

            supabase
                .rpc('generate_document_number', {
                    p_department_id: needsDepartment ? deptStr : null,
                    p_document_type: formData.document_type,
                    p_document_subcategory: null,
                })
                .then(({ data, error }) => {
                    if (cancelled) return;
                    if (error) {
                        console.error('Yeni doküman numarası önizlenemedi:', error);
                        setPreviewDocumentNumber('');
                        return;
                    }
                    setPreviewDocumentNumber(data || '');
                })
                .finally(() => {
                    if (!cancelled) setIsLoadingPreviewNumber(false);
                });

            return () => {
                cancelled = true;
            };
        }, [
            isOpen,
            isEditMode,
            originalClassification,
            formData.department_id,
            formData.document_type,
            validCostSettingIds,
        ]);

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

                    if (effectiveDocument) {
                         const revision = effectiveDocument.document_revisions;
                         
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
                            id: effectiveDocument.id,
                            document_number: effectiveDocument.document_number || '',
                            title: effectiveDocument.title || '',
                            document_type: effectiveDocument.document_type || '',
                            personnel_id: effectiveDocument.personnel_id || null,
                            valid_until: effectiveDocument.valid_until ? new Date(effectiveDocument.valid_until).toISOString().slice(0, 10) : '',
                            revision_number: nextRevisionNumber,
                            publish_date: publishDate, // Revizyon modunda da ilk yayın tarihini koru
                            // Revizyon modunda: Revizyon tarihi async useEffect ile bugünün tarihi olarak ayarlanacak
                            // Düzenleme modunda: Mevcut revizyon tarihini göster
                            revision_date: isRevisionMode ? '' : (revision?.revision_date ? new Date(revision.revision_date).toISOString().slice(0, 10) : ''),
                            revision_reason: isRevisionMode ? '' : (revision?.revision_reason || ''),
                            file_name: getPublishedAttachment(revision?.attachments)?.name,
                            department_id: effectiveDocument.department_id || null,
                         });
                         if (isEditMode) {
                            setOriginalClassification({
                                department_id: effectiveDocument.department_id || null,
                                document_type: effectiveDocument.document_type || '',
                                document_number: effectiveDocument.document_number || '',
                            });
                         } else {
                            setOriginalClassification(null);
                         }
                         setPreviewDocumentNumber('');
                         setKeptExistingSources(getSourceAttachments(revision?.attachments || []));
                         setNewSourceFiles([]);
                    } else {
                        setFormData(initialData);
                        setKeptExistingSources([]);
                        setNewSourceFiles([]);
                        setOriginalClassification(null);
                        setPreviewDocumentNumber('');
                    }
                    setFile(null);
                    initialLoadRef.current = false;
                }
            } else {
                initialLoadRef.current = true;
                setKeptExistingSources([]);
                setNewSourceFiles([]);
                setDraftDocument(null);
                setOriginalClassification(null);
                setPreviewDocumentNumber('');
            }
        }, [isOpen, effectiveDocument, isEditMode, preselectedCategory, profile, isRevisionMode]);

        const warnRevisionInFileName = useCallback((fileName) => {
            if (hasRevisionInFileName(fileName)) {
                toast({
                    variant: 'destructive',
                    title: 'Dosya adı kuralı',
                    description: 'Revizyon bilgisi dosya adında olmamalıdır (KYS A010). Lütfen "(Rev.xx)" ifadesini kaldırın; revizyon yalnızca antet ve ana listede tutulur.',
                });
            }
        }, [toast]);

        const onDrop = useCallback(acceptedFiles => {
            if (acceptedFiles.length > 0) {
                const picked = acceptedFiles[0];
                warnRevisionInFileName(picked.name);
                setFile(picked);
            }
        }, [warnRevisionInFileName]);

        const onDropSource = useCallback((acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                acceptedFiles.forEach((f) => warnRevisionInFileName(f.name));
                setNewSourceFiles((prev) => [...prev, ...acceptedFiles].slice(0, 25));
            }
        }, [warnRevisionInFileName]);

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
            // Yeni kayıt: önce metadata ile numara alınabilir; PDF/Word sonradan eklenir
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
                } else if ((isEditMode || isRevisionMode) && effectiveDocument?.department_id === deptStr) {
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
                if (!currentUserPersonnelRecord) {
                    console.warn(`Personel kaydı bulunamadı: ${user.email}. prepared_by_id null olarak kaydedilecek.`);
                }

                const documentTitle = (formData.title || '').trim();
                const wasNewInsert = !isRevisionMode && !isEditMode;
                let documentId = (isEditMode || isRevisionMode) ? effectiveDocument.id : (effectiveDocument?.id || uuidv4());
                let documentNumber = formData.document_number || effectiveDocument?.document_number || '';

                if (isEditMode && isReclassifying) {
                    const needsDepartment = CATEGORIES_REQUIRING_DEPARTMENT.includes(formData.document_type);
                    if (needsDepartment && !resolvedDepartmentId) {
                        throw new Error('Yeniden sınıflandırma için birim seçilmelidir.');
                    }
                    const { data: newNum, error: numError } = await supabase.rpc('generate_document_number', {
                        p_department_id: needsDepartment ? resolvedDepartmentId : null,
                        p_document_type: formData.document_type,
                        p_document_subcategory: null,
                    });
                    if (numError) throw numError;
                    documentNumber = newNum || documentNumber;
                }
                let currentRevisionId = effectiveDocument?.current_revision_id || null;
                const folderName = getDocumentFolder(formData.document_type);

                const documentPayload = {
                    title: formData.title,
                    document_type: formData.document_type,
                    status: 'Yayınlandı',
                    department_id: resolvedDepartmentId,
                    personnel_id: formData.document_type === 'Personel Sertifikaları' ? formData.personnel_id : null,
                    valid_until: formData.valid_until || null,
                    user_id: user.id,
                };

                const buildRevisionPayload = (attachments) => ({
                    revision_number: parseInt(formData.revision_number, 10) || 1,
                    revision_reason: formData.revision_reason || (isRevisionMode ? 'Revizyon' : 'İlk Yayın'),
                    publish_date: formData.publish_date,
                    revision_date: formData.revision_date || null,
                    prepared_by_id: currentUserPersonnelRecord?.id || null,
                    user_id: user.id,
                    attachments: attachments?.length > 0 ? attachments : null,
                });

                const persistDocumentShell = async () => {
                    const { data: docData, error: docError } = await supabase
                        .from('documents')
                        .insert({ ...documentPayload, id: documentId })
                        .select('id, document_number')
                        .single();
                    if (docError) throw docError;

                    const { data: revData, error: revError } = await supabase
                        .from('document_revisions')
                        .insert({ ...buildRevisionPayload(null), document_id: docData.id })
                        .select('id')
                        .single();
                    if (revError) throw revError;

                    const { error: updateDocError } = await supabase
                        .from('documents')
                        .update({ current_revision_id: revData.id })
                        .eq('id', docData.id);
                    if (updateDocError) throw updateDocError;

                    documentId = docData.id;
                    documentNumber = docData.document_number || '';
                    currentRevisionId = revData.id;

                    const { data: fullDoc, error: fetchErr } = await supabase
                        .from('documents')
                        .select('*, document_revisions(*)')
                        .eq('id', docData.id)
                        .single();
                    if (!fetchErr && fullDoc) {
                        const revs = fullDoc.document_revisions || [];
                        const currentRev = revs.find((r) => r.id === revData.id) || revs[0];
                        setDraftDocument({
                            ...fullDoc,
                            current_revision_id: revData.id,
                            document_revisions: currentRev,
                        });
                        setFormData((prev) => ({
                            ...prev,
                            id: fullDoc.id,
                            document_number: documentNumber,
                        }));
                    }
                };

                if (wasNewInsert && !documentNumber && newSourceFiles.length > 0) {
                    await persistDocumentShell();
                }

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
                } else if (isEditMode || isRevisionMode || currentRevisionId) {
                    const prev = getPublishedAttachment(effectiveDocument?.document_revisions?.attachments);
                    if (prev) {
                        publishedMeta = {
                            ...prev,
                            role: 'published',
                        };
                    }
                }

                const sourceMetas = [];
                const codeReplacements = isEditMode && isReclassifying && originalClassification?.document_number && documentNumber
                    ? buildDocumentCodeReplacements(
                        originalClassification.document_number,
                        documentNumber,
                        [
                            ...keptExistingSources.map((s) => s.name),
                            ...newSourceFiles.map((f) => f.name),
                        ]
                    )
                    : [];
                let docxContentPatched = false;

                const buildSourceStoragePath = (sanitizedSourceName) => {
                    const shortId = uuidv4().slice(0, 8);
                    if (isRevisionMode) {
                        const revisionNumber = formData.revision_number || '1';
                        return `${folderName}/${documentId}-rev${revisionNumber}-src-${shortId}-${sanitizedSourceName}`;
                    }
                    if (isEditMode || currentRevisionId) {
                        const rev = String(formData.revision_number || '1');
                        return `${folderName}/${documentId}-rev${rev}-src-${shortId}-${sanitizedSourceName}`;
                    }
                    return `${folderName}/${documentId}-src-${shortId}-${sanitizedSourceName}`;
                };

                const prepareSourceBlob = async (blob, fileName, mimeType) => {
                    if (!codeReplacements.length || !isDocxAttachment(fileName, mimeType)) {
                        return blob;
                    }
                    docxContentPatched = true;
                    return replaceDocumentCodeInDocx(blob, codeReplacements);
                };

                for (let index = 0; index < keptExistingSources.length; index += 1) {
                    const source = keptExistingSources[index];
                    const displayName = documentNumber
                        ? buildEditableSourceFileName(documentNumber, documentTitle, source.name, index)
                        : source.name;
                    const sanitizedSourceName = sanitizeFileName(displayName);
                    let uploadPath = source.path;
                    let uploadSize = source.size;
                    let uploadType = source.type || 'application/octet-stream';

                    if (codeReplacements.length && isDocxAttachment(source.name, source.type)) {
                        const { data, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(source.path);
                        if (downloadError) throw downloadError;
                        const patchedBlob = await prepareSourceBlob(data, source.name, source.type);
                        uploadPath = buildSourceStoragePath(sanitizedSourceName);
                        uploadSize = patchedBlob.size;
                        uploadType = source.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(uploadPath, patchedBlob, {
                            upsert: true,
                            contentType: uploadType,
                        });
                        if (uploadError) throw uploadError;
                    }

                    sourceMetas.push({
                        path: uploadPath,
                        name: displayName,
                        size: uploadSize,
                        type: uploadType,
                        role: 'source',
                    });
                }

                for (let sourceIndex = 0; sourceIndex < newSourceFiles.length; sourceIndex += 1) {
                    const srcFile = newSourceFiles[sourceIndex];
                    const displayName = documentNumber
                        ? buildEditableSourceFileName(
                            documentNumber,
                            documentTitle,
                            srcFile.name,
                            keptExistingSources.length + sourceIndex
                        )
                        : srcFile.name;
                    const sanitizedSourceName = sanitizeFileName(displayName);
                    const srcPath = buildSourceStoragePath(sanitizedSourceName);
                    let uploadBlob = srcFile;
                    if (codeReplacements.length && isDocxAttachment(srcFile.name, srcFile.type)) {
                        uploadBlob = await prepareSourceBlob(srcFile, srcFile.name, srcFile.type);
                    }
                    const { error: srcErr } = await supabase.storage.from(BUCKET_NAME).upload(srcPath, uploadBlob, {
                        upsert: true,
                        contentType: srcFile.type || uploadBlob.type || 'application/octet-stream',
                    });
                    if (srcErr) throw srcErr;
                    sourceMetas.push({
                        path: srcPath,
                        name: displayName,
                        size: uploadBlob.size,
                        type: srcFile.type || uploadBlob.type || 'application/octet-stream',
                        role: 'source',
                    });
                }

                const mergedAttachments = [];
                if (publishedMeta) mergedAttachments.push(publishedMeta);
                mergedAttachments.push(...sourceMetas);

                const hasPublishedFile = !!publishedMeta;
                const revisionPayload = buildRevisionPayload(mergedAttachments);

                if (isRevisionMode) {
                    const { data: revData, error: revError } = await supabase
                        .from('document_revisions')
                        .insert({ ...revisionPayload, document_id: documentId })
                        .select('id')
                        .single();
                    if (revError) throw revError;

                    const { error: docUpdateError } = await supabase
                        .from('documents')
                        .update({ ...documentPayload, current_revision_id: revData.id })
                        .eq('id', documentId);
                    if (docUpdateError) throw docUpdateError;
                } else if (isEditMode || currentRevisionId) {
                    const { error: docUpdateError } = await supabase
                        .from('documents')
                        .update(documentPayload)
                        .eq('id', documentId);
                    if (docUpdateError) throw docUpdateError;

                    const { error: revUpdateError } = await supabase
                        .from('document_revisions')
                        .update(revisionPayload)
                        .eq('id', currentRevisionId);
                    if (revUpdateError) throw revUpdateError;
                } else {
                    await persistDocumentShell();
                    if (mergedAttachments.length > 0) {
                        const { error: revUpdateError } = await supabase
                            .from('document_revisions')
                            .update(revisionPayload)
                            .eq('id', currentRevisionId);
                        if (revUpdateError) throw revUpdateError;
                    }
                }

                if (wasNewInsert && !hasPublishedFile) {
                    toast({
                        title: 'Doküman numarası alındı',
                        description:
                            'Kayıt oluşturuldu. Formu düzenlemeye devam edebilir; ardından PDF ve Word kaynaklarını yükleyebilirsiniz.',
                    });
                    refreshDocuments();
                    return;
                }

                toast({
                    title: 'Başarılı!',
                    description: docxContentPatched
                        ? `Doküman ${isRevisionMode ? 'revize edildi' : (isEditMode ? 'güncellendi' : 'yüklendi')}. Word kaynak dosyalarındaki doküman kodu da güncellendi.`
                        : `Doküman başarıyla ${isRevisionMode ? 'revize edildi' : (isEditMode ? 'güncellendi' : 'yüklendi')}.`,
                });
                refreshDocuments();
                setIsOpen(false);
                setDraftDocument(null);
            } catch (error) {
                console.error("Submit Error:", error);
                toast({ variant: 'destructive', title: 'Hata!', description: `İşlem başarısız: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };

        const previewSourceFileName = (originalName, index) => {
            const num = displayDocumentNumber;
            if (!num) return originalName;
            return buildEditableSourceFileName(num, formData.title, originalName, index);
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">{isRevisionMode ? 'Dokümanı Revize Et' : (isEditMode ? 'Dokümanı Düzenle' : 'Yeni Doküman Yükle')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {isRevisionMode 
                                ? 'Yayın PDF’ini ve isteğe bağlı olarak Word/Excel kaynaklarını yükleyin. Kaynaklar bu revizyonla birlikte saklanır; sonraki düzenlemeler için indirilebilir.' 
                                : (isEditMode
                                    ? 'Birim veya kategori değiştirirken doküman yeni numara alır; Word kaynak dosyasındaki antet kodu da otomatik güncellenir.'
                                    : 'Önce zorunlu alanları doldurup kaydedin (doküman numarası oluşur); sonra PDF ve kaynak dosyalarını ekleyin.')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        {displayDocumentNumber && (
                            <div className={`md:col-span-2 rounded-lg border px-4 py-3 ${isReclassifying ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary/30 bg-primary/5'}`}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                    {isReclassifying ? 'Yeni doküman numarası' : 'Doküman numarası'}
                                </p>
                                <p className="text-lg font-semibold font-mono text-primary">
                                    {isLoadingPreviewNumber && isReclassifying ? 'Hesaplanıyor…' : displayDocumentNumber}
                                </p>
                                {isReclassifying && originalClassification?.document_number && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Birim veya kategori değişti. Eski numara ({originalClassification.document_number}) korunur.
                                        Word (.docx) kaynak dosyalarındaki kod ve dosya adı yeni numara ile güncellenir.
                                    </p>
                                )}
                            </div>
                        )}
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
                            <Label>Yayın dosyası (PDF) {isRevisionMode && <span className="text-red-500">*</span>}</Label>
                            <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                                {isEditMode && !file && !formData.file_name
                                    ? 'İlk kayıtta PDF zorunlu değildir; numara aldıktan sonra yükleyebilirsiniz.'
                                    : 'Dağıtım ve görüntüleme için nihai PDF.'}
                            </p>
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
                                    {keptExistingSources.map((s, idx) => (
                                        <li key={s.path} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                                            <span className="truncate pr-2">{previewSourceFileName(s.name, idx)}</span>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setKeptExistingSources((prev) => prev.filter((x) => x.path !== s.path))} aria-label="Kaldır">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                    {newSourceFiles.map((f, idx) => (
                                        <li key={`${f.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                                            <span className="truncate pr-2">
                                                {previewSourceFileName(f.name, keptExistingSources.length + idx)}
                                                <span className="text-muted-foreground"> (yeni)</span>
                                            </span>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setNewSourceFiles((prev) => prev.filter((_, i) => i !== idx))} aria-label="Kaldır">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                         <DialogFooter className="md:col-span-2 mt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting
                                    ? 'Kaydediliyor...'
                                    : isRevisionMode
                                      ? 'Revizyonu Kaydet'
                                      : isEditMode
                                        ? 'Değişiklikleri Kaydet'
                                        : 'Kaydet ve Numara Al'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default UploadDocumentModal;