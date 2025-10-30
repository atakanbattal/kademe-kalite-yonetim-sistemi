import React, { useState } from 'react';
import { Plus, MessageSquare, Phone, Mail, Video, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const COMMUNICATION_TYPES = ['Email', 'Telefon', 'Toplantı', 'Ziyaret', 'Diğer'];

const CommunicationTab = ({ complaintId, communications, onRefresh }) => {
    const { toast } = useToast();
    const { personnel } = useData();
    const [isFormOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openForm = () => {
        setFormData({
            communication_type: 'Email',
            communication_date: new Date().toISOString().slice(0, 16),
            contact_person: '',
            subject: '',
            notes: '',
            communicated_by: ''
        });
        setFormOpen(true);
    };

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.notes) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Notlar alanı zorunludur.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const dataToSubmit = { ...formData, complaint_id: complaintId };
            Object.keys(dataToSubmit).forEach(key => {
                if (dataToSubmit[key] === '') dataToSubmit[key] = null;
            });

            const { error } = await supabase.from('customer_communication_history').insert([dataToSubmit]);
            if (error) throw error;

            toast({ title: 'Başarılı!', description: 'İletişim kaydı eklendi.' });
            setFormOpen(false);
            onRefresh();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.filter(p => p.is_active).map(p => ({ value: p.id, label: p.full_name }));

    const getCommIcon = (type) => {
        switch (type) {
            case 'Email': return <Mail className="w-5 h-5" />;
            case 'Telefon': return <Phone className="w-5 h-5" />;
            case 'Toplantı': return <Video className="w-5 h-5" />;
            case 'Ziyaret': return <Users className="w-5 h-5" />;
            default: return <MessageSquare className="w-5 h-5" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">İletişim Geçmişi</h3>
                    <p className="text-sm text-muted-foreground">Müşteri ile yapılan iletişimleri kaydedin</p>
                </div>
                <Button onClick={openForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni İletişim
                </Button>
            </div>

            {communications.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Henüz iletişim kaydı eklenmemiş.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {communications.map(comm => (
                        <Card key={comm.id}>
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-full">
                                        {getCommIcon(comm.communication_type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline">{comm.communication_type}</Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(comm.communication_date).toLocaleString('tr-TR')}
                                            </span>
                                        </div>
                                        {comm.subject && (
                                            <div className="font-medium mb-2">{comm.subject}</div>
                                        )}
                                        {comm.contact_person && (
                                            <div className="text-sm text-muted-foreground mb-2">
                                                İletişim: {comm.contact_person}
                                            </div>
                                        )}
                                        <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                                            {comm.notes}
                                        </div>
                                        {comm.communicated_by && (
                                            <div className="text-xs text-muted-foreground mt-2">
                                                Kaydeden: {comm.communicated_by.full_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Yeni İletişim Kaydı</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>İletişim Tipi</Label>
                                <Select value={formData.communication_type || ''} onValueChange={(v) => handleSelectChange('communication_type', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{COMMUNICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="communication_date">Tarih/Saat</Label>
                                <Input id="communication_date" type="datetime-local" value={formData.communication_date || ''} onChange={handleChange} />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="contact_person">İletişime Geçilen Kişi</Label>
                            <Input id="contact_person" value={formData.contact_person || ''} onChange={handleChange} placeholder="Ad Soyad" />
                        </div>
                        <div>
                            <Label htmlFor="subject">Konu</Label>
                            <Input id="subject" value={formData.subject || ''} onChange={handleChange} placeholder="İletişim konusu" />
                        </div>
                        <div>
                            <Label htmlFor="notes">Notlar *</Label>
                            <Textarea id="notes" value={formData.notes || ''} onChange={handleChange} rows={6} required placeholder="İletişim detayları..." />
                        </div>
                        <div>
                            <Label>Kaydeden</Label>
                            <SearchableSelectDialog options={personnelOptions} value={formData.communicated_by || ''} onChange={(v) => handleSelectChange('communicated_by', v)} triggerPlaceholder="Kişi seçin..." allowClear />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CommunicationTab;

