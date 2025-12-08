import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, 
    Search, 
    FileText, 
    Badge as Certificate, 
    HardHat, 
    FileDown, 
    Eye, 
    Trash2, 
    Edit,
    Building2,
    Package,
    LayoutGrid,
    List,
    History,
    Filter,
    Download,
    Upload
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import UploadDocumentModal from '@/components/document/UploadDocumentModal';
import DocumentDashboard from '@/components/document/DocumentDashboard';
import DepartmentDocumentsView from '@/components/document/DepartmentDocumentsView';
import SupplierDocumentsView from '@/components/document/SupplierDocumentsView';
import RevisionHistoryModal from '@/components/document/RevisionHistoryModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DOCUMENT_CATEGORIES = [
    { value: 'Kalite Sertifikaları', label: 'Kalite Sertifikaları', icon: Certificate },
    { value: 'Personel Sertifikaları', label: 'Personel Sertifikaları', icon: HardHat },
    { value: 'Prosedürler', label: 'Prosedürler', icon: FileText },
    { value: 'Talimatlar', label: 'Talimatlar', icon: FileText },
    { value: 'Formlar', label: 'Formlar', icon: FileText },
    { value: 'Diğer', label: 'Diğer', icon: FileText },
];

const BUCKET_NAME = 'documents';

const ValidityStatus = ({ validUntil, nextReviewDate }) => {
    if (nextReviewDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reviewDate = new Date(nextReviewDate);
        const diffTime = reviewDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return <Badge variant="destructive">Revizyon Gerekli ({Math.abs(diffDays)} gün geçti)</Badge>;
        }
        if (diffDays <= 30) {
            return <Badge className="bg-orange-100 text-orange-800">Revizyon Yaklaşıyor ({diffDays} gün)</Badge>;
        }
    }

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
        return <Badge className="bg-yellow-100 text-yellow-800">{diffDays} gün kaldı</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">{diffDays} gün kaldı</Badge>;
};

const DocumentModule = () => {
    const { toast } = useToast();
    const { documents, personnel, productionDepartments, suppliers, loading, refreshData } = useData();
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMainTab, setActiveMainTab] = useState('dashboard'); // 'dashboard', 'by-department', 'by-category', 'suppliers'
    const [activeCategoryTab, setActiveCategoryTab] = useState(DOCUMENT_CATEGORIES[0].value);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });
    const [revisionHistoryState, setRevisionHistoryState] = useState({ isOpen: false, document: null });
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [selectedSupplier, setSelectedSupplier] = useState(null);

    // Dokümanları yükle ve ilişkileri dahil et
    const enrichedDocuments = useMemo(() => {
        if (!documents || documents.length === 0) return [];
        
        return documents.map(doc => {
            // Department bilgisini ekle
            const department = productionDepartments?.find(d => d.id === doc.department_id) || 
                              (doc.department ? { id: doc.department.id, unit_name: doc.department.unit_name } : null);
            
            return {
                ...doc,
                department,
                department_name: department?.unit_name || doc.department_name
            };
        });
    }, [documents, productionDepartments]);

    const filteredDocuments = useMemo(() => {
        let docs = enrichedDocuments.filter(doc => {
            // Arşivlenmiş dokümanları filtreleme seçeneği
            if (activeMainTab !== 'archived' && doc.is_archived) return false;
            if (activeMainTab === 'archived' && !doc.is_archived) return false;

            // Kategori filtresi (by-category tab'ında)
            if (activeMainTab === 'by-category' && doc.document_type !== activeCategoryTab) {
                return false;
            }

            return true;
        });

        // Arama filtresi
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            docs = docs.filter(doc => {
                const titleMatch = doc.title?.toLowerCase().includes(lowercasedFilter);
                const docNumberMatch = doc.document_number?.toLowerCase().includes(lowercasedFilter);
                const personnelMatch = doc.personnel?.full_name?.toLowerCase().includes(lowercasedFilter);
                const keywordMatch = doc.keywords?.some(k => k.toLowerCase().includes(lowercasedFilter));
                const tagMatch = doc.tags?.some(t => t.toLowerCase().includes(lowercasedFilter));
                const deptMatch = doc.department_name?.toLowerCase().includes(lowercasedFilter);
                
                return titleMatch || docNumberMatch || personnelMatch || keywordMatch || tagMatch || deptMatch;
            });
        }

        // Sıralama
        return docs.sort((a, b) => {
            const aDate = new Date(a.created_at || 0);
            const bDate = new Date(b.created_at || 0);
            return bDate - aDate;
        });
    }, [enrichedDocuments, activeMainTab, activeCategoryTab, searchTerm]);

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
        a.download = fileName || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const deleteDocument = async (doc) => {
        try {
            // Dosyaları sil
            if (doc.current_revision_id) {
                const { data: revision } = await supabase
                    .from('document_revisions')
                    .select('attachments')
                    .eq('id', doc.current_revision_id)
                    .single();
                
                if (revision?.attachments?.length > 0) {
                    const paths = revision.attachments.map(att => att.path).filter(Boolean);
                    if (paths.length > 0) {
                        await supabase.storage.from(BUCKET_NAME).remove(paths);
                    }
                }
            }

            // Veritabanından sil
            const { error: dbError } = await supabase
                .from('documents')
                .delete()
                .eq('id', doc.id);
            
            if (dbError) throw dbError;
            
            toast({ title: 'Başarılı', description: 'Doküman başarıyla silindi.' });
            refreshData();
        } catch (error) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata', 
                description: 'Doküman silinemedi: ' + error.message 
            });
        }
    };

    const handleOpenUploadModal = (doc = null, departmentId = null, supplierId = null) => {
        setEditingDocument(doc);
        setSelectedDepartment(departmentId);
        setSelectedSupplier(supplierId);
        setUploadModalOpen(true);
    };

    const handleViewPdf = async (revision, title) => {
        const filePath = revision?.attachments?.[0]?.path;
        if (!filePath) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya yolu bulunamadı.' });
            return;
        }
        
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `PDF görüntülenemedi: ${error.message}` });
                return;
            }
            
            const blob = new Blob([data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            
            setPdfViewerState({ isOpen: true, url: blobUrl, title });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'PDF açılırken bir hata oluştu.' });
            console.error('PDF view error:', err);
        }
    };

    const handleViewRevisionHistory = (document) => {
        setRevisionHistoryState({ isOpen: true, document });
    };

    return (
        <div className="space-y-6">
            {/* Modals */}
            <UploadDocumentModal 
                isOpen={isUploadModalOpen} 
                setIsOpen={setUploadModalOpen} 
                refreshDocuments={refreshData} 
                categories={DOCUMENT_CATEGORIES.map(c => c.value)}
                personnelList={personnel}
                existingDocument={editingDocument}
                preselectedCategory={activeCategoryTab}
                preselectedDepartment={selectedDepartment}
                preselectedSupplier={selectedSupplier}
            />
            <PdfViewerModal 
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(isOpen) => setPdfViewerState(s => ({...s, isOpen}))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />
            <RevisionHistoryModal
                isOpen={revisionHistoryState.isOpen}
                setIsOpen={(isOpen) => setRevisionHistoryState(s => ({...s, isOpen}))}
                document={revisionHistoryState.document}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Doküman Yönetim Sistemi (QDMS)</h1>
                    <p className="text-muted-foreground mt-1">
                        Profesyonel doküman yönetimi: Birim bazlı organizasyon, revizyon takibi ve tedarikçi dokümanları
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => handleOpenUploadModal()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni Doküman
                    </Button>
                </div>
            </div>

            {/* Ana Tab'lar */}
            <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                    <TabsTrigger value="dashboard">
                        <LayoutGrid className="w-4 h-4 mr-2" />
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="by-department">
                        <Building2 className="w-4 h-4 mr-2" />
                        Birim Bazlı
                    </TabsTrigger>
                    <TabsTrigger value="by-category">
                        <FileText className="w-4 h-4 mr-2" />
                        Kategori Bazlı
                    </TabsTrigger>
                    <TabsTrigger value="suppliers">
                        <Package className="w-4 h-4 mr-2" />
                        Tedarikçi Dokümanları
                    </TabsTrigger>
                </TabsList>

                {/* Dashboard Tab */}
                <TabsContent value="dashboard" className="pt-6">
                    <DocumentDashboard documents={enrichedDocuments} loading={loading} />
                </TabsContent>

                {/* Birim Bazlı Tab */}
                <TabsContent value="by-department" className="pt-6">
                    <DepartmentDocumentsView
                        documents={enrichedDocuments}
                        departments={productionDepartments}
                        onViewDocument={(doc) => {
                            const revision = doc.document_revisions || doc.current_revision;
                            handleViewPdf(revision, doc.title);
                        }}
                        onEditDocument={(doc) => handleOpenUploadModal(doc)}
                        onDeleteDocument={deleteDocument}
                        onAddDocument={(deptId) => handleOpenUploadModal(null, deptId)}
                        onViewRevisionHistory={handleViewRevisionHistory}
                    />
                </TabsContent>

                {/* Kategori Bazlı Tab */}
                <TabsContent value="by-category" className="pt-6">
                    <div className="space-y-6">
                        {/* Kategori Seçimi */}
                        <div className="flex items-center gap-4">
                            <Tabs value={activeCategoryTab} onValueChange={setActiveCategoryTab}>
                                <TabsList>
                                    {DOCUMENT_CATEGORIES.map(({ value, label, icon: Icon }) => (
                                        <TabsTrigger key={value} value={value}>
                                            <Icon className="w-4 h-4 mr-2" />
                                            {label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Arama ve Filtreler */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Doküman adı, numara, anahtar kelime ile ara..." 
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                                    size="icon"
                                    onClick={() => setViewMode('grid')}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'outline'}
                                    size="icon"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Doküman Listesi */}
                        <div className="dashboard-widget">
                            {loading ? (
                                <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Bu kategoride doküman bulunmuyor.
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocuments.map((doc, index) => {
                                        const revision = doc.document_revisions || doc.current_revision;
                                        const fileName = revision?.attachments?.[0]?.name;
                                        const hasFile = !!revision?.attachments?.[0]?.path;

                                        return (
                                            <motion.div
                                                key={doc.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                            >
                                                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1">
                                                            <h3 className="font-semibold mb-1">{doc.title}</h3>
                                                            {doc.document_number && (
                                                                <p className="text-xs text-muted-foreground">{doc.document_number}</p>
                                                            )}
                                                        </div>
                                                        {doc.department_name && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {doc.department_name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-2 text-sm mb-4">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Versiyon:</span>
                                                            <span className="font-medium">{revision?.revision_number || '-'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Yayın:</span>
                                                            <span className="font-medium">
                                                                {revision?.publish_date 
                                                                    ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr })
                                                                    : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Durum:</span>
                                                            <ValidityStatus 
                                                                validUntil={doc.valid_until} 
                                                                nextReviewDate={doc.next_review_date}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 pt-3 border-t">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleViewPdf(revision, doc.title)}
                                                            disabled={!hasFile}
                                                            className="flex-1"
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            Görüntüle
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleViewRevisionHistory(doc)}
                                                            title="Revizyon Geçmişi"
                                                        >
                                                            <History className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleOpenUploadModal(doc)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Doküman Adı / Numarası</th>
                                                <th>Birim</th>
                                                <th>Versiyon</th>
                                                <th>Yayın Tarihi</th>
                                                <th>Durum</th>
                                                <th>İşlemler</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDocuments.map((doc, index) => {
                                                const revision = doc.document_revisions || doc.current_revision;
                                                const fileName = revision?.attachments?.[0]?.name;
                                                const hasFile = !!revision?.attachments?.[0]?.path;

                                                return (
                                                    <motion.tr
                                                        key={doc.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                                    >
                                                        <td className="font-medium">
                                                            <div>{doc.title}</div>
                                                            {doc.document_number && (
                                                                <div className="text-xs text-muted-foreground">{doc.document_number}</div>
                                                            )}
                                                        </td>
                                                        <td>{doc.department_name || '-'}</td>
                                                        <td>{revision?.revision_number || '-'}</td>
                                                        <td>
                                                            {revision?.publish_date 
                                                                ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr })
                                                                : '-'}
                                                        </td>
                                                        <td>
                                                            <ValidityStatus 
                                                                validUntil={doc.valid_until} 
                                                                nextReviewDate={doc.next_review_date}
                                                            />
                                                        </td>
                                                        <td className="flex items-center gap-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => handleViewPdf(revision, doc.title)} 
                                                                disabled={!hasFile}
                                                            >
                                                                <Eye className="w-4 h-4 mr-1" /> Görüntüle
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => downloadPdf(revision, fileName)} 
                                                                disabled={!hasFile}
                                                            >
                                                                <FileDown className="w-4 h-4 mr-1" /> İndir
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleViewRevisionHistory(doc)}
                                                                title="Revizyon Geçmişi"
                                                            >
                                                                <History className="w-4 h-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleOpenUploadModal(doc)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
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
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Tedarikçi Dokümanları Tab */}
                <TabsContent value="suppliers" className="pt-6">
                    <SupplierDocumentsView
                        onViewDocument={(doc) => {
                            // Tedarikçi dokümanları için özel görüntüleme
                            const filePath = doc.file_path;
                            if (filePath) {
                                supabase.storage.from(BUCKET_NAME).download(filePath).then(({ data, error }) => {
                                    if (!error && data) {
                                        const blob = new Blob([data], { type: 'application/pdf' });
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        setPdfViewerState({ isOpen: true, url: blobUrl, title: doc.title });
                                    }
                                });
                            }
                        }}
                        onEditDocument={(doc) => handleOpenUploadModal(doc, null, doc.supplier_id)}
                        onDeleteDocument={async (doc) => {
                            try {
                                await supabase.from('supplier_documents').delete().eq('id', doc.id);
                                toast({ title: 'Başarılı', description: 'Doküman silindi.' });
                                refreshData();
                            } catch (error) {
                                toast({ variant: 'destructive', title: 'Hata', description: error.message });
                            }
                        }}
                        onAddDocument={(supplierId) => handleOpenUploadModal(null, null, supplierId)}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default DocumentModule;
