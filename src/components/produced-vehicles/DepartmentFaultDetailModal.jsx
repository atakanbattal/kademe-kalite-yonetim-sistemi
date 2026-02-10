import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const DepartmentFaultDetailModal = ({ isOpen, setIsOpen, departmentName, faults }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader>
          <DialogTitle>{departmentName} Departmanı Hata Detayları</DialogTitle>
          <DialogDescription>
            Bu departmanda kaydedilen tüm hataların ve ilgili araçların listesi.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hata Tarihi</TableHead>
                <TableHead>Araç Tipi</TableHead>
                <TableHead>Şasi No</TableHead>
                <TableHead>Hata Açıklaması</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faults && faults.length > 0 ? (
                faults.map((fault) => (
                  <TableRow key={fault.id}>
                    <TableCell>{new Date(fault.fault_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell>{fault.inspection?.vehicle_type || 'N/A'}</TableCell>
                    <TableCell>{fault.inspection?.serial_no || 'N/A'}</TableCell>
                    <TableCell className="max-w-xs truncate">{fault.description}</TableCell>
                    <TableCell className="text-right">{fault.quantity}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan="5" className="h-24 text-center">
                    Bu departman için hata bulunamadı.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentFaultDetailModal;