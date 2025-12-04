import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RunAtRateStudies = ({ projects }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Run-at-Rate Çalışmaları</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    Run-at-Rate çalışmaları yakında eklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default RunAtRateStudies;

