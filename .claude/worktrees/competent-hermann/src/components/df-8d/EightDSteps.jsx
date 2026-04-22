import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const EightDSteps = ({ steps, onStepsChange }) => {
    const handleStepChange = (stepKey, field, value) => {
        const newSteps = {
            ...steps,
            [stepKey]: {
                ...steps[stepKey],
                [field]: value,
            },
        };
        onStepsChange(newSteps);
    };

    return (
        <div className="space-y-4 p-1">
            {Object.entries(steps).map(([key, step]) => (
                <Card key={key} className="bg-background/50">
                    <CardHeader className="p-4">
                        <CardTitle className="text-md text-primary">{key}: {step.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor={`responsible-${key}`}>Sorumlu</Label>
                            <Input
                                id={`responsible-${key}`}
                                value={step.responsible || ''}
                                onChange={(e) => handleStepChange(key, 'responsible', e.target.value)}
                                placeholder="Sorumlu kişi veya departman..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`completionDate-${key}`}>Tamamlanma Tarihi</Label>
                            <Input
                                id={`completionDate-${key}`}
                                type="date"
                                value={step.completionDate || ''}
                                onChange={(e) => handleStepChange(key, 'completionDate', e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor={`description-${key}`}>Açıklama / Yapılan Çalışmalar</Label>
                            <Textarea
                                id={`description-${key}`}
                                value={step.description || ''}
                                onChange={(e) => handleStepChange(key, 'description', e.target.value)}
                                placeholder="Bu adımda yapılan çalışmaları ve alınan kararları detaylandırın..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default EightDSteps;