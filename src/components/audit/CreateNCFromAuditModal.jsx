import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';

const CreateNCFromAuditModal = ({ isOpen, setIsOpen, finding, audit, onOpenNCForm }) => {
    const { toast } = useToast();
    const [ncType, setNcType] = useState('DF');
    const [departments, setDepartments] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [requestingUnit, setRequestingUnit] = useState('Kalite Birimi');
    const [requestingPerson, setRequestingPerson] = useState('Atakan Battal');
    
    useEffect(() => {
        const fetchDepartments = async () => {
            const { data, error } = await supabase.from('cost_settings').select('unit_name');
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Birimler yüklenemedi.' });
            } else {
                setDepartments(data.map(d => d.unit_name).sort());
            }
        };
        fetchDepartments();
    }, [toast]);
    
    useEffect(() => {
        if (audit?.department?.unit_name) {
            setSelectedDepartment(audit.department.unit_name);
        } else {
            setSelectedDepartment('');
        }
    }, [audit, isOpen]);

    if (!finding) return null;

    const handleCreateAndProceed = () => {
        if (!onOpenNCForm) {
             toast({ variant: 'destructive', title: 'Hata', description: 'Form açma fonksiyonu bulunamadı.' });
             return;
        }

        if (!selectedDepartment) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen bir departman seçin.' });
            return;
        }

        const initialRecord = {
            source: 'audit',
            source_finding_id: finding.id,
            description: finding.description,
            title: `Tetkik Bulgusu: ${audit?.report_number || 'N/A'}`,
            audit_title: audit?.title || '',
            department: selectedDepartment,
            department_name: selectedDepartment,
            type: ncType,
            requesting_person: requestingPerson,
            requesting_unit: requestingUnit
        };
        
        onOpenNCForm(ncType, initialRecord);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Bulgudan Uygunsuzluk Oluştur</DialogTitle>
                    <DialogDescription>
                        "{finding.description}" bulgusu için bir kayıt oluşturun. Gerekli alanları doldurun.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <Label htmlFor="ncType">Uygunsuzluk Türü</Label>
                        <Select value={ncType} onValueChange={setNcType}>
                            <SelectTrigger id="ncType">
                                <SelectValue placeholder="Tür seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DF">DF (Düzeltici Faaliyet)</SelectItem>
                                <SelectItem value="8D">8D</SelectItem>
                                <SelectItem value="MDI">MDI (Mini Düzeltici İyileştirme)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="requestingUnit">Talep Eden Birim</Label>
                        <Input id="requestingUnit" value={requestingUnit} onChange={(e) => setRequestingUnit(e.target.value)} />
                    </div>

                    <div>
                        <Label htmlFor="requestingPerson">Talep Eden Kişi</Label>
                        <Input id="requestingPerson" value={requestingPerson} onChange={(e) => setRequestingPerson(e.target.value)} />
                    </div>

                    <div className="col-span-2">
                        <Label htmlFor="department">İlgili Departman</Label>
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                            <SelectTrigger id="department" placeholder="Departman seçin...">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map(dep => (
                                    <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                    <Button onClick={handleCreateAndProceed}>Oluştur ve Devam Et</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateNCFromAuditModal;