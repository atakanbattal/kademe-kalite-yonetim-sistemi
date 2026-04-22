/**
 * LoadingSpinner - Tekrar kullanılabilir loading bileşeni
 * Sayfa, modül ve bileşen seviyesinde kullanılabilir.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {string} props.size - Boyut ('sm' | 'default' | 'lg' | 'full')
 * @param {string} props.text - Yükleniyor metni
 * @param {string} props.className - Ek CSS sınıfı
 */
const LoadingSpinner = ({
    size = 'default',
    text = 'Yükleniyor...',
    className = '',
}) => {
    const sizeConfig = {
        sm: { container: 'py-4', icon: 'h-4 w-4', text: 'text-xs' },
        default: { container: 'py-8', icon: 'h-6 w-6', text: 'text-sm' },
        lg: { container: 'py-16', icon: 'h-10 w-10', text: 'text-base' },
        full: { container: 'min-h-[50vh]', icon: 'h-10 w-10', text: 'text-base' },
    };

    const config = sizeConfig[size] || sizeConfig.default;

    return (
        <div className={cn(
            'flex flex-col items-center justify-center gap-3',
            config.container,
            className,
        )}>
            <Loader2 className={cn('animate-spin text-primary', config.icon)} />
            {text && (
                <p className={cn('text-muted-foreground', config.text)}>
                    {text}
                </p>
            )}
        </div>
    );
};

export default LoadingSpinner;

/**
 * PageLoader - Tam sayfa loading bileşeni (code splitting için ideal)
 * React.lazy Suspense fallback olarak kullanılabilir.
 */
export const PageLoader = ({ text = 'Modül yükleniyor...' }) => (
    <LoadingSpinner size="full" text={text} />
);
