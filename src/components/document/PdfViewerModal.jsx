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
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
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
                <div className="flex-1 min-h-0 px-6 pb-6">
                    {pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            title={title || 'PDF Viewer'}
                            className="w-full h-full border rounded-md"
                        />
                    ) : (
                        <div className="w-full h-full border rounded-md flex flex-col items-center justify-center text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p className="mt-2">PDF yükleniyor...</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PdfViewerModal;