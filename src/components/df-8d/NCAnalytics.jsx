import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const NCAnalytics = ({ records }) => {
    const analyticsData = useMemo(() => {
        if (!records || records.length === 0) {
            return { closureTimes: [] };
        }

        const departments = {};

        records.forEach(record => {
            const deptName = record.department || "Belirtilmemiş";
            if (!departments[deptName]) {
                departments[deptName] = {
                    count: 0,
                    totalDays: 0,
                };
            }

            if (record.status === 'Kapatıldı' && record.closed_at && record.created_at) {
                const openDate = new Date(record.created_at);
                const closeDate = new Date(record.closed_at);
                const diffTime = Math.abs(closeDate - openDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                departments[deptName].count++;
                departments[deptName].totalDays += diffDays;
            }
        });

        const closureTimes = Object.entries(departments)
            .map(([name, data]) => ({
                name,
                value: data.count > 0 ? parseFloat((data.totalDays / data.count).toFixed(1)) : 0,
            }))
            .filter(d => d.value > 0);

        return { closureTimes };
    }, [records]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
    
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/90 backdrop-blur-sm p-2 border border-border rounded-lg shadow-lg">
                    <p className="font-semibold text-foreground">{`${payload[0].name}`}</p>
                    <p className="text-sm text-muted-foreground">{`Ortalama Süre: ${payload[0].value} gün`}</p>
                </div>
            );
        }
        return null;
    };


    return (
        <motion.div 
            className="dashboard-widget"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={itemVariants}>
                <h3 className="text-lg font-semibold text-foreground mb-4">Birim Bazlı Ortalama Kapatma Süreleri (Gün)</h3>
                {analyticsData.closureTimes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={analyticsData.closureTimes}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {analyticsData.closureTimes.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        Kapatılmış kayıt bulunmadığı için analiz görüntülenemiyor.
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default NCAnalytics;