import React, { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, AlertTriangle, FileText, Package } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';

const NotesManagement = ({ equipment, documents, notes, loading, refreshNotes, refreshEquipment, refreshDocuments, onOpenNCForm }) => {
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [files, setFiles] = useState([]);
    const [formData, setFormData] = useState({
        equipment_id: null,
        note_type: '',
        title: '',
        description: '',
        part_code: '',
        part_name: '',
        document_id: null,
        drawing_revision: '',
        drawing_location: '',
        status: 'Açık',
        priority: 'Normal'
    });

    const equipmentOptions = equipment.map(eq => ({
        value: eq.id,
        label: `${eq.equipment_code} - ${eq.equipment_name}`
    }));

    const documentOptions = documents
        .filter(doc => doc.document_type === 'Teknik Resim')
        .map(doc => ({
            value: doc.id,
            label: `${doc.document_name}${doc.document_number ? ` (${doc.document_number})` : ''}`
        }));

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg']
        },
        multiple: true
    });

    const filteredNotes = notes.filter(note => {
        const searchLower = searchTerm.toLowerCase();
        return (
            note.title?.toLowerCase().includes(searchLower) ||
            note.description?.toLowerCase().includes(searchLower) ||
            note.part_code?.toLowerCase().includes(searchLower) ||
            note.part_name?.toLowerCase().includes(searchLower) ||
            note.process_control_equipment?.equipment_name?.toLowerCase().includes(searchLower)
        );
    });

    const handleOpenForm = (note = null) => {
        if (note) {
            setSelectedNote(note);
            setFormData({
                equipment_id: note.equipment_id,
                note_type: note.note_type || '',
                title: note.title || '',
                description: note.description || '',
                part_code: note.part_code || '',
                part_name: note.part_name || '',
                document_id: note.document_id || null,
                drawing_revision: note.drawing_revision || '',
                drawing_location: note.drawing_location || '',
                status: note.status || 'Açık',
                priority: note.priority || 'Normal'
            });
            setFiles([]);
        } else {
            setSelectedNote(null);
            setFormData({
                equipment_id: null,
                note_type: '',
                title: '',
                description: '',
                part_code: '',
                part_name: '',
                document_id: null,
                drawing_revision: '',
                drawing_location: '',
                status: 'Açık',
                priority: 'Normal'
            });
            setFiles([]);
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.equipment_id || !formData.title || !formData.description || !formData.note_type) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen zorunlu alanları doldurun.' });
            return;
        }

        if (formData.note_type === 'Teknik Resim Notu' && !formData.document_id) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Teknik resim notu için doküman seçmelisiniz.' });
            return;
        }

        if (formData.note_type === 'Parça Kodu Notu' && (!formData.part_code || !formData.part_name)) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Parça kodlu not için parça kodu ve adı girmelisiniz.' });
            return;
        }

        try {
            let attachments = selectedNote?.attachments || [];

            if (files.length > 0) {
                const uploadPromises = files.map(async (file) => {
                    const sanitizedName = sanitizeFileName(file.name);
                    const filePath = `notes/${uuidv4()}-${sanitizedName}`;
                    const { error: uploadError } = await supabase
                        .storage
                        .from('process_control')
                        .upload(filePath, file);
                    
                    if (uploadError) throw uploadError;
                    return filePath;
                });

                const uploadedPaths = await Promise.all(uploadPromises);
                attachments = [...attachments, ...uploadedPaths];
            }

            const noteData = {
                ...formData,
                attachments
            };

            if (selectedNote) {
                const { error } = await supabase
                    .from('process_control_notes')
                    .update(noteData)
                    .eq('id', selectedNote.id);
                
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Not güncellendi.' });
            } else {
                const { error } = await supabase
                    .from('process_control_notes')
                    .insert([noteData]);
                
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Not eklendi.' });
            }
            
            setIsFormOpen(false);
            refreshNotes();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu notu silmek istediğinizden emin misiniz?')) return;
        
        try {
            const { error } = await supabase
                .from('process_control_notes')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            toast({ title: 'Başarılı', description: 'Not silindi.' });
            refreshNotes();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleCreateNC = (note) => {
        if (!onOpenNCForm) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Uygunsuzluk formu açılamadı.' });
            return;
        }

        const ncData = {
            title: `Proses Kontrol Notu: ${note.title}`,
            description: `Araç: ${note.process_control_equipment?.equipment_name || note.equipment_id}\n\n${note.description}`,
            type: 'DF',
            department: note.process_control_equipment?.responsible_unit || '',
            part_code: note.part_code,
            part_name: note.part_name,
        };

        onOpenNCForm(ncData, () => {
            // NC oluşturulduktan sonra notu güncelle
            supabase
                .from('process_control_notes')
                .update({ related_nc_id: null }) // Bu ID'yi NC kaydedildikten sonra güncellemek gerekir
                .eq('id', note.id);
        });
    };

    return (
        <div className="space-y-4">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedNote ? 'Not Düzenle' : 'Yeni Not Ekle'}
                        </DialogTitle>
                        <DialogDescription>
                            Teknik resim veya parça kodlu not ekleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Araç (*)</Label>
                                    <Combobox
                                        options={equipmentOptions}
                                        value={formData.equipment_id}
                                        onChange={(v) => setFormData({ ...formData, equipment_id: v })}
                                        placeholder="Araç seçin..."
                                    />
                                </div>
                                <div>
                                    <Label>Not Tipi (*)</Label>
                                    <Combobox
                                        options={[
                                            { value: 'Teknik Resim Notu', label: 'Teknik Resim Notu' },
                                            { value: 'Parça Kodu Notu', label: 'Parça Kodu Notu' },
                                            { value: 'Genel Not', label: 'Genel Not' }
                                        ]}
                                        value={formData.note_type}
                                        onChange={(v) => setFormData({ ...formData, note_type: v, document_id: v !== 'Teknik Resim Notu' ? null : formData.document_id, part_code: v !== 'Parça Kodu Notu' ? '' : formData.part_code, part_name: v !== 'Parça Kodu Notu' ? '' : formData.part_name })}
                                        placeholder="Not tipi seçin..."
                                    />
                                </div>
                            </div>
                            {formData.note_type === 'Teknik Resim Notu' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Teknik Resim (*)</Label>
                                        <Combobox
                                            options={documentOptions}
                                            value={formData.document_id}
                                            onChange={(v) => setFormData({ ...formData, document_id: v })}
                                            placeholder="Teknik resim seçin..."
                                        />
                                    </div>
                                    <div>
                                        <Label>Resim Revizyonu</Label>
                                        <Input
                                            value={formData.drawing_revision}
                                            onChange={(e) => setFormData({ ...formData, drawing_revision: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                            {formData.note_type === 'Teknik Resim Notu' && (
                                <div>
                                    <Label>Resim Üzerindeki Konum/Bölge</Label>
                                    <Input
                                        value={formData.drawing_location}
                                        onChange={(e) => setFormData({ ...formData, drawing_location: e.target.value })}
                                        placeholder="Örn: A-A kesiti, Bölüm 3, vb."
                                    />
                                </div>
                            )}
                            {formData.note_type === 'Parça Kodu Notu' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Parça Kodu (*)</Label>
                                        <Input
                                            value={formData.part_code}
                                            onChange={(e) => setFormData({ ...formData, part_code: e.target.value })}
                                            required={formData.note_type === 'Parça Kodu Notu'}
                                        />
                                    </div>
                                    <div>
                                        <Label>Parça Adı (*)</Label>
                                        <Input
                                            value={formData.part_name}
                                            onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                                            required={formData.note_type === 'Parça Kodu Notu'}
                                        />
                                    </div>
                                </div>
                            )}
                            <div>
                                <Label>Başlık (*)</Label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Açıklama (*)</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                    rows={5}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Durum</Label>
                                    <Combobox
                                        options={[
                                            { value: 'Açık', label: 'Açık' },
                                            { value: 'İnceleniyor', label: 'İnceleniyor' },
                                            { value: 'Çözüldü', label: 'Çözüldü' },
                                            { value: 'Kapatıldı', label: 'Kapatıldı' }
                                        ]}
                                        value={formData.status}
                                        onChange={(v) => setFormData({ ...formData, status: v })}
                                        placeholder="Durum seçin..."
                                    />
                                </div>
                                <div>
                                    <Label>Öncelik</Label>
                                    <Combobox
                                        options={[
                                            { value: 'Kritik', label: 'Kritik' },
                                            { value: 'Yüksek', label: 'Yüksek' },
                                            { value: 'Normal', label: 'Normal' },
                                            { value: 'Düşük', label: 'Düşük' }
                                        ]}
                                        value={formData.priority}
                                        onChange={(v) => setFormData({ ...formData, priority: v })}
                                        placeholder="Öncelik seçin..."
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Ekler</Label>
                                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                                    <input {...getInputProps()} />
                                    {files.length > 0 ? (
                                        <div className="space-y-2">
                                            {files.map((file, idx) => (
                                                <p key={idx} className="text-sm">{file.name}</p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Dosyaları buraya sürükleyin veya seçin</p>
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
                        placeholder="Not başlığı, açıklama veya parça kodu ile ara..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <Plus className="w-4 h-4 mr-2" /> Yeni Not
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="p-3 text-left">Araç</th>
                            <th className="p-3 text-left">Not Tipi</th>
                            <th className="p-3 text-left">Başlık</th>
                            <th className="p-3 text-left">Parça/Resim</th>
                            <th className="p-3 text-left">Durum</th>
                            <th className="p-3 text-left">Öncelik</th>
                            <th className="p-3 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-muted-foreground">
                                    Yükleniyor...
                                </td>
                            </tr>
                        ) : filteredNotes.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-muted-foreground">
                                    Not bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            filteredNotes.map((note) => (
                                <tr key={note.id} className="border-t hover:bg-muted/50">
                                    <td className="p-3">
                                        {note.process_control_equipment?.equipment_name || '-'}
                                    </td>
                                    <td className="p-3">
                                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                            {note.note_type === 'Teknik Resim Notu' ? (
                                                <FileText className="h-3 w-3" />
                                            ) : note.note_type === 'Parça Kodu Notu' ? (
                                                <Package className="h-3 w-3" />
                                            ) : null}
                                            {note.note_type}
                                        </Badge>
                                    </td>
                                    <td className="p-3 font-medium">{note.title}</td>
                                    <td className="p-3">
                                        {note.note_type === 'Parça Kodu Notu' ? (
                                            <span>{note.part_code} - {note.part_name}</span>
                                        ) : note.note_type === 'Teknik Resim Notu' ? (
                                            <span>{note.process_control_documents?.document_name || '-'}</span>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <Badge variant={note.status === 'Açık' ? 'default' : 'secondary'}>
                                            {note.status}
                                        </Badge>
                                    </td>
                                    <td className="p-3">
                                        <Badge 
                                            variant={
                                                note.priority === 'Kritik' ? 'destructive' :
                                                note.priority === 'Yüksek' ? 'default' : 'secondary'
                                            }
                                        >
                                            {note.priority}
                                        </Badge>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            {note.status === 'Açık' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleCreateNC(note)}
                                                    title="Uygunsuzluk Oluştur"
                                                >
                                                    <AlertTriangle className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenForm(note)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(note.id)}
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

export default NotesManagement;

