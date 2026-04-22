import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SupplierScoreModal = ({ isOpen, setIsOpen, supplier }) => {
    if (!supplier) return null;

    const latestScore = supplier.supplier_scores && supplier.supplier_scores.length > 0
        ? supplier.supplier_scores.sort((a, b) => new Date(b.period) - new Date(a.period))[0]
        : null;

    const getGradeBadge = (grade) => {
        switch (grade) {
           case 'A': return <Badge className="bg-green-500 text-white text-2xl p-4">A</Badge>;
           case 'B': return <Badge className="bg-blue-500 text-white text-2xl p-4">B</Badge>;
           case 'C': return <Badge className="bg-yellow-500 text-white text-2xl p-4">C</Badge>;
           case 'D': return <Badge className="bg-red-500 text-white text-2xl p-4">D</Badge>;
           default: return <Badge variant="secondary" className="text-2xl p-4">N/A</Badge>;
       }
   };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tedarikçi Puanı: {supplier.name}</DialogTitle>
                    <DialogDescription>
                        En son performans değerlendirme sonuçları.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 text-center">
                    {latestScore ? (
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-muted-foreground">
                                {new Date(latestScore.period).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })} Dönemi
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-bold text-primary">{latestScore.final_score}</span>
                                <span className="text-2xl text-muted-foreground">/ 100</span>
                            </div>
                            {getGradeBadge(latestScore.grade)}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Bu tedarikçi için henüz puanlama verisi girilmemiş.</p>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierScoreModal;