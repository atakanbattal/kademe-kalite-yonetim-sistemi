import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Folder, 
    FolderOpen, 
    ChevronRight, 
    ChevronDown, 
    Plus, 
    Edit, 
    Trash2, 
    FileText,
    MoreVertical
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';

const DocumentFolderTree = ({ 
    selectedFolderId, 
    onFolderSelect, 
    departmentId = null,
    supplierId = null,
    refreshTrigger = 0 
}) => {
    const { toast } = useToast();
    const { productionDepartments, suppliers } = useData();
    const [folders, setFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [folderFormData, setFolderFormData] = useState({
        folder_name: '',
        parent_folder_id: null,
        folder_type: departmentId ? 'Birim' : supplierId ? 'Tedarikçi' : 'Genel',
        department_id: departmentId,
        supplier_id: supplierId,
        folder_category: '',
        description: '',
        color: '#3b82f6'
    });

    useEffect(() => {
        loadFolders();
    }, [departmentId, supplierId, refreshTrigger]);

    const loadFolders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('document_folders')
                .select('*')
                .eq('is_archived', false)
                .order('display_order', { ascending: true })
                .order('folder_name', { ascending: true });

            if (departmentId) {
                query = query.eq('department_id', departmentId);
            } else if (supplierId) {
                query = query.eq('supplier_id', supplierId);
            } else {
                query = query.or(`department_id.is.null,supplier_id.is.null`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setFolders(data || []);
            
            // Kök klasörleri otomatik aç
            const rootFolders = (data || []).filter(f => !f.parent_folder_id);
            setExpandedFolders(new Set(rootFolders.map(f => f.id)));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Klasörler yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const buildFolderTree = (folders) => {
        const folderMap = new Map();
        const rootFolders = [];

        // Tüm klasörleri map'e ekle
        folders.forEach(folder => {
            folderMap.set(folder.id, { ...folder, children: [] });
        });

        // Hiyerarşiyi oluştur
        folders.forEach(folder => {
            const folderNode = folderMap.get(folder.id);
            if (folder.parent_folder_id) {
                const parent = folderMap.get(folder.parent_folder_id);
                if (parent) {
                    parent.children.push(folderNode);
                } else {
                    rootFolders.push(folderNode);
                }
            } else {
                rootFolders.push(folderNode);
            }
        });

        return rootFolders;
    };

    const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

    const toggleFolder = (folderId) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        setExpandedFolders(newExpanded);
    };

    const handleCreateFolder = async () => {
        if (!folderFormData.folder_name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Klasör adı gereklidir.'
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('document_folders')
                .insert({
                    ...folderFormData,
                    folder_path: folderFormData.folder_name // Trigger otomatik güncelleyecek
                })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Klasör oluşturuldu.'
            });

            setIsCreateModalOpen(false);
            setFolderFormData({
                folder_name: '',
                parent_folder_id: null,
                folder_type: departmentId ? 'Birim' : supplierId ? 'Tedarikçi' : 'Genel',
                department_id: departmentId,
                supplier_id: supplierId,
                folder_category: '',
                description: '',
                color: '#3b82f6'
            });
            loadFolders();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Klasör oluşturulamadı: ' + error.message
            });
        }
    };

    const handleEditFolder = async () => {
        if (!folderFormData.folder_name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Klasör adı gereklidir.'
            });
            return;
        }

        try {
            const { error } = await supabase
                .from('document_folders')
                .update({
                    folder_name: folderFormData.folder_name,
                    folder_category: folderFormData.folder_category,
                    description: folderFormData.description,
                    color: folderFormData.color
                })
                .eq('id', editingFolder.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Klasör güncellendi.'
            });

            setIsEditModalOpen(false);
            setEditingFolder(null);
            loadFolders();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Klasör güncellenemedi: ' + error.message
            });
        }
    };

    const handleDeleteFolder = async (folderId) => {
        if (!confirm('Bu klasörü silmek istediğinizden emin misiniz? İçindeki tüm dokümanlar da silinecektir.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('document_folders')
                .update({ is_archived: true })
                .eq('id', folderId);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Klasör silindi.'
            });

            loadFolders();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Klasör silinemedi: ' + error.message
            });
        }
    };

    const openEditModal = (folder) => {
        setEditingFolder(folder);
        setFolderFormData({
            folder_name: folder.folder_name,
            parent_folder_id: folder.parent_folder_id,
            folder_type: folder.folder_type,
            department_id: folder.department_id,
            supplier_id: folder.supplier_id,
            folder_category: folder.folder_category || '',
            description: folder.description || '',
            color: folder.color || '#3b82f6'
        });
        setIsEditModalOpen(true);
    };

    const renderFolder = (folder, level = 0) => {
        const isExpanded = expandedFolders.has(folder.id);
        const isSelected = selectedFolderId === folder.id;
        const hasChildren = folder.children && folder.children.length > 0;

        return (
            <div key={folder.id}>
                <div
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                        isSelected ? 'bg-primary/10 border border-primary' : ''
                    }`}
                    style={{ paddingLeft: `${level * 20 + 8}px` }}
                    onClick={() => {
                        onFolderSelect(folder.id);
                        if (hasChildren) {
                            toggleFolder(folder.id);
                        }
                    }}
                >
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFolder(folder.id);
                            }}
                            className="p-0.5 hover:bg-muted rounded"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>
                    ) : (
                        <div className="w-5" />
                    )}
                    
                    <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: folder.color || '#3b82f6' }}
                    />
                    
                    {isExpanded ? (
                        <FolderOpen className="h-4 w-4 text-primary" />
                    ) : (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                    )}
                    
                    <span className="flex-1 text-sm font-medium truncate">
                        {folder.folder_name}
                    </span>
                    
                    {folder.folder_category && (
                        <Badge variant="outline" className="text-xs">
                            {folder.folder_category}
                        </Badge>
                    )}
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(folder)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => handleDeleteFolder(folder.id)}
                                className="text-destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                
                {isExpanded && hasChildren && (
                    <div>
                        {folder.children.map(child => renderFolder(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const getAllFoldersFlat = (tree, result = []) => {
        tree.forEach(folder => {
            result.push(folder);
            if (folder.children) {
                getAllFoldersFlat(folder.children, result);
            }
        });
        return result;
    };

    const availableParentFolders = useMemo(() => {
        const allFolders = getAllFoldersFlat(folderTree);
        return allFolders.filter(f => 
            !editingFolder || f.id !== editingFolder.id
        );
    }, [folderTree, editingFolder]);

    if (loading) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                Klasörler yükleniyor...
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-semibold">Klasörler</h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Yeni Klasör
                </Button>
            </div>

            <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {folderTree.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                        Henüz klasör oluşturulmamış.
                    </div>
                ) : (
                    folderTree.map(folder => renderFolder(folder))
                )}
            </div>

            {/* Yeni Klasör Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yeni Klasör Oluştur</DialogTitle>
                        <DialogDescription>
                            Dokümanlarınızı organize etmek için yeni bir klasör oluşturun.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Klasör Adı *</Label>
                            <Input
                                value={folderFormData.folder_name}
                                onChange={(e) => setFolderFormData(prev => ({ ...prev, folder_name: e.target.value }))}
                                placeholder="Örn: Kalite Prosedürleri"
                            />
                        </div>
                        <div>
                            <Label>Üst Klasör</Label>
                            <Select
                                value={folderFormData.parent_folder_id || ''}
                                onValueChange={(value) => setFolderFormData(prev => ({ ...prev, parent_folder_id: value || null }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Üst klasör seçin (opsiyonel)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Kök Klasör</SelectItem>
                                    {availableParentFolders.map(folder => (
                                        <SelectItem key={folder.id} value={folder.id}>
                                            {folder.folder_path || folder.folder_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Kategori</Label>
                            <Select
                                value={folderFormData.folder_category}
                                onValueChange={(value) => setFolderFormData(prev => ({ ...prev, folder_category: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategori seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Genel</SelectItem>
                                    <SelectItem value="Prosedürler">Prosedürler</SelectItem>
                                    <SelectItem value="Talimatlar">Talimatlar</SelectItem>
                                    <SelectItem value="Formlar">Formlar</SelectItem>
                                    <SelectItem value="Sertifikalar">Sertifikalar</SelectItem>
                                    <SelectItem value="Tedarikçi Dokümanları">Tedarikçi Dokümanları</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Açıklama</Label>
                            <Input
                                value={folderFormData.description}
                                onChange={(e) => setFolderFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Klasör açıklaması (opsiyonel)"
                            />
                        </div>
                        <div>
                            <Label>Renk</Label>
                            <Input
                                type="color"
                                value={folderFormData.color}
                                onChange={(e) => setFolderFormData(prev => ({ ...prev, color: e.target.value }))}
                                className="h-10"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleCreateFolder}>
                            Oluştur
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Düzenle Klasör Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Klasörü Düzenle</DialogTitle>
                        <DialogDescription>
                            Klasör bilgilerini güncelleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Klasör Adı *</Label>
                            <Input
                                value={folderFormData.folder_name}
                                onChange={(e) => setFolderFormData(prev => ({ ...prev, folder_name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Kategori</Label>
                            <Select
                                value={folderFormData.folder_category}
                                onValueChange={(value) => setFolderFormData(prev => ({ ...prev, folder_category: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategori seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Genel</SelectItem>
                                    <SelectItem value="Prosedürler">Prosedürler</SelectItem>
                                    <SelectItem value="Talimatlar">Talimatlar</SelectItem>
                                    <SelectItem value="Formlar">Formlar</SelectItem>
                                    <SelectItem value="Sertifikalar">Sertifikalar</SelectItem>
                                    <SelectItem value="Tedarikçi Dokümanları">Tedarikçi Dokümanları</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Açıklama</Label>
                            <Input
                                value={folderFormData.description}
                                onChange={(e) => setFolderFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Renk</Label>
                            <Input
                                type="color"
                                value={folderFormData.color}
                                onChange={(e) => setFolderFormData(prev => ({ ...prev, color: e.target.value }))}
                                className="h-10"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleEditFolder}>
                            Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DocumentFolderTree;

