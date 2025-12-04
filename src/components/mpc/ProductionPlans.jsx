import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ProductionPlans = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Üretim Planları</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    Üretim planı yönetimi yakında eklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default ProductionPlans;

