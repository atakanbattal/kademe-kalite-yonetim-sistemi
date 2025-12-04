import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DMAICPhaseView = () => {
    const phases = [
        { name: 'Define', description: 'Problemi tanımla ve kapsamı belirle' },
        { name: 'Measure', description: 'Mevcut durumu ölç ve veri topla' },
        { name: 'Analyze', description: 'Kök nedenleri analiz et' },
        { name: 'Improve', description: 'İyileştirme çözümleri uygula' },
        { name: 'Control', description: 'Kontrol mekanizmaları kur ve sürdür' }
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>DMAIC Aşamaları</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {phases.map((phase, index) => (
                            <div key={phase.name} className="flex items-center gap-4 p-3 border rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold">{phase.name}</h4>
                                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                                </div>
                                <Badge variant="outline">Not Started</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DMAICPhaseView;

