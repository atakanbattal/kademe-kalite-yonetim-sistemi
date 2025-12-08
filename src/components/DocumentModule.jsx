import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Search, FileText, Badge as Certificate, HardHat, FileDown, Eye, Trash2, Edit } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
    import UploadDocumentModal from '@/components/document/UploadDocumentModal';
    import { Badge } from '@/components/ui/badge';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { useData } from '@/contexts/DataContext';
    import PdfViewerModal from '@/components/document/PdfViewerModal';

    const DOCUMENT_CATEGORIES = [
      { value: 'Kalite Sertifikaları', label: 'Kalite Sertifikaları', icon: Certificate, addText: 'Yeni Kalite Sertifikası Ekle' },
      { value: 'Personel Sertifikaları', label: 'Personel Sertifikaları', icon: HardHat, addText: 'Yeni Personel Sertifikası Ekle' },
      { value: 'Prosedürler', label: 'Prosedürler', icon: FileText, addText: 'Yeni Prosedür Ekle' },
      { value: 'Talimatlar', label: 'Talimatlar', icon: FileText, addText: 'Yeni Talimat Ekle' },
      { value: 'Formlar', label: 'Formlar', icon: FileText, addText: 'Yeni Form Ekle' },
      { value: 'Diğer', label: 'Diğer', icon: FileText, addText: 'Yeni Doküman Ekle' },
    ];

    const BUCKET_NAME = 'documents';

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
        const { documents, personnel, loading, refreshData } = useData();
        const [isUploadModalOpen, setUploadModalOpen] = useState(false);
        const [editingDocument, setEditingDocument] = useState(null);
        const [searchTerm, setSearchTerm] = useState('');
        const [activeTab, setActiveTab] = useState(DOCUMENT_CATEGORIES[0].value);
        const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });

        const filteredDocuments = useMemo(() => {
            let docs = documents
                .filter(doc => doc.document_type === activeTab)
                .map(doc => {
                    // document_revisions bir array ise, current_revision_id ile eşleşeni bul
                    let revision = doc.document_revisions;
                    if (Array.isArray(revision) && doc.current_revision_id) {
                        revision = revision.find(r => r.id === doc.current_revision_id) || revision[0] || null;
                    }
                    return { ...doc, document_revisions: revision };
                })
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (searchTerm) {
                const lowercasedFilter = searchTerm.toLowerCase();
                docs = docs.filter(doc => {
                    const titleMatch = doc.title?.toLowerCase().includes(lowercasedFilter);
                    const personnelMatch = activeTab === 'Personel Sertifikaları' && doc.personnel?.full_name?.toLowerCase().includes(lowercasedFilter);
                    return titleMatch || personnelMatch;
                });
            }
            return docs;
        }, [documents, activeTab, searchTerm]);
        
        const downloadPdf = async (revision, fileName) => {
            const filePath = revision?.attachments?.[0]?.path;
            if (!filePath) {
                 toast({ variant: 'destructive', title: 'Hata', description: 'İndirilecek dosya yolu bulunamadı.' });
                return;
            }
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

        const handleOpenUploadModal = (doc = null) => {
            setEditingDocument(doc);
            setUploadModalOpen(true);
        };

        const handleViewPdf = async (revision, title) => {
            const filePath = revision?.attachments?.[0]?.path;
            if (!filePath) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya yolu bulunamadı.' });
                return;
            }
            
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

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                        {DOCUMENT_CATEGORIES.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="flex-1"
                            >
                                <Icon className="w-4 h-4 mr-2" /> {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent value={activeTab} className="pt-6">
                        <div className="dashboard-widget">
                             <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                                <div className="relative w-full sm:max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Doküman veya personel adı ile ara..." 
                                        className="pl-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
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
                                            <th>Versiyon</th>
                                            <th>Yayın Tarihi</th>
                                            <th>Geçerlilik Durumu</th>
                                            <th>İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="6" className="text-center py-8 text-muted-foreground">Yükleniyor...</td></tr>
                                        ) : filteredDocuments.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-8 text-muted-foreground">Bu kategoride doküman bulunmuyor.</td></tr>
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
                                                    {activeTab === 'Personel Sertifikaları' && <td>{doc.personnel?.full_name || 'N/A'}</td>}
                                                    <td className="text-muted-foreground">{revision?.revision_number || '-'}</td>
                                                    <td className="text-muted-foreground">{revision ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</td>
                                                    <td><ValidityStatus validUntil={doc.valid_until} /></td>
                                                    <td className="flex items-center gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => handleViewPdf(revision, doc.title)} disabled={!hasFile}><Eye className="w-4 h-4 mr-1" /> Görüntüle</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => downloadPdf(revision, fileName)} disabled={!hasFile}><FileDown className="w-4 h-4 mr-1" /> İndir</Button>
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
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    export default DocumentModule;