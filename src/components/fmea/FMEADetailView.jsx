import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FMEAFunctionFormModal from './FMEAFunctionFormModal';
import FMEAFailureModeFormModal from './FMEAFailureModeFormModal';
import FMEACauseFormModal from './FMEACauseFormModal';
import FMEAActionPlanFormModal from './FMEAActionPlanFormModal';

const FMEADetailView = ({ project, onBack }) => {
    const { toast } = useToast();
    const [functions, setFunctions] = useState([]);
    const [failureModes, setFailureModes] = useState({});
    const [causes, setCauses] = useState({});
    const [actionPlans, setActionPlans] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('functions');
    const [selectedFunction, setSelectedFunction] = useState(null);
    const [selectedFailureMode, setSelectedFailureMode] = useState(null);
    const [selectedCause, setSelectedCause] = useState(null);
    
    // Form modal states
    const [isFunctionModalOpen, setFunctionModalOpen] = useState(false);
    const [isFailureModeModalOpen, setFailureModeModalOpen] = useState(false);
    const [isCauseModalOpen, setCauseModalOpen] = useState(false);
    const [isActionPlanModalOpen, setActionPlanModalOpen] = useState(false);
    const [editingFunction, setEditingFunction] = useState(null);
    const [editingFailureMode, setEditingFailureMode] = useState(null);
    const [editingCause, setEditingCause] = useState(null);
    const [editingActionPlan, setEditingActionPlan] = useState(null);
    const [deletingItem, setDeletingItem] = useState(null);
    const [deletingType, setDeletingType] = useState(null);

    const loadFunctions = useCallback(async () => {
        if (!project?.id) return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fmea_functions')
                .select('*')
                .eq('fmea_project_id', project.id)
                .order('display_order', { ascending: true })
                .order('function_number', { ascending: true });

            if (error) throw error;
            setFunctions(data || []);
        } catch (error) {
            console.error('Functions loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Fonksiyonlar yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [project, toast]);

    const loadFailureModes = useCallback(async (functionIds) => {
        if (!functionIds || functionIds.length === 0) {
            setFailureModes({});
            return;
        }

        try {
            const { data, error } = await supabase
                .from('fmea_failure_modes')
                .select('*')
                .in('function_id', functionIds)
                .order('failure_mode_number', { ascending: true });

            if (error) throw error;
            
            const grouped = {};
            (data || []).forEach(fm => {
                if (!grouped[fm.function_id]) {
                    grouped[fm.function_id] = [];
                }
                grouped[fm.function_id].push(fm);
            });
            setFailureModes(grouped);
        } catch (error) {
            console.error('Failure modes loading error:', error);
        }
    }, []);

    const loadCauses = useCallback(async (failureModeIds) => {
        if (!failureModeIds || failureModeIds.length === 0) {
            setCauses({});
            return;
        }

        try {
            const { data, error } = await supabase
                .from('fmea_causes_controls')
                .select('*')
                .in('failure_mode_id', failureModeIds)
                .order('cause_number', { ascending: true });

            if (error) throw error;
            
            const grouped = {};
            (data || []).forEach(cause => {
                if (!grouped[cause.failure_mode_id]) {
                    grouped[cause.failure_mode_id] = [];
                }
                grouped[cause.failure_mode_id].push(cause);
            });
            setCauses(grouped);
        } catch (error) {
            console.error('Causes loading error:', error);
        }
    }, []);

    const loadActionPlans = useCallback(async (causeIds) => {
        if (!causeIds || causeIds.length === 0) {
            setActionPlans({});
            return;
        }

        try {
            const { data, error } = await supabase
                .from('fmea_action_plans')
                .select(`
                    *,
                    responsible_person:responsible_person_id(full_name),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .in('cause_control_id', causeIds)
                .order('action_number', { ascending: true });

            if (error) throw error;
            
            const grouped = {};
            (data || []).forEach(plan => {
                if (!grouped[plan.cause_control_id]) {
                    grouped[plan.cause_control_id] = [];
                }
                grouped[plan.cause_control_id].push(plan);
            });
            setActionPlans(grouped);
        } catch (error) {
            console.error('Action plans loading error:', error);
        }
    }, []);

    useEffect(() => {
        loadFunctions();
    }, [loadFunctions]);

    useEffect(() => {
        if (functions.length > 0) {
            const functionIds = functions.map(f => f.id);
            loadFailureModes(functionIds);
        }
    }, [functions, loadFailureModes]);

    useEffect(() => {
        const allFailureModes = Object.values(failureModes).flat();
        if (allFailureModes.length > 0) {
            const failureModeIds = allFailureModes.map(fm => fm.id);
            loadCauses(failureModeIds);
        }
    }, [failureModes, loadCauses]);

    useEffect(() => {
        const allCauses = Object.values(causes).flat();
        if (allCauses.length > 0) {
            const causeIds = allCauses.map(c => c.id);
            loadActionPlans(causeIds);
        }
    }, [causes, loadActionPlans]);

    const handleDelete = async () => {
        if (!deletingItem || !deletingType) return;

        try {
            let tableName = '';
            switch (deletingType) {
                case 'function':
                    tableName = 'fmea_functions';
                    break;
                case 'failure_mode':
                    tableName = 'fmea_failure_modes';
                    break;
                case 'cause':
                    tableName = 'fmea_causes_controls';
                    break;
                case 'action_plan':
                    tableName = 'fmea_action_plans';
                    break;
                default:
                    return;
            }

            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', deletingItem.id);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Kayıt silindi.'
            });

            setDeletingItem(null);
            setDeletingType(null);
            
            // Reload data
            loadFunctions();
        } catch (error) {
            console.error('Delete error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Silme işlemi başarısız.'
            });
        }
    };

    const getRPNColor = (rpn) => {
        if (rpn >= 100) return 'destructive';
        if (rpn >= 50) return 'warning';
        return 'default';
    };

    const getRPNLabel = (rpn) => {
        if (rpn >= 100) return 'Yüksek Risk';
        if (rpn >= 50) return 'Orta Risk';
        return 'Düşük Risk';
    };

    return (
        <div className="space-y-4">
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="functions">Fonksiyonlar</TabsTrigger>
                    <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                </TabsList>

                <TabsContent value="functions" className="mt-6">
                    <div className="space-y-6">
                        {loading ? (
                            <Card>
                                <CardContent className="py-12">
                                    <div className="text-center text-muted-foreground">
                                        Yükleniyor...
                                    </div>
                                </CardContent>
                            </Card>
                        ) : functions.length === 0 ? (
                            <Card>
                                <CardContent className="py-12">
                                    <div className="text-center text-muted-foreground">
                                        Henüz fonksiyon tanımlanmamış.
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            functions.map((func) => {
                                const funcFailureModes = failureModes[func.id] || [];
                                return (
                                    <Card key={func.id} className="overflow-hidden">
                                        <CardHeader className="bg-muted/50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle>
                                                        Fonksiyon #{func.function_number}: {func.function_name}
                                                    </CardTitle>
                                                    {func.function_description && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {func.function_description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedFunction(func);
                                                            setEditingFailureMode(null);
                                                            setFailureModeModalOpen(true);
                                                        }}
                                                    >
                                                        <Plus className="w-4 h-4 mr-1" />
                                                        Hata Modu Ekle
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingFunction(func);
                                                            setFunctionModalOpen(true);
                                                        }}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setDeletingItem(func);
                                                            setDeletingType('function');
                                                        }}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            {funcFailureModes.length === 0 ? (
                                                <div className="text-center text-muted-foreground py-8">
                                                    Bu fonksiyon için henüz hata modu tanımlanmamış.
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {funcFailureModes.map((fm) => {
                                                        const fmCauses = causes[fm.id] || [];
                                                        return (
                                                            <Card key={fm.id} className="border-l-4 border-l-orange-500">
                                                                <CardHeader className="pb-3">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex-1">
                                                                            <CardTitle className="text-base">
                                                                                Hata Modu #{fm.failure_mode_number}: {fm.failure_mode_description}
                                                                            </CardTitle>
                                                                            {fm.potential_effect && (
                                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                                    Etki: {fm.potential_effect}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Badge variant="outline">
                                                                                S: {fm.severity}
                                                                            </Badge>
                                                                            {fm.is_special_characteristic && (
                                                                                <Badge variant="destructive">
                                                                                    {fm.classification || 'Özel'}
                                                                                </Badge>
                                                                            )}
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setSelectedFailureMode(fm);
                                                                                    setEditingCause(null);
                                                                                    setCauseModalOpen(true);
                                                                                }}
                                                                            >
                                                                                <Plus className="w-4 h-4 mr-1" />
                                                                                Kök Neden Ekle
                                                                            </Button>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setEditingFailureMode(fm);
                                                                                    setSelectedFunction(func);
                                                                                    setFailureModeModalOpen(true);
                                                                                }}
                                                                            >
                                                                                <Edit className="w-4 h-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setDeletingItem(fm);
                                                                                    setDeletingType('failure_mode');
                                                                                }}
                                                                                className="text-destructive"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </CardHeader>
                                                                <CardContent>
                                                                    {fmCauses.length === 0 ? (
                                                                        <div className="text-center text-muted-foreground py-4 text-sm">
                                                                            Bu hata modu için henüz kök neden tanımlanmamış.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-3">
                                                                            {fmCauses.map((cause) => {
                                                                                const causeActionPlans = actionPlans[cause.id] || [];
                                                                                return (
                                                                                    <Card key={cause.id} className="bg-muted/30">
                                                                                        <CardContent className="p-4">
                                                                                            <div className="flex items-start justify-between mb-3">
                                                                                                <div className="flex-1">
                                                                                                    <div className="flex items-center gap-2 mb-2">
                                                                                                        <span className="font-semibold">
                                                                                                            Kök Neden #{cause.cause_number}:
                                                                                                        </span>
                                                                                                        <span>{cause.potential_cause}</span>
                                                                                                    </div>
                                                                                                    <div className="flex gap-4 text-sm">
                                                                                                        <div>
                                                                                                            <span className="text-muted-foreground">O: </span>
                                                                                                            <span className="font-medium">{cause.occurrence}</span>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <span className="text-muted-foreground">D: </span>
                                                                                                            <span className="font-medium">{cause.detection}</span>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <span className="text-muted-foreground">RPN: </span>
                                                                                                            <Badge variant={getRPNColor(cause.rpn)}>
                                                                                                                {cause.rpn} ({getRPNLabel(cause.rpn)})
                                                                                                            </Badge>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    {cause.current_controls_prevention && (
                                                                        <div className="mt-2 text-xs text-muted-foreground">
                                                                                                            <strong>Önleyici Kontroller:</strong> {cause.current_controls_prevention}
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {cause.current_controls_detection && (
                                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                                                                            <strong>Tespit Kontrolleri:</strong> {cause.current_controls_detection}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="flex gap-2">
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        onClick={() => {
                                                                                                            setSelectedCause(cause);
                                                                                                            setEditingActionPlan(null);
                                                                                                            setActionPlanModalOpen(true);
                                                                                                        }}
                                                                                                    >
                                                                                                        <Plus className="w-4 h-4 mr-1" />
                                                                                                        Aksiyon
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        onClick={() => {
                                                                                                            setEditingCause(cause);
                                                                                                            setSelectedFailureMode(fm);
                                                                                                            setCauseModalOpen(true);
                                                                                                        }}
                                                                    >
                                                                                                        <Edit className="w-4 h-4" />
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        onClick={() => {
                                                                                                            setDeletingItem(cause);
                                                                                                            setDeletingType('cause');
                                                                                                        }}
                                                                                                        className="text-destructive"
                                                                                                    >
                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                            
                                                                                            {causeActionPlans.length > 0 && (
                                                                                                <div className="mt-3 pt-3 border-t">
                                                                                                    <div className="text-xs font-semibold mb-2">Aksiyon Planları:</div>
                                                                                                    <div className="space-y-2">
                                                                                                        {causeActionPlans.map((plan) => (
                                                                                                            <div key={plan.id} className="flex items-start justify-between p-2 bg-background rounded text-sm">
                                                                                                                <div className="flex-1">
                                                                                                                    <div className="font-medium">
                                                                                                                        Aksiyon #{plan.action_number}: {plan.recommended_action}
                                                                                                                    </div>
                                                                                                                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                                                                                                        <span>Durum: {plan.status === 'Open' ? 'Açık' : plan.status === 'In Progress' ? 'Devam Eden' : plan.status === 'Completed' ? 'Tamamlanan' : plan.status}</span>
                                                                                                                        {plan.target_completion_date && (
                                                                                                                            <span>Hedef: {new Date(plan.target_completion_date).toLocaleDateString('tr-TR')}</span>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                    {plan.new_rpn && (
                                                                                                                        <div className="mt-1">
                                                                                                                            <Badge variant={getRPNColor(plan.new_rpn)}>
                                                                                                                                Yeni RPN: {plan.new_rpn}
                                                                                                                            </Badge>
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <div className="flex gap-1">
                                                                                                                    <Button
                                                                                                                        variant="ghost"
                                                                                                                        size="sm"
                                                                                                                        onClick={() => {
                                                                                                                            setEditingActionPlan(plan);
                                                                                                                            setSelectedCause(cause);
                                                                                                                            setActionPlanModalOpen(true);
                                                                                                                        }}
                                                                                                                    >
                                                                                                                        <Edit className="w-3 h-3" />
                                                                                                                    </Button>
                                                                                                                    <Button
                                                                                                                        variant="ghost"
                                                                                                                        size="sm"
                                                                                                                        onClick={() => {
                                                                                                                            setDeletingItem(plan);
                                                                                                                            setDeletingType('action_plan');
                                                                                                                        }}
                                                                                                                        className="text-destructive"
                                                                                                                    >
                                                                                                                        <Trash2 className="w-3 h-3" />
                                                                                                                    </Button>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
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
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}

                        <Card>
                            <CardContent className="p-6">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setEditingFunction(null);
                                        setFunctionModalOpen(true);
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Yeni Fonksiyon Ekle
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="overview" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Toplam Fonksiyon</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{functions.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Toplam Hata Modu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">
                                    {Object.values(failureModes).flat().length}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Toplam Kök Neden</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">
                                    {Object.values(causes).flat().length}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Yüksek Riskli Öğeler (RPN ≥ 100)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                const allCauses = Object.values(causes).flat();
                                const highRisk = allCauses.filter(c => c.rpn >= 100).sort((a, b) => b.rpn - a.rpn);
                                
                                if (highRisk.length === 0) {
                                    return (
                                        <div className="text-center text-muted-foreground py-8">
                                            Yüksek riskli öğe bulunmuyor.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-3">
                                        {highRisk.map((cause) => {
                                            const failureMode = Object.values(failureModes).flat().find(fm => fm.id === cause.failure_mode_id);
                                            const func = functions.find(f => failureMode && f.id === failureMode.function_id);
                                            return (
                                                <div key={cause.id} className="p-4 border rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-semibold">
                                                                {func?.function_name} → {failureMode?.failure_mode_description}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground mt-1">
                                                                Kök Neden: {cause.potential_cause}
                                                            </div>
                                                            <div className="flex gap-4 mt-2 text-sm">
                                                                <span>S: {cause.severity}</span>
                                                                <span>O: {cause.occurrence}</span>
                                                                <span>D: {cause.detection}</span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="destructive" className="text-lg px-4 py-2">
                                                            RPN: {cause.rpn}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Form Modals */}
            <FMEAFunctionFormModal
                open={isFunctionModalOpen}
                setOpen={(open) => {
                    setFunctionModalOpen(open);
                    if (!open) {
                        setEditingFunction(null);
                        setSelectedFunction(null);
                    }
                }}
                existingFunction={editingFunction}
                projectId={project.id}
                onSuccess={loadFunctions}
            />

            <FMEAFailureModeFormModal
                open={isFailureModeModalOpen}
                setOpen={(open) => {
                    setFailureModeModalOpen(open);
                    if (!open) {
                        setEditingFailureMode(null);
                        setSelectedFunction(null);
                    }
                }}
                existingFailureMode={editingFailureMode}
                functionId={selectedFunction?.id}
                onSuccess={() => {
                    loadFunctions();
                }}
            />

            <FMEACauseFormModal
                open={isCauseModalOpen}
                setOpen={(open) => {
                    setCauseModalOpen(open);
                    if (!open) {
                        setEditingCause(null);
                        setSelectedFailureMode(null);
                    }
                }}
                existingCause={editingCause}
                failureModeId={selectedFailureMode?.id}
                onSuccess={() => {
                    loadFunctions();
                }}
            />

            <FMEAActionPlanFormModal
                open={isActionPlanModalOpen}
                setOpen={(open) => {
                    setActionPlanModalOpen(open);
                    if (!open) {
                        setEditingActionPlan(null);
                        setSelectedCause(null);
                    }
                }}
                existingActionPlan={editingActionPlan}
                causeControlId={selectedCause?.id}
                onSuccess={() => {
                    loadFunctions();
                }}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu kaydı silmek istediğinizden emin misiniz?
                            Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FMEADetailView;
