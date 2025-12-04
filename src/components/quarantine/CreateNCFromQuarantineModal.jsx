import React, { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

const CreateNCFromQuarantineModal = ({ isOpen, setIsOpen, quarantineRecord, onOpenNCForm, refreshData }) => {
    const { toast } = useToast();
    const [defaultDesc, setDefaultDesc] = React.useState('');

    useEffect(() => {
        if (quarantineRecord) {
            const desc = `Karantina Kaydından Oluşturuldu\n\nParça: ${quarantineRecord.part_code}\nLot: ${quarantineRecord.lot_no}\nMiktar: ${quarantineRecord.quantity} ${quarantineRecord.unit}\n\nSebep: ${quarantineRecord.reason || 'Belirtilmemiş'}\n\nAçıklama: ${quarantineRecord.description || ''}`;
            setDefaultDesc(desc);
        }
    }, [quarantineRecord, isOpen]);

    const handleCreateNC = (ncType) => {
        if (!quarantineRecord) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Karantina kaydı bulunamadı.' });
            return;
        }

        const ncData = {
            type: ncType,
            title: `${quarantineRecord.part_code} - ${quarantineRecord.part_name}`,
            description: defaultDesc,
            source: 'quarantine',
            source_quarantine_id: quarantineRecord?.id,
            part_code: quarantineRecord?.part_code || '',
            part_name: quarantineRecord?.part_name || '',
            status: 'Açık',
            priority: 'Normal',
            requesting_unit: quarantineRecord?.requesting_department || '',
            department: quarantineRecord?.source_department || '',
            eight_d_steps: ncType === '8D' ? {
                'D0': { title: 'Planlama', responsible: '', completionDate: '', description: 'Karantina kaydından otomatik oluşturuldu' },
                'D1': { title: 'Takım Kurma', responsible: '', completionDate: '', description: '' },
                'D2': { title: 'Problem Tanımlama', responsible: '', completionDate: '', description: `Karantina Sebebi: ${quarantineRecord?.reason}` },
                'D3': { title: 'Kök Neden Analizi', responsible: '', completionDate: '', description: '' },
                'D4': { title: 'Geçici Çözüm', responsible: '', completionDate: '', description: '' },
                'D5': { title: 'Kalıcı Çözüm', responsible: '', completionDate: '', description: '' },
                'D6': { title: 'Sonuç Doğrulama', responsible: '', completionDate: '', description: '' },
                'D7': { title: 'Standardizasyon', responsible: '', completionDate: '', description: '' },
            } : null,
        };

        // NCFormModal'ı aç
        if (onOpenNCForm) {
            onOpenNCForm(ncData, () => {
                setIsOpen(false);
                toast({ title: 'Başarılı!', description: 'Uygunsuzluk başarıyla oluşturuldu.' });
                refreshData?.();
            });
        }
    };

    if (!isOpen || !quarantineRecord) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-2">Uygunsuzluk Türü Seçin</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Karantina kaydı <strong>{quarantineRecord?.part_code}</strong> için hangi türde uygunsuzluk oluşturmak istiyorsunuz?
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                    <button
                        onClick={() => handleCreateNC('DF')}
                        className="p-3 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition text-left"
                    >
                        <div className="font-semibold text-blue-600">DF (Düzeltme Formu)</div>
                        <div className="text-xs text-gray-600">Basit düzeltme işlemleri için</div>
                    </button>
                    
                    <button
                        onClick={() => handleCreateNC('8D')}
                        className="p-3 border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-400 transition text-left"
                    >
                        <div className="font-semibold text-green-600">8D (8 Adım Yöntemi)</div>
                        <div className="text-xs text-gray-600">Köklü çözüm analizi için</div>
                    </button>
                    
                    <button
                        onClick={() => handleCreateNC('MDI')}
                        className="p-3 border border-gray-300 rounded-lg hover:bg-purple-50 hover:border-purple-400 transition text-left"
                    >
                        <div className="font-semibold text-purple-600">MDI (Mühendislik Değişim İsteği)</div>
                        <div className="text-xs text-gray-600">Mühendislik iyileştirmeleri için</div>
                    </button>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                        İptal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateNCFromQuarantineModal;