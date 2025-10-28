import React, { useMemo, useState, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
    import { format, startOfMonth, eachMonthOfInterval, isValid, parseISO } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useToast } from '@/components/ui/use-toast';
    import { Target, Save } from 'lucide-react';

    const formatCurrency = (value) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

    const CustomTooltip = ({ active, payload, label, unit, isCurrency }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/90 p-2 border border-border rounded-lg shadow-lg text-sm">
                    <p className="font-bold">{label}</p>
                    {payload.map((p, i) => (
                        <p key={i} style={{ color: p.color }}>
                            {`${p.name}: ${isCurrency && p.dataKey.includes('cost') ? formatCurrency(p.value) : p.value.toLocaleString('tr-TR')} ${unit}`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const PerformanceChart = ({ data, dataKey, name, unit, color, targetValue, isCurrency }) => (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis 
                    fontSize={12} 
                    tickFormatter={(value) => isCurrency ? value.toLocaleString('tr-TR') : value}
                    domain={[0, 'dataMax + 20']}
                />
                <Tooltip content={<CustomTooltip unit={unit} isCurrency={isCurrency} />} />
                <Legend />
                <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                {targetValue > 0 && (
                    <ReferenceLine y={targetValue} label={{ value: `Hedef: ${targetValue}`, position: 'insideTopRight', fill: '#a1a1aa' }} stroke="#a1a1aa" strokeDasharray="3 3" />
                )}
            </LineChart>
        </ResponsiveContainer>
    );

    const TargetManagementModal = ({ isOpen, setIsOpen, targets, onUpdate, vehicleType }) => {
        const [editableTargets, setEditableTargets] = useState({});
        const { toast } = useToast();

        const targetLabels = {
            scrap_cost_per_vehicle: 'Hurda Maliyeti (TRY/Araç)',
            scrap_kg_per_vehicle: 'Hurda Ağırlığı (Kg/Araç)',
            waste_kg_per_vehicle: 'Fire Ağırlığı (Kg/Araç)',
            rejection_count_per_vehicle: 'Ret Adedi (Adet/Araç)',
            rework_cost_per_vehicle: 'Yeniden İşlem Maliyeti (TRY/Araç)',
        };

        useEffect(() => {
            const initialTargets = {};
            Object.keys(targetLabels).forEach(key => {
                initialTargets[key] = {
                    value: targets[key]?.value || 0,
                    unit: targets[key]?.unit || ''
                };
            });
            setEditableTargets(initialTargets);
        }, [targets, isOpen]);

        const handleSave = async () => {
            const upsertData = Object.entries(editableTargets).map(([key, target]) => ({
                target_type: key,
                vehicle_type: vehicleType,
                value: target.value,
                unit: targetLabels[key].match(/\(([^)]+)\)/)[1],
            }));

            const { error } = await supabase.from('quality_cost_targets').upsert(upsertData, {
                onConflict: 'target_type,vehicle_type'
            });

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Hedefler güncellenirken bir hata oluştu: ${error.message}` });
            } else {
                toast({ title: 'Başarılı', description: `${vehicleType} için hedefler başarıyla güncellendi.` });
                onUpdate();
                setIsOpen(false);
            }
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{vehicleType} - Performans Hedefleri</DialogTitle>
                        <DialogDescription>Bu araç tipi için hedefleri güncelleyin. Boş bırakılan hedefler genel hedefleri kullanır.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {Object.entries(editableTargets).map(([key, target]) => (
                            <div key={key} className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor={key} className="text-right">{targetLabels[key] || key}</Label>
                                <Input
                                    id={key}
                                    type="number"
                                    value={target.value}
                                    onChange={(e) => setEditableTargets(prev => ({ ...prev, [key]: { ...prev[key], value: parseFloat(e.target.value) || 0 } }))}
                                    className="col-span-2"
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                        <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };


    const VehiclePerformanceModal = ({ isOpen, setIsOpen, vehicleType, costs, onTargetsUpdate }) => {
        const [targets, setTargets] = useState({});
        const [isTargetModalOpen, setTargetModalOpen] = useState(false);

        const fetchTargets = async () => {
            const { data, error } = await supabase
                .from('quality_cost_targets')
                .select('*')
                .or(`vehicle_type.eq.${vehicleType},vehicle_type.is.null`);

            if (!error && data) {
                const newTargets = {};
                // Prioritize vehicle-specific targets over global ones
                data.sort((a, b) => (a.vehicle_type ? -1 : 1)).forEach(target => {
                    if (!newTargets[target.target_type]) {
                        newTargets[target.target_type] = { value: target.value, unit: target.unit };
                    }
                });
                setTargets(newTargets);
                if(onTargetsUpdate) onTargetsUpdate();
            }
        };

        useEffect(() => {
            if(isOpen) fetchTargets();
        }, [isOpen, vehicleType]);

        const monthlyData = useMemo(() => {
            if (!costs || costs.length === 0) return { monthlyTotals: [], totalVehicles: 0 };

            const monthlyAggregates = {};
            const vehicleSet = new Set();

            costs.forEach(cost => {
                if (cost.part_code) vehicleSet.add(cost.part_code);

                const costDate = parseISO(cost.cost_date);
                if (!isValid(costDate)) return;

                const monthKey = format(costDate, 'yyyy-MM');
                if (!monthlyAggregates[monthKey]) {
                    monthlyAggregates[monthKey] = {
                        name: format(costDate, 'MMM yy', { locale: tr }),
                        scrapCost: 0,
                        scrapWeight: 0,
                        rejectionCount: 0,
                        wasteWeight: 0,
                        reworkCost: 0,
                        vehicleCount: new Set(),
                    };
                }

                monthlyAggregates[monthKey].vehicleCount.add(cost.part_code);

                if (cost.cost_type === 'Hurda Maliyeti') {
                    monthlyAggregates[monthKey].scrapCost += cost.amount || 0;
                    monthlyAggregates[monthKey].scrapWeight += cost.scrap_weight || 0;
                    monthlyAggregates[monthKey].rejectionCount += cost.quantity || 0;
                }
                if (cost.cost_type === 'Fire Maliyeti') {
                    monthlyAggregates[monthKey].wasteWeight += cost.scrap_weight || 0;
                }
                if (cost.cost_type === 'Yeniden İşlem Maliyeti') {
                    monthlyAggregates[monthKey].reworkCost += cost.amount || 0;
                }
            });

            const allDates = costs.map(c => parseISO(c.cost_date)).filter(isValid);
            const firstMonth = allDates.length > 0 ? startOfMonth(allDates.sort((a, b) => a - b)[0]) : new Date();
            const lastMonth = startOfMonth(new Date());
            const monthInterval = eachMonthOfInterval({ start: firstMonth, end: lastMonth });

            const monthlyTotals = monthInterval.map(month => {
                const monthKey = format(month, 'yyyy-MM');
                const data = monthlyAggregates[monthKey];
                const defaultData = { name: format(month, 'MMM yy', { locale: tr }), scrapCostPerVehicle: 0, scrapPerVehicle: 0, rejectionPerVehicle: 0, wastePerVehicle: 0, reworkPerVehicle: 0 };
                if (!data) return defaultData;

                const numVehicles = data.vehicleCount.size || 1;
                return {
                    name: data.name,
                    scrapCostPerVehicle: data.scrapCost / numVehicles,
                    scrapPerVehicle: data.scrapWeight / numVehicles,
                    rejectionPerVehicle: data.rejectionCount / numVehicles,
                    wastePerVehicle: data.wasteWeight / numVehicles,
                    reworkPerVehicle: data.reworkCost / numVehicles,
                };
            });

            return { monthlyTotals, totalVehicles: vehicleSet.size };
        }, [costs]);

        const { monthlyTotals, totalVehicles } = monthlyData;

        return (
            <>
                <TargetManagementModal
                    isOpen={isTargetModalOpen}
                    setIsOpen={setTargetModalOpen}
                    targets={targets}
                    onUpdate={fetchTargets}
                    vehicleType={vehicleType}
                />
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-2xl flex justify-between items-center">
                                <span>{vehicleType} - Araç Başına Performans</span>
                                <Button variant="outline" size="sm" onClick={() => setTargetModalOpen(true)}>
                                    <Target className="mr-2 h-4 w-4" /> Hedefleri Yönet
                                </Button>
                            </DialogTitle>
                            <DialogDescription>
                                Seçili dönem için aylık araç başına maliyet ve hata metrikleri. Toplam {totalVehicles} araç analiz edildi.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-grow overflow-hidden">
                            <Tabs defaultValue="scrap_cost" className="h-full flex flex-col">
                                <TabsList className="grid w-full grid-cols-5">
                                    <TabsTrigger value="scrap_cost">Hurda Maliyeti</TabsTrigger>
                                    <TabsTrigger value="rework">Yeniden İşlem</TabsTrigger>
                                    <TabsTrigger value="scrap_weight">Hurda Ağırlığı</TabsTrigger>
                                    <TabsTrigger value="waste">Fire Ağırlığı</TabsTrigger>
                                    <TabsTrigger value="rejection">Ret Adedi</TabsTrigger>
                                </TabsList>
                                <TabsContent value="scrap_cost" className="flex-grow">
                                    <PerformanceChart data={monthlyTotals} dataKey="scrapCostPerVehicle" name="Hurda/Araç" unit="TRY" color="#f43f5e" targetValue={targets.scrap_cost_per_vehicle?.value} isCurrency />
                                </TabsContent>
                                <TabsContent value="rework" className="flex-grow">
                                    <PerformanceChart data={monthlyTotals} dataKey="reworkPerVehicle" name="Y.İşlem/Araç" unit="TRY" color="#3b82f6" targetValue={targets.rework_cost_per_vehicle?.value} isCurrency />
                                </TabsContent>
                                <TabsContent value="scrap_weight" className="flex-grow">
                                    <PerformanceChart data={monthlyTotals} dataKey="scrapPerVehicle" name="Hurda/Araç" unit="Kg" color="#8b5cf6" targetValue={targets.scrap_kg_per_vehicle?.value} />
                                </TabsContent>
                                <TabsContent value="waste" className="flex-grow">
                                    <PerformanceChart data={monthlyTotals} dataKey="wastePerVehicle" name="Fire/Araç" unit="Kg" color="#f97316" targetValue={targets.waste_kg_per_vehicle?.value} />
                                </TabsContent>
                                <TabsContent value="rejection" className="flex-grow">
                                    <PerformanceChart data={monthlyTotals} dataKey="rejectionPerVehicle" name="Ret/Araç" unit="Adet" color="#ef4444" targetValue={targets.rejection_count_per_vehicle?.value} />
                                </TabsContent>
                            </Tabs>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
    };

    export default VehiclePerformanceModal;