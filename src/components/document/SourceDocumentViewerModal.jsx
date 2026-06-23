import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';

const waitForNextPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
    });
});

const SourceDocumentViewerModal = ({
    isOpen,
    setIsOpen,
    blob,
    previewUrl,
    fallbackPreviewUrl,
    previewMode,
    title,
    onDownload,
}) => {
    const containerRef = useRef(null);
    const styleContainerRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activePreviewUrl, setActivePreviewUrl] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setLoading(false);
            setActivePreviewUrl(null);
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            if (styleContainerRef.current) {
                styleContainerRef.current.innerHTML = '';
            }
            return;
        }

        if (previewMode === 'office-online') {
            setLoading(!!previewUrl);
            setError(previewUrl ? null : 'Belge için önizleme bağlantısı oluşturulamadı.');
            setActivePreviewUrl(previewUrl || null);
            return;
        }

        if (previewMode !== 'docx' || !blob) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const renderDocument = async () => {
            setLoading(true);
            setError(null);

            await waitForNextPaint();
            if (cancelled) return;

            const container = containerRef.current;
            const styleContainer = styleContainerRef.current;
            if (!container) {
                setError('Belge görüntülenemedi.');
                setLoading(false);
                return;
            }

            container.innerHTML = '';
            if (styleContainer) {
                styleContainer.innerHTML = '';
            }

            try {
                await renderAsync(blob, container, styleContainer, {
                    className: 'docx-preview-wrapper',
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: true,
                    breakPages: true,
                });
                if (!cancelled) {
                    setLoading(false);
                }
            } catch (err) {
                console.error('Word önizleme hatası:', err);
                if (!cancelled) {
                    setError('Belge görüntülenemedi.');
                    setLoading(false);
                }
            }
        };

        renderDocument();

        return () => {
            cancelled = true;
        };
    }, [isOpen, blob, previewMode, previewUrl]);

    const handleOfficeFrameLoad = () => {
        setLoading(false);
    };

    const handleOfficeFrameError = () => {
        if (fallbackPreviewUrl && activePreviewUrl !== fallbackPreviewUrl) {
            setActivePreviewUrl(fallbackPreviewUrl);
            setLoading(true);
            return;
        }
        setLoading(false);
        setError('Belge önizlenemedi. Dosyayı indirip Office ile açmayı deneyin.');
    };

    const showDocxPreview = previewMode === 'docx';
    const showOfficePreview = previewMode === 'office-online' && activePreviewUrl && !error;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
                    <DialogTitle className="flex justify-between items-center gap-4">
                        <span className="truncate">{title || 'Belge Görüntüleyici'}</span>
                        {onDownload && (
                            <Button variant="outline" size="sm" onClick={onDownload} className="shrink-0">
                                <Download className="w-4 h-4 mr-2" />
                                İndir
                            </Button>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Word / Excel kaynak dosyasını aşağıda görüntüleyebilirsiniz.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 px-6 pb-6 overflow-hidden flex flex-col relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md border bg-background/90 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="mt-2">Belge yükleniyor...</p>
                        </div>
                    )}
                    {error && !loading && (
                        <div className="w-full flex-1 min-h-[200px] border rounded-md flex flex-col items-center justify-center text-muted-foreground text-center px-6 gap-4">
                            <p>{error}</p>
                            {onDownload && (
                                <Button variant="outline" onClick={onDownload}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Dosyayı İndir
                                </Button>
                            )}
                        </div>
                    )}
                    {showOfficePreview && (
                        <iframe
                            key={activePreviewUrl}
                            src={activePreviewUrl}
                            title={title || 'Office Viewer'}
                            className="w-full flex-1 min-h-0 border rounded-md bg-white"
                            onLoad={handleOfficeFrameLoad}
                            onError={handleOfficeFrameError}
                        />
                    )}
                    {showDocxPreview && !error && (
                        <>
                            <div ref={styleContainerRef} className="hidden" aria-hidden="true" />
                            <div
                                ref={containerRef}
                                className="w-full flex-1 min-h-0 overflow-auto [&_.docx-wrapper]:bg-white [&_.docx-wrapper]:shadow-sm [&_.docx-wrapper]:mx-auto"
                            />
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SourceDocumentViewerModal;
