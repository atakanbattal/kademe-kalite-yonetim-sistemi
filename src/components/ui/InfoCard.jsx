import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export const InfoCard = ({ icon: Icon, label, value, variant = 'default' }) => {
    const variants = {
        default: 'bg-background border-border',
        primary: 'bg-primary/5 border-primary/20',
        success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
        warning: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
        danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900',
        info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
    };

    return (
        <Card className={variants[variant]}>
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                        <p className="text-sm font-semibold text-foreground break-words">{value || '-'}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

