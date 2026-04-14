import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Eye, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getEquipmentDisplayStatus } from '@/components/equipment/equipmentDisplayStatus';

const EquipmentList = ({ equipments, onEdit, onView, onDelete, onSort, sortConfig, getSortIcon }) => {
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    
    const getStatusVariant = (status) => {
        switch (status) {
            case 'Aktif': return 'success';
            case 'Zimmetli': return 'default';
            case 'Bakımda': return 'default';
            case 'Kullanım Dışı': return 'destructive';
            case 'Hurdaya Ayrıldı': return 'destructive';
            default: return 'secondary';
        }
    };

    const getCalibrationStatus = (calibrations, equipmentStatus) => {
        // Hurdaya ayrılmış ekipmanlar için kalibrasyon durumu gösterilmez
        if (equipmentStatus === 'Hurdaya Ayrıldı') {
            return { text: 'Hurdaya Ayrıldı', variant: 'destructive', date: null, daysLeft: null };
        }
        
        if (!calibrations || calibrations.length === 0) {
            return { text: 'Girilmemiş', variant: 'secondary', date: null, daysLeft: null };
        }
        
        // Sadece aktif kalibrasyonları kontrol et
        const activeCalibrations = calibrations.filter(cal => cal.is_active !== false);
        if (activeCalibrations.length === 0) {
            return { text: 'Pasif', variant: 'secondary', date: null, daysLeft: null };
        }
        
        const latestCalibration = [...activeCalibrations].sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
        const nextDate = new Date(latestCalibration.next_calibration_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const timeDiff = nextDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        let text, variant;
        if (daysLeft < 0) {
            text = `Geçmiş (${Math.abs(daysLeft)} gün)`;
            variant = 'destructive';
        } else if (daysLeft <= 30) {
            text = `Yaklaşıyor (${daysLeft} gün)`;
            variant = 'warning';
        } else {
            text = 'Tamam';
            variant = 'success';
        }
        return { text, variant, date: nextDate.toLocaleDateString('tr-TR'), daysLeft };
    };
    
    if (equipments.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">Filtreye uygun ekipman bulunamadı.</div>;
    }

    return (
        <>
            <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ekipmanı silmek istiyor musunuz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. Bu ekipman kaydı ve ilişkili kalibrasyon / zimmet verileri kalıcı olarak kaldırılır.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteId && onDelete) onDelete(pendingDeleteId);
                                setPendingDeleteId(null);
                            }}
                        >
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <TooltipProvider delayDuration={250}>
                <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="data-table document-module-table">
                <thead>
                    <tr>
                        {onSort ? (
                            <>
                                <th 
                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                    onClick={() => onSort('name')}
                                >
                                    <div className="flex items-center">
                                        Ekipman Adı
                                        {getSortIcon && getSortIcon('name')}
                                    </div>
                                </th>
                                <th 
                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                    onClick={() => onSort('serial_number')}
                                >
                                    <div className="flex items-center">
                                        Seri Numarası
                                        {getSortIcon && getSortIcon('serial_number')}
                                    </div>
                                </th>
                                <th 
                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                    onClick={() => onSort('brand_model')}
                                >
                                    <div className="flex items-center">
                                        Model
                                        {getSortIcon && getSortIcon('brand_model')}
                                    </div>
                                </th>
                                <th 
                                    className="cursor-pointer hover:bg-secondary/50 select-none"
                                    onClick={() => onSort('status')}
                                >
                                    <div className="flex items-center">
                                        Durum
                                        {getSortIcon && getSortIcon('status')}
                                    </div>
                                </th>
                                <th>Zimmet Durumu</th>
                                <th>Kalibrasyon Durumu</th>
                                <th>Sonraki Kalibrasyon</th>
                            </>
                        ) : (
                            <>
                        <th>Ekipman Adı</th>
                        <th>Seri Numarası</th>
                        <th>Model</th>
                        <th>Durum</th>
                        <th>Zimmet Durumu</th>
                        <th>Kalibrasyon Durumu</th>
                        <th>Sonraki Kalibrasyon</th>
                            </>
                        )}
                        <th className="text-right">İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    {equipments.map((eq, index) => {
                        const calStatus = getCalibrationStatus(eq.equipment_calibrations, eq.status);
                        // Aktif zimmet kontrolü
                        const activeAssignment = eq.equipment_assignments?.find(a => a.is_active);
                        const assignedPersonnel = activeAssignment?.personnel?.full_name;
                        const displayStatus = getEquipmentDisplayStatus(eq);
                        
                        return (
                        <motion.tr
                            key={eq.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            onClick={() => onView && onView(eq)}
                            className="cursor-pointer"
                        >
                            <td className="font-medium text-foreground">{eq.name}</td>
                            <td className="font-mono text-muted-foreground">{eq.serial_number}</td>
                            <td className="text-sm text-muted-foreground">{eq.brand_model || eq.model || '-'}</td>
                            <td><Badge variant={getStatusVariant(displayStatus)}>{displayStatus}</Badge></td>
                            <td>
                                {assignedPersonnel ? (
                                    <span className="text-sm text-foreground">{assignedPersonnel}</span>
                                ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                )}
                            </td>
                            <td>
                                <Badge variant={calStatus.variant}>{calStatus.text}</Badge>
                            </td>
                            <td>
                                <span className="text-muted-foreground text-sm">{calStatus.date || '-'}</span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()} className="align-middle">
                                <div className="inline-flex items-center justify-end gap-0.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                aria-label="Detayları gör"
                                                onClick={() => onView && onView(eq)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Detayları gör</TooltipContent>
                                    </Tooltip>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                aria-label="Diğer işlemler"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem
                                                className="cursor-pointer text-sm"
                                                onClick={() => onEdit && onEdit(eq)}
                                            >
                                                <Edit className="mr-2 h-4 w-4" />
                                                Düzenle
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="cursor-pointer text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                                onClick={() => setPendingDeleteId(eq.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Sil
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </td>
                        </motion.tr>
                    )})}
                </tbody>
            </table>
                    </div>
                </div>
            </TooltipProvider>
        </>
    );
};

export default EquipmentList;