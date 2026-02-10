import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const DetailModal = ({ isOpen, onClose, title, description, data, columns, onRowClick }) => {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <div className="mt-4">
                    {!data || data.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Veri bulunamadı.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.map((col, idx) => (
                                            <TableHead key={idx}>{col.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((row, rowIdx) => (
                                        <TableRow 
                                            key={rowIdx} 
                                            className={onRowClick ? 'cursor-pointer hover:bg-accent' : ''}
                                            onClick={() => onRowClick && onRowClick(row)}
                                        >
                                            {columns.map((col, colIdx) => (
                                                <TableCell key={colIdx}>
                                                    {col.render ? col.render(row) : row[col.key] || '-'}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
                <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={onClose}>
                        Kapat
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DetailModal;

