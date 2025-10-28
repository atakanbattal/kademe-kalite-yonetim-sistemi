import React from 'react';
import { motion } from 'framer-motion';
import { Plus, AlertTriangle, CheckSquare, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const StatCard = ({ title, value, icon: Icon, colorClass, onClick, records }) => {
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    return (
        <motion.div variants={cardVariants}>
            <Card className={cn("overflow-hidden border-l-4 hover:shadow-lg transition-shadow cursor-pointer", colorClass)} onClick={() => onClick(title, records)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-foreground">{value}</div>
                </CardContent>
            </Card>
        </motion.div>
    );
};


const DashboardView = ({ stats, handleCardClick, handleCreateNew }) => {
    return null;
};

export default DashboardView;