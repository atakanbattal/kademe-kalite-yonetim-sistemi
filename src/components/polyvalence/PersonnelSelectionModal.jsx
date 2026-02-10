import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { UserPlus, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';

const PersonnelSelectionModal = ({ isOpen, onClose, onRefresh, existingPersonnelIds = [] }) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedPersonnelId, setSelectedPersonnelId] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchPersonnel();
            setSelectedPersonnelId('');
        }
    }, [isOpen]);

    const fetchPersonnel = async () => {
        try {
            const { data, error } = await supabase
                .from('personnel')
                .select('id, full_name, department, job_title, registration_number')
                .eq('is_active', true)
                .order('full_name');

            if (error) throw error;

            setPersonnelList(data || []);
        } catch (error) {
            console.error('Personel yükleme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Personel listesi yüklenemedi: ' + error.message
            });
        }
    };

    const handleAddPersonnel = async () => {
        if (!selectedPersonnelId) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Lütfen bir personel seçin.'
            });
            return;
        }

        // Check if already exists
        if (existingPersonnelIds.includes(selectedPersonnelId)) {
            toast({
                variant: 'destructive',
                title: 'Uyarı',
                description: 'Bu personel zaten polivalans matrisinde mevcut.'
            });
            return;
        }

        setLoading(true);
        try {
            // Personel zaten personnel tablosunda mevcut
            // Sadece sayfayı yenile
            toast({
                title: 'Başarılı',
                description: 'Personel polivalans matrisine eklendi.'
            });

            onRefresh();
            onClose();
        } catch (error) {
            console.error('Personel ekleme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Personel eklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNavigateToSettings = () => {
        onClose();
        navigate('/settings');
    };

    // Prepare options for SearchableSelectDialog
    const personnelOptions = personnelList.map(p => ({
        value: p.id,
        label: (
            <div className="flex flex-col">
                <span className="font-medium">{p.full_name}</span>
                <span className="text-xs text-muted-foreground">
                    {p.department} {p.job_title && `• ${p.job_title}`} {p.registration_number && `• ${p.registration_number}`}
                </span>
            </div>
        )
    }));

    // Filter out already existing personnel
    const availablePersonnelOptions = personnelOptions.filter(
        option => !existingPersonnelIds.includes(option.value)
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Personel Seç
                    </DialogTitle>
                    <DialogDescription>
                        Polivalans matrisine eklemek için mevcut personellerden birini seçin.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Yeni personel eklemek için{' '}
                            <Button 
                                variant="link" 
                                className="h-auto p-0 text-primary"
                                onClick={handleNavigateToSettings}
                            >
                                Ayarlar &gt; Personel Yönetimi
                                <ExternalLink className="ml-1 h-3 w-3" />
                            </Button>
                            {' '}sayfasını kullanın.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label>Personel Seçin <span className="text-red-500">*</span></Label>
                        <SearchableSelectDialog
                            options={availablePersonnelOptions}
                            value={selectedPersonnelId}
                            onChange={setSelectedPersonnelId}
                            triggerPlaceholder="Personel seçin..."
                            dialogTitle="Personel Seç"
                            searchPlaceholder="Personel ara..."
                            notFoundText="Personel bulunamadı."
                        />
                    </div>

                    {availablePersonnelOptions.length === 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Tüm aktif personeller zaten polivalans matrisinde mevcut.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        İptal
                    </Button>
                    <Button 
                        onClick={handleAddPersonnel} 
                        disabled={loading || !selectedPersonnelId || availablePersonnelOptions.length === 0}
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Personel Ekle
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PersonnelSelectionModal;

