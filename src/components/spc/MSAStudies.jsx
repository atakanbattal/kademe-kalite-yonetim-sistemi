import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MSAStudies = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ölçüm Sistemi Analizi (MSA)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    MSA çalışmaları (Gage R&R, Bias, Linearity, Stability) yakında eklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default MSAStudies;

