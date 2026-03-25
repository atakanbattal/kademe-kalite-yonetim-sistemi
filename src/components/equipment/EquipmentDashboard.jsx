import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    Users,
    XCircle,
    CalendarClock,
    LayoutList,
    HelpCircle,
    Archive,
    UserX,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const borderToIconClass = (colorClass) => {
    if (colorClass.includes('blue')) return 'text-blue-600 dark:text-blue-400';
    if (colorClass.includes('red')) return 'text-red-600 dark:text-red-400';
    if (colorClass.includes('yellow') || colorClass.includes('amber')) return 'text-amber-600 dark:text-amber-400';
    if (colorClass.includes('green')) return 'text-emerald-600 dark:text-emerald-400';
    if (colorClass.includes('slate')) return 'text-slate-600 dark:text-slate-400';
    if (colorClass.includes('orange')) return 'text-orange-600 dark:text-orange-400';
    return 'text-muted-foreground';
};

const StatCard = ({ icon: Icon, title, value, hint, colorClass, tooltip }) => (
    <Card className={cn('overflow-hidden border-l-4 h-full flex flex-col shadow-sm', colorClass)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 gap-2">
            <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold text-foreground leading-snug">{title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {tooltip ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`${title} — açıklama`}
                            >
                                <HelpCircle className="h-4 w-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                            {tooltip}
                        </TooltipContent>
                    </Tooltip>
                ) : null}
                <Icon className={cn('h-5 w-5', borderToIconClass(colorClass))} aria-hidden />
            </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
            {hint ? <p className="text-[11px] sm:text-xs text-muted-foreground mt-2 leading-snug">{hint}</p> : null}
        </CardContent>
    </Card>
);

const SectionLabel = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</p>
);

