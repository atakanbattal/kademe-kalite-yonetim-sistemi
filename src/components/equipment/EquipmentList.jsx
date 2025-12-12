import React from 'react';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EquipmentList = ({ equipments, onEdit, onView, onDelete }) => {
    
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
        <div className="overflow-x-auto">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Ekipman Adı</th>
                        <th>Seri Numarası</th>
                        <th>Durum</th>
                        <th>Zimmet Durumu</th>
                        <th>Kalibrasyon Durumu</th>
                        <th>Sonraki Kalibrasyon</th>
                        <th>İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    {equipments.map((eq, index) => {
                        const calStatus = getCalibrationStatus(eq.equipment_calibrations, eq.status);
                        // Aktif zimmet kontrolü
                        const activeAssignment = eq.equipment_assignments?.find(a => a.is_active);
                        const assignedPersonnel = activeAssignment?.personnel?.full_name;
                        
                        // Durum belirleme: Eğer aktif zimmet varsa durum "Zimmetli" olmalı
                        const displayStatus = assignedPersonnel ? 'Zimmetli' : eq.status;
                        
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
                            <td onClick={(e) => e.stopPropagation()}>
                                 <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Menüyü aç</span>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onView && onView(eq)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                <span>Detayları Gör</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onEdit && onEdit(eq)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                <span>Düzenle</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4"/>
                                                    Kaydı Sil
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Bu işlem geri alınamaz. Bu ekipman kaydını ve ilişkili tüm kalibrasyon/zimmet kayıtlarını kalıcı olarak silecektir.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDelete && onDelete(eq.id)}>Sil</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </td>
                        </motion.tr>
                    )})}
                </tbody>
            </table>
        </div>
    );
};

export default EquipmentList;