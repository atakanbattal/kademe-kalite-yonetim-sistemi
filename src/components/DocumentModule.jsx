import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, 
    Search, 
    FileText, 
    Folder,
    Grid3x3,
    List,
    Filter,
    Download,
    Eye,
    Edit,
    Trash2,
    Building2,
    Users,
    Package
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import UploadDocumentModal from '@/components/document/UploadDocumentModal';
import DocumentFolderTree from '@/components/document/DocumentFolderTree';
import DocumentAdvancedSearch from '@/components/document/DocumentAdvancedSearch';
import DocumentDetailModal from '@/components/document/DocumentDetailModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const BUCKET_NAME = 'documents';

const DocumentModule = () => {
    const { toast } = useToast();
    const { productionDepartments, suppliers, personnel, loading: dataLoading, refreshData } = useData();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
    const [selectedSupplierId, setSelectedSupplierId] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        department_id: null,
        document_type: null,
        document_subcategory: null,
        approval_status: null,
        classification: null,
        owner_id: null,
        tags: [],
        keywords: []
    });
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'departments', 'suppliers'

    useEffect(() => {
        loadDocuments();
    }, [selectedFolderId, selectedDepartmentId, selectedSupplierId, activeTab]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('documents')
                .select(`
                    *,
                    department:department_id(unit_name, unit_code),
                    supplier:supplier_id(name, supplier_code),
                    owner:owner_id(full_name, email),
                    folder:folder_id(folder_name, folder_path),
                    current_revision:current_revision_id(*)
                `)
                .eq('is_archived', false)
                .order('created_at', { ascending: false });

            // Klasör filtresi
            if (selectedFolderId) {
                query = query.eq('folder_id', selectedFolderId);
            }

            // Birim filtresi
            if (selectedDepartmentId) {
                query = query.eq('department_id', selectedDepartmentId);
            }

            // Tedarikçi filtresi
            if (selectedSupplierId) {
                query = query.eq('supplier_id', selectedSupplierId);
            }

            // Tab filtresi
            if (activeTab === 'departments') {
                query = query.not('department_id', 'is', null);
            } else if (activeTab === 'suppliers') {
                query = query.not('supplier_id', 'is', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dokümanlar yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredDocuments = useMemo(() => {
        let filtered = documents;

        // Arama filtresi
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(doc => {
                const titleMatch = doc.title?.toLowerCase().includes(searchLower);
                const docNumberMatch = doc.document_number?.toLowerCase().includes(searchLower);
                const descriptionMatch = doc.description?.toLowerCase().includes(searchLower);
                const ownerMatch = doc.owner?.full_name?.toLowerCase().includes(searchLower);
                const deptMatch = doc.department?.unit_name?.toLowerCase().includes(searchLower);
                const tagMatch = doc.tags?.some(tag => tag.toLowerCase().includes(searchLower));
                const keywordMatch = doc.keywords?.some(kw => kw.toLowerCase().includes(searchLower));
                
                return titleMatch || docNumberMatch || descriptionMatch || ownerMatch || deptMatch || tagMatch || keywordMatch;
            });
        }

        // Gelişmiş filtreler
        if (filters.department_id) {
            filtered = filtered.filter(doc => doc.department_id === filters.department_id);
        }
        if (filters.document_type) {
            filtered = filtered.filter(doc => doc.document_type === filters.document_type);
        }
        if (filters.document_subcategory) {
            filtered = filtered.filter(doc => 
                doc.document_subcategory?.toLowerCase().includes(filters.document_subcategory.toLowerCase())
            );
        }
        if (filters.approval_status) {
            filtered = filtered.filter(doc => doc.approval_status === filters.approval_status);
        }
        if (filters.classification) {
            filtered = filtered.filter(doc => doc.classification === filters.classification);
        }
        if (filters.owner_id) {
            filtered = filtered.filter(doc => doc.owner_id === filters.owner_id);
        }
        if (filters.tags.length > 0) {
            filtered = filtered.filter(doc => 
                doc.tags && filters.tags.some(tag => doc.tags.includes(tag))
            );
        }
        if (filters.keywords.length > 0) {
            filtered = filtered.filter(doc => 
                doc.keywords && filters.keywords.some(kw => doc.keywords.includes(kw))
            );
        }

        return filtered;
    }, [documents, searchTerm, filters]);

    const handleDeleteDocument = async (doc) => {
        try {
            // Dosyayı storage'dan sil
            if (doc.current_revision?.attachments?.[0]?.path) {
                await supabase.storage.from(BUCKET_NAME).remove([doc.current_revision.attachments[0].path]);
            }

            // Veritabanından sil (soft delete)
            const { error } = await supabase
                .from('documents')
                .update({ is_archived: true, archived_at: new Date().toISOString() })
                .eq('id', doc.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Doküman silindi.'
            });

            loadDocuments();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Doküman silinemedi: ' + error.message
            });
        }
    };

    const handleViewDocument = (doc) => {
        setSelectedDocument(doc);
        setIsDetailModalOpen(true);
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'Yayınlandı': { variant: 'success', className: 'bg-green-100 text-green-800' },
            'Onaylandı': { variant: 'success', className: 'bg-green-100 text-green-800' },
            'Onay Bekliyor': { variant: 'warning', className: 'bg-yellow-100 text-yellow-800' },
            'Taslak': { variant: 'secondary', className: 'bg-gray-100 text-gray-800' },
            'Reddedildi': { variant: 'destructive', className: 'bg-red-100 text-red-800' }
        };

        const config = statusConfig[status] || { variant: 'default', className: 'bg-gray-100 text-gray-800' };

        return (
            <Badge className={config.className}>
                {status}
            </Badge>
        );
    };

    const getValidityBadge = (validUntil) => {
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
            return <Badge className="bg-yellow-500 text-white">{diffDays} gün kaldı</Badge>;
        }
        return <Badge className="bg-green-600 text-white">{diffDays} gün kaldı</Badge>;
    };

    return (
        <div className="space-y-6">
            <UploadDocumentModal
                isOpen={isUploadModalOpen}
                setIsOpen={setUploadModalOpen}
                refreshDocuments={loadDocuments}
                categories={['Prosedürler', 'Talimatlar', 'Formlar', 'Kalite Sertifikaları', 'Personel Sertifikaları', 'Diğer']}
                personnelList={personnel}
                existingDocument={null}
                preselectedCategory={null}
            />

            <DocumentDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                document={selectedDocument}
                onRefresh={loadDocuments}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Doküman Yönetim Sistemi</h1>
                    <p className="text-muted-foreground mt-1">
                        Tüm dokümanlarınızı profesyonelce yönetin ve organize edin.
                    </p>
                </div>
                <Button onClick={() => setUploadModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Doküman
                </Button>
            </div>

            {/* Ana İçerik */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sol Sidebar - Klasörler ve Filtreler */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardContent className="p-4">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-4">
                                    <TabsTrigger value="all" className="text-xs">Tümü</TabsTrigger>
                                    <TabsTrigger value="departments" className="text-xs">
                                        <Building2 className="h-3 w-3 mr-1" />
                                        Birimler
                                    </TabsTrigger>
                                    <TabsTrigger value="suppliers" className="text-xs">
                                        <Package className="h-3 w-3 mr-1" />
                                        Tedarikçiler
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="all" className="mt-0">
                                    <DocumentFolderTree
                                        selectedFolderId={selectedFolderId}
                                        onFolderSelect={(id) => {
                                            setSelectedFolderId(id);
                                            setSelectedDepartmentId(null);
                                            setSelectedSupplierId(null);
                                        }}
                                        refreshTrigger={0}
                                    />
                                </TabsContent>

                                <TabsContent value="departments" className="mt-0">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Birim Seçin</Label>
                                        <Select
                                            value={selectedDepartmentId || ''}
                                            onValueChange={(value) => {
                                                setSelectedDepartmentId(value || null);
                                                setSelectedFolderId(null);
                                                setSelectedSupplierId(null);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tüm birimler" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">Tüm birimler</SelectItem>
                                                {productionDepartments.map(dept => (
                                                    <SelectItem key={dept.id} value={dept.id}>
                                                        {dept.unit_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedDepartmentId && (
                                            <DocumentFolderTree
                                                selectedFolderId={selectedFolderId}
                                                onFolderSelect={(id) => {
                                                    setSelectedFolderId(id);
                                                    setSelectedSupplierId(null);
                                                }}
                                                departmentId={selectedDepartmentId}
                                                refreshTrigger={0}
                                            />
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="suppliers" className="mt-0">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Tedarikçi Seçin</Label>
                                        <Select
                                            value={selectedSupplierId || ''}
                                            onValueChange={(value) => {
                                                setSelectedSupplierId(value || null);
                                                setSelectedFolderId(null);
                                                setSelectedDepartmentId(null);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Tüm tedarikçiler" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">Tüm tedarikçiler</SelectItem>
                                                {suppliers.map(supplier => (
                                                    <SelectItem key={supplier.id} value={supplier.id}>
                                                        {supplier.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedSupplierId && (
                                            <DocumentFolderTree
                                                selectedFolderId={selectedFolderId}
                                                onFolderSelect={(id) => {
                                                    setSelectedFolderId(id);
                                                    setSelectedDepartmentId(null);
                                                }}
                                                supplierId={selectedSupplierId}
                                                refreshTrigger={0}
                                            />
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Ana İçerik Alanı */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Arama ve Filtreler */}
                    <Card>
                        <CardContent className="p-4">
                            <DocumentAdvancedSearch
                                onSearchChange={setSearchTerm}
                                onFilterChange={setFilters}
                            />
                        </CardContent>
                    </Card>

                    {/* Görünüm Kontrolleri */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {filteredDocuments.length} doküman bulundu
                            </span>
                            {selectedFolderId && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                    <Folder className="h-3 w-3" />
                                    Klasör filtrelendi
                                </Badge>
                            )}
                            {selectedDepartmentId && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {productionDepartments.find(d => d.id === selectedDepartmentId)?.unit_name}
                                </Badge>
                            )}
                            {selectedSupplierId && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    {suppliers.find(s => s.id === selectedSupplierId)?.name}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Doküman Listesi/Grid */}
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : filteredDocuments.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    {searchTerm || Object.values(filters).some(v => v !== null && (Array.isArray(v) ? v.length > 0 : true))
                                        ? 'Arama kriterlerinize uygun doküman bulunamadı.'
                                        : 'Henüz doküman eklenmemiş.'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredDocuments.map((doc, index) => (
                                <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                >
                                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                                        <CardContent className="p-4 flex flex-col flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                                                        {doc.title}
                                                    </h3>
                                                    {doc.document_number && (
                                                        <p className="text-xs text-muted-foreground mb-2">
                                                            {doc.document_number}
                                                        </p>
                                                    )}
                                                </div>
                                                {getStatusBadge(doc.approval_status)}
                                            </div>

                                            <div className="space-y-2 mb-3 flex-1">
                                                {doc.department && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Building2 className="h-3 w-3" />
                                                        {doc.department.unit_name}
                                                    </div>
                                                )}
                                                {doc.folder && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Folder className="h-3 w-3" />
                                                        <span className="truncate">{doc.folder.folder_path}</span>
                                                    </div>
                                                )}
                                                {doc.current_revision && (
                                                    <div className="text-sm text-muted-foreground">
                                                        Revizyon {doc.current_revision.revision_number}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t">
                                                <div>
                                                    {getValidityBadge(doc.valid_until)}
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleViewDocument(doc)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="text-destructive">
                                                                <Trash2 className="h-4 w-4" />
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
                                                                <AlertDialogAction onClick={() => handleDeleteDocument(doc)}>
                                                                    Sil
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-4 font-semibold">Doküman</th>
                                                <th className="text-left p-4 font-semibold">Birim</th>
                                                <th className="text-left p-4 font-semibold">Klasör</th>
                                                <th className="text-left p-4 font-semibold">Revizyon</th>
                                                <th className="text-left p-4 font-semibold">Durum</th>
                                                <th className="text-left p-4 font-semibold">Geçerlilik</th>
                                                <th className="text-left p-4 font-semibold">İşlemler</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDocuments.map((doc, index) => (
                                                <motion.tr
                                                    key={doc.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.3, delay: index * 0.02 }}
                                                    className="border-b hover:bg-muted/50 cursor-pointer"
                                                    onClick={() => handleViewDocument(doc)}
                                                >
                                                    <td className="p-4">
                                                        <div className="font-medium">{doc.title}</div>
                                                        {doc.document_number && (
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {doc.document_number}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {doc.department?.unit_name || '-'}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                            <Folder className="h-3 w-3" />
                                                            {doc.folder?.folder_path || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {doc.current_revision?.revision_number || '-'}
                                                    </td>
                                                    <td className="p-4">
                                                        {getStatusBadge(doc.approval_status)}
                                                    </td>
                                                    <td className="p-4">
                                                        {getValidityBadge(doc.valid_until)}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleViewDocument(doc)}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button size="sm" variant="ghost" className="text-destructive">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Bu dokümanı kalıcı olarak silmek istediğinizden emin misiniz?
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteDocument(doc)}>
                                                                            Sil
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentModule;
