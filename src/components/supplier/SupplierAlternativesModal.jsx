import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Users, Link, PlusCircle, AlertTriangle } from 'lucide-react';

    const SupplierAlternativesModal = ({ isOpen, setIsOpen, supplier, allSuppliers, onCreateAlternative }) => {
        if (!supplier) return null;

        const alternatives = allSuppliers.filter(s => s.alternative_to_supplier_id === supplier.id);
        const mainSupplier = supplier.alternative_to_supplier_id 
            ? allSuppliers.find(s => s.id === supplier.alternative_to_supplier_id)
            : null;

        const handleCreateClick = () => {
            onCreateAlternative(supplier);
            setIsOpen(false);
        }

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="w-6 h-6 text-primary" />
                            Alternatif Tedarikçiler
                        </DialogTitle>
                        <DialogDescription>
                            <span className="font-semibold">{supplier.name}</span> için alternatif ve ana tedarikçi ilişkileri.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        {mainSupplier && (
                            <div>
                                <h3 className="font-semibold text-foreground mb-2">Ana Tedarikçi</h3>
                                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                                    <Link className="w-5 h-5 text-primary" />
                                    <span className="font-medium">{mainSupplier.name}</span>
                                    <Badge variant="outline">{mainSupplier.status}</Badge>
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="font-semibold text-foreground mb-2">Bu Tedarikçinin Alternatifleri</h3>
                            {alternatives.length > 0 ? (
                                <ul className="space-y-2">
                                    {alternatives.map(alt => (
                                        <li key={alt.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                                            <Users className="w-5 h-5 text-muted-foreground" />
                                            <span className="font-medium">{alt.name}</span>
                                            <Badge variant="outline">{alt.status}</Badge>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-4 px-6 border border-dashed rounded-lg">
                                    <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                                    <p className="text-muted-foreground mb-4">Bu tedarikçi için tanımlanmış alternatif bulunmuyor.</p>
                                    <Button onClick={handleCreateClick}>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Alternatif Oluştur
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default SupplierAlternativesModal;