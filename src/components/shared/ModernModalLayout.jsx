import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, X } from 'lucide-react';

/**
 * Modern modal layout - CostFormModal ile uyumlu profesyonel tasarım.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function} props.onOpenChange
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {React.ReactNode} props.icon
 * @param {string} props.badge
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} props.rightPanel
 * @param {string} props.maxWidth - sm:max-w-2xl vb.
 * @param {string} props.formId
 */
export const ModernModalLayout = ({
    open,
    onOpenChange,
    title,
    subtitle = 'Kalite Yönetim Sistemi',
    icon,
    badge,
    children,
    rightPanel,
    footerLeft,
    footerExtra,
    footerDate,
    onCancel,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Kaydı Tamamla',
    cancelLabel = 'İptal Et',
    maxWidth = 'sm:max-w-7xl',
    formId,
}) => {
    const hasTwoColumns = !!rightPanel;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/*
              Varsayılan top:50%+translate -50%; büyük modalları aşağı itiyor ve transform alt öğeleri etkileyebilir.
              Üstten sabit konum ile hizalı, dikey göbek yok (translate-y-0).
            */}
            <DialogContent
                className={`${maxWidth} w-[98vw] sm:w-[95vw] max-h-[min(92vh,100dvh-1rem)] overflow-hidden flex flex-col p-0 !left-[50%] !top-[max(1rem,env(safe-area-inset-top,1rem))] !translate-x-[-50%] !translate-y-0`}
                hideCloseButton
            >
                <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle></DialogHeader>
                <header className="bg-gradient-to-r from-primary to-blue-700 px-8 py-6 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-lg">{icon}</div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
                            <p className="text-xs text-blue-100 uppercase tracking-[0.15em] font-medium">{subtitle}</p>
                        </div>
                        {badge && (
                            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-xs font-bold rounded-full uppercase tracking-wider">
                                {badge}
                            </span>
                        )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="bg-white/20 hover:bg-white/30 text-white shrink-0 rounded-xl">
                        <X className="w-4 h-4" />
                        <span className="sr-only">Kapat</span>
                    </Button>
                </header>

                {hasTwoColumns ? (
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-5" style={{ scrollbarWidth: 'thin' }}>{children}</div>
                        <div className="w-[360px] min-w-[320px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-5" style={{ scrollbarWidth: 'thin' }}>{rightPanel}</div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
                )}

                <footer className="flex shrink-0 justify-end gap-2 px-8 py-4 border-t border-border bg-muted/20">
                    <div className="flex items-center gap-3 flex-1 justify-end">
                        {footerExtra}
                        <Button type="button" variant="outline" onClick={onCancel}>
                            {cancelLabel}
                        </Button>
                        <Button type={formId ? 'submit' : 'button'} form={formId} onClick={!formId ? onSubmit : undefined} disabled={isSubmitting} className="text-base font-bold shadow-lg shadow-primary/20">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Kaydediliyor...' : submitLabel}
                        </Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export const ModalSectionHeader = ({ children }) => (
    <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">{children}</h2>
        <div className="h-px flex-1 bg-border" />
    </div>
);

export const ModalField = ({ label, required, children }) => (
    <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {label} {required && <span className="text-destructive">*</span>}
        </label>
        {children}
    </div>
);

export default ModernModalLayout;
