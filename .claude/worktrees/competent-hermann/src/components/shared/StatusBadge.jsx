/**
 * StatusBadge - Evrensel durum badge bileşeni
 * Tüm modüllerde tutarlı durum gösterimi sağlar.
 * Mevcut statusUtils.jsx'i BOZMAZ - ek olarak kullanılabilir.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { isAfter, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

// Durum renk haritası
const STATUS_CONFIG = {
    // Genel durumlar
    'Açık': { variant: 'secondary', className: '' },
    'Kapatıldı': { variant: 'default', className: 'bg-green-600 text-white hover:bg-green-700' },
    'Kapalı': { variant: 'default', className: 'bg-green-600 text-white hover:bg-green-700' },
    'Tamamlandı': { variant: 'default', className: 'bg-green-600 text-white hover:bg-green-700' },
    'İşlemde': { variant: 'default', className: 'bg-yellow-500 text-white hover:bg-yellow-600' },
    'Devam Ediyor': { variant: 'default', className: 'bg-yellow-500 text-white hover:bg-yellow-600' },
    'Onay Bekliyor': { variant: 'default', className: 'bg-purple-500 text-white hover:bg-purple-600' },
    'Reddedildi': { variant: 'destructive', className: '' },
    'İptal': { variant: 'destructive', className: '' },
    'İptal Edildi': { variant: 'destructive', className: '' },
    'Gecikmiş': { variant: 'default', className: 'bg-red-600 text-white animate-pulse' },
    
    // Tedarikçi durumları
    'Onaylı': { variant: 'default', className: 'bg-green-600 text-white' },
    'Koşullu Onaylı': { variant: 'default', className: 'bg-yellow-500 text-white' },
    'Askıya Alınmış': { variant: 'default', className: 'bg-orange-500 text-white' },
    'Red': { variant: 'destructive', className: '' },
    
    // Kalite durumları
    'Uygun': { variant: 'default', className: 'bg-green-600 text-white' },
    'Uygun Değil': { variant: 'destructive', className: '' },
    'Koşullu Kabul': { variant: 'default', className: 'bg-yellow-500 text-white' },
    'Muayene Bekliyor': { variant: 'secondary', className: '' },
    
    // Kaizen/İyileştirme durumları
    'Planlama': { variant: 'secondary', className: '' },
    'Uygulama': { variant: 'default', className: 'bg-blue-500 text-white' },
    'Doğrulama': { variant: 'default', className: 'bg-purple-500 text-white' },
    'Standartlaştırma': { variant: 'default', className: 'bg-indigo-500 text-white' },
    
    // Önem seviyeleri
    'Kritik': { variant: 'destructive', className: '' },
    'Yüksek': { variant: 'default', className: 'bg-orange-500 text-white' },
    'Orta': { variant: 'default', className: 'bg-yellow-500 text-white' },
    'Düşük': { variant: 'secondary', className: '' },
    
    // Tedarikçi notları
    'A': { variant: 'default', className: 'bg-green-600 text-white' },
    'B': { variant: 'default', className: 'bg-blue-500 text-white' },
    'C': { variant: 'default', className: 'bg-yellow-500 text-white' },
    'D': { variant: 'destructive', className: '' },
    
    // Genel
    'Aktif': { variant: 'default', className: 'bg-green-600 text-white' },
    'Pasif': { variant: 'secondary', className: '' },
    'Taslak': { variant: 'outline', className: '' },
};

/**
 * @param {Object} props
 * @param {string} props.status - Durum metni
 * @param {string} props.dueDate - Son tarih (ISO string) - gecikme kontrolü için
 * @param {boolean} props.showOverdue - Gecikme kontrolü aktif mi (default: true)
 * @param {string} props.size - Badge boyutu ('sm' | 'default' | 'lg')
 * @param {string} props.className - Ek CSS sınıfı
 * @param {React.ReactNode} props.icon - Opsiyonel ikon
 */
const StatusBadge = ({
    status,
    dueDate = null,
    showOverdue = true,
    size = 'default',
    className = '',
    icon = null,
}) => {
    if (!status) {
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }

    // Gecikme kontrolü
    const isOverdue = showOverdue
        && dueDate
        && !['Kapatıldı', 'Kapalı', 'Tamamlandı', 'Reddedildi', 'İptal', 'İptal Edildi'].includes(status)
        && isValid(parseISO(dueDate))
        && isAfter(new Date(), parseISO(dueDate));

    if (isOverdue) {
        return (
            <Badge className={cn(
                'bg-red-600 text-white animate-pulse',
                size === 'sm' && 'text-[10px] px-1.5 py-0',
                size === 'lg' && 'text-sm px-3 py-1',
                className,
            )}>
                {icon && <span className="mr-1">{icon}</span>}
                Gecikmiş
            </Badge>
        );
    }

    const config = STATUS_CONFIG[status] || { variant: 'outline', className: '' };

    return (
        <Badge
            variant={config.variant}
            className={cn(
                config.className,
                size === 'sm' && 'text-[10px] px-1.5 py-0',
                size === 'lg' && 'text-sm px-3 py-1',
                className,
            )}
        >
            {icon && <span className="mr-1">{icon}</span>}
            {status}
        </Badge>
    );
};

export default StatusBadge;

// Status konfigürasyonunu dışarıya aç (custom konfigürasyon için)
export { STATUS_CONFIG };
