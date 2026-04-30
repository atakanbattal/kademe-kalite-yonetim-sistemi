import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { compareDf8dRecordsForModuleList, getNonConformityListTitle } from '@/lib/df8dTextUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const getStatusVariant = (status) => {
    switch (status) {
        case 'Kapatıldı': return 'success';
        case 'Açık': return 'warning';
        case 'Reddedildi': return 'destructive';
        default: return 'default';
    }
};

const RecordListModal = ({ isOpen, setIsOpen, title, records, onRecordClick }) => {
    const sortedRecords = React.useMemo(
        () => (records && records.length ? [...records].sort(compareDf8dRecordsForModuleList) : []),
        [records]
    );
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        İlgili kayıtlar aşağıda listelenmiştir. Detayları görmek için bir kayda tıklayın.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] p-1">
                    <ul className="space-y-2">
                        {sortedRecords.length > 0 ? sortedRecords.map(record => (
                            <li 
                                key={record.id} 
                                onClick={() => { onRecordClick(record); setIsOpen(false); }} 
                                className="p-3 rounded-md hover:bg-secondary transition-colors cursor-pointer flex justify-between items-center"
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="font-semibold text-primary">{record.nc_number || record.mdi_no || getNonConformityListTitle(record)}</p>
                                    <p className="text-sm text-foreground max-w-lg truncate">
                                        {getNonConformityListTitle(record)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{record.department}</p>
                                </div>
                                <Badge variant={getStatusVariant(record.status)}>{record.status}</Badge>
                            </li>
                        )) : (
                            <p className="text-center text-muted-foreground py-8">Bu kategoriye ait kayıt bulunamadı.</p>
                        )}
                    </ul>
                </ScrollArea>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RecordListModal;