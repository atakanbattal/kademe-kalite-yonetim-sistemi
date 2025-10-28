import React from 'react';
    import { motion } from 'framer-motion';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { MoreVertical, Edit, Eye, Trash2, Clock, Play, CheckCircle, Truck, AlertTriangle, Wrench, RefreshCw, Timer } from 'lucide-react';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
    import { parseISO, differenceInMilliseconds } from 'date-fns';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { formatDuration } from '@/lib/formatDuration.js';

    const FaultStatusIndicator = ({ faults, onClick }) => {
        if (!faults) return <Badge variant="secondary">0</Badge>;

        const activeFaults = faults.filter(f => !f.is_resolved).length;
        const resolvedFaults = faults.filter(f => f.is_resolved).length;

        const content = (
            <div className="flex items-center gap-2 cursor-pointer" onClick={onClick}>
                {activeFaults > 0 ? (
                    <Badge variant="destructive" className="flex items-center gap-1.5 pl-1.5 pr-2.5 rounded-full">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {activeFaults}
                    </Badge>
                ) : <Badge variant="destructive" className="flex items-center gap-1.5 pl-1.5 pr-2.5 rounded-full bg-gray-300 dark:bg-gray-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> 0
                    </Badge>
                }
                {resolvedFaults > 0 ? (
                    <Badge variant="success" className="flex items-center gap-1.5 pl-1.5 pr-2.5 rounded-full">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {resolvedFaults}
                    </Badge>
                ) : <Badge variant="success" className="flex items-center gap-1.5 pl-1.5 pr-2.5 rounded-full bg-gray-300 dark:bg-gray-700">
                         <CheckCircle className="h-3.5 w-3.5" /> 0
                    </Badge>
                }
            </div>
        );
        
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent>
                        <p>Aktif Hata: {activeFaults}</p>
                        <p>Giderilen Hata: {resolvedFaults}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const VehicleTable = ({ vehicles, onEdit, onView, onDelete, onUpdateStatus, onOpenFaults, onViewTimeDetails }) => {
        const { user, profile } = useAuth();
        const userEmail = user?.email;
        const userRole = profile?.role;
    
        const hasSpecialAccess = () => {
            const specialQualityEmails = [
              'atakan.battal@kademe.com.tr',
              'yunus.senel@kademe.com.tr',
              'safa.bagci@kademe.com.tr'
            ];
            return userRole === 'admin' || specialQualityEmails.includes(userEmail);
        };

        const getStatusInfo = (status) => {
            switch (status) {
                case 'Kaliteye Girdi': return { variant: 'info', icon: <Play className="w-3 h-3 mr-1.5" />, text: 'Kaliteye Girdi' };
                case 'Kontrol Başladı': return { variant: 'warning', icon: <Play className="w-3 h-3 mr-1.5" />, text: 'Kontrol Başladı' };
                case 'Kontrol Bitti': return { variant: 'purple', icon: <CheckCircle className="w-3 h-3 mr-1.5" />, text: 'Kontrol Bitti' };
                case 'Yeniden İşlemde': return { variant: 'destructive', icon: <Wrench className="w-3 h-3 mr-1.5" />, text: 'Yeniden İşlemde' };
                case 'Sevk Hazır': return { variant: 'success', icon: <CheckCircle className="w-3 h-3 mr-1.5" />, text: 'Sevk Hazır' };
                case 'Sevk Edildi': return { variant: 'secondary', icon: <Truck className="w-3 h-3 mr-1.5" />, text: 'Sevk Edildi' };
                default: return { variant: 'secondary', icon: <Clock className="w-3 h-3 mr-1.5" />, text: status };
            }
        };

        const getDmoStatusInfo = (dmoStatus) => {
            switch (dmoStatus) {
                case 'DMO Bekliyor': return { variant: 'info', text: 'DMO Bekliyor' };
                case 'DMO Geçti': return { variant: 'success', text: 'DMO Geçti' };
                case 'DMO Kaldı': return { variant: 'destructive', text: 'DMO Kaldı' };
                default: return null;
            }
        };
        
        const formatElapsedTime = (vehicle) => {
            if (['Sevk Edildi'].includes(vehicle.status)) {
                return 'N/A';
            }
            if (!vehicle.status_entered_at) return '-';
            try {
                const date = parseISO(vehicle.status_entered_at);
                const now = new Date();
                const diffMs = differenceInMilliseconds(now, date);
                return formatDuration(diffMs);
            } catch (error) {
                return 'Geçersiz tarih';
            }
        };

        const handleStatusUpdate = (e, vehicle, newStatus) => {
            e.stopPropagation();
            onUpdateStatus(vehicle.id, newStatus);
        };

        const renderActionItems = (vehicle) => {
            const { status } = vehicle;
            const isActionDisabled = !hasSpecialAccess();

            const ActionItem = ({ newStatus, label, icon, condition }) => {
                if (!condition) return null;
                
                const item = (
                    <DropdownMenuItem onClick={(e) => handleStatusUpdate(e, vehicle, newStatus)} disabled={isActionDisabled}>
                        {icon} {label}
                    </DropdownMenuItem>
                );

                if (isActionDisabled) {
                    return (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild><div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm opacity-50 outline-none">{icon} {label}</div></TooltipTrigger>
                                <TooltipContent><p>Bu işlem için yetkiniz yok.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }
                return item;
            };

            return (
                <>
                    <ActionItem newStatus="control_start" label="Kontrole Başla" icon={<Play className="mr-2 h-4 w-4" />} condition={['Kaliteye Girdi', 'Kontrol Bitti'].includes(status)} />
                    <ActionItem newStatus="control_end" label="Kontrolü Bitir" icon={<CheckCircle className="mr-2 h-4 w-4" />} condition={status === 'Kontrol Başladı'} />
                    
                    <ActionItem newStatus="rework_start" label="Yeniden İşleme Gönder" icon={<Wrench className="mr-2 h-4 w-4" />} condition={status === 'Kontrol Bitti'} />
                    <ActionItem newStatus="ready_to_ship" label="Onayla (Sevk Hazır)" icon={<CheckCircle className="mr-2 h-4 w-4 text-green-500" />} condition={status === 'Kontrol Bitti'} />
                    
                    <ActionItem newStatus="shipped" label="Sevk Et (Kapat)" icon={<Truck className="mr-2 h-4 w-4" />} condition={status === 'Sevk Hazır'} />
                    
                    <DropdownMenuSeparator />
                    <ActionItem newStatus="quality_entry" label="Tekrar Kaliteye Al" icon={<RefreshCw className="mr-2 h-4 w-4" />} condition={!['Kaliteye Girdi', 'Kontrol Başladı'].includes(status)} />
                </>
            );
        };

        return (
            <div className="overflow-x-auto">
                <table className="data-table w-full">
                    <thead>
                        <tr>
                            <th>Şasi No</th>
                            <th>Seri No</th>
                            <th>Araç Tipi</th>
                            <th>Hata Durumu</th>
                            <th>Müşteri</th>
                            <th>Kalite Durumu</th>
                            <th>DMO Durumu</th>
                            <th>Durumda Geçen Süre</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vehicles.map((vehicle, index) => {
                            const statusInfo = getStatusInfo(vehicle.status);
                            const dmoStatusInfo = getDmoStatusInfo(vehicle.dmo_status);
                            const isActionDisabled = !hasSpecialAccess();
                            return (
                                <motion.tr
                                    key={vehicle.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    className="cursor-pointer"
                                    onClick={() => onView(vehicle)}
                                >
                                    <td className="font-mono text-foreground">{vehicle.chassis_no}</td>
                                    <td className="font-mono text-muted-foreground">{vehicle.serial_no}</td>
                                    <td>{vehicle.vehicle_type}</td>
                                    <td><FaultStatusIndicator faults={vehicle.quality_inspection_faults} onClick={(e) => { e.stopPropagation(); onOpenFaults(vehicle); }} /></td>
                                    <td>{vehicle.customer_name || '-'}</td>
                                    <td><Badge variant={statusInfo.variant} className="flex items-center w-fit">{statusInfo.icon}{statusInfo.text}</Badge></td>
                                    <td>{dmoStatusInfo ? <Badge variant={dmoStatusInfo.variant}>{dmoStatusInfo.text}</Badge> : <Badge variant="secondary">-</Badge>}</td>
                                    <td>{formatElapsedTime(vehicle)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Menüyü aç</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onView(vehicle)}}><Eye className="mr-2 h-4 w-4" /> Detayları Gör</DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onViewTimeDetails(vehicle)}} disabled={isActionDisabled}><Timer className="mr-2 h-4 w-4" /> Süreleri Yönet</DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onEdit(vehicle)}} disabled={isActionDisabled}><Edit className="mr-2 h-4 w-4" /> Temel Bilgileri Düzenle</DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); onOpenFaults(vehicle)}} disabled={isActionDisabled}><AlertTriangle className="mr-2 h-4 w-4" /> Hataları Yönet</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {renderActionItems(vehicle)}
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive" disabled={isActionDisabled}><Trash2 className="mr-2 h-4 w-4" /> Kaydı Sil</DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                            <AlertDialogDescription>Bu işlem geri alınamaz. Bu araç kaydını ve ilişkili tüm verileri kalıcı olarak silecektir.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDelete(vehicle.id)}>Sil</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    export default VehicleTable;