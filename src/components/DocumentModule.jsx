import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Search, FileText, Badge as Certificate, HardHat, FileDown, Eye, Trash2, Edit, RefreshCw, FileSpreadsheet } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import UploadDocumentModal from '@/components/document/UploadDocumentModal';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { useData } from '@/contexts/DataContext';
    import PdfViewerModal from '@/components/document/PdfViewerModal';
    import { openPrintableReport } from '@/lib/reportUtils';

    const DOCUMENT_CATEGORIES = [
      { value: 'Kalite Sertifikaları', label: 'Kalite Sertifikaları', icon: Certificate, addText: 'Yeni Kalite Sertifikası Ekle' },
      { value: 'Personel Sertifikaları', label: 'Personel Sertifikaları', icon: HardHat, addText: 'Yeni Personel Sertifikası Ekle' },
      { value: 'Prosedürler', label: 'Prosedürler', icon: FileText, addText: 'Yeni Prosedür Ekle' },
      { value: 'Talimatlar', label: 'Talimatlar', icon: FileText, addText: 'Yeni Talimat Ekle' },
      { value: 'Formlar', label: 'Formlar', icon: FileText, addText: 'Yeni Form Ekle' },
      { value: 'El Kitapları', label: 'El Kitapları', icon: FileText, addText: 'Yeni El Kitabı Ekle' },
      { value: 'Şemalar', label: 'Şemalar', icon: FileText, addText: 'Yeni Şema Ekle' },
      { value: 'Görev Tanımları', label: 'Görev Tanımları', icon: FileText, addText: 'Yeni Görev Tanımı Ekle' },
      { value: 'Süreçler', label: 'Süreçler', icon: FileText, addText: 'Yeni Süreç Ekle' },
      { value: 'Planlar', label: 'Planlar', icon: FileText, addText: 'Yeni Plan Ekle' },
      { value: 'Listeler', label: 'Listeler', icon: FileText, addText: 'Yeni Liste Ekle' },
      { value: 'Şartnameler', label: 'Şartnameler', icon: FileText, addText: 'Yeni Şartname Ekle' },
      { value: 'Politikalar', label: 'Politikalar', icon: FileText, addText: 'Yeni Politika Ekle' },
      { value: 'Tablolar', label: 'Tablolar', icon: FileText, addText: 'Yeni Tablo Ekle' },
      { value: 'Antetler', label: 'Antetler', icon: FileText, addText: 'Yeni Antet Ekle' },
      { value: 'Sözleşmeler', label: 'Sözleşmeler', icon: FileText, addText: 'Yeni Sözleşme Ekle' },
      { value: 'Yönetmelikler', label: 'Yönetmelikler', icon: FileText, addText: 'Yeni Yönetmelik Ekle' },
      { value: 'Kontrol Planları', label: 'Kontrol Planları', icon: FileText, addText: 'Yeni Kontrol Planı Ekle' },
      { value: 'FMEA Planları', label: 'FMEA Planları', icon: FileText, addText: 'Yeni FMEA Planı Ekle' },
      { value: 'Proses Kontrol Kartları', label: 'Proses Kontrol Kartları', icon: FileText, addText: 'Yeni Proses Kontrol Kartı Ekle' },
      { value: 'Görsel Yardımcılar', label: 'Görsel Yardımcılar', icon: FileText, addText: 'Yeni Görsel Yardımcı Ekle' },
      { value: 'Diğer', label: 'Diğer', icon: FileText, addText: 'Yeni Doküman Ekle' },
    ];

    const BUCKET_NAME = 'documents';

    // Doküman tipine göre klasör adı döndürür (Storage klasör yapısına uygun)
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

    // Eski path formatını yeni klasör yapısına uyarlar (eğer gerekirse)
    const normalizeDocumentPath = (path, documentType) => {
        if (!path) return null;
        // Eğer path zaten klasör yapısında ise (örn: "Kalite-Sertifikalari/..."), olduğu gibi döndür
        if (path.includes('/') && !path.startsWith('documents/') && !path.includes('Kalite') && !path.includes('Personel')) {
            // Eski format: "user-id/documentId-filename" -> yeni format: "folder/documentId-filename"
            const folderName = getDocumentFolder(documentType);
            const parts = path.split('/');
            if (parts.length >= 2) {
                // user-id kısmını klasör adıyla değiştir
                return `${folderName}/${parts.slice(1).join('/')}`;
            }
        }
        // Eğer path zaten doğru formatta ise, olduğu gibi döndür
        return path;
    };

    const ValidityStatus = ({ validUntil }) => {
        if (!validUntil) {
            return <Badge variant="secondary">Süresiz</Badge>;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(validUntil);
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return <Badge variant="destructive">Süresi Doldu ({Math.abs(diffDays)} gün önce)</Badge>;
        }
        if (diffDays <= 30) {
            return <Badge variant="warning" className="bg-yellow-500 text-white">{diffDays} gün kaldı</Badge>;
        }
        return <Badge variant="success" className="bg-green-600 text-white">{diffDays} gün kaldı</Badge>;
    };

    const DocumentModule = () => {
        const { toast } = useToast();
        const { documents, personnel, loading, refreshData, unitCostSettings } = useData();
        const [isUploadModalOpen, setUploadModalOpen] = useState(false);
        const [editingDocument, setEditingDocument] = useState(null);
        const [isRevisionMode, setIsRevisionMode] = useState(false);
        const [searchTerm, setSearchTerm] = useState('');
        const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
        const [activeTab, setActiveTab] = useState(DOCUMENT_CATEGORIES[0].value);
        const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });


        const filteredDocuments = useMemo(() => {
            // Doküman tipi eşleştirme mapping'i (veritabanındaki farklı formatları desteklemek için)
            const documentTypeMapping = {
                'Prosedürler': ['Prosedürler', 'Prosedür'],
                'Talimatlar': ['Talimatlar', 'Talimat'],
                'Formlar': ['Formlar', 'Form'],
                'El Kitapları': ['El Kitapları', 'El Kitabı'],
                'Şemalar': ['Şemalar', 'Şema'],
                'Görev Tanımları': ['Görev Tanımları', 'Görev Tanımı'],
                'Süreçler': ['Süreçler', 'Süreç'],
                'Planlar': ['Planlar', 'Plan'],
                'Listeler': ['Listeler', 'Liste'],
                'Şartnameler': ['Şartnameler', 'Şartname'],
                'Politikalar': ['Politikalar', 'Politika'],
                'Tablolar': ['Tablolar', 'Tablo'],
                'Antetler': ['Antetler', 'Antet'],
                'Sözleşmeler': ['Sözleşmeler', 'Sözleşme'],
                'Yönetmelikler': ['Yönetmelikler', 'Yönetmelik'],
                'Kontrol Planları': ['Kontrol Planları', 'Kontrol Planı'],
                'FMEA Planları': ['FMEA Planları', 'FMEA Planı'],
                'Proses Kontrol Kartları': ['Proses Kontrol Kartları', 'Proses Kontrol Kartı'],
                'Görsel Yardımcılar': ['Görsel Yardımcılar', 'Görsel Yardımcı'],
                'Kalite Sertifikaları': ['Kalite Sertifikaları', 'Kalite Sertifikası'],
                'Personel Sertifikaları': ['Personel Sertifikaları', 'Personel Sertifikası'],
                'Diğer': ['Diğer']
            };
            
            let docs = documents
                .filter(doc => {
                    // Aktif tab için geçerli olan tüm tip varyasyonlarını kontrol et
                    const validTypes = documentTypeMapping[activeTab] || [activeTab];
                    const matches = validTypes.includes(doc.document_type);
                    return matches;
                })
                .map(doc => {
                    // document_revisions bir array ise, current_revision_id ile eşleşeni bul
                    let revision = doc.document_revisions;
                    if (Array.isArray(revision) && doc.current_revision_id) {
                        revision = revision.find(r => r.id === doc.current_revision_id) || revision[0] || null;
                    }
                    // Eğer revision yoksa ve current_revision_id varsa, direkt fetch et
                    if (!revision && doc.current_revision_id) {
                        console.warn(`⚠️ Revision bulunamadı: ${doc.title} - current_revision_id: ${doc.current_revision_id}`);
                    }
                    return { ...doc, document_revisions: revision };
                })
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            
            // Birim filtresi (belirli kategoriler için)
            const categoriesWithDepartmentFilter = [
                'Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar', 
                'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler', 
                'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler', 
                'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar'
            ];
            if (selectedDepartmentId && categoriesWithDepartmentFilter.includes(activeTab)) {
                docs = docs.filter(doc => doc.department_id === selectedDepartmentId);
            }
            
            if (searchTerm) {
                const lowercasedFilter = searchTerm.toLowerCase();
                docs = docs.filter(doc => {
                    const titleMatch = doc.title?.toLowerCase().includes(lowercasedFilter);
                    const personnelMatch = activeTab === 'Personel Sertifikaları' && (
                        doc.personnel?.full_name?.toLowerCase().includes(lowercasedFilter) ||
                        doc.owner?.full_name?.toLowerCase().includes(lowercasedFilter)
                    );
                    return titleMatch || personnelMatch;
                });
            }
            
            return docs;
        }, [documents, activeTab, searchTerm, selectedDepartmentId]);
        
        const downloadPdf = async (revision, fileName, documentType) => {
            let filePath = revision?.attachments?.[0]?.path;
            if (!filePath) {
                 toast({ variant: 'destructive', title: 'Hata', description: 'İndirilecek dosya yolu bulunamadı.' });
                return;
            }
            // Path'i normalize et (eski formatı yeni klasör yapısına uyarla)
            filePath = normalizeDocumentPath(filePath, documentType);
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Dosya indirilemedi: ${error.message}` });
                return;
            }
            const blob = new Blob([data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        };

        const deleteDocument = async (doc) => {
            if (doc.current_revision_id) {
                const { data: revision } = await supabase.from('document_revisions').select('attachments').eq('id', doc.current_revision_id).single();
                if (revision?.attachments?.[0]?.path) {
                    await supabase.storage.from(BUCKET_NAME).remove([revision.attachments[0].path]);
                }
            }
            const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id);
            if (dbError) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Veritabanından doküman kaydı silinemedi.' });
            } else {
                toast({ title: 'Başarılı', description: 'Doküman başarıyla silindi.' });
                refreshData();
            }
        };

        const handleOpenUploadModal = (doc = null, revisionMode = false) => {
            setEditingDocument(doc);
            setIsRevisionMode(revisionMode);
            setUploadModalOpen(true);
        };

        const handleReviseDocument = async (doc) => {
            try {
                // Revizyon modunda modal'ı aç (revizyon numarası modal içinde async olarak hesaplanacak)
                handleOpenUploadModal(doc, true);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Revizyon başlatılamadı: ${error.message}` });
            }
        };

        const handleViewPdf = async (revision, title, documentType) => {
            let filePath = revision?.attachments?.[0]?.path;
            if (!filePath) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya yolu bulunamadı.' });
                return;
            }
            
            // Path'i normalize et (eski formatı yeni klasör yapısına uyarla)
            filePath = normalizeDocumentPath(filePath, documentType);
            
            try {
                // Download file as blob
                const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);
                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: `PDF görüntülenemedi: ${error.message}` });
                    return;
                }
                
                // Create blob URL for viewing in modal
                const blob = new Blob([data], { type: 'application/pdf' });
                const blobUrl = window.URL.createObjectURL(blob);
                
                // Open PDF in modal
                setPdfViewerState({ isOpen: true, url: blobUrl, title });
            } catch (err) {
                toast({ variant: 'destructive', title: 'Hata', description: 'PDF açılırken bir hata oluştu.' });
                console.error('PDF view error:', err);
            }
        };

        const currentCategory = DOCUMENT_CATEGORIES.find(c => c.value === activeTab);

        // Tab değiştiğinde birim filtresini sıfırla
        useEffect(() => {
            setSelectedDepartmentId('');
        }, [activeTab]);

        return (
            <div className="space-y-6">
                <UploadDocumentModal 
                    isOpen={isUploadModalOpen} 
                    setIsOpen={setUploadModalOpen} 
                    refreshDocuments={refreshData} 
                    categories={DOCUMENT_CATEGORIES.map(c => c.value)}
                    personnelList={personnel}
                    existingDocument={editingDocument}
                    preselectedCategory={activeTab}
                    isRevisionMode={isRevisionMode}
                />
                <PdfViewerModal 
                    isOpen={pdfViewerState.isOpen}
                    setIsOpen={(isOpen) => setPdfViewerState(s => ({...s, isOpen}))}
                    pdfUrl={pdfViewerState.url}
                    title={pdfViewerState.title}
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Doküman Yönetimi</h1>
                        <p className="text-muted-foreground mt-1">Tüm kalite dokümanlarınızı tek bir yerden yönetin.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <Label htmlFor="category-select" className="text-base font-semibold whitespace-nowrap">Kategori:</Label>
                            <Select value={activeTab} onValueChange={setActiveTab}>
                                <SelectTrigger id="category-select" className="w-full sm:w-[300px]">
                                    <SelectValue placeholder="Kategori seçin..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[400px]">
                                    {DOCUMENT_CATEGORIES.map(({ value, label, icon: Icon }) => (
                                        <SelectItem key={value} value={value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="w-4 h-4" />
                                                <span>{label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {filteredDocuments.length > 0 && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        const reportData = {
                                            items: filteredDocuments.map(doc => ({
                                                title: doc.title || '-',
                                                document_number: doc.document_number || '-',
                                                department_name: doc.departments?.unit_name || doc.personnel?.full_name || '-',
                                                revision_number: doc.document_revisions?.revision_number || '1',
                                                publish_date: doc.document_revisions?.publish_date || doc.created_at,
                                                revision_date: doc.document_revisions?.created_at || doc.updated_at,
                                                valid_until: doc.valid_until
                                            })),
                                            categoryName: currentCategory?.label || activeTab
                                        };
                                        openPrintableReport({ items: reportData.items, categoryName: reportData.categoryName }, 'document_list');
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Rapor Al
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <div className="dashboard-widget">
                             <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Doküman veya personel adı ile ara..." 
                                            className="pl-10"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    {['Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar', 'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler', 'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler', 'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar'].includes(activeTab) && (
                                        <Select value={selectedDepartmentId || 'all'} onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? '' : value)}>
                                            <SelectTrigger className="w-full sm:w-[200px]">
                                                <SelectValue placeholder="Birim seçin..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tüm Birimler</SelectItem>
                                                {unitCostSettings && unitCostSettings.map((dept) => (
                                                    <SelectItem key={dept.id} value={dept.id}>
                                                        {dept.unit_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <Button onClick={() => handleOpenUploadModal()} className="w-full sm:w-auto">
                                    <Plus className="w-4 h-4 mr-2" /> {currentCategory?.addText || 'Yeni Doküman Ekle'}
                                </Button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Doküman Adı / Numarası</th>
                                            {activeTab === 'Personel Sertifikaları' && <th>Personel</th>}
                                            {['Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar', 'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler', 'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler', 'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar'].includes(activeTab) && <th>Birim</th>}
                                            <th>Versiyon</th>
                                            <th>Yayın Tarihi</th>
                                            <th>Revizyon Tarihi</th>
                                            <th>Geçerlilik Durumu</th>
                                            <th>İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={activeTab === 'Personel Sertifikaları' ? '8' : ['Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar', 'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler', 'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler', 'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar'].includes(activeTab) ? '8' : '7'} className="text-center py-8 text-muted-foreground">Yükleniyor...</td></tr>
                                        ) : filteredDocuments.length === 0 ? (
                                            <tr><td colSpan={activeTab === 'Personel Sertifikaları' ? '8' : ['Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar', 'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler', 'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler', 'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar'].includes(activeTab) ? '8' : '7'} className="text-center py-8 text-muted-foreground">Bu kategoride doküman bulunmuyor.</td></tr>
                                        ) : (
                                            filteredDocuments.map((doc, index) => {
                                                const revision = doc.document_revisions;
                                                const fileName = revision?.attachments?.[0]?.name;
                                                const hasFile = !!revision?.attachments?.[0]?.path;

                                                return (
                                                <motion.tr
                                                    key={doc.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                                >
                                                    <td className="font-medium text-foreground">
                                                        <div>{doc.title}</div>
                                                        <div className="text-xs text-muted-foreground">{doc.document_number}</div>
                                                    </td>
                                                    {activeTab === 'Personel Sertifikaları' && <td>{doc.personnel?.full_name || doc.owner?.full_name || 'N/A'}</td>}
                                                    {['Prosedürler', 'Talimatlar', 'Formlar', 'El Kitapları', 'Şemalar', 'Görev Tanımları', 'Süreçler', 'Planlar', 'Listeler', 'Şartnameler', 'Politikalar', 'Tablolar', 'Antetler', 'Sözleşmeler', 'Yönetmelikler', 'Kontrol Planları', 'FMEA Planları', 'Proses Kontrol Kartları', 'Görsel Yardımcılar'].includes(activeTab) && (
                                                        <td className="text-muted-foreground">{doc.department?.unit_name || '-'}</td>
                                                    )}
                                                    <td className="text-muted-foreground">{revision?.revision_number || '-'}</td>
                                                    <td className="text-muted-foreground">{revision ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</td>
                                                    <td className="text-muted-foreground">{revision?.created_at ? format(new Date(revision.created_at), 'dd.MM.yyyy', { locale: tr }) : '-'}</td>
                                                    <td><ValidityStatus validUntil={doc.valid_until} /></td>
                                                    <td className="flex items-center gap-2 flex-wrap">
                                                        <Button variant="ghost" size="sm" onClick={() => handleViewPdf(revision, doc.title, doc.document_type)} disabled={!hasFile}><Eye className="w-4 h-4 mr-1" /> Görüntüle</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => downloadPdf(revision, fileName, doc.document_type)} disabled={!hasFile}><FileDown className="w-4 h-4 mr-1" /> İndir</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleReviseDocument(doc)}><RefreshCw className="w-4 h-4 mr-1" /> Revize Et</Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenUploadModal(doc)}><Edit className="w-4 h-4" /></Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                  <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                                  <AlertDialogDescription>
                                                                    Bu dokümanı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                                                  </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                  <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                  <AlertDialogAction onClick={() => deleteDocument(doc)}>Sil</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </td>
                                                </motion.tr>
                                            )})
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    export default DocumentModule;