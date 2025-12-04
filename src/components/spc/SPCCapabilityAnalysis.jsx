import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SPCCapabilityAnalysis = ({ characteristics }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Proses Yetenek Analizi</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    Proses yetenek analizi (Cp, Cpk, Pp, Ppk) özelliği yakında eklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default SPCCapabilityAnalysis;

