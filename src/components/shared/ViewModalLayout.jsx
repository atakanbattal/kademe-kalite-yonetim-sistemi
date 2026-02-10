import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/**
 * Görüntüleme modalları için standart layout.
 * Girdi Kalite Kontrol Kayıt Görüntüleme modalı ile aynı yapı ve renkler.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function} props.onOpenChange
 * @param {string} props.title - Ana başlık
 * @param {string} props.subtitle - Alt başlık (örn: "Kalite Yönetim Sistemi")
 * @param {React.ReactNode} props.icon - Lucide ikonu (örn: <Eye />)
 * @param {React.ReactNode} props.badge - Sağ üstte gösterilecek badge (örn: durum)
 * @param {React.ReactNode} props.children - Ana içerik
 * @param {string} props.maxWidth - sm:max-w-7xl vb.
 */
export const ViewModalLayout = ({
    open,
    onOpenChange,
    title,
    subtitle = 'Kalite Yönetim Sistemi',
    icon,
    badge,
    children,
    maxWidth = 'sm:max-w-7xl',
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`${maxWidth} w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0`}>
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg">{icon}</div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{subtitle}</p>
                        </div>
                    </div>
                    {badge && <div>{badge}</div>}
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ViewModalLayout;
