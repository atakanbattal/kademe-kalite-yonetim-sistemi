import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Clock, RotateCcw, Trash2, Activity } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, delay = 0 }) => (
    <motion.div
        className="dashboard-widget p-5 flex items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
    >
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
        </div>
    </motion.div>
);

const FixtureDashboard = ({ fixtures = [], loading }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const stats = React.useMemo(() => {
        const active = fixtures.filter(f => f.status === 'Aktif').length;
        const overdue = fixtures.filter(f => {
            if (f.status !== 'Aktif') return false;
            if (!f.next_verification_date) return false;
            return new Date(f.next_verification_date) < today;
        }).length;
        const nonconformant = fixtures.filter(f => f.status === 'Uygunsuz').length;
        const inRevision = fixtures.filter(f => f.status === 'Revizyon Beklemede').length;
        const scrapped = fixtures.filter(f =>
            f.status === 'Hurdaya Ayrılmış' &&
            f.scrap_date &&
            new Date(f.scrap_date) >= sixMonthsAgo
        ).length;
        const pendingActivation = fixtures.filter(f => f.status === 'Devreye Alma Bekleniyor').length;

        return { active, overdue, nonconformant, inRevision, scrapped, pendingActivation };
    }, [fixtures]);

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="dashboard-widget p-5 h-24 animate-pulse bg-muted" />
                ))}
            </div>
        );
    }

    const cards = [
        { title: 'Aktif Fikstür', value: stats.active, icon: CheckCircle2, color: 'bg-emerald-500', delay: 0 },
        { title: 'Doğrulama Bekliyor', value: stats.pendingActivation, icon: Clock, color: 'bg-blue-500', delay: 0.05 },
        { title: 'Vadesi Geçmiş', value: stats.overdue, icon: AlertTriangle, color: 'bg-amber-500', delay: 0.1 },
        { title: 'Uygunsuz', value: stats.nonconformant, icon: Activity, color: 'bg-red-500', delay: 0.15 },
        { title: 'Revizyon Beklemede', value: stats.inRevision, icon: RotateCcw, color: 'bg-purple-500', delay: 0.2 },
        { title: 'Hurdaya (6 Ay)', value: stats.scrapped, icon: Trash2, color: 'bg-gray-500', delay: 0.25 },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cards.map(card => (
                <StatCard key={card.title} {...card} />
            ))}
        </div>
    );
};

export default FixtureDashboard;
