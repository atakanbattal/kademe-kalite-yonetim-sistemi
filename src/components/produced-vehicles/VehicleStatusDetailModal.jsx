import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Wrench, Clock, Eye, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeInStatus } from '@/lib/date-fns-utils';

const VehicleStatusDetailModal = ({ 
    isOpen, 
    setIsOpen, 
    status, 
    vehicles, 
    loading, 
    onOpenStatusModal, 
    onEditDuration, 
    onManageFaults, 
    onViewDetails 
}) => {
    
  const [timeInStatusMap, setTimeInStatusMap] = useState({});

  const filteredVehicles = useMemo(() => {
    if (!vehicles || !status) return [];
    if (status === 'Tümü') return vehicles;
    if (status === 'Kalitede Bekleyen') return vehicles.filter(v => ['Kaliteye Girdi', 'Kontrol Başladı', 'Kontrol Bitti'].includes(v.status));
    return vehicles.filter(v => v.status === status);
  }, [vehicles, status]);
    
  const title = useMemo(() => {
    if (!status) return "Araç Listesi";
    if (status === 'Kalitede Bekleyen') return "Kalitede Bekleyen Araçlar";
    return `${status} Durumundaki Araçlar`;
  }, [status]);

  const calculateTimes = useCallback(() => {
    const newTimes = {};
    filteredVehicles.forEach(vehicle => {
      newTimes[vehicle.id] = formatTimeInStatus(vehicle);
    });
    setTimeInStatusMap(newTimes);
  }, [filteredVehicles]);

  useEffect(() => {
    if (isOpen) {
      calculateTimes();
      const intervalId = setInterval(calculateTimes, 60000); // Update every minute
      return () => clearInterval(intervalId);
    }
  }, [isOpen, calculateTimes]);

  const getStatusVariant = (status) => {
    switch (status) {
      case 'Kaliteye Girdi': return 'secondary';
      case 'Kontrol Başladı': return 'warning';
      case 'Kontrol Bitti': return 'purple';
      case 'Yeniden İşlemde': return 'destructive';
      case 'Ar-Ge\'de': return 'info';
      case 'Sevk Hazır': return 'success';
      case 'Sevk Edildi': return 'outline';
      default: return 'outline';
    }
  };

  const getTotalFaults = (faults) => {
    if (!faults || faults.length === 0) return 0;
    return faults.filter(f => !f.is_resolved).reduce((total, fault) => total + (fault.quantity || 1), 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-6xl w-full h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Bu listede seçilen duruma göre filtrelenmiş araçlar görüntülenmektedir.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Şasi No</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Araç Tipi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Durumda Geçen Süre</TableHead>
                  <TableHead>Hata Sayısı</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredVehicles.length > 0 ? (
                  filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewDetails(vehicle)}>
                      <TableCell className="font-medium">{vehicle.chassis_no}</TableCell>
                      <TableCell>{vehicle.customer_name}</TableCell>
                      <TableCell>{vehicle.vehicle_type}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(vehicle.status)}>{vehicle.status}</Badge></TableCell>
                      <TableCell>{timeInStatusMap[vehicle.id] || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getTotalFaults(vehicle.quality_inspection_faults) > 0 ? "destructive" : "secondary"}>
                            {getTotalFaults(vehicle.quality_inspection_faults)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Menüyü aç</span>
                                    <MoreHorizontal className="h-4 w-4 flex-shrink-0 text-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onViewDetails(vehicle);}}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    <span>Detayları Gör</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onOpenStatusModal(vehicle);}}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Durum Değiştir</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onManageFaults(vehicle);}}>
                                    <AlertTriangle className="mr-2 h-4 w-4 text-yellow-600" />
                                    <span>Hataları Yönet</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onEditDuration(vehicle);}}>
                                    <Clock className="mr-2 h-4 w-4" />
                                    <span>Süreyi Düzenle</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan="7" className="h-24 text-center">
                      Bu durumda araç bulunmamaktadır.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleStatusDetailModal;