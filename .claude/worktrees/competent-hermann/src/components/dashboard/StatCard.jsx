import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ icon: Icon, title, value, color, onClick, loading }) => (
    <motion.div
        whileHover={{ y: -5, boxShadow: '0 10px 15px -3px hsla(var(--card-foreground), 0.1), 0 4px 6px -2px hsla(var(--card-foreground), 0.05)' }}
        className="h-full"
    >
        <Card className="h-full cursor-pointer shadow-sm hover:shadow-md transition-shadow" onClick={onClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {Icon && <Icon className={`w-5 h-5 ${color || 'text-muted-foreground'}`} />}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-3/4 mt-1" />
                ) : (
                    <div className={`text-3xl font-bold ${color || 'text-foreground'}`}>{value}</div>
                )}
            </CardContent>
        </Card>
    </motion.div>
);

export default StatCard;