import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LotTraceability = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Lot/Seri Takibi</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    Lot ve seri numarası takibi yakında eklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default LotTraceability;

