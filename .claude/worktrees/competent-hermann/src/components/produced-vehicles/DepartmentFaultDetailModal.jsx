import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const DepartmentFaultDetailModal = ({ isOpen, setIsOpen, departmentName, faults }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2.5 rounded-lg"><AlertTriangle className="h-5 w-5 text-white" /></div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{departmentName} Departmanı Hata Detayları</h1>
              <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Hatalar ve ilgili araçlar</p>
            </div>
            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Hata</span>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
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
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentFaultDetailModal;