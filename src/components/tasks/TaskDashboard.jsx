import React from 'react';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { CheckCircle, List, AlertCircle, Clock, TrendingUp } from 'lucide-react';

    const StatCard = ({ title, value, icon, color }) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {React.cloneElement(icon, { className: `h-4 w-4 text-muted-foreground ${color}` })}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );

    const TaskDashboard = ({ tasks }) => {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Tamamlandı').length;
        const openTasks = totalTasks - completedTasks;
        const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Tamamlandı').length;
        const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) + '%' : 'N/A';

        const stats = [
            { title: 'Toplam Görev', value: totalTasks, icon: <List />, color: 'text-blue-500' },
            { title: 'Açık Görevler', value: openTasks, icon: <Clock />, color: 'text-orange-500' },
            { title: 'Tamamlananlar', value: completedTasks, icon: <CheckCircle />, color: 'text-green-500' },
            { title: 'Gecikenler', value: overdueTasks, icon: <AlertCircle />, color: 'text-red-500' },
            { title: 'Tamamlama Performansı', value: completionRate, icon: <TrendingUp />, color: 'text-purple-500' },
        ];

        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {stats.map(stat => (
                    <StatCard key={stat.title} {...stat} />
                ))}
            </div>
        );
    };

    export default TaskDashboard;