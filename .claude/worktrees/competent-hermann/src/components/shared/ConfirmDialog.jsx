/**
 * ConfirmDialog - Tekrar kullanılabilir onay dialogu
 * Silme, kapatma, iptal gibi işlemler için ortak dialog.
 * Mevcut AlertDialog kullanımlarını BOZMAZ - ek olarak kullanılabilir.
 */
import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Dialog açık mı
 * @param {Function} props.onClose - Kapatma callback
 * @param {Function} props.onConfirm - Onay callback (async olabilir)
 * @param {string} props.title - Dialog başlığı
 * @param {string|React.ReactNode} props.description - Dialog açıklaması
 * @param {string} props.confirmText - Onay butonu metni (default: 'Onayla')
 * @param {string} props.cancelText - İptal butonu metni (default: 'İptal')
 * @param {string} props.variant - Stil ('default' | 'danger' | 'warning')
 * @param {boolean} props.loading - Loading state
 * @param {React.ReactNode} props.icon - Opsiyonel ikon
 */
const ConfirmDialog = ({
    isOpen = false,
    onClose,
    onConfirm,
    title = 'Emin misiniz?',
    description = 'Bu işlem geri alınamaz.',
    confirmText = 'Onayla',
    cancelText = 'İptal',
    variant = 'default',
    loading = false,
    icon = null,
}) => {
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleConfirm = async () => {
        if (!onConfirm) return;
        
        setIsProcessing(true);
        try {
            await onConfirm();
        } catch (err) {
            console.error('ConfirmDialog onConfirm error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const isLoading = loading || isProcessing;

    const confirmButtonClass = cn(
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        variant === 'warning' && 'bg-yellow-500 text-white hover:bg-yellow-600',
    );

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {icon}
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={confirmButtonClass}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default ConfirmDialog;
