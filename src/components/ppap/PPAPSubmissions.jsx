import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PPAPSubmissions = ({ projects }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>PPAP Submissions (PSW)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    PPAP submission ve PSW yönetimi yakında eklenecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default PPAPSubmissions;

