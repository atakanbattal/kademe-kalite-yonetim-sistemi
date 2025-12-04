import React, { useState, useCallback } from 'react';
import { ArrowLeft, Plus, Edit, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const FMEADetailView = ({ project, onBack }) => {
    const { toast } = useToast();
    const [functions, setFunctions] = useState([]);
    const [failureModes, setFailureModes] = useState([]);
    const [causesControls, setCausesControls] = useState([]);
    const [actionPlans, setActionPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFunction, setSelectedFunction] = useState(null);

    const loadFMEAData = useCallback(async () => {
        if (!project?.id) return;

        setLoading(true);
        try {
            // Fonksiyonları yükle
            const { data: funcs, error: funcsError } = await supabase
                .from('fmea_functions')
                .select('*')
                .eq('fmea_project_id', project.id)
                .order('function_number', { ascending: true });

            if (funcsError) throw funcsError;

            // Hata modlarını yükle
            const { data: failures, error: failuresError } = await supabase
                .from('fmea_failure_modes')
                .select('*')
                .in('function_id', funcs?.map(f => f.id) || [])
                .order('failure_mode_number', { ascending: true });

            if (failuresError) throw failuresError;

            // Kök nedenleri ve kontrolleri yükle
            const { data: causes, error: causesError } = await supabase
                .from('fmea_causes_controls')
                .select('*')
                .in('failure_mode_id', failures?.map(f => f.id) || [])
                .order('cause_number', { ascending: true });

            if (causesError) throw causesError;

            // Aksiyon planlarını yükle
            const { data: actions, error: actionsError } = await supabase
                .from('fmea_action_plans')
                .select('*')
                .in('cause_control_id', causes?.map(c => c.id) || []);

            if (actionsError) throw actionsError;

            setFunctions(funcs || []);
            setFailureModes(failures || []);
            setCausesControls(causes || []);
            setActionPlans(actions || []);

            if (funcs && funcs.length > 0) {
                setSelectedFunction(funcs[0].id);
            }
        } catch (error) {
            console.error('FMEA data loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'FMEA verileri yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [project, toast]);

    React.useEffect(() => {
        loadFMEAData();
    }, [loadFMEAData]);

    const getRPNColor = (rpn) => {
        if (!rpn) return 'secondary';
        if (rpn >= 100) return 'destructive';
        if (rpn >= 50) return 'warning';
        return 'default';
    };

    const getRPNStatus = (rpn) => {
        if (!rpn) return 'Bilinmiyor';
        if (rpn >= 100) return 'Yüksek Risk';
        if (rpn >= 50) return 'Orta Risk';
        return 'Düşük Risk';
    };

    const selectedFunctionFailures = failureModes.filter(fm => fm.function_id === selectedFunction);
    const highRiskItems = causesControls.filter(cc => cc.rpn >= 100).length;

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Geri
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold">{project.fmea_name}</h2>
                        <p className="text-muted-foreground">{project.fmea_number}</p>
                    </div>
                </div>
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Yükleniyor...
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Geri
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold">{project.fmea_name}</h2>
                        <p className="text-muted-foreground">{project.fmea_number} - {project.fmea_type}</p>
                    </div>
                </div>
                <Badge variant={project.status === 'Active' ? 'success' : 'default'}>
                    {project.status}
                </Badge>
            </div>

            {/* Özet İstatistikler */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Toplam Fonksiyon
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{functions.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Hata Modu
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{failureModes.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Yüksek Risk (RPN≥100)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{highRiskItems}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Aksiyon Planı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{actionPlans.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* FMEA Tablosu */}
            <Tabs defaultValue="matrix" className="w-full">
                <TabsList>
                    <TabsTrigger value="matrix">RPN Matrisi</TabsTrigger>
                    <TabsTrigger value="details">Detaylı Görünüm</TabsTrigger>
                </TabsList>

                <TabsContent value="matrix" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>RPN (Risk Priority Number) Matrisi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {causesControls.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    Henüz kök neden tanımlanmamış.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fonksiyon</TableHead>
                                                <TableHead>Hata Modu</TableHead>
                                                <TableHead>Kök Neden</TableHead>
                                                <TableHead>S</TableHead>
                                                <TableHead>O</TableHead>
                                                <TableHead>D</TableHead>
                                                <TableHead>RPN</TableHead>
                                                <TableHead>Durum</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {causesControls.map((cc) => {
                                                const failureMode = failureModes.find(fm => fm.id === cc.failure_mode_id);
                                                const function_ = functions.find(f => f.id === failureMode?.function_id);
                                                return (
                                                    <TableRow key={cc.id}>
                                                        <TableCell>{function_?.function_name || '-'}</TableCell>
                                                        <TableCell>{failureMode?.failure_mode_description || '-'}</TableCell>
                                                        <TableCell>{cc.potential_cause}</TableCell>
                                                        <TableCell>{cc.severity}</TableCell>
                                                        <TableCell>{cc.occurrence}</TableCell>
                                                        <TableCell>{cc.detection}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={getRPNColor(cc.rpn)}>
                                                                {cc.rpn}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={getRPNColor(cc.rpn)}>
                                                                {getRPNStatus(cc.rpn)}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="details" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fonksiyon Bazlı Detaylı Görünüm</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {functions.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    Henüz fonksiyon tanımlanmamış.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {functions.map((func) => {
                                        const funcFailures = failureModes.filter(fm => fm.function_id === func.id);
                                        return (
                                            <Card key={func.id} className="border-l-4 border-l-primary">
                                                <CardHeader>
                                                    <CardTitle className="text-lg">
                                                        {func.function_number}. {func.function_name}
                                                    </CardTitle>
                                                    {func.function_description && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {func.function_description}
                                                        </p>
                                                    )}
                                                </CardHeader>
                                                <CardContent>
                                                    {funcFailures.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">
                                                            Bu fonksiyon için henüz hata modu tanımlanmamış.
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {funcFailures.map((failure) => {
                                                                const failureCauses = causesControls.filter(cc => cc.failure_mode_id === failure.id);
                                                                return (
                                                                    <div key={failure.id} className="p-4 bg-muted rounded-lg">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div>
                                                                                <h4 className="font-semibold">
                                                                                    {failure.failure_mode_number}. {failure.failure_mode_description}
                                                                                </h4>
                                                                                {failure.potential_effect && (
                                                                                    <p className="text-sm text-muted-foreground mt-1">
                                                                                        Etki: {failure.potential_effect}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <Badge variant="outline">
                                                                                S: {failure.severity}
                                                                            </Badge>
                                                                        </div>
                                                                        {failureCauses.length > 0 && (
                                                                            <div className="mt-3 space-y-2">
                                                                                {failureCauses.map((cause) => (
                                                                                    <div key={cause.id} className="p-3 bg-background rounded border">
                                                                                        <div className="flex items-center justify-between">
                                                                                            <div className="flex-1">
                                                                                                <p className="text-sm font-medium">{cause.potential_cause}</p>
                                                                                                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                                                                                    <span>O: {cause.occurrence}</span>
                                                                                                    <span>D: {cause.detection}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <Badge variant={getRPNColor(cause.rpn)} className="ml-2">
                                                                                                RPN: {cause.rpn}
                                                                                            </Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default FMEADetailView;
