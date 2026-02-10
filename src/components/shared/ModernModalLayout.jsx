import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock } from 'lucide-react';

/**
 * Modern modal layout - CostFormModal ile uyumlu profesyonel tasarım.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function} props.onOpenChange
 * @param {string} props.title - Ana başlık
 * @param {string} props.subtitle - Alt başlık (örn: "Kalite Yönetim Sistemi")
 * @param {React.ReactNode} props.icon - Lucide ikonu (örn: <DollarSign />)
 * @param {string} props.badge - "Yeni" veya "Düzenleme" gibi badge metni
 * @param {React.ReactNode} props.children - Ana içerik
 * @param {React.ReactNode} props.footerLeft - Footer sol taraf (varsayılan: tarih)
 * @param {React.ReactNode} props.footerExtra - Footer'a eklenecek ekstra butonlar (örn: PDF İndir)
 * @param {string} props.footerDate - Footer'da gösterilecek tarih
 * @param {function} props.onCancel
 * @param {function} props.onSubmit
 * @param {boolean} props.isSubmitting
 * @param {string} props.submitLabel - "Kaydı Tamamla" veya "Kaydet" vb.
 * @param {string} props.cancelLabel - "İptal Et" vb.
 * @param {string} props.maxWidth - sm:max-w-2xl, sm:max-w-4xl vb.
 * @param {string} props.formId - Form id (submit butonu bu formu tetikler)
 * @param {React.ReactNode} props.rightPanel - Sağ özet paneli (CostFormModal gibi iki sütunlu yapı)
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
    maxWidth = 'sm:max-w-2xl',
    formId,
}) => {
    const hasTwoColumns = !!rightPanel;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg">{icon}</div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{subtitle}</p>
                        </div>
                        {badge && (
                            <span className="ml-2 px-3 py-1 bg-green-400/20 border border-green-400/30 text-green-100 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                {badge}
                            </span>
                        )}
                    </div>
                </header>

                {hasTwoColumns ? (
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4" style={{ scrollbarWidth: 'thin' }}>{children}</div>
                        <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4" style={{ scrollbarWidth: 'thin' }}>{rightPanel}</div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
                )}

                <footer className="bg-background px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center text-muted-foreground">
                        {footerLeft ?? (
                            <>
                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                <span className="text-[11px] font-medium">
                                    {footerDate ? new Date(footerDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {footerExtra}
                        <Button type="button" variant="ghost" onClick={onCancel} className="text-sm font-semibold">
                            {cancelLabel}
                        </Button>
                        <Button type={formId ? 'submit' : 'button'} form={formId} onClick={!formId ? onSubmit : undefined} disabled={isSubmitting} className="text-sm font-bold shadow-lg shadow-primary/20">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Kaydediliyor...' : submitLabel}
                        </Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Section header - uppercase label + divider line
 */
export const ModalSectionHeader = ({ children }) => (
    <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">{children}</h2>
        <div className="h-px flex-1 bg-border" />
    </div>
);

/**
 * Form field wrapper with consistent label styling
 */
export const ModalField = ({ label, required, children }) => (
    <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {label} {required && <span className="text-destructive">*</span>}
        </label>
        {children}
    </div>
);

export default ModernModalLayout;
