import React from 'react';
    import { motion } from 'framer-motion';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { MoreVertical, Edit, Eye, Trash2, Clock, Play, CheckCircle, Truck, AlertTriangle, Wrench, RefreshCw, Timer, FlaskConical } from 'lucide-react';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
    import { parseISO, differenceInMilliseconds, differenceInDays, format, startOfDay } from 'date-fns';
    import { tr } from 'date-fns/locale';
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

    const VehicleTable = ({ vehicles, onEdit, onView, onDelete, onUpdateStatus, onOpenFaults, onViewTimeDetails, onSort, sortConfig, getSortIcon }) => {
        const { user, profile } = useAuth();
        const userEmail = user?.email;
        const userRole = profile?.role;
    
        const hasSpecialAccess = () => {
            const userEmailLower = userEmail?.toLowerCase();
            const specialQualityEmails = [
              'atakan.battal@kademe.com.tr',
              'yunus.senel@kademe.com.tr',
              'safa.bagci@kademe.com.tr',
              'ramazan.boztilki@kademe.com.tr'
            ].map(email => email.toLowerCase());
            return userRole === 'admin' || specialQualityEmails.includes(userEmailLower);
        };

        const getStatusInfo = (status) => {
            switch (status) {
                case 'Kaliteye Girdi': return { variant: 'info', icon: <Play className="w-3 h-3 mr-1.5" />, text: 'Kaliteye Girdi' };
                case 'Kontrol Başladı': return { variant: 'warning', icon: <Play className="w-3 h-3 mr-1.5" />, text: 'Kontrol Başladı' };
                case 'Kontrol Bitti': return { variant: 'purple', icon: <CheckCircle className="w-3 h-3 mr-1.5" />, text: 'Kontrol Bitti' };
                case 'Yeniden İşlemde': return { variant: 'destructive', icon: <Wrench className="w-3 h-3 mr-1.5" />, text: 'Yeniden İşlemde' };
                case 'Yeniden İşlem Bitti': return { variant: 'warning', icon: <CheckCircle className="w-3 h-3 mr-1.5" />, text: 'Yeniden İşlem Bitti' };
                case 'Sevk Bilgisi Bekleniyor': return { variant: 'warning', icon: <Clock className="w-3 h-3 mr-1.5" />, text: 'Sevk Bilgisi Bekleniyor' };
                case 'Sevk Hazır': return { variant: 'success', icon: <CheckCircle className="w-3 h-3 mr-1.5" />, text: 'Sevk Hazır' };
                case 'Sevk Edildi': return { variant: 'secondary', icon: <Truck className="w-3 h-3 mr-1.5" />, text: 'Sevk Edildi' };
                case 'Ar-Ge\'de': return { variant: 'info', icon: <FlaskConical className="w-3 h-3 mr-1.5" />, text: 'Ar-Ge\'de' };
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

            let start, end;
            const now = new Date();

            // Duruma göre başlangıç zamanını belirle
            switch (vehicle.status) {
                case 'Ar-Ge\'de':
                    // Timeline events'ten en son arge_sent'i bul
                    const argeTimeline = vehicle.vehicle_timeline_events || [];
                    const latestArgeSent = argeTimeline
                        .filter(e => e.event_type === 'arge_sent')
                        .sort((a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp))[0];
                    
                    if (latestArgeSent) {
                        const argeReturned = argeTimeline
                            .filter(e => e.event_type === 'arge_returned' && new Date(e.event_timestamp) > new Date(latestArgeSent.event_timestamp))
                            .sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp))[0];
                        
                        start = latestArgeSent.event_timestamp;
                        end = argeReturned ? argeReturned.event_timestamp : now;
                    } else {
                        start = vehicle.status_entered_at;
                        end = now;
                    }
                    break;
                case 'Yeniden İşlem':
                case 'Yeniden İşlemde':
                    // Önce timeline events'ten kontrol et
                    const timelineEvents = vehicle.vehicle_timeline_events || [];
                    const latestReworkStart = timelineEvents
                        .filter(e => e.event_type === 'rework_start')
                        .sort((a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp))[0];
                    
                    if (latestReworkStart) {
                        // Timeline'da rework_start var, rework_end var mı kontrol et
                        const reworkEnd = timelineEvents
                            .filter(e => e.event_type === 'rework_end' && new Date(e.event_timestamp) > new Date(latestReworkStart.event_timestamp))
                            .sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp))[0];
                        
                        if (reworkEnd) {
                            // Rework bitmiş
                            start = latestReworkStart.event_timestamp;
                            end = reworkEnd.event_timestamp;
                        } else {
                            // Rework devam ediyor - dinamik olarak şu anki zamana kadar
                            start = latestReworkStart.event_timestamp;
                            end = now;
                        }
                    } else {
                        // Timeline'da yoksa quality_inspection_cycles'dan kontrol et
                        const activeReworkCycle = vehicle.quality_inspection_cycles
                            ?.filter(c => c.rework_start_at && !c.rework_end_at)
                            .sort((a, b) => new Date(b.rework_start_at) - new Date(a.rework_start_at))[0];
                        
                        start = activeReworkCycle?.rework_start_at || vehicle.status_entered_at;
                        end = now;
                    }
                    break;

                case 'Kontrol Başladı':
                    // Timeline events'ten en son control_start'i bul
                    const timeline = vehicle.vehicle_timeline_events || [];
                    const latestControlStart = timeline
                        .filter(e => e.event_type === 'control_start')
                        .sort((a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp))[0];
                    
                    if (latestControlStart) {
                        const controlEnd = timeline
                            .filter(e => e.event_type === 'control_end' && new Date(e.event_timestamp) > new Date(latestControlStart.event_timestamp))
                            .sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp))[0];
                        
                        start = latestControlStart.event_timestamp;
                        end = controlEnd ? controlEnd.event_timestamp : now;
                    } else {
                        start = vehicle.status_entered_at;
                        end = now;
                    }
                    break;

                default:
                    // Diğer durumlar için status_entered_at kullan
                    start = vehicle.status_entered_at;
                    end = now;
                    break;
            }

            // Fallback if primary start time is missing
            if (!start) {
                start = vehicle.created_at;
            }

            if (!start) {
                return '-';
            }

            try {
                const startDate = start instanceof Date ? start : parseISO(start);
                const endDate = end instanceof Date ? end : (end ? parseISO(end) : now);
                const diffMs = differenceInMilliseconds(endDate, startDate);
                
                if (diffMs < 0) {
                    return '0 dk';
                }
                
                return formatDuration(diffMs);
            } catch (error) {
                console.error('formatElapsedTime error:', error, { vehicle, start, end });
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
                
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuItem 
                                    onClick={(e) => handleStatusUpdate(e, vehicle, newStatus)} 
                                    disabled={isActionDisabled}
                                    className={isActionDisabled ? 'cursor-not-allowed opacity-50' : ''}
                                >
                                    {icon} {label}
                                </DropdownMenuItem>
                            </TooltipTrigger>
                            {isActionDisabled && (
                                <TooltipContent>
                                    <p>Bu işlem için yetkiniz yok.</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                );
            };

            return (
                <>
                    <ActionItem newStatus="control_start" label="Kontrole Başla" icon={<Play className="mr-2 h-4 w-4" />} condition={['Kaliteye Girdi', 'Kontrol Bitti'].includes(status)} />
                    <ActionItem newStatus="control_end" label="Kontrolü Bitir" icon={<CheckCircle className="mr-2 h-4 w-4" />} condition={status === 'Kontrol Başladı'} />
                    
                    <ActionItem newStatus="rework_start" label="Yeniden İşleme Gönder" icon={<Wrench className="mr-2 h-4 w-4" />} condition={status === 'Kontrol Bitti'} />
                    <ActionItem newStatus="rework_end" label="Yeniden İşlem Bitti" icon={<CheckCircle className="mr-2 h-4 w-4 text-orange-500" />} condition={status === 'Yeniden İşlemde'} />
                    
                    <ActionItem newStatus="waiting_for_shipping_info" label="Sevk Bilgisi Bekleniyor" icon={<Clock className="mr-2 h-4 w-4 text-orange-500" />} condition={['Kontrol Bitti', 'Yeniden İşlem Bitti', 'Sevk Hazır'].includes(status)} />
                    <ActionItem newStatus="ready_to_ship" label="Onayla (Sevk Hazır)" icon={<CheckCircle className="mr-2 h-4 w-4 text-green-500" />} condition={['Kontrol Bitti', 'Yeniden İşlem Bitti', 'Sevk Bilgisi Bekleniyor'].includes(status)} />
                    
                    <ActionItem newStatus="shipped" label="Sevk Et (Kapat)" icon={<Truck className="mr-2 h-4 w-4" />} condition={['Sevk Hazır', 'Sevk Bilgisi Bekleniyor'].includes(status)} />
                    
                    <ActionItem newStatus="arge_sent" label="Ar-Ge'ye Gönder" icon={<FlaskConical className="mr-2 h-4 w-4 text-purple-500" />} condition={['Kontrol Bitti', 'Yeniden İşlem Bitti'].includes(status)} />
                    <ActionItem newStatus="arge_returned" label="Ar-Ge'den Döndü" icon={<FlaskConical className="mr-2 h-4 w-4 text-blue-500" />} condition={status === 'Ar-Ge\'de'} />
                    
                    <DropdownMenuSeparator />
                    <ActionItem newStatus="quality_entry" label="Tekrar Kaliteye Al" icon={<RefreshCw className="mr-2 h-4 w-4" />} condition={['Yeniden İşlem Bitti', 'Kontrol Bitti', 'Sevk Bilgisi Bekleniyor', 'Ar-Ge\'de'].includes(status)} />
                </>
            );
        };

        return (
            <div className="overflow-x-auto">
                <table className="data-table w-full">
                    <thead>
                        <tr>
                            {onSort ? (
                                <>
                                    <th 
                                        className="cursor-pointer hover:bg-secondary/50 select-none"
                                        onClick={() => onSort('chassis_no')}
                                    >
                                        <div className="flex items-center">
                                            Şasi No
                                            {getSortIcon && getSortIcon('chassis_no')}
                                        </div>
                                    </th>
                                    <th 
                                        className="cursor-pointer hover:bg-secondary/50 select-none"
                                        onClick={() => onSort('serial_no')}
                                    >
                                        <div className="flex items-center">
                                            Seri No
                                            {getSortIcon && getSortIcon('serial_no')}
                                        </div>
                                    </th>
                                    <th 
                                        className="cursor-pointer hover:bg-secondary/50 select-none"
                                        onClick={() => onSort('vehicle_type')}
                                    >
                                        <div className="flex items-center">
                                            Araç Tipi
                                            {getSortIcon && getSortIcon('vehicle_type')}
                                        </div>
                                    </th>
                                    <th>Hata Durumu</th>
                                    <th 
                                        className="cursor-pointer hover:bg-secondary/50 select-none"
                                        onClick={() => onSort('customer_name')}
                                    >
                                        <div className="flex items-center">
                                            Müşteri
                                            {getSortIcon && getSortIcon('customer_name')}
                                        </div>
                                    </th>
                                    <th 
                                        className="cursor-pointer hover:bg-secondary/50 select-none"
                                        onClick={() => onSort('status')}
                                    >
                                        <div className="flex items-center">
                                            Kalite Durumu
                                            {getSortIcon && getSortIcon('status')}
                                        </div>
                                    </th>
                                    <th>DMO Durumu</th>
                                    <th>Durumda Geçen Süre</th>
                                    <th>Termin / Kalan</th>
                                </>
                            ) : (
                                <>
                            <th>Şasi No</th>
                            <th>Seri No</th>
                            <th>Araç Tipi</th>
                            <th>Hata Durumu</th>
                            <th>Müşteri</th>
                            <th>Kalite Durumu</th>
                            <th>DMO Durumu</th>
                            <th>Durumda Geçen Süre</th>
                            <th>Termin / Kalan</th>
                                </>
                            )}
                            <th className="px-4 py-2 text-center whitespace-nowrap z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
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
                                    <td>
                                        {vehicle.delivery_due_date ? (() => {
                                            const dueDate = startOfDay(parseISO(vehicle.delivery_due_date));
                                            const today = startOfDay(new Date());
                                            const daysRemaining = differenceInDays(dueDate, today);
                                            return (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(parseISO(vehicle.delivery_due_date), 'dd.MM.yyyy', { locale: tr })}
                                                    </span>
                                                    {vehicle.status !== 'Sevk Edildi' && (
                                                        <Badge 
                                                            variant={
                                                                daysRemaining < 0 
                                                                    ? 'destructive'
                                                                    : daysRemaining <= 3
                                                                        ? 'warning'
                                                                        : 'secondary'
                                                            }
                                                            className="text-xs w-fit"
                                                        >
                                                            {daysRemaining < 0 
                                                                ? `${Math.abs(daysRemaining)} gün geçti`
                                                                : `${daysRemaining} gün`
                                                            }
                                                        </Badge>
                                                    )}
                                                </div>
                                            );
                                        })() : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Menüyü aç</span>
                                                    <MoreVertical className="h-4 w-4 flex-shrink-0 text-foreground" />
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