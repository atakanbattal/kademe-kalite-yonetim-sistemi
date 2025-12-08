import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Search, FileText, Plus, Eye, FileDown, Edit, Trash2, History, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from 'framer-motion';

const DepartmentDocumentsView = ({ 
    documents, 
    departments, 
    onViewDocument, 
    onEditDocument, 
    onDeleteDocument, 
    onAddDocument,
    onViewRevisionHistory 
}) => {
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    const filteredDocuments = useMemo(() => {
        let filtered = documents.filter(doc => {
            // Arşivlenmiş dokümanları gösterme
            if (doc.is_archived) return false;

            // Birim filtresi
            if (selectedDepartment !== 'all') {
                const deptId = doc.department_id || doc.department?.id;
                if (deptId !== selectedDepartment) return false;
            }

            // Kategori filtresi
            if (selectedCategory !== 'all') {
                if (doc.document_type !== selectedCategory) return false;
            }

            // Arama filtresi
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const titleMatch = doc.title?.toLowerCase().includes(search);
                const docNumberMatch = doc.document_number?.toLowerCase().includes(search);
                const keywordMatch = doc.keywords?.some(k => k.toLowerCase().includes(search));
                const tagMatch = doc.tags?.some(t => t.toLowerCase().includes(search));
                
                if (!titleMatch && !docNumberMatch && !keywordMatch && !tagMatch) {
                    return false;
                }
            }

            return true;
        });

        // Birim ve kategoriye göre sırala
        return filtered.sort((a, b) => {
            const aDate = new Date(a.created_at || 0);
            const bDate = new Date(b.created_at || 0);
            return bDate - aDate;
        });
    }, [documents, selectedDepartment, selectedCategory, searchTerm]);

    const documentsByDepartment = useMemo(() => {
        const grouped = {};
        filteredDocuments.forEach(doc => {
            const deptId = doc.department_id || doc.department?.id || 'unknown';
            const deptName = doc.department?.unit_name || doc.department_name || 'Belirtilmemiş';
            
            if (!grouped[deptId]) {
                grouped[deptId] = {
                    id: deptId,
                    name: deptName,
                    documents: []
                };
            }
            grouped[deptId].documents.push(doc);
        });
        return Object.values(grouped);
    }, [filteredDocuments]);

    const categories = useMemo(() => {
        const cats = new Set();
        documents.forEach(doc => {
            if (doc.document_type) {
                cats.add(doc.document_type);
            }
        });
        return Array.from(cats).sort();
    }, [documents]);

    const handleDepartmentSelect = (deptId) => {
        setSelectedDepartment(deptId);
    };

    return (
        <div className="space-y-6">
            {/* Filtreler */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Birim Seç</label>
                            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tüm Birimler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Birimler</SelectItem>
                                    {departments?.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.unit_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Kategori</label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tüm Kategoriler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Ara</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Doküman adı, numara, anahtar kelime..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Birim Bazlı Görünüm */}
            {selectedDepartment === 'all' ? (
                <div className="space-y-4">
                    {documentsByDepartment.map((deptGroup, idx) => (
                        <Card key={deptGroup.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        {deptGroup.name}
                                        <Badge variant="secondary">{deptGroup.documents.length} doküman</Badge>
                                    </CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDepartmentSelect(deptGroup.id)}
                                    >
                                        Tümünü Gör
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {deptGroup.documents.slice(0, 6).map((doc) => (
                                        <DocumentCard
                                            key={doc.id}
                                            document={doc}
                                            onView={onViewDocument}
                                            onEdit={onEditDocument}
                                            onDelete={onDeleteDocument}
                                            onViewHistory={onViewRevisionHistory}
                                        />
                                    ))}
                                </div>
                                {deptGroup.documents.length > 6 && (
                                    <div className="mt-4 text-center">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleDepartmentSelect(deptGroup.id)}
                                        >
                                            {deptGroup.documents.length - 6} doküman daha göster
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>
                                    {documentsByDepartment.find(d => d.id === selectedDepartment)?.name || 'Seçili Birim'}
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setSelectedDepartment('all')}>
                                        Tüm Birimler
                                    </Button>
                                    {onAddDocument && (
                                        <Button onClick={() => onAddDocument(selectedDepartment)}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Yeni Doküman
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredDocuments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Bu birimde doküman bulunmuyor.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocuments.map((doc) => (
                                        <DocumentCard
                                            key={doc.id}
                                            document={doc}
                                            onView={onViewDocument}
                                            onEdit={onEditDocument}
                                            onDelete={onDeleteDocument}
                                            onViewHistory={onViewRevisionHistory}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

const DocumentCard = ({ document, onView, onEdit, onDelete, onViewHistory }) => {
    const revision = document.document_revisions || document.current_revision;
    const hasFile = !!revision?.attachments?.[0]?.path;

    const getStatusBadge = () => {
        const status = document.approval_status || document.status;
        const statusConfig = {
            'Yayınlandı': { variant: 'success', className: 'bg-green-100 text-green-800' },
            'Onaylandı': { variant: 'default', className: 'bg-blue-100 text-blue-800' },
            'Onay Bekliyor': { variant: 'warning', className: 'bg-yellow-100 text-yellow-800' },
            'Taslak': { variant: 'secondary', className: 'bg-gray-100 text-gray-800' },
            'Reddedildi': { variant: 'destructive', className: 'bg-red-100 text-red-800' }
        };
        const config = statusConfig[status] || { className: 'bg-gray-100 text-gray-800' };
        return <Badge className={config.className}>{status}</Badge>;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-base mb-1 line-clamp-2">
                                {document.title}
                            </CardTitle>
                            {document.document_number && (
                                <p className="text-xs text-muted-foreground">
                                    {document.document_number}
                                </p>
                            )}
                        </div>
                        {getStatusBadge()}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Kategori:</span>
                            <span className="font-medium">{document.document_type || '-'}</span>
                        </div>
                        {revision && (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Versiyon:</span>
                                    <span className="font-medium">{revision.revision_number || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Yayın Tarihi:</span>
                                    <span className="font-medium">
                                        {revision.publish_date 
                                            ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr })
                                            : '-'}
                                    </span>
                                </div>
                            </>
                        )}
                        {document.next_review_date && (
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Sonraki Revizyon:</span>
                                <span className="font-medium text-orange-600">
                                    {format(new Date(document.next_review_date), 'dd.MM.yyyy', { locale: tr })}
                                </span>
                            </div>
                        )}
                    </div>

                    {document.tags && document.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {document.tags.slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                            {document.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                    +{document.tags.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(document)}
                            disabled={!hasFile}
                            className="flex-1"
                        >
                            <Eye className="h-4 w-4 mr-1" />
                            Görüntüle
                        </Button>
                        {onViewHistory && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onViewHistory(document)}
                                title="Revizyon Geçmişi"
                            >
                                <History className="h-4 w-4" />
                            </Button>
                        )}
                        {onEdit && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(document)}
                                title="Düzenle"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}
                        {onDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                                        title="Sil"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Bu dokümanı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(document)}>
                                            Sil
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default DepartmentDocumentsView;

