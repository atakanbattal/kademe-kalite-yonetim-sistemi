import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const StatCard = ({ title, value, icon: Icon, colorClass, description }) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div variants={cardVariants}>
      <Card className={cn("overflow-hidden border-l-4", colorClass)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{value}</div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatCard;