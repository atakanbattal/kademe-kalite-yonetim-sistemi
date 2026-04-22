/**
 * EmptyState - Boş liste/veri durumu bileşeni
 * Tüm modüllerde tutarlı "veri yok" görünümü sağlar.
 */
import React from 'react';
import { FileText, Search, Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {string} props.title - Başlık (default: 'Kayıt bulunamadı')
 * @param {string} props.description - Açıklama
 * @param {React.ReactNode} props.icon - Ikon (default: Inbox)
 * @param {string} props.actionLabel - Aksiyon butonu metni
 * @param {Function} props.onAction - Aksiyon butonu callback
 * @param {boolean} props.isFiltered - Filtre aktif mi (arama yapıldığında farklı mesaj gösterir)
 * @param {string} props.className - Ek CSS sınıfı
 * @param {boolean} props.compact - Kompakt görünüm
 */
const EmptyState = ({
    title,
    description,
    icon,
    actionLabel,
    onAction,
    isFiltered = false,
    className = '',
    compact = false,
}) => {
    const Icon = icon || (isFiltered ? Search : Inbox);
    const displayTitle = title || (isFiltered ? 'Sonuç bulunamadı' : 'Kayıt bulunamadı');
    const displayDescription = description || (
        isFiltered
            ? 'Arama kriterlerinize uygun kayıt bulunamadı. Filtreleri değiştirmeyi deneyin.'
            : 'Henüz kayıt eklenmemiş.'
    );

    return (
        <div className={cn(
            'flex flex-col items-center justify-center text-center',
            compact ? 'py-6 px-4' : 'py-12 px-6',
            className,
        )}>
            <div className={cn(
                'rounded-full bg-muted flex items-center justify-center',
                compact ? 'h-10 w-10 mb-3' : 'h-16 w-16 mb-4',
            )}>
                {React.isValidElement(Icon) ? Icon : (
                    <Icon className={cn(
                        'text-muted-foreground',
                        compact ? 'h-5 w-5' : 'h-8 w-8',
                    )} />
                )}
            </div>
            <h3 className={cn(
                'font-semibold text-foreground',
                compact ? 'text-sm mb-1' : 'text-lg mb-2',
            )}>
                {displayTitle}
            </h3>
            <p className={cn(
                'text-muted-foreground max-w-sm',
                compact ? 'text-xs mb-3' : 'text-sm mb-4',
            )}>
                {displayDescription}
            </p>
            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    size={compact ? 'sm' : 'default'}
                    variant="outline"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
