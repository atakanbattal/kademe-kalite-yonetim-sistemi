import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wrench, CheckSquare, AlertTriangle, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const StatCard = ({ icon: Icon, title, value, colorClass }) => (
    <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${colorClass.replace('border-', 'text-')}`} />
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold text-foreground">{value}</p>
        </CardContent>
    </Card>
);

const EquipmentDashboard = ({ equipments, loading }) => {
    const analytics = useMemo(() => {
        const total = equipments.length;
        let approachingCalibration = 0;
        let assignedCount = 0;
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        equipments.forEach(eq => {
            const latestCalibration = [...(eq.equipment_calibrations || [])].sort((a, b) => new Date(b.calibration_date) - new Date(a.calibration_date))[0];
            if (latestCalibration) {
                const nextDate = new Date(latestCalibration.next_calibration_date);
                if (nextDate <= thirtyDaysFromNow && nextDate >= today) {
                    approachingCalibration++;
                }
            }
            if(eq.equipment_assignments?.some(a => a.is_active)){
                assignedCount++;
            }
        });

        return { total, approachingCalibration, assignedCount };
    }, [equipments]);

    if (loading) {
        return <div className="text-center p-4 text-muted-foreground">Analizler yükleniyor...</div>;
    }

    const stats = [
        { icon: Wrench, title: 'Toplam Ekipman', value: analytics.total, colorClass: 'border-blue-500' },
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {stats.map(stat => (
                    <motion.div key={stat.title} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                        <StatCard {...stat} />
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

export default EquipmentDashboard;