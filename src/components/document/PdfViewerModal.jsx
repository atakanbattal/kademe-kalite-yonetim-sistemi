import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Download, Loader2 } from 'lucide-react';
    import { sanitizeFileName } from '@/lib/utils';

    const PdfViewerModal = ({ isOpen, setIsOpen, pdfUrl, title }) => {

        const handleDownload = () => {
            if (!pdfUrl) return;
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.target = '_blank';
            link.download = sanitizeFileName(title ? `${title}.pdf` : 'belge.pdf');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex justify-between items-center">
                            <span className="truncate pr-4">{title || 'PDF Görüntüleyici'}</span>
                            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!pdfUrl}>
                                <Download className="w-4 h-4 mr-2" />
                                İndir
                            </Button>
                        </DialogTitle>
                        <DialogDescription>
                            PDF belgesini aşağıda görüntüleyebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow mt-4 border rounded-md flex items-center justify-center">
                        {pdfUrl ? (
                            <iframe
                                src={pdfUrl}
                                title={title || 'PDF Viewer'}
                                width="100%"
                                height="100%"
                                className="border-0"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <p>PDF yükleniyor...</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    export default PdfViewerModal;