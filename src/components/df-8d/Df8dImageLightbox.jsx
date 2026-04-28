import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Tam ekran görsel önizleme. Radix modal + react-modal-image üst üste bindiğinde
 * tıklanamayan / kapanmayan katman sorunlarını önlemek için doğrudan body'ye portallanır (yüksek z-index).
 */
export function Df8dImageLightbox({ url, onClose }) {
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    if (!url) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[5500] flex items-center justify-center bg-black/90 p-4"
            onClick={onClose}
        >
            <img
                src={url}
                alt=""
                className="max-h-[min(95vh,100%)] max-w-full object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25"
                aria-label="Kapat"
                onClick={onClose}
            >
                <X className="h-6 w-6" />
            </button>
        </div>,
        document.body
    );
}

export default Df8dImageLightbox;
