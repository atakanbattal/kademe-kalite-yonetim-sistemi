import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Target, TrendingUp, Lightbulb, CheckCircle2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const KaizenA3Template = ({ kaizenData, onA3Change }) => {
    const [data, setData] = useState(kaizenData || {
        problem_definition: '',
        current_state: '',
        target_state: '',
        root_cause_analysis: '',
        solution_plan: '',
        implementation_plan: '',
        results_and_followup: '',
        team_members: '',
        start_date: '',
        end_date: ''
    });

    const handleChange = (field, value) => {
        const newData = {
            ...data,
            [field]: value
        };
        setData(newData);
        if (onA3Change) {
            onA3Change(newData);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Kaizen A3 Formatı (TPS Standardı)
                </CardTitle>
                <CardDescription>
                    Toyota Production System (TPS) Kaizen A3 formatı - Problem çözme ve iyileştirme raporu
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Problem Tanımı */}
                <div className="space-y-2">
                    <Label htmlFor="problem_definition" className="text-base font-semibold flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        1. Problem Tanımı
                    </Label>
                    <Textarea
                        id="problem_definition"
                        value={data.problem_definition || ''}
                        onChange={(e) => handleChange('problem_definition', e.target.value)}
                        placeholder="Çözülmesi gereken problemi net bir şekilde tanımlayın..."
                        rows={4}
                        className="font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                        Ne problemi çözüyoruz? Problemin önemi ve aciliyeti nedir?
                    </p>
                </div>

                {/* Mevcut Durum */}
                <div className="space-y-2">
                    <Label htmlFor="current_state" className="text-base font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        2. Mevcut Durum Analizi
                    </Label>
                    <Textarea
                        id="current_state"
                        value={data.current_state || ''}
                        onChange={(e) => handleChange('current_state', e.target.value)}
                        placeholder="Mevcut durumu detaylı şekilde analiz edin..."
                        rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                        Şu anki durum nedir? Veriler, ölçümler, gözlemler nelerdir?
                    </p>
                </div>

                {/* Hedef Durum */}
                <div className="space-y-2">
                    <Label htmlFor="target_state" className="text-base font-semibold flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-600" />
                        3. Hedef Durum
                    </Label>
                    <Textarea
                        id="target_state"
                        value={data.target_state || ''}
                        onChange={(e) => handleChange('target_state', e.target.value)}
                        placeholder="Ulaşmak istediğiniz hedef durumu tanımlayın..."
                        rows={4}
                        className="bg-green-50 dark:bg-green-950/20"
                    />
                    <p className="text-xs text-muted-foreground">
                        İdeal durum nedir? Hangi metriklerle ölçülecek?
                    </p>
                </div>

                {/* Kök Neden Analizi */}
                <div className="space-y-2">
                    <Label htmlFor="root_cause_analysis" className="text-base font-semibold flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        4. Kök Neden Analizi
                    </Label>
                    <Textarea
                        id="root_cause_analysis"
                        value={data.root_cause_analysis || ''}
                        onChange={(e) => handleChange('root_cause_analysis', e.target.value)}
                        placeholder="Problemin kök nedenini analiz edin (5 Why, Ishikawa, vb. kullanabilirsiniz)..."
                        rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                        Problemin gerçek kök nedeni nedir? 5 Why veya Ishikawa analizi sonuçları.
                    </p>
                </div>

                {/* Çözüm Planı */}
                <div className="space-y-2">
                    <Label htmlFor="solution_plan" className="text-base font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        5. Çözüm Planı
                    </Label>
                    <Textarea
                        id="solution_plan"
                        value={data.solution_plan || ''}
                        onChange={(e) => handleChange('solution_plan', e.target.value)}
                        placeholder="Kök nedeni çözmek için alınacak aksiyonları detaylı şekilde planlayın..."
                        rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                        Hangi çözümler uygulanacak? Adım adım plan nedir?
                    </p>
                </div>

                {/* Uygulama Planı */}
                <div className="space-y-2">
                    <Label htmlFor="implementation_plan" className="text-base font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        6. Uygulama Planı
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                        <div>
                            <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={data.start_date || ''}
                                onChange={(e) => handleChange('start_date', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="end_date">Bitiş Tarihi</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={data.end_date || ''}
                                onChange={(e) => handleChange('end_date', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <Textarea
                        id="implementation_plan"
                        value={data.implementation_plan || ''}
                        onChange={(e) => handleChange('implementation_plan', e.target.value)}
                        placeholder="Uygulama adımlarını, sorumluları ve zamanlamayı belirtin..."
                        rows={5}
                    />
                    <div className="mt-2">
                        <Label htmlFor="team_members">Ekip Üyeleri</Label>
                        <Input
                            id="team_members"
                            value={data.team_members || ''}
                            onChange={(e) => handleChange('team_members', e.target.value)}
                            placeholder="Ekip üyelerini virgülle ayırarak yazın..."
                            className="mt-1"
                        />
                    </div>
                </div>

                {/* Sonuçlar ve Takip */}
                <div className="space-y-2">
                    <Label htmlFor="results_and_followup" className="text-base font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        7. Sonuçlar ve Takip
                    </Label>
                    <Textarea
                        id="results_and_followup"
                        value={data.results_and_followup || ''}
                        onChange={(e) => handleChange('results_and_followup', e.target.value)}
                        placeholder="Uygulama sonuçlarını, ölçülen metrikleri ve takip planını yazın..."
                        rows={5}
                        className="bg-green-50 dark:bg-green-950/20"
                    />
                    <p className="text-xs text-muted-foreground">
                        Hedeflere ulaşıldı mı? Sonuçlar nasıl? Standartlaştırma yapıldı mı?
                    </p>
                </div>

                {/* Özet */}
                {(data.problem_definition || data.current_state || data.target_state) && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-3">A3 Özet</h4>
                        <div className="space-y-2 text-sm">
                            {data.problem_definition && (
                                <div>
                                    <span className="font-medium">Problem:</span>
                                    <p className="mt-1 text-muted-foreground">{data.problem_definition.substring(0, 150)}...</p>
                                </div>
                            )}
                            {data.target_state && (
                                <div>
                                    <span className="font-medium">Hedef:</span>
                                    <p className="mt-1 text-muted-foreground">{data.target_state.substring(0, 150)}...</p>
                                </div>
                            )}
                            {(data.start_date || data.end_date) && (
                                <div className="flex items-center gap-4">
                                    {data.start_date && (
                                        <Badge variant="outline">
                                            Başlangıç: {new Date(data.start_date).toLocaleDateString('tr-TR')}
                                        </Badge>
                                    )}
                                    {data.end_date && (
                                        <Badge variant="outline">
                                            Bitiş: {new Date(data.end_date).toLocaleDateString('tr-TR')}
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default KaizenA3Template;

