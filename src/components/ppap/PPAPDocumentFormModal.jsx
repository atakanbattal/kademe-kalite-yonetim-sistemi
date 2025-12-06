import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const DOCUMENT_TYPES = [
    'Design Records',
    'Engineering Change Documents',
    'Customer Engineering Approval',
    'DFMEA',
    'PFMEA',
    'Control Plan',
    'MSA',
    'SPC',
    'Process Flow',
    'Dimensional Results',
    'Material Test Results',
    'Performance Test Results',
    'Initial Sample Inspection Report',
    'PSW'
];

const DOCUMENT_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Under Review'];

const PPAPDocumentFormModal = ({ open, setOpen, existingDocument, projectId, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        document_type: 'Design Records',
        document_name: '',
        document_version: '',
        document_status: 'Draft',
        file_name: '',
        rejection_reason: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingDocument) {
            setFormData({
                document_type: existingDocument.document_type || 'Design Records',
                document_name: existingDocument.document_name || '',
                document_version: existingDocument.document_version || '',
                document_status: existingDocument.document_status || 'Draft',
                file_name: existingDocument.file_name || '',
                rejection_reason: existingDocument.rejection_reason || ''
            });
        } else {
            setFormData({
                document_type: 'Design Records',
                document_name: '',
                document_version: '',
                document_status: 'Draft',
                file_name: '',
                rejection_reason: ''
            });
        }
    }, [existingDocument, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!projectId) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Lütfen bir proje seçin.'
                });
                setIsSubmitting(false);
                return;
            }

            const dataToSubmit = {
                ...formData,
                project_id: projectId,
                rejection_reason: formData.rejection_reason || null
            };

            if (existingDocument) {
                const { error } = await supabase
                    .from('ppap_documents')
                    .update(dataToSubmit)
                    .eq('id', existingDocument.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Doküman güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('ppap_documents')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Doküman oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving document:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Doküman kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingDocument ? 'Doküman Düzenle' : 'Yeni Doküman'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="document_type">Doküman Tipi *</Label>
                                <Select
                                    value={formData.document_type}
                                    onValueChange={(v) => setFormData({ ...formData, document_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="document_status">Durum</Label>
                                <Select
                                    value={formData.document_status}
                                    onValueChange={(v) => setFormData({ ...formData, document_status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>
                                                {status === 'Draft' ? 'Taslak' :
                                                 status === 'Submitted' ? 'Gönderildi' :
                                                 status === 'Approved' ? 'Onaylandı' :
                                                 status === 'Rejected' ? 'Reddedildi' : 'İncelemede'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="document_name">Doküman Adı *</Label>
                            <Input
                                id="document_name"
                                value={formData.document_name}
                                onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="document_version">Versiyon</Label>
                                <Input
                                    id="document_version"
                                    value={formData.document_version}
                                    onChange={(e) => setFormData({ ...formData, document_version: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="file_name">Dosya Adı</Label>
                                <Input
                                    id="file_name"
                                    value={formData.file_name}
                                    onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
                                />
                            </div>
                        </div>

                        {formData.document_status === 'Rejected' && (
                            <div>
                                <Label htmlFor="rejection_reason">Red Nedeni</Label>
                                <Textarea
                                    id="rejection_reason"
                                    value={formData.rejection_reason}
                                    onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PPAPDocumentFormModal;

