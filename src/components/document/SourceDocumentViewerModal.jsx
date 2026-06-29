import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { buildSpreadsheetPreviewSheets } from '@/lib/spreadsheetPreview';

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
    const [spreadsheetSheets, setSpreadsheetSheets] = useState([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setLoading(false);
            setActivePreviewUrl(null);
            setSpreadsheetSheets([]);
            setActiveSheetIndex(0);
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

        if (previewMode === 'spreadsheet' && blob) {
            let cancelled = false;

            const renderSpreadsheet = async () => {
                setLoading(true);
                setError(null);
                setSpreadsheetSheets([]);
                setActiveSheetIndex(0);

                try {
                    const sheets = await buildSpreadsheetPreviewSheets(blob);
                    if (cancelled) return;
                    setSpreadsheetSheets(sheets);
                    setLoading(false);
                } catch (err) {
                    console.error('Excel önizleme hatası:', err);
                    if (!cancelled) {
                        setError('Excel dosyası görüntülenemedi.');
                        setLoading(false);
                    }
                }
            };

            renderSpreadsheet();
            return () => {
                cancelled = true;
            };
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
    const showSpreadsheetPreview = previewMode === 'spreadsheet' && spreadsheetSheets.length > 0 && !error;
    const showOfficePreview = previewMode === 'office-online' && activePreviewUrl && !error;
    const activeSheet = spreadsheetSheets[activeSheetIndex];

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
                    {showSpreadsheetPreview && (
                        <div className="flex flex-1 min-h-0 flex-col gap-2">
                            {spreadsheetSheets.length > 1 && (
                                <div className="flex flex-wrap gap-1 flex-shrink-0">
                                    {spreadsheetSheets.map((sheet, index) => (
                                        <Button
                                            key={sheet.name}
                                            type="button"
                                            size="sm"
                                            variant={index === activeSheetIndex ? 'default' : 'outline'}
                                            className="max-w-[200px] truncate"
                                            onClick={() => setActiveSheetIndex(index)}
                                        >
                                            {sheet.name}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            <div
                                className="flex-1 min-h-0 overflow-auto rounded-md border bg-white p-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_td]:align-top [&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-xs [&_th]:font-semibold"
                                dangerouslySetInnerHTML={{ __html: activeSheet?.html || '' }}
                            />
                        </div>
                    )}
                    {showDocxPreview && !error && (
                        <>
                            <div ref={styleContainerRef} className="hidden" aria-hidden="true" />
                            <div
                                ref={containerRef}
                                className="w-full flex-1 min-h-0 overflow-auto [&_.docx-wrapper]:bg-white [&_.docx-wrapper]:shadow-sm [&_.docx-wrapper]:mx-auto [&_.docx-wrapper_span[style*='font-weight:bold']]:!font-bold [&_.docx-wrapper_span[style*='font-weight: bold']]:!font-bold [&_.docx-wrapper_b]:!font-bold"
                            />
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SourceDocumentViewerModal;
