import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowDown, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FiveWhyTemplate = ({ analysisData, onAnalysisChange }) => {
    const [data, setData] = useState(analysisData || {
        problem: '',
        why1: '',
        why2: '',
        why3: '',
        why4: '',
        why5: '',
        rootCause: '',
        immediateAction: '',
        preventiveAction: ''
    });

    const handleChange = (field, value) => {
        const newData = {
            ...data,
            [field]: value
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const whySteps = [
        { key: 'why1', label: '1. Neden?', placeholder: 'İlk neden: Problem neden meydana geldi?' },
        { key: 'why2', label: '2. Neden?', placeholder: 'İkinci neden: İlk nedene neden olan şey nedir?' },
        { key: 'why3', label: '3. Neden?', placeholder: 'Üçüncü neden: İkinci nedene neden olan şey nedir?' },
        { key: 'why4', label: '4. Neden?', placeholder: 'Dördüncü neden: Üçüncü nedene neden olan şey nedir?' },
        { key: 'why5', label: '5. Neden?', placeholder: 'Beşinci neden: Dördüncü nedene neden olan şey nedir? (Kök neden)' }
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    5 Neden (5 Why) Analizi
                </CardTitle>
                <CardDescription>
                    Problemin kök nedenini bulmak için 5 kez "Neden?" sorusunu sorun
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Problem Tanımı */}
                <div className="space-y-2">
                    <Label htmlFor="problem">
                        Problem Tanımı <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                        id="problem"
                        value={data.problem || ''}
                        onChange={(e) => handleChange('problem', e.target.value)}
                        placeholder="Analiz edilecek problemi net bir şekilde tanımlayın..."
                        rows={3}
                    />
                </div>

                {/* 5 Neden Zinciri */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Badge variant="outline" className="text-sm">Neden Zinciri</Badge>
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    {whySteps.map((step, index) => (
                        <div key={step.key} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor={step.key} className="font-semibold min-w-[100px]">
                                    {step.label}
                                </Label>
                                {index === whySteps.length - 1 && (
                                    <Badge variant="destructive" className="text-xs">Kök Neden</Badge>
                                )}
                            </div>
                            <Textarea
                                id={step.key}
                                value={data[step.key] || ''}
                                onChange={(e) => handleChange(step.key, e.target.value)}
                                placeholder={step.placeholder}
                                rows={2}
                                className={index === whySteps.length - 1 ? 'border-red-300 dark:border-red-700' : ''}
                            />
                            {index < whySteps.length - 1 && (
                                <div className="flex justify-center py-2">
                                    <ArrowDown className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Kök Neden Özeti */}
                <div className="space-y-2">
                    <Label htmlFor="rootCause">
                        Kök Neden Özeti <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                        id="rootCause"
                        value={data.rootCause || ''}
                        onChange={(e) => handleChange('rootCause', e.target.value)}
                        placeholder="5. Neden'den çıkan kök nedeni özetleyin..."
                        rows={3}
                        className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20"
                    />
                </div>

                {/* Aksiyonlar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="immediateAction">
                            Anlık Aksiyon (Containment Action)
                        </Label>
                        <Textarea
                            id="immediateAction"
                            value={data.immediateAction || ''}
                            onChange={(e) => handleChange('immediateAction', e.target.value)}
                            placeholder="Problemin etkisini hemen azaltmak için alınacak önlemler..."
                            rows={4}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="preventiveAction">
                            Önleyici Aksiyon (Preventive Action)
                        </Label>
                        <Textarea
                            id="preventiveAction"
                            value={data.preventiveAction || ''}
                            onChange={(e) => handleChange('preventiveAction', e.target.value)}
                            placeholder="Kök nedeni ortadan kaldırmak için alınacak kalıcı önlemler..."
                            rows={4}
                        />
                    </div>
                </div>

                {/* Özet */}
                {(data.problem || data.why1 || data.rootCause) && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-3">5 Neden Analiz Özeti</h4>
                        {data.problem && (
                            <div className="mb-3">
                                <span className="font-medium">Problem:</span>
                                <p className="text-sm mt-1">{data.problem}</p>
                            </div>
                        )}
                        {data.why1 && (
                            <div className="space-y-2 text-sm">
                                {whySteps.map((step, index) => {
                                    const value = data[step.key];
                                    if (!value) return null;
                                    return (
                                        <div key={step.key} className="flex items-start gap-2">
                                            <span className="font-medium min-w-[80px]">{step.label}</span>
                                            <span className="text-muted-foreground">{value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {data.rootCause && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded">
                                <div className="font-semibold text-red-700 dark:text-red-400 mb-1">Kök Neden:</div>
                                <div className="text-sm text-red-900 dark:text-red-200">{data.rootCause}</div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default FiveWhyTemplate;

