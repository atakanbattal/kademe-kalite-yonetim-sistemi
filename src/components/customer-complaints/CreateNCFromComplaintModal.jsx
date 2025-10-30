import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const CreateNCFromComplaintModal = ({ open, setOpen, complaint, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = async () => {
        if (!complaint) return;

        setIsSubmitting(true);
        try {
            // Uygunsuzluk kaydı oluştur
            const ncData = {
                title: `Müşteri Şikayeti: ${complaint.title || 'Başlıksız'}`,
                description: `${complaint.description || ''}\n\nMüşteri: ${complaint.customer?.name || 'N/A'}\nŞikayet No: ${complaint.complaint_no || 'N/A'}\n\n${notes}`,
                nc_type: 'Müşteri Şikayeti',
                source: 'Müşteri Şikayeti',
                detection_date: new Date().toISOString().split('T')[0],
                status: 'Yeni',
                severity: complaint.severity || 'Orta',
                priority: complaint.priority || 'Orta',
                product_code: complaint.product_code || null,
                product_name: complaint.product_name || null,
                batch_number: complaint.batch_number || null,
                quantity_affected: complaint.quantity_affected || null,
                responsible_department_id: complaint.responsible_department_id || null,
                responsible_person_id: complaint.responsible_personnel_id || null,
                assigned_to_id: complaint.assigned_to_id || null,
                created_by: user?.id,
                // İlişkili şikayet ID'sini de kaydedelim (eğer alan varsa)
                related_complaint_id: complaint.id
            };

            const { data: ncRecord, error: ncError } = await supabase
                .from('non_conformities')
                .insert([ncData])
                .select()
                .single();

            if (ncError) throw ncError;

            // Şikayetin ilgili uygunsuzluk ID'sini güncelle
            const { error: updateError } = await supabase
                .from('customer_complaints')
                .update({ related_nc_id: ncRecord.id })
                .eq('id', complaint.id);

            if (updateError) console.error('Şikayet güncelleme hatası:', updateError);

            toast({
                title: 'Başarılı!',
                description: `Uygunsuzluk kaydı oluşturuldu: ${ncRecord.nc_number || ncRecord.id.substring(0, 8)}`
            });

            setOpen(false);
            setNotes('');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Uygunsuzluk oluşturma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Uygunsuzluk oluşturulamadı: ${error.message}`
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Uygunsuzluk Oluştur
                    </DialogTitle>
                    <DialogDescription>
                        Bu şikayetten bir uygunsuzluk kaydı oluşturulacaktır.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <div className="text-sm">
                            <span className="font-medium">Şikayet:</span> {complaint?.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Müşteri:</span> {complaint?.customer?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Önem:</span> {complaint?.severity || 'Orta'}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="notes">Ek Notlar</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4}
                            placeholder="Uygunsuzluk kaydına eklenecek ek bilgiler..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        İptal
                    </Button>
                    <Button onClick={handleCreate} disabled={isSubmitting}>
                        {isSubmitting ? 'Oluşturuluyor...' : 'Uygunsuzluk Oluştur'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateNCFromComplaintModal;

