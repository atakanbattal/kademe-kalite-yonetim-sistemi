import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, Download, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';

const DocumentManagement = ({ equipment, documents, loading, refreshDocuments, refreshEquipment }) => {
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [file, setFile] = useState(null);
    const [formData, setFormData] = useState({
        equipment_id: null,
        document_type: '',
        document_name: '',
        document_number: '',
        revision_number: 0,
        revision_date: null
    });

    const equipmentOptions = equipment.map(eq => ({
        value: eq.id,
        label: `${eq.equipment_code} - ${eq.equipment_name}`
    }));

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
        },
        maxFiles: 1
    });

    const filteredDocuments = documents.filter(doc => {
        const searchLower = searchTerm.toLowerCase();
        return (
            doc.document_name?.toLowerCase().includes(searchLower) ||
            doc.document_number?.toLowerCase().includes(searchLower) ||
            doc.document_type?.toLowerCase().includes(searchLower) ||
            doc.process_control_equipment?.equipment_name?.toLowerCase().includes(searchLower)
        );
    });

    const handleOpenForm = (doc = null) => {
        if (doc) {
            setSelectedDocument(doc);
            setFormData({
                equipment_id: doc.equipment_id,
                document_type: doc.document_type || '',
                document_name: doc.document_name || '',
                document_number: doc.document_number || '',
                revision_number: doc.revision_number || 0,
                revision_date: doc.revision_date || null
            });
            setFile(null);
        } else {
            setSelectedDocument(null);
            setFormData({
                equipment_id: null,
                document_type: '',
                document_name: '',
                document_number: '',
                revision_number: 0,
                revision_date: null
            });
            setFile(null);
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.equipment_id || !formData.document_name || !formData.document_type) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen zorunlu alanları doldurun.' });
            return;
        }

        if (!selectedDocument && !file) {
            toast({ variant: 'destructive', title: 'Eksik Dosya', description: 'Lütfen bir dosya yükleyin.' });
            return;
        }

        try {
            let filePath = selectedDocument?.file_path;
            let fileName = selectedDocument?.file_name;
            let fileSize = selectedDocument?.file_size;
            let fileType = selectedDocument?.file_type;

            if (file) {
                const sanitizedName = sanitizeFileName(file.name);
                const newFilePath = `documents/${uuidv4()}-${sanitizedName}`;
                const { error: uploadError } = await supabase
                    .storage
                    .from('process_control')
                    .upload(newFilePath, file);
                
                if (uploadError) throw uploadError;
                
                filePath = newFilePath;
                fileName = sanitizedName;
                fileSize = file.size;
                fileType = file.type;
            }

            const documentData = {
                ...formData,
                file_path: filePath,
                file_name: fileName,
                file_size: fileSize,
                file_type: fileType,
                revision_date: formData.revision_date || new Date().toISOString().split('T')[0]
            };

            if (selectedDocument) {
                const { error } = await supabase
                    .from('process_control_documents')
                    .update(documentData)
                    .eq('id', selectedDocument.id);
                
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Doküman güncellendi.' });
            } else {
                const { error } = await supabase
                    .from('process_control_documents')
                    .insert([documentData]);
                
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Doküman eklendi.' });
            }
            
            setIsFormOpen(false);
            refreshDocuments();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu dokümanı silmek istediğinizden emin misiniz?')) return;
        
        try {
            const { error } = await supabase
                .from('process_control_documents')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            toast({ title: 'Başarılı', description: 'Doküman silindi.' });
            refreshDocuments();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleDownload = async (doc) => {
        try {
            const { data, error } = await supabase
                .storage
                .from('process_control')
                .download(doc.file_path);
            
            if (error) throw error;
            
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Dosya indirilemedi.' });
        }
    };

    const handleView = async (doc) => {
        try {
            const { data, error } = await supabase
                .storage
                .from('process_control')
                .createSignedUrl(doc.file_path, 3600);
            
            if (error) throw error;
            
            window.open(data.signedUrl, '_blank');
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Dosya açılamadı.' });
        }
    };

    return (
        <div className="space-y-4">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDocument ? 'Doküman Düzenle' : 'Yeni Doküman Ekle'}
                        </DialogTitle>
                        <DialogDescription>
                            Proses kontrol aracına ait dokümanı ekleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div>
                                <Label>Araç (*)</Label>
                                <Combobox
                                    options={equipmentOptions}
                                    value={formData.equipment_id}
                                    onChange={(v) => setFormData({ ...formData, equipment_id: v })}
                                    placeholder="Araç seçin..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Doküman Tipi (*)</Label>
                                    <Combobox
                                        options={[
                                            { value: 'Teknik Resim', label: 'Teknik Resim' },
                                            { value: 'Kontrol Planı', label: 'Kontrol Planı' },
                                            { value: 'İş Talimatı', label: 'İş Talimatı' },
                                            { value: 'Diğer', label: 'Diğer' }
                                        ]}
                                        value={formData.document_type}
                                        onChange={(v) => setFormData({ ...formData, document_type: v })}
                                        placeholder="Doküman tipi seçin..."
                                    />
                                </div>
                                <div>
                                    <Label>Doküman Adı (*)</Label>
                                    <Input
                                        value={formData.document_name}
                                        onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Doküman Numarası</Label>
                                    <Input
                                        value={formData.document_number}
                                        onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Revizyon Numarası</Label>
                                    <Input
                                        type="number"
                                        value={formData.revision_number}
                                        onChange={(e) => setFormData({ ...formData, revision_number: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Revizyon Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.revision_date || ''}
                                    onChange={(e) => setFormData({ ...formData, revision_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Dosya {selectedDocument ? '(Değiştirmek için yeni dosya seçin)' : '(*)'}</Label>
                                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                                    <input {...getInputProps()} />
                                    {file ? (
                                        <p className="text-sm">{file.name}</p>
                                    ) : selectedDocument ? (
                                        <p className="text-sm text-muted-foreground">Mevcut dosya: {selectedDocument.file_name}</p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Dosyayı buraya sürükleyin veya seçin</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                                İptal
                            </Button>
                            <Button type="submit">Kaydet</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Doküman adı, numarası veya araç ile ara..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <Plus className="w-4 h-4 mr-2" /> Yeni Doküman
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="p-3 text-left">Araç</th>
                            <th className="p-3 text-left">Doküman Adı</th>
                            <th className="p-3 text-left">Tip</th>
                            <th className="p-3 text-left">Doküman No</th>
                            <th className="p-3 text-left">Revizyon</th>
                            <th className="p-3 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-muted-foreground">
                                    Yükleniyor...
                                </td>
                            </tr>
                        ) : filteredDocuments.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-muted-foreground">
                                    Doküman bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            filteredDocuments.map((doc) => (
                                <tr key={doc.id} className="border-t hover:bg-muted/50">
                                    <td className="p-3">
                                        {doc.process_control_equipment?.equipment_name || '-'}
                                    </td>
                                    <td className="p-3 font-medium">{doc.document_name}</td>
                                    <td className="p-3">{doc.document_type}</td>
                                    <td className="p-3">{doc.document_number || '-'}</td>
                                    <td className="p-3">Rev.{doc.revision_number || 0}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleView(doc)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDownload(doc)}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenForm(doc)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(doc.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DocumentManagement;

