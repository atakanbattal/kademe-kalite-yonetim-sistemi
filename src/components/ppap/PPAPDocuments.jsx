import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PPAPDocuments = ({ projects }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>PPAP Dokümanları</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    PPAP doküman yönetimi yakında eklenecek.
                    <br />
                    Design Records, DFMEA, PFMEA, Control Plan, MSA, SPC, PSW vb. dokümanlar yönetilecek.
                </div>
            </CardContent>
        </Card>
    );
};

export default PPAPDocuments;

