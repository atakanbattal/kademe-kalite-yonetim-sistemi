import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const ReportGenerationModal = ({ isOpen, setIsOpen }) => {
    const [period, setPeriod] = useState('last12months');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateReport = () => {
        setIsGenerating(true);
        // Open the report in a new tab. The report page will handle data fetching.
        const reportUrl = `/print/dashboard-report?period=${period}`;
        window.open(reportUrl, '_blank');
        
        // Simulate generation time before closing modal and resetting state
        setTimeout(() => {
            setIsGenerating(false);
            setIsOpen(false);
        }, 1000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Yönetici Özet Raporu Oluştur</DialogTitle>
                    <DialogDescription>
                        Rapor için bir zaman aralığı seçin. Rapor yeni bir sekmede oluşturulacaktır.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger>
                            <SelectValue placeholder="Dönem Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="last3months">Son 3 Ay</SelectItem>
                            <SelectItem value="last6months">Son 6 Ay</SelectItem>
                            <SelectItem value="last12months">Son 12 Ay</SelectItem>
                            <SelectItem value="thisYear">Bu Yıl</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
                        İptal
                    </Button>
                    <Button onClick={handleGenerateReport} disabled={isGenerating}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Oluşturuluyor...
                            </>
                        ) : (
                            'Rapor Oluştur'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReportGenerationModal;