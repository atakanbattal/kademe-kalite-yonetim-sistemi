import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Search, FileText, Plus, Eye, FileDown, Edit, Trash2, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from 'framer-motion';

const SUPPLIER_DOCUMENT_CATEGORIES = [
    'Kalite Sertifikası',
    'Test Raporu',
    'Teknik Şartname',
    'İrsaliye',
    'Fatura',
    'Sertifika',
    'Diğer'
];

const SupplierDocumentsView = ({ 
    onViewDocument, 
    onEditDocument, 
    onDeleteDocument, 
    onAddDocument 
}) => {
    const { toast } = useToast();
    const { suppliers } = useData();
    const [supplierDocuments, setSupplierDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadSupplierDocuments();
    }, []);

    const loadSupplierDocuments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_documents_view')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSupplierDocuments(data || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Tedarikçi dokümanları yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredDocuments = useMemo(() => {
        let filtered = supplierDocuments;

        // Tedarikçi filtresi
        if (selectedSupplier !== 'all') {
            filtered = filtered.filter(doc => doc.supplier_id === selectedSupplier);
        }

        // Kategori filtresi
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(doc => doc.document_category === selectedCategory);
        }

        // Arama filtresi
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(doc => {
                const titleMatch = doc.title?.toLowerCase().includes(search);
                const supplierMatch = doc.supplier_name?.toLowerCase().includes(search);
                const docNumberMatch = doc.document_number?.toLowerCase().includes(search);
                return titleMatch || supplierMatch || docNumberMatch;
            });
        }

        return filtered;
    }, [supplierDocuments, selectedSupplier, selectedCategory, searchTerm]);

    const documentsBySupplier = useMemo(() => {
        const grouped = {};
        filteredDocuments.forEach(doc => {
            const supplierId = doc.supplier_id;
            const supplierName = doc.supplier_name || 'Bilinmeyen Tedarikçi';
            
            if (!grouped[supplierId]) {
                grouped[supplierId] = {
                    id: supplierId,
                    name: supplierName,
                    code: doc.supplier_code,
                    documents: []
                };
            }
            grouped[supplierId].documents.push(doc);
        });
        return Object.values(grouped);
    }, [filteredDocuments]);

    const getExpiryStatus = (expiryDate, isValid) => {
        if (!expiryDate) return null;
        if (!isValid) {
            return <Badge variant="destructive">Geçersiz</Badge>;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return <Badge variant="destructive">Süresi Doldu ({Math.abs(diffDays)} gün önce)</Badge>;
        }
        if (diffDays <= 30) {
            return <Badge className="bg-yellow-100 text-yellow-800">{diffDays} gün kaldı</Badge>;
        }
        return <Badge className="bg-green-100 text-green-800">{diffDays} gün kaldı</Badge>;
    };

    return (
        <div className="space-y-6">
            {/* Filtreler */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Tedarikçi</label>
                            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tüm Tedarikçiler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
                                    {suppliers?.map(supplier => (
                                        <SelectItem key={supplier.id} value={supplier.id}>
                                            {supplier.name}
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
                                    {SUPPLIER_DOCUMENT_CATEGORIES.map(cat => (
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
                                    placeholder="Doküman adı, tedarikçi..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tedarikçi Bazlı Görünüm */}
            {selectedSupplier === 'all' ? (
                <div className="space-y-4">
                    {documentsBySupplier.map((supplierGroup) => (
                        <Card key={supplierGroup.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        {supplierGroup.name}
                                        {supplierGroup.code && (
                                            <Badge variant="outline">{supplierGroup.code}</Badge>
                                        )}
                                        <Badge variant="secondary">{supplierGroup.documents.length} doküman</Badge>
                                    </CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedSupplier(supplierGroup.id)}
                                    >
                                        Tümünü Gör
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {supplierGroup.documents.slice(0, 6).map((doc) => (
                                        <SupplierDocumentCard
                                            key={doc.id}
                                            document={doc}
                                            onView={onViewDocument}
                                            onEdit={onEditDocument}
                                            onDelete={onDeleteDocument}
                                            getExpiryStatus={getExpiryStatus}
                                        />
                                    ))}
                                </div>
                                {supplierGroup.documents.length > 6 && (
                                    <div className="mt-4 text-center">
                                        <Button
                                            variant="outline"
                                            onClick={() => setSelectedSupplier(supplierGroup.id)}
                                        >
                                            {supplierGroup.documents.length - 6} doküman daha göster
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
                                    {documentsBySupplier.find(d => d.id === selectedSupplier)?.name || 'Seçili Tedarikçi'}
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setSelectedSupplier('all')}>
                                        Tüm Tedarikçiler
                                    </Button>
                                    {onAddDocument && (
                                        <Button onClick={() => onAddDocument(selectedSupplier)}>
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
                                    Bu tedarikçide doküman bulunmuyor.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocuments.map((doc) => (
                                        <SupplierDocumentCard
                                            key={doc.id}
                                            document={doc}
                                            onView={onViewDocument}
                                            onEdit={onEditDocument}
                                            onDelete={onDeleteDocument}
                                            getExpiryStatus={getExpiryStatus}
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

const SupplierDocumentCard = ({ document, onView, onEdit, onDelete, getExpiryStatus }) => {
    const revision = document.revision_number;
    const hasFile = !!document.file_path;

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
                        <Badge variant="outline">{document.document_category}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Tedarikçi:</span>
                            <span className="font-medium">{document.supplier_name}</span>
                        </div>
                        {revision && (
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Versiyon:</span>
                                <span className="font-medium">{revision}</span>
                            </div>
                        )}
                        {document.document_date && (
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Doküman Tarihi:</span>
                                <span className="font-medium">
                                    {format(new Date(document.document_date), 'dd.MM.yyyy', { locale: tr })}
                                </span>
                            </div>
                        )}
                        {document.expiry_date && (
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Geçerlilik:</span>
                                {getExpiryStatus(document.expiry_date, document.is_valid)}
                            </div>
                        )}
                    </div>

                    {document.validation_notes && (
                        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            <strong>Not:</strong> {document.validation_notes}
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
                                            Bu dokümanı silmek istediğinizden emin misiniz?
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

export default SupplierDocumentsView;

