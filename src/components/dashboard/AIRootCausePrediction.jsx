import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Search, AlertTriangle, TrendingUp } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AIRootCausePrediction = () => {
    const { nonConformities, productionDepartments, producedVehicles, loading } = useData();
    const { toast } = useToast();
    const [partCode, setPartCode] = useState('');
    const [department, setDepartment] = useState('');
    const [vehicleType, setVehicleType] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    // Son 30 günde DF artışı analizi
    const dfIncreaseAnalysis = useMemo(() => {
        if (!nonConformities) return null;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const recentDFs = nonConformities.filter(nc => {
            const ncDate = new Date(nc.opening_date || nc.created_at);
            return nc.type === 'DF' && ncDate >= thirtyDaysAgo;
        });

        const previousDFs = nonConformities.filter(nc => {
            const ncDate = new Date(nc.opening_date || nc.created_at);
            return nc.type === 'DF' && ncDate >= sixtyDaysAgo && ncDate < thirtyDaysAgo;
        });

        const increase = recentDFs.length - previousDFs.length;
        const increasePercentage = previousDFs.length > 0 
            ? ((increase / previousDFs.length) * 100).toFixed(1)
            : recentDFs.length > 0 ? '100' : '0';

        // En çok DF çıkan parça kodları
        const partCodeMap = {};
        recentDFs.forEach(nc => {
            if (nc.part_code) {
                partCodeMap[nc.part_code] = (partCodeMap[nc.part_code] || 0) + 1;
            }
        });

        const topPartCodes = Object.entries(partCodeMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([code, count]) => ({ code, count }));

        // En çok DF çıkan birimler
        const deptMap = {};
        recentDFs.forEach(nc => {
            const dept = nc.requesting_unit || nc.department || 'Belirtilmemiş';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });

        const topDepartments = Object.entries(deptMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([dept, count]) => ({ dept, count }));

        return {
            increase,
            increasePercentage,
            recentCount: recentDFs.length,
            previousCount: previousDFs.length,
            topPartCodes,
            topDepartments,
            possibleReasons: increase > 0 ? [
                topPartCodes.length > 0 ? `${topPartCodes[0].code} parça kodunda ${topPartCodes[0].count} DF tespit edildi` : null,
                topDepartments.length > 0 ? `${topDepartments[0].dept} biriminde ${topDepartments[0].count} DF açıldı` : null,
                'Yeni tedarikçi veya malzeme değişikliği olabilir',
                'Süreç değişikliği veya eğitim eksikliği olabilir'
            ].filter(Boolean) : ['DF sayısında artış yok']
        };
    }, [nonConformities]);

    const handleAnalyze = async () => {
        if (!partCode && !department && !vehicleType) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen en az bir kriter seçin.'
            });
            return;
        }

        setAnalyzing(true);
        try {
            const { data, error } = await supabase.rpc('predict_root_cause', {
                p_part_code: partCode || null,
                p_department: department || null,
                p_vehicle_type: vehicleType || null
            });

            if (error) throw error;
            setPrediction(data);
        } catch (error) {
            console.error('Kök neden tahmini yapılamadı:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Analiz yapılırken bir hata oluştu.'
            });
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        AI Destekli Kök Neden Tahmin
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analiz Formu */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        Kök Neden Analizi
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Parça kodu, birim veya araç tipine göre kök neden tahmini
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="partCode">Parça Kodu</Label>
                        <Input
                            id="partCode"
                            value={partCode}
                            onChange={(e) => setPartCode(e.target.value)}
                            placeholder="Parça kodu girin..."
                        />
                    </div>
                    <div>
                        <Label htmlFor="department">Birim</Label>
                        <Select value={department} onValueChange={setDepartment}>
                            <SelectTrigger>
                                <SelectValue placeholder="Birim seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Tümü</SelectItem>
                                {productionDepartments?.map(dept => (
                                    <SelectItem key={dept.id} value={dept.unit_name || dept.name}>
                                        {dept.unit_name || dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="vehicleType">Araç Tipi</Label>
                        <Select value={vehicleType} onValueChange={setVehicleType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Araç tipi seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Tümü</SelectItem>
                                {Array.from(new Set(producedVehicles?.map(v => v.vehicle_type).filter(Boolean))).map(vt => (
                                    <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
                        <Search className="h-4 w-4 mr-2" />
                        {analyzing ? 'Analiz Ediliyor...' : 'Analiz Et'}
                    </Button>

                    {/* Sonuçlar */}
                    {prediction && (
                        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                            <h4 className="font-semibold mb-3">Analiz Sonuçları</h4>
                            <div className="space-y-3 text-sm">
                                {prediction.part_code_analysis && (
                                    <div>
                                        <p className="font-medium">Parça Kodu Analizi:</p>
                                        <p className="text-muted-foreground">
                                            Açık DF: {prediction.part_code_analysis.open_nc_count}
                                        </p>
                                        <Badge variant={
                                            prediction.part_code_analysis.risk_level === 'HIGH' ? 'destructive' :
                                            prediction.part_code_analysis.risk_level === 'MEDIUM' ? 'secondary' :
                                            'outline'
                                        }>
                                            Risk: {prediction.part_code_analysis.risk_level}
                                        </Badge>
                                    </div>
                                )}
                                {prediction.department_analysis && (
                                    <div>
                                        <p className="font-medium">Birim Analizi:</p>
                                        <p className="text-muted-foreground">
                                            Açık DF: {prediction.department_analysis.open_nc_count}
                                        </p>
                                        <Badge variant={
                                            prediction.department_analysis.risk_level === 'HIGH' ? 'destructive' :
                                            prediction.department_analysis.risk_level === 'MEDIUM' ? 'secondary' :
                                            'outline'
                                        }>
                                            Risk: {prediction.department_analysis.risk_level}
                                        </Badge>
                                    </div>
                                )}
                                {prediction.vehicle_type_analysis && (
                                    <div>
                                        <p className="font-medium">Araç Tipi Analizi:</p>
                                        <p className="text-muted-foreground">
                                            Açık DF: {prediction.vehicle_type_analysis.open_nc_count}
                                        </p>
                                        <Badge variant={
                                            prediction.vehicle_type_analysis.risk_level === 'HIGH' ? 'destructive' :
                                            prediction.vehicle_type_analysis.risk_level === 'MEDIUM' ? 'secondary' :
                                            'outline'
                                        }>
                                            Risk: {prediction.vehicle_type_analysis.risk_level}
                                        </Badge>
                                    </div>
                                )}
                                <div className="pt-2 border-t">
                                    <p className="font-medium text-purple-600">Öneri:</p>
                                    <p className="text-muted-foreground">{prediction.recommendation}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DF Artış Analizi */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-orange-500" />
                        Bu Ayki DF Artışının Olası Nedeni
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {dfIncreaseAnalysis ? (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-lg border-2 ${
                                parseFloat(dfIncreaseAnalysis.increasePercentage) > 20 
                                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                                    : parseFloat(dfIncreaseAnalysis.increasePercentage) > 0
                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                                    : 'border-green-500 bg-green-50 dark:bg-green-950/20'
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold">Son 30 Gün</span>
                                    <Badge variant={
                                        parseFloat(dfIncreaseAnalysis.increasePercentage) > 20 ? 'destructive' :
                                        parseFloat(dfIncreaseAnalysis.increasePercentage) > 0 ? 'secondary' :
                                        'default'
                                    }>
                                        {dfIncreaseAnalysis.increase > 0 ? '+' : ''}{dfIncreaseAnalysis.increase} DF
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Önceki 30 güne göre %{dfIncreaseAnalysis.increasePercentage} değişim
                                </p>
                            </div>

                            {dfIncreaseAnalysis.topPartCodes.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                        En Çok DF Çıkan Parça Kodları
                                    </h4>
                                    <div className="space-y-2">
                                        {dfIncreaseAnalysis.topPartCodes.map((item, idx) => (
                                            <div key={idx} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-900">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm">{item.code}</span>
                                                    <Badge variant="destructive">{item.count} DF</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {dfIncreaseAnalysis.topDepartments.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">En Çok DF Çıkan Birimler</h4>
                                    <div className="space-y-2">
                                        {dfIncreaseAnalysis.topDepartments.map((item, idx) => (
                                            <div key={idx} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm">{item.dept}</span>
                                                    <Badge variant="secondary">{item.count} DF</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t">
                                <h4 className="font-semibold mb-2 text-purple-600">Olası Nedenler:</h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                    {dfIncreaseAnalysis.possibleReasons.map((reason, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-purple-500">•</span>
                                            <span>{reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Veri bulunamadı.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AIRootCausePrediction;

