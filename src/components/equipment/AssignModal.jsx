import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AssignModal = ({ isOpen, setIsOpen, equipmentId, personnelList, refreshData }) => {
    const { toast } = useToast();
    const [personnelId, setPersonnelId] = useState('');
    const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        await supabase
            .from('equipment_assignments')
            .update({ is_active: false, return_date: new Date().toISOString() })
            .eq('equipment_id', equipmentId)
            .eq('is_active', true);
        
        const { error: insertError } = await supabase
            .from('equipment_assignments')
            .insert({
                equipment_id: equipmentId,
                assigned_personnel_id: personnelId,
                assignment_date: assignmentDate,
                is_active: true
            });
        
        if(insertError) {
            toast({ variant: 'destructive', title: 'Hata', description: `Yeni zimmet oluşturulamadı: ${insertError.message}` });
        } else {
            await supabase.from('equipments').update({ status: 'Zimmetli' }).eq('id', equipmentId);
            toast({ title: 'Başarılı', description: 'Ekipman başarıyla zimmetlendi.' });
            refreshData();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ekipman Zimmetle</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label>Personel</Label>
                        <Select onValueChange={setPersonnelId} required>
                            <SelectTrigger><SelectValue placeholder="Personel seçin..." /></SelectTrigger>
                            <SelectContent>
                                {personnelList.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="assignmentDate">Zimmet Tarihi</Label>
                        <Input id="assignmentDate" type="date" value={assignmentDate} onChange={e => setAssignmentDate(e.target.value)} required />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Zimmetleniyor...' : 'Zimmetle'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default AssignModal;