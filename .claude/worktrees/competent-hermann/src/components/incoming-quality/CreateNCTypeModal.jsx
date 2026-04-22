import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, ClipboardList } from 'lucide-react';

const CreateNCTypeModal = ({ isOpen, setIsOpen, onSelectNCType }) => {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Uygunsuzluk Tipi Seçin</DialogTitle>
                    <DialogDescription>
                        Oluşturmak istediğiniz uygunsuzluk raporunun tipini seçin. Seçiminize göre ilgili form açılacaktır.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-around py-8">
                    <Button
                        variant="outline"
                        className="flex flex-col h-24 w-32 gap-2"
                        onClick={() => onSelectNCType('DF')}
                    >
                        <FileText className="h-8 w-8" />
                        <span>DF Oluştur</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="flex flex-col h-24 w-32 gap-2"
                        onClick={() => onSelectNCType('8D')}
                    >
                        <ClipboardList className="h-8 w-8" />
                        <span>8D Oluştur</span>
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>İptal</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateNCTypeModal;