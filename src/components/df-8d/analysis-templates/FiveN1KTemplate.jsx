import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HelpCircle } from 'lucide-react';

const FiveN1KTemplate = ({ analysisData, onAnalysisChange }) => {
    const [data, setData] = useState(analysisData || {
        ne: '',
        nerede: '',
        neZaman: '',
        kim: '',
        neden: '',
        nasil: ''
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    5N1K Analizi
                </CardTitle>
                <CardDescription>
                    Problemi detaylı şekilde analiz etmek için 5N1K sorularını cevaplayın
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="ne">
                            Ne? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="ne"
                            value={data.ne || ''}
                            onChange={(e) => handleChange('ne', e.target.value)}
                            placeholder="Ne problemi yaşandı? Problemin tanımı nedir?"
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            Problemin ne olduğunu açık ve net bir şekilde tanımlayın
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nerede">
                            Nerede? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="nerede"
                            value={data.nerede || ''}
                            onChange={(e) => handleChange('nerede', e.target.value)}
                            placeholder="Problem nerede meydana geldi? Lokasyon, departman, proses?"
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            Problemin meydana geldiği yer, lokasyon veya prosesi belirtin
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="neZaman">
                            Ne Zaman? <span className="text-red-500">*</span>
                        </Label>
                        <div className="space-y-2">
                            <Input
                                id="neZaman-date"
                                type="datetime-local"
                                value={data.neZamanTarih || ''}
                                onChange={(e) => handleChange('neZamanTarih', e.target.value)}
                                placeholder="Tarih ve saat"
                            />
                            <Textarea
                                id="neZaman"
                                value={data.neZaman || ''}
                                onChange={(e) => handleChange('neZaman', e.target.value)}
                                placeholder="Problem ne zaman tespit edildi? Hangi vardiya, saat?"
                                rows={2}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Problemin tespit edildiği veya meydana geldiği zamanı belirtin
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="kim">
                            Kim? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="kim"
                            value={data.kim || ''}
                            onChange={(e) => handleChange('kim', e.target.value)}
                            placeholder="Problemi kim tespit etti? Kim etkilendi? Sorumlu kişi/departman?"
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            Problemi tespit eden, etkilenen veya sorumlu kişi/departmanı belirtin
                        </p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="neden">
                            Neden? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="neden"
                            value={data.neden || ''}
                            onChange={(e) => handleChange('neden', e.target.value)}
                            placeholder="Problem neden meydana geldi? Kök neden analizi için başlangıç noktası"
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Problemin olası nedenlerini ve kök neden analizi için başlangıç noktasını belirtin
                        </p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="nasil">
                            Nasıl? <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="nasil"
                            value={data.nasil || ''}
                            onChange={(e) => handleChange('nasil', e.target.value)}
                            placeholder="Problem nasıl tespit edildi? Hangi yöntemler kullanıldı? Nasıl önlenebilir?"
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Problemin tespit yöntemi, mevcut kontrol mekanizmaları ve önleme stratejilerini belirtin
                        </p>
                    </div>
                </div>

                {/* Özet */}
                {(data.ne || data.nerede || data.neZaman || data.kim || data.neden || data.nasil) && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">5N1K Analiz Özeti</h4>
                        <div className="space-y-2 text-sm">
                            {data.ne && (
                                <div>
                                    <span className="font-medium">Ne?:</span> {data.ne}
                                </div>
                            )}
                            {data.nerede && (
                                <div>
                                    <span className="font-medium">Nerede?:</span> {data.nerede}
                                </div>
                            )}
                            {data.neZaman && (
                                <div>
                                    <span className="font-medium">Ne Zaman?:</span> {data.neZaman}
                                </div>
                            )}
                            {data.kim && (
                                <div>
                                    <span className="font-medium">Kim?:</span> {data.kim}
                                </div>
                            )}
                            {data.neden && (
                                <div>
                                    <span className="font-medium">Neden?:</span> {data.neden}
                                </div>
                            )}
                            {data.nasil && (
                                <div>
                                    <span className="font-medium">Nasıl?:</span> {data.nasil}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default FiveN1KTemplate;

