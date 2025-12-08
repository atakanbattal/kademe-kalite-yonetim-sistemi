import React, { useState, useEffect } from 'react';
import { Plus, Download, Trash2, Upload, FileText, Image, File, Eye, Search, Filter, Calendar, Tag, Link2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { sanitizeFileName } from '@/lib/utils';
import { useData } from '@/contexts/DataContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const DOCUMENT_TYPES = [
    'Aksiyon Planı',
    'Kalite Belgesi',
    'Test Raporu',
    'Denetim Raporu',
    '8D Raporu',
    'İyileştirme Planı',
    'Görsel',
    'Video',
    'Email',
    'Sertifika',
    'Diğer'
];

const BUCKET_NAME = 'supplier_documents';

const SupplierDocumentsTab = ({ suppliers, loading: suppliersLoading, refreshData }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { nonConformities, supplierAuditPlans } = useData();
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isUploadOpen, setUploadOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [docType, setDocType] = useState('Aksiyon Planı');
    const [docDescription, setDocDescription] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [tags, setTags] = useState('');
    const [relatedNcId, setRelatedNcId] = useState('none');
    const [relatedAuditId, setRelatedAuditId] = useState('none');
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    // Tedarikçi seçildiğinde veya filtreler değiştiğinde dokümanları yükle
    useEffect(() => {
        loadDocuments();
    }, [selectedSupplier, filterType, filterStatus, searchTerm]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('supplier_documents')
                .select('*, suppliers!supplier_documents_supplier_id_fkey(name)')
                .order('uploaded_at', { ascending: false });
            
            // Eğer tedarikçi seçiliyse filtrele
            if (selectedSupplier) {
                query = query.eq('supplier_id', selectedSupplier.id);
            }

            if (filterType !== 'all') {
                query = query.eq('document_type', filterType);
            }
            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Arama filtresi
            let filtered = data || [];
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(doc => {
                    const supplierName = doc.suppliers?.name?.toLowerCase() || '';
                    return doc.document_name?.toLowerCase().includes(term) ||
                        doc.document_description?.toLowerCase().includes(term) ||
                        supplierName.includes(term) ||
                        doc.tags?.some(tag => tag.toLowerCase().includes(term));
                });
            }

            setDocuments(filtered);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        } finally {
            setLoading(false);
        }
    };
    
    // Arama terimi değiştiğinde dokümanları filtrele (client-side)
    useEffect(() => {
        if (!loading && documents.length > 0) {
            const term = searchTerm.toLowerCase();
            if (term) {
                const filtered = documents.filter(doc => {
                    const supplierName = doc.suppliers?.name?.toLowerCase() || '';
                    return doc.document_name?.toLowerCase().includes(term) ||
                        doc.document_description?.toLowerCase().includes(term) ||
                        supplierName.includes(term) ||
                        doc.tags?.some(tag => tag.toLowerCase().includes(term));
                });
                // Not: Bu filtreleme zaten loadDocuments içinde yapılıyor, burada tekrar yapmaya gerek yok
                // Ama searchTerm değiştiğinde loadDocuments çağrılmalı
            }
        }
    }, [searchTerm]);

    const handleFileSelect = (e) => {
        setSelectedFiles(Array.from(e.target.files));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast({ variant: 'destructive', title: 'Dosya seçilmedi!' });
            return;
        }
        if (!selectedSupplier || selectedSupplier === null) {
            toast({ variant: 'destructive', title: 'Lütfen bir tedarikçi seçin! (Tüm Tedarikçiler seçeneği ile yükleme yapılamaz)' });
            return;
        }

        setIsUploading(true);
        try {
            for (const file of selectedFiles) {
                const sanitizedFileName = sanitizeFileName(file.name);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 9);
                const filePath = `suppliers/${selectedSupplier.id}/${timestamp}-${randomStr}-${sanitizedFileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type || 'application/octet-stream'
                    });
                
                if (uploadError) throw uploadError;

                const fileExt = file.name.split('.').pop();
                const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                
                // Önce documents tablosuna kayıt oluştur
                const { data: documentData, error: documentError } = await supabase
                    .from('documents')
                    .insert({
                        title: file.name,
                        document_type: docType,
                        document_category: docType,
                        supplier_id: selectedSupplier.id,
                        user_id: user?.id,
                        tags: tagsArray.length > 0 ? tagsArray : null,
                        valid_until: expiryDate || null,
                        status: 'Aktif'
                    })
                    .select('id')
                    .single();
                
                if (documentError) throw documentError;
                if (!documentData?.id) throw new Error('Document kaydı oluşturulamadı');
                
                // Sonra supplier_documents tablosuna kayıt ekle
                const { error: dbError } = await supabase.from('supplier_documents').insert({
                    supplier_id: selectedSupplier.id,
                    document_id: documentData.id,
                    document_type: docType,
                    document_name: file.name,
                    document_category: docType,
                    document_description: docDescription || null,
                    file_path: filePath,
                    file_type: fileExt,
                    file_size: file.size,
                    uploaded_by: user?.id,
                    expiry_date: expiryDate || null,
                    tags: tagsArray.length > 0 ? tagsArray : null,
                    related_nc_id: relatedNcId && relatedNcId !== 'none' ? relatedNcId : null,
                    related_audit_id: relatedAuditId && relatedAuditId !== 'none' ? relatedAuditId : null,
                    status: 'Aktif'
                });
                
                if (dbError) throw dbError;
            }

            toast({ title: 'Başarılı!', description: `${selectedFiles.length} dosya yüklendi.` });
            setSelectedFiles([]);
            setDocDescription('');
            setExpiryDate('');
            setTags('');
            setRelatedNcId('none');
            setRelatedAuditId('none');
            setUploadOpen(false);
            loadDocuments();
            if (refreshData) refreshData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Yükleme hatası', description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const deleteDocument = async (doc) => {
        try {
            await supabase.storage.from(BUCKET_NAME).remove([doc.file_path]);
            const { error } = await supabase.from('supplier_documents').delete().eq('id', doc.id);
            if (error) throw error;
            toast({ title: 'Başarılı', description: 'Doküman silindi.' });
            loadDocuments();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: error.message });
        }
    };

    const downloadDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(doc.file_path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.document_name;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'İndirme hatası', description: error.message });
        }
    };

    const viewDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(doc.file_path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            window.open(url, '_blank');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Görüntüleme hatası', description: error.message });
        }
    };

    const getFileIcon = (type) => {
        const lowerType = type?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lowerType)) return <Image className="w-5 h-5 text-blue-500" />;
        if (['pdf'].includes(lowerType)) return <FileText className="w-5 h-5 text-red-500" />;
        if (['doc', 'docx'].includes(lowerType)) return <FileText className="w-5 h-5 text-blue-600" />;
        if (['xls', 'xlsx'].includes(lowerType)) return <FileText className="w-5 h-5 text-green-600" />;
        if (['mp4', 'avi', 'mov'].includes(lowerType)) return <File className="w-5 h-5 text-purple-500" />;
        return <File className="w-5 h-5" />;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getRelatedNcTitle = (ncId) => {
        if (!ncId) return null;
        const nc = nonConformities?.find(n => n.id === ncId);
        return nc ? nc.nc_number || nc.title : null;
    };

    const getRelatedAuditTitle = (auditId) => {
        if (!auditId) return null;
        const audit = supplierAuditPlans?.find(a => a.id === auditId);
        return audit ? audit.audit_number || `Denetim ${audit.audit_date}` : null;
    };

    return (
        <div className="space-y-6">
            {/* Tedarikçi Seçimi */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">Tedarikçi Doküman Yönetimi</h3>
                            <p className="text-sm text-muted-foreground">Tedarikçilerden gelen tüm dokümanları yönetin</p>
                        </div>
                        <Button onClick={() => {
                            if (!selectedSupplier) {
                                toast({ variant: 'destructive', title: 'Lütfen bir tedarikçi seçin! (Tüm Tedarikçiler seçeneği ile yükleme yapılamaz)' });
                                return;
                            }
                            setUploadOpen(true);
                        }}>
                            <Upload className="w-4 h-4 mr-2" />
                            Dosya Yükle
                        </Button>
                    </div>
                    
                    <div className="mb-4">
                        <Label>Tedarikçi Seç</Label>
                        <Select value={selectedSupplier?.id || 'all'} onValueChange={(value) => {
                            if (value === 'all') {
                                setSelectedSupplier(null);
                            } else {
                                const supplier = suppliers.find(s => s.id === value);
                                setSelectedSupplier(supplier || null);
                            }
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tedarikçi seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
                                {suppliers.map(supplier => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Filtreler - Tüm Tedarikçiler seçildiğinde de görünür */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Doküman ara..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Doküman Tipi" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Tipler</SelectItem>
                                {DOCUMENT_TYPES.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Durum" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Durumlar</SelectItem>
                                <SelectItem value="Aktif">Aktif</SelectItem>
                                <SelectItem value="Arşiv">Arşiv</SelectItem>
                                <SelectItem value="İptal">İptal</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Doküman Listesi */}
            {loading ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <p>Yükleniyor...</p>
                    </CardContent>
                </Card>
            ) : documents.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Henüz doküman yüklenmemiş.</p>
                        <Button onClick={() => setUploadOpen(true)} className="mt-4">
                            <Upload className="w-4 h-4 mr-2" />
                            İlk Dokümanı Yükle
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {documents.map(doc => (
                        <Card key={doc.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    {/* Dosya İkonu */}
                                    <div className="flex-shrink-0">
                                        {getFileIcon(doc.file_type)}
                                    </div>
                                    
                                    {/* Doküman Bilgileri */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="font-medium truncate" title={doc.document_name}>
                                                {doc.document_name}
                                            </div>
                                            <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                            {doc.status !== 'Aktif' && (
                                                <Badge variant={doc.status === 'Arşiv' ? 'secondary' : 'destructive'} className="text-xs">
                                                    {doc.status}
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        {/* Tedarikçi adı (tüm tedarikçiler görüntülenirken) */}
                                        {!selectedSupplier && doc.suppliers && (
                                            <div className="text-xs text-muted-foreground mb-1">
                                                Tedarikçi: {doc.suppliers.name}
                                            </div>
                                        )}
                                        
                                        {/* Açıklama */}
                                        {doc.document_description && (
                                            <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                                                {doc.document_description}
                                            </p>
                                        )}
                                        
                                        {/* Meta Bilgiler */}
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(doc.uploaded_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                            </div>
                                            {doc.file_size && (
                                                <div>Boyut: {formatFileSize(doc.file_size)}</div>
                                            )}
                                            {doc.expiry_date && (
                                                <div className={new Date(doc.expiry_date) < new Date() ? 'text-red-500' : ''}>
                                                    Geçerlilik: {format(new Date(doc.expiry_date), 'dd.MM.yyyy', { locale: tr })}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* İlişkili Kayıtlar ve Etiketler */}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            {doc.related_nc_id && (
                                                <Badge variant="outline" className="text-xs">
                                                    <Link2 className="w-3 h-3 mr-1" />
                                                    NC: {getRelatedNcTitle(doc.related_nc_id) || 'Bilinmiyor'}
                                                </Badge>
                                            )}
                                            {doc.related_audit_id && (
                                                <Badge variant="outline" className="text-xs">
                                                    <Link2 className="w-3 h-3 mr-1" />
                                                    Denetim: {getRelatedAuditTitle(doc.related_audit_id) || 'Bilinmiyor'}
                                                </Badge>
                                            )}
                                            {doc.tags && doc.tags.length > 0 && doc.tags.slice(0, 3).map((tag, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                    <Tag className="w-3 h-3 mr-1" />
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Aksiyon Butonları */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button size="sm" variant="outline" onClick={() => viewDocument(doc)}>
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)}>
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Bu doküman kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={() => deleteDocument(doc)} 
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Sil
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Yükleme Modal */}
            {isUploadOpen && (
                <Dialog open={isUploadOpen} onOpenChange={setUploadOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Doküman Yükle</DialogTitle>
                            <DialogDescription>
                                {selectedSupplier ? `${selectedSupplier.name} için doküman yükleyin` : 'Lütfen önce bir tedarikçi seçin'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                        <div>
                            <Label>Doküman Tipi <span className="text-red-500">*</span></Label>
                            <Select value={docType} onValueChange={setDocType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[100]">
                                    {DOCUMENT_TYPES.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="file">Dosya Seç <span className="text-red-500">*</span></Label>
                            <Input 
                                id="file" 
                                type="file" 
                                multiple 
                                onChange={handleFileSelect}
                                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                            />
                            {selectedFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {selectedFiles.map((file, idx) => (
                                        <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                            <File className="w-4 h-4" />
                                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="description">Açıklama</Label>
                            <Textarea 
                                id="description" 
                                value={docDescription} 
                                onChange={(e) => setDocDescription(e.target.value)} 
                                rows={3}
                                placeholder="Doküman hakkında açıklama..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="expiry_date">Geçerlilik Tarihi</Label>
                                <Input 
                                    id="expiry_date" 
                                    type="date" 
                                    value={expiryDate} 
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="tags">Etiketler</Label>
                                <Input 
                                    id="tags" 
                                    value={tags} 
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="virgülle ayırın: örn: kalite, test, rapor"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>İlgili Uygunsuzluk (NC)</Label>
                                <Select value={relatedNcId} onValueChange={setRelatedNcId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz (opsiyonel)" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[100]">
                                        <SelectItem value="none">Yok</SelectItem>
                                        {nonConformities
                                            ?.filter(nc => nc.supplier_id === selectedSupplier?.id)
                                            .map(nc => (
                                                <SelectItem key={nc.id} value={nc.id}>
                                                    {nc.nc_number || nc.title}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>İlgili Denetim</Label>
                                <Select value={relatedAuditId} onValueChange={setRelatedAuditId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz (opsiyonel)" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[100]">
                                        <SelectItem value="none">Yok</SelectItem>
                                        {supplierAuditPlans
                                            ?.filter(audit => audit.supplier_id === selectedSupplier?.id)
                                            .map(audit => (
                                                <SelectItem key={audit.id} value={audit.id}>
                                                    {audit.audit_number || `Denetim ${audit.audit_date}`}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>
                            İptal
                        </Button>
                        <Button 
                            onClick={handleUpload} 
                            disabled={isUploading || selectedFiles.length === 0 || !selectedSupplier}
                        >
                            {isUploading ? 'Yükleniyor...' : `Yükle (${selectedFiles.length} dosya)`}
                        </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

export default SupplierDocumentsTab;