const EquipmentDashboard = ({ allEquipments = [], loading }) => {
    const analytics = useMemo(() => {
        const list = Array.isArray(allEquipments) ? allEquipments : [];
        const registeredTotal = list.length;
        /** Resmi hurda: hurda ayırma akışında tarih kaydı var (sadece durum seçilmiş eski kayıtlar sayılmaz) */
        let formalScrapCount = 0;
        let overdueCalibration = 0;
        let approachingCalibration = 0;
        let assignedCount = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999);

        list.forEach((eq) => {
            if (eq.status === 'Hurdaya Ayrıldı') {
                if (eq.scrap_date) {
                    formalScrapCount++;
                }
                return;
            }

            const activeCalibrations = (eq.equipment_calibrations || []).filter((cal) => cal.is_active !== false);
            if (activeCalibrations.length > 0) {
                const latestCalibration = [...activeCalibrations].sort(
                    (a, b) => new Date(b.calibration_date) - new Date(a.calibration_date)
                )[0];
                if (latestCalibration?.next_calibration_date) {
                    const nextDate = new Date(latestCalibration.next_calibration_date);
                    nextDate.setHours(0, 0, 0, 0);

                    if (nextDate < today) {
                        overdueCalibration++;
                    } else if (nextDate > today && nextDate <= thirtyDaysFromNow) {
                        approachingCalibration++;
                    }
                }
            }

            if (eq.equipment_assignments?.some((a) => a.is_active)) {
                assignedCount++;
            }
        });

        const statusScrapCount = list.filter((eq) => eq.status === 'Hurdaya Ayrıldı').length;
        const nonScrapCount = registeredTotal - statusScrapCount;
        const unassignedNonScrap = Math.max(0, nonScrapCount - assignedCount);

        return {
            registeredTotal,
            scrapCount: formalScrapCount,
            statusScrapCount,
            legacyScrapWithoutDate: Math.max(0, statusScrapCount - formalScrapCount),
            nonScrapCount,
            unassignedNonScrap,
            overdueCalibration,
            approachingCalibration,
            assignedCount,
        };
    }, [allEquipments]);

    if (loading) {
        return <div className="text-center p-4 text-muted-foreground">Özet yükleniyor…</div>;
    }

    const calibrationStats = [
        {
            icon: XCircle,
            title: 'Kalibrasyonu gecikmiş',
            value: analytics.overdueCalibration,
            hint: 'Son geçerli kalibrasyondaki sonraki tarih bugünden önce.',
            colorClass: 'border-l-red-500',
            tooltip:
                'Kayıtlı envanter içinde hurda olmayan ekipmanlar arasında, aktif kalibrasyon kaydının “sonraki kalibrasyon” tarihi geçmiş olanlar. Hurda cihazlar sayılmaz.',
        },
        {
            icon: AlertTriangle,
            title: 'Kalibrasyon süresi yaklaşıyor',
            value: analytics.approachingCalibration,
            hint: 'Sonraki kalibrasyon tarihi 30 gün içinde.',
            colorClass: 'border-l-amber-500',
            tooltip:
                'Bugünden sonra ama 30 gün içinde sonraki kalibrasyonu olan cihazlar. Tüm kayıtlı envanter (hurda hariç) üzerinden sayılır.',
        },
    ];

    const inventoryStats = [
        {
            icon: LayoutList,
            title: 'Mevcut ekipman',
            value: analytics.registeredTotal,
            hint: 'Sistemde kayıtlı toplam ekipman (hurda kayıtları dahil).',
            colorClass: 'border-l-blue-500',
            tooltip:
                'Veritabanına eklenmiş tüm ekipman kartları. Parçalama: durumu “Hurdaya Ayrıldı” olanlar + hurda olmayanlar; hurda olmayanlar da zimmetli + zimmet dışı olarak ayrılır. Hurda kartı yalnızca resmi (tarihli) hurda sayısını gösterir.',
        },
        {
            icon: Archive,
            title: 'Hurda',
            value: analytics.scrapCount,
            hint: 'Hurda ayırma tarihi kaydı olan resmi hurda kayıtlar. Tablo satırları filtreyle azalabilir.',
            colorClass: 'border-l-slate-500',
            tooltip:
                'Yalnızca “Hurda ayırma” işleminde tarih girilmiş kayıtlar sayılır. Durumu elle “Hurdaya Ayrıldı” yapılmış ama hurda tarihi boş kalmış eski kayıtlar bu sayıya dahil edilmez (veriyi düzeltmek için kaydı açıp hurda işlemini tamamlayın veya durumu güncelleyin). Liste filtreye tabidir; kart filtreye bakmaz.',
        },
        {
            icon: Users,
            title: 'Zimmetli cihaz',
            value: analytics.assignedCount,
            hint: 'Hurda olmayanlardan, aktif zimmet kaydı olanlar.',
            colorClass: 'border-l-emerald-500',
            tooltip:
                'Durumu hurda olmayan kayıtlar içinde aktif zimmeti olanlar. Toplam = durumu hurda (tümü) + zimmetli + zimmet dışı.',
        },
        {
            icon: UserX,
            title: 'Zimmet dışı',
            value: analytics.unassignedNonScrap,
            hint: 'Hurda değil; personele atanmamış (aktif zimmet yok).',
            colorClass: 'border-l-orange-500',
            tooltip:
                'Durumu hurda olmayan ve aktif zimmeti olmayan ekipmanlar. Toplam kayıt = durumu hurda olanlar + zimmetli + zimmet dışı.',
        },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.06, delayChildren: 0.05 }}
                className="rounded-xl border border-border/80 bg-card/40 p-4 sm:p-5 space-y-6"
            >
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 text-foreground">
                            <CalendarClock className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
                            <h2 className="text-base sm:text-lg font-semibold tracking-tight">Kalibrasyon özeti</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                            Özet rakamlar <span className="text-foreground/90 font-medium">kayıtlı tüm ekipman</span>{' '}
                            üzerindendir (filtre uygulanmaz). Tablo görünümü aşağıda arama ve filtreyle daraltılır. İkonun
                            yanındaki{' '}
                            <HelpCircle className="inline h-3.5 w-3.5 align-text-bottom opacity-70" aria-hidden /> ile
                            her kutunun tanımını görebilirsiniz.
                        </p>
                    </div>
                </div>

                <div>
                    <SectionLabel>Kalibrasyon takibi</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {calibrationStats.map((stat) => (
                            <motion.div
                                key={stat.title}
                                initial={{ y: 12, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="h-full"
                            >
                                <StatCard {...stat} />
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="pt-1 border-t border-border/60">
                    <SectionLabel>Envanter ve zimmet</SectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {inventoryStats.map((stat) => (
                            <motion.div
                                key={stat.title}
                                initial={{ y: 12, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="h-full"
                            >
                                <StatCard {...stat} />
                            </motion.div>
                        ))}
                    </div>
                    {analytics.legacyScrapWithoutDate > 0 ? (
                        <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-200 mt-3 leading-relaxed rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2">
                            <span className="font-semibold">{analytics.legacyScrapWithoutDate} kayıt</span> durumu
                            “Hurdaya Ayrıldı” görünüyor ancak{' '}
                            <span className="font-medium">hurda ayırma tarihi</span> boş; bu yüzden{' '}
                            <span className="font-medium">Hurda</span> kartında sayılmıyorlar. Doğru sayı için kaydı açıp
                            hurda işlemini tamamlayın veya durumu güncelleyin.
                        </p>
                    ) : null}
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-3 leading-relaxed rounded-md bg-muted/40 border border-border/60 px-3 py-2">
                        <span className="font-medium text-foreground/90">Toplam kayıt:</span> Mevcut ekipman ={' '}
                        <span className="text-foreground/90">durumu hurda olanların tamamı</span> + zimmetli + zimmet
                        dışı. <span className="font-medium text-foreground/90">Hurda</span> kartı ise bunların içinden
                        yalnızca <span className="text-foreground/90">hurda ayırma tarihi girilmiş</span> (resmi işlem)
                        kayıtları gösterir. Listede daha az satır varsa <span className="text-foreground/90">filtre veya arama</span>{' '}
                        açıktır.
                    </p>
                </div>
            </motion.div>
        </TooltipProvider>
    );
};

export default EquipmentDashboard;
