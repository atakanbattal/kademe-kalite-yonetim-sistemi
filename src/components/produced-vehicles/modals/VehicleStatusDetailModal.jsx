import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeInStatus } from '@/lib/date-fns-utils';
import { PackageCheck } from 'lucide-react';

const InfoCard = ({ label, value, loading, loadingClassName = "h-6 w-24" }) => (
    <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {loading ? <Skeleton className={`${loadingClassName} mt-1`} /> : <p className="text-xl font-bold text-foreground mt-1">{value || '—'}</p>}
    </div>
);

const VehicleStatusDetailModal = ({ isOpen, setIsOpen, vehicle }) => {
    const [timeInStatus, setTimeInStatus] = useState('');
    const [totalReworkTime, setTotalReworkTime] = useState('');
    const [totalQualityTime, setTotalQualityTime] = useState('');
    const [totalInspectionTime, setTotalInspectionTime] = useState('');
    const [loading, setLoading] = useState(true);

    const calculateTimes = useCallback(() => {
        if (vehicle) {
            setLoading(false);
            setTimeInStatus(formatTimeInStatus(vehicle));

            const hasReworkCycles = vehicle.quality_inspection_cycles?.some(c => c.rework_start_at);

            setTotalReworkTime(formatTimeInStatus({
                ...vehicle,
                status: 'custom', 
                rework_start_at: hasReworkCycles ? true : undefined, // Signal that rework calculation is needed
                quality_inspection_cycles: vehicle.quality_inspection_cycles,
            }));

            setTotalQualityTime(formatTimeInStatus({ 
                ...vehicle,
                status: 'custom', 
                quality_entry_at: vehicle.quality_entry_at, 
                approved_at: vehicle.approved_at,
            }));

            const latestInspectionCycle = vehicle.quality_inspection_cycles
                ?.filter(c => c.inspection_start_at)
                .sort((a, b) => new Date(b.inspection_start_at) - new Date(a.inspection_start_at))[0];

            setTotalInspectionTime(formatTimeInStatus({
                ...vehicle,
                status: 'custom',
                inspection_start_at: latestInspectionCycle?.inspection_start_at,
                inspection_end_at: latestInspectionCycle?.inspection_end_at,
            }));
        } else {
            setLoading(true);
        }
    }, [vehicle]);


    useEffect(() => {
        let intervalId;
        
        if (isOpen) {
            calculateTimes();
            if (vehicle && (vehicle.status !== 'Onaylandı' && vehicle.status !== 'Sevk Edildi')) {
                intervalId = setInterval(calculateTimes, 60000); 
            }
        }
        
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && isOpen && vehicle && (vehicle.status !== 'Onaylandı' && vehicle.status !== 'Sevk Edildi')) {
            calculateTimes();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (intervalId) clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [vehicle, isOpen, calculateTimes]);

    if (!isOpen) return null;

    const isLoading = loading || !vehicle;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><PackageCheck className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{isLoading ? '...' : `Araç Durum Detayı: ${vehicle.chassis_no || 'N/A'}`}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Mevcut durum ve süreç süreleri</p>
                        </div>
                        {!isLoading && vehicle.status && <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{vehicle.status}</span>}
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                        <InfoCard label="Durumda Geçen Süre" value={timeInStatus} loading={isLoading} />
                        <InfoCard label="Toplam Kalite Süresi" value={totalQualityTime} loading={isLoading} />
                        <InfoCard label="Toplam Kontrol Süresi" value={totalInspectionTime} loading={isLoading} />
                        <InfoCard label="Toplam Yeniden İşlem Süresi" value={totalReworkTime} loading={isLoading} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-4 space-y-1">
                        <p><strong>Durumda Geçen Süre:</strong> Aracın mevcut durumuna girdiği andan itibaren geçen toplam süre.</p>
                        <p><strong>Toplam Kalite Süresi:</strong> Aracın kaliteye ilk girdiği andan onaylandığı ana kadar geçen toplam süre.</p>
                        <p><strong>Toplam Kontrol Süresi:</strong> Aracın kontrolünün başladığı ve bittiği zaman arasındaki toplam süre.</p>
                        <p><strong>Toplam Yeniden İşlem Süresi:</strong> Aracın yeniden işleme alındığı ve bittiği zaman arasındaki toplam süre.</p>
                    </div>
                </div>
                <DialogFooter className="shrink-0">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleStatusDetailModal;