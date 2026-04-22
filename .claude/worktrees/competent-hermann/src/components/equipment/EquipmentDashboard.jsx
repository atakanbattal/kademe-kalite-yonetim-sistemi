import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wrench, CheckSquare, AlertTriangle, Users, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const StatCard = ({ icon: Icon, title, value, colorClass }) => (
    <Card className={`overflow-hidden border-l-4 ${colorClass} h-full flex flex-col`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${colorClass.replace('border-', 'text-')}`} />
        </CardHeader>
        <CardContent className="flex-1">
            <p className="text-2xl font-bold text-foreground">{value}</p>
        </CardContent>
    </Card>
);

const EquipmentDashboard = ({ equipments, loading }) => {
    const analytics = useMemo(() => {
        const total = equipments.length;
        let overdueCalibration = 0;
        let approachingCalibration = 0;
        let assignedCount = 0;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Bugünü gece yarısına ayarla
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999); // 30 gün sonrasının son saatine ayarla

        equipments.forEach(eq => {
            // Hurdaya ayrılmış ekipmanları kalibrasyon sayımından hariç tut
            if (eq.status === 'Hurdaya Ayrıldı') {
                return;
            }
            
            // Sadece aktif kalibrasyonları kontrol et
            const activeCalibrations = (eq.equipment_calibrations || []).filter(cal => cal.is_active !== false);
            if (activeCalibrations.length > 0) {
                const latestCalibration = [...activeCalibrations].sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
                if (latestCalibration && latestCalibration.next_calibration_date) {
                    const nextDate = new Date(latestCalibration.next_calibration_date);
                    nextDate.setHours(0, 0, 0, 0); // Tarih kısmını gece yarısına ayarla
                    
                    // Gecikmiş kalibrasyonları say (bugünden önce olanlar)
                    if (nextDate < today) {
                        overdueCalibration++;
                    }
                    // Yaklaşan kalibrasyonları say (bugünden sonra ve 30 gün içinde olanlar)
                    else if (nextDate > today && nextDate <= thirtyDaysFromNow) {
                        approachingCalibration++;
                    }
                }
            }
            
            if(eq.equipment_assignments?.some(a => a.is_active)){
                assignedCount++;
            }
        });

        return { total, overdueCalibration, approachingCalibration, assignedCount };
    }, [equipments]);

    if (loading) {
        return <div className="text-center p-4 text-muted-foreground">Analizler yükleniyor...</div>;
    }

    const stats = [
        { icon: Wrench, title: 'Toplam Ekipman', value: analytics.total, colorClass: 'border-blue-500' },
        { icon: XCircle, title: 'Kalibrasyonu Gecikmiş', value: analytics.overdueCalibration, colorClass: 'border-red-500' },
        { icon: AlertTriangle, title: 'Kalibrasyonu Yaklaşan', value: analytics.approachingCalibration, colorClass: 'border-yellow-500' },
        { icon: Users, title: 'Zimmetli Ekipman', value: analytics.assignedCount, colorClass: 'border-green-500' },
        { icon: CheckSquare, title: 'Aktif Ekipman', value: equipments.filter(e => e.status === 'Aktif').length, colorClass: 'border-indigo-500' }
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1, delayChildren: 0.1 }}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                {stats.map(stat => (
                    <motion.div key={stat.title} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-full">
                        <StatCard {...stat} />
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

export default EquipmentDashboard;