import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SPCControlCharts = ({ characteristics }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Kontrol Grafikleri</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    Kontrol grafikleri görüntüleme özelliği yakında eklenecek.
                    <br />
                    X-bar, R, p, np, c, u ve I-MR grafikleri desteklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default SPCControlCharts;

