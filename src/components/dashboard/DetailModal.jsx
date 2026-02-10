import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const DetailModal = ({ isOpen, onClose, title, description, data, columns, onRowClick }) => {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><FileText className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                            {description && <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{description}</p>}
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Detay</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
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
                <div className="flex justify-end mt-4 px-6 pb-6 shrink-0">
                    <Button variant="outline" onClick={onClose}>
                        Kapat
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DetailModal;

