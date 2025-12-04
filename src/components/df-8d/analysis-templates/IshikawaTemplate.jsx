import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X, Users, Cog, Package, Ruler, Globe, Clipboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const IshikawaTemplate = ({ analysisData, onAnalysisChange }) => {
    const [data, setData] = useState(analysisData || {
        problem: '',
        man: [],
        machine: [],
        material: [],
        measurement: [],
        environment: [],
        management: []
    });

    const categories = [
        { key: 'man', label: 'İnsan (Man)', icon: Users, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' },
        { key: 'machine', label: 'Makine (Machine)', icon: Cog, color: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900' },
        { key: 'material', label: 'Malzeme (Material)', icon: Package, color: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' },
        { key: 'measurement', label: 'Ölçüm (Measurement)', icon: Ruler, color: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900' },
        { key: 'environment', label: 'Çevre (Environment)', icon: Globe, color: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900' },
        { key: 'management', label: 'Yönetim (Management)', icon: Clipboard, color: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' }
    ];

    const handleProblemChange = (value) => {
        const newData = { ...data, problem: value };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleAddCause = (category) => {
        const newData = {
            ...data,
            [category]: [...(data[category] || []), '']
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleRemoveCause = (category, index) => {
        const newData = {
            ...data,
            [category]: data[category].filter((_, i) => i !== index)
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    const handleCauseChange = (category, index, value) => {
        const newData = {
            ...data,
            [category]: data[category].map((item, i) => i === index ? value : item)
        };
        setData(newData);
        if (onAnalysisChange) {
            onAnalysisChange(newData);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clipboard className="h-5 w-5 text-primary" />
                    Ishikawa (Balık Kılçığı) Analizi - 6M Yaklaşımı
                </CardTitle>
                <CardDescription>
                    Problemin kök nedenlerini 6M kategorisinde analiz edin
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
                        onChange={(e) => handleProblemChange(e.target.value)}
                        placeholder="Analiz edilecek problemi net bir şekilde tanımlayın..."
                        rows={3}
                    />
                </div>

                {/* 6M Kategorileri */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => {
                        const Icon = category.icon;
                        const causes = data[category.key] || [];
                        
                        return (
                            <Card key={category.key} className={category.color}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        {category.label}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {causes.map((cause, index) => (
                                        <div key={index} className="flex items-start gap-2">
                                            <Textarea
                                                value={cause}
                                                onChange={(e) => handleCauseChange(category.key, index, e.target.value)}
                                                placeholder={`${category.label} nedeni...`}
                                                rows={2}
                                                className="flex-1 text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => handleRemoveCause(category.key, index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleAddCause(category.key)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Neden Ekle
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Özet */}
                {(data.problem || categories.some(cat => (data[cat.key] || []).length > 0)) && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-3">Ishikawa Analiz Özeti</h4>
                        {data.problem && (
                            <div className="mb-4">
                                <span className="font-medium">Problem:</span>
                                <p className="text-sm mt-1">{data.problem}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {categories.map((category) => {
                                const causes = (data[category.key] || []).filter(c => c.trim());
                                if (causes.length === 0) return null;
                                
                                return (
                                    <div key={category.key} className="space-y-1">
                                        <div className="font-medium text-sm">{category.label}:</div>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                            {causes.map((cause, idx) => (
                                                <li key={idx}>{cause}</li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <Badge variant="secondary">
                                Toplam {categories.reduce((sum, cat) => sum + (data[cat.key] || []).filter(c => c.trim()).length, 0)} neden tespit edildi
                            </Badge>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default IshikawaTemplate;

