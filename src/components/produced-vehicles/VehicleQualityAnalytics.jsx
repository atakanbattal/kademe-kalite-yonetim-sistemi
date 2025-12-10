import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { Car, TrendingUp, AlertTriangle, CheckCircle, Percent, Factory, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA', '#34D399', '#F87171'];

const VehicleQualityAnalytics = () => {
    const { producedVehicles, productionDepartments, loading } = useData();
    const [activeTab, setActiveTab] = useState('vehicle-type'); // 'vehicle-type', 'production-line', 'critical'

    // Araç tipine göre kalite sonuçları
    const vehicleTypeQuality = useMemo(() => {
        if (!producedVehicles || producedVehicles.length === 0) return [];

        const typeMap = {};
        
        producedVehicles.forEach(vehicle => {
            const vehicleType = vehicle.vehicle_type || 'Belirtilmemiş';
            if (!typeMap[vehicleType]) {
                typeMap[vehicleType] = {
                    total: 0,
                    shipped: 0,
                    inQuality: 0,
                    inRework: 0,
                    readyForShipment: 0,
                    faults: 0,
                    vehiclesWithFaults: new Set()
                };
            }

            typeMap[vehicleType].total++;
            
            // Durum bazlı sayım
            if (vehicle.status === 'Sevk Edildi') typeMap[vehicleType].shipped++;
            else if (['Kaliteye Girdi', 'Kontrol Başladı', 'Kontrol Bitti'].includes(vehicle.status)) {
                typeMap[vehicleType].inQuality++;
            }
            else if (vehicle.status === 'Yeniden İşlemde') typeMap[vehicleType].inRework++;
            else if (vehicle.status === 'Sevk Hazır') typeMap[vehicleType].readyForShipment++;

            // Hata sayısı
            const faults = vehicle.quality_inspection_faults || [];
            const unresolvedFaults = faults.filter(f => !f.is_resolved);
            if (unresolvedFaults.length > 0) {
                typeMap[vehicleType].faults += unresolvedFaults.reduce((sum, f) => sum + (f.quantity || 1), 0);
                typeMap[vehicleType].vehiclesWithFaults.add(vehicle.id);
            }
        });

        return Object.entries(typeMap).map(([type, data]) => ({
            vehicleType: type,
            total: data.total,
            shipped: data.shipped,
            inQuality: data.inQuality,
            inRework: data.inRework,
            readyForShipment: data.readyForShipment,
            totalFaults: data.faults,
            vehiclesWithFaults: data.vehiclesWithFaults.size,
            qualityIndex: data.total > 0 
                ? ((data.shipped + data.readyForShipment) / data.total * 100).toFixed(2)
                : '0.00',
            faultRate: data.total > 0 
                ? ((data.vehiclesWithFaults.size / data.total) * 100).toFixed(2)
                : '0.00',
            avgFaultsPerVehicle: data.total > 0 
                ? (data.faults / data.total).toFixed(2)
                : '0.00'
        })).sort((a, b) => b.total - a.total);
    }, [producedVehicles]);

    // Üretim hatları bazında araç başı kalite indeksi
    const productionLineQuality = useMemo(() => {
        if (!producedVehicles || !productionDepartments || producedVehicles.length === 0) return [];

        const lineMap = {};
        
        producedVehicles.forEach(vehicle => {
            // Üretim hattını belirle (department veya başka bir alan)
            const productionLine = vehicle.production_line || vehicle.production_department || 'Genel';
            
            if (!lineMap[productionLine]) {
                lineMap[productionLine] = {
                    total: 0,
                    shipped: 0,
                    readyForShipment: 0,
                    inRework: 0,
                    totalFaults: 0,
                    totalInspectionTime: 0,
                    inspectionCount: 0,
                    vehiclesWithFaults: new Set()
                };
            }

            lineMap[productionLine].total++;
            
            if (vehicle.status === 'Sevk Edildi') lineMap[productionLine].shipped++;
            else if (vehicle.status === 'Sevk Hazır') lineMap[productionLine].readyForShipment++;
            else if (vehicle.status === 'Yeniden İşlemde') lineMap[productionLine].inRework++;

            // Hata sayısı
            const faults = vehicle.quality_inspection_faults || [];
            const unresolvedFaults = faults.filter(f => !f.is_resolved);
            if (unresolvedFaults.length > 0) {
                const faultCount = unresolvedFaults.reduce((sum, f) => sum + (f.quantity || 1), 0);
                lineMap[productionLine].totalFaults += faultCount;
                lineMap[productionLine].vehiclesWithFaults.add(vehicle.id);
            }

            // Kontrol süresi hesaplama
            const timeline = vehicle.vehicle_timeline_events || [];
            for (let i = 0; i < timeline.length; i++) {
                if (timeline[i].event_type === 'control_start') {
                    const endEvent = timeline.slice(i + 1).find(e => e.event_type === 'control_end');
                    if (endEvent) {
                        const duration = new Date(endEvent.event_timestamp) - new Date(timeline[i].event_timestamp);
                        lineMap[productionLine].totalInspectionTime += duration;
                        lineMap[productionLine].inspectionCount++;
                        break;
                    }
                }
            }
        });

        return Object.entries(lineMap).map(([line, data]) => {
            const qualityIndex = data.total > 0 
                ? ((data.shipped + data.readyForShipment) / data.total * 100).toFixed(2)
                : '0.00';
            
            const avgInspectionTime = data.inspectionCount > 0
                ? (data.totalInspectionTime / data.inspectionCount / 60000).toFixed(1) // dakika cinsinden
                : '0';

            return {
                productionLine: line,
                total: data.total,
                shipped: data.shipped,
                readyForShipment: data.readyForShipment,
                inRework: data.inRework,
                totalFaults: data.totalFaults,
                vehiclesWithFaults: data.vehiclesWithFaults.size,
                qualityIndex: parseFloat(qualityIndex),
                faultRate: data.total > 0 
                    ? ((data.vehiclesWithFaults.size / data.total) * 100).toFixed(2)
                    : '0.00',
                avgFaultsPerVehicle: data.total > 0 
                    ? (data.totalFaults / data.total).toFixed(2)
                    : '0.00',
                avgInspectionTime: parseFloat(avgInspectionTime)
            };
        }).sort((a, b) => b.qualityIndex - a.qualityIndex);
    }, [producedVehicles, productionDepartments]);

    // Kritik karakteristiklerin kontrol yüzdesi
    const criticalCharacteristics = useMemo(() => {
        if (!producedVehicles || producedVehicles.length === 0) return [];

        const characteristicMap = {};
        
        producedVehicles.forEach(vehicle => {
            const faults = vehicle.quality_inspection_faults || [];
            
            faults.forEach(fault => {
                const category = fault.category?.name || fault.fault_category || 'Genel';
                const isCritical = fault.is_critical || false; // Kritik karakteristik flag'i
                
                if (isCritical) {
                    if (!characteristicMap[category]) {
                        characteristicMap[category] = {
                            totalVehicles: new Set(),
                            vehiclesWithFault: new Set(),
                            totalFaults: 0
                        };
                    }
                    
                    characteristicMap[category].totalVehicles.add(vehicle.id);
                    if (!fault.is_resolved) {
                        characteristicMap[category].vehiclesWithFault.add(vehicle.id);
                        characteristicMap[category].totalFaults += (fault.quantity || 1);
                    }
                }
            });
        });

        return Object.entries(characteristicMap).map(([category, data]) => {
            const totalVehicles = data.totalVehicles.size;
            const vehiclesWithFault = data.vehiclesWithFault.size;
            const controlPercentage = totalVehicles > 0
                ? ((totalVehicles - vehiclesWithFault) / totalVehicles * 100).toFixed(2)
                : '100.00';

            return {
                category,
                totalVehicles,
                vehiclesWithFault,
                totalFaults: data.totalFaults,
                controlPercentage: parseFloat(controlPercentage),
                faultRate: totalVehicles > 0
                    ? ((vehiclesWithFault / totalVehicles) * 100).toFixed(2)
                    : '0.00'
            };
        }).sort((a, b) => a.controlPercentage - b.controlPercentage); // En düşük kontrol yüzdesi önce
    }, [producedVehicles]);

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="vehicle-type">
                        <Car className="w-4 h-4 mr-2" />
                        Araç Tipine Göre
                    </TabsTrigger>
                    <TabsTrigger value="production-line">
                        <Factory className="w-4 h-4 mr-2" />
                        Üretim Hatları
                    </TabsTrigger>
                    <TabsTrigger value="critical">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Kritik Karakteristikler
                    </TabsTrigger>
                </TabsList>

                {/* Araç Tipine Göre Kalite Sonuçları */}
                <TabsContent value="vehicle-type" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Araç Tipine Göre Kalite İndeksi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={vehicleTypeQuality} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <XAxis 
                                            dataKey="vehicleType" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem'
                                            }}
                                            formatter={(value) => `${parseFloat(value).toFixed(2)}%`}
                                        />
                                        <Bar dataKey="qualityIndex" name="Kalite İndeksi (%)" radius={[4, 4, 0, 0]}>
                                            {vehicleTypeQuality.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={parseFloat(entry.qualityIndex) >= 90 ? '#22c55e' : 
                                                          parseFloat(entry.qualityIndex) >= 75 ? '#eab308' : 
                                                          '#ef4444'} 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Araç Tipine Göre Hata Oranı</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={vehicleTypeQuality} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <XAxis 
                                            dataKey="vehicleType" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem'
                                            }}
                                            formatter={(value) => `${parseFloat(value).toFixed(2)}%`}
                                        />
                                        <Bar dataKey="faultRate" name="Hata Oranı (%)" radius={[4, 4, 0, 0]}>
                                            {vehicleTypeQuality.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={parseFloat(entry.faultRate) <= 5 ? '#22c55e' : 
                                                          parseFloat(entry.faultRate) <= 15 ? '#eab308' : 
                                                          '#ef4444'} 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Araç Tipi Detay Tablosu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Araç Tipi</TableHead>
                                            <TableHead className="text-right">Toplam</TableHead>
                                            <TableHead className="text-right">Sevk Edildi</TableHead>
                                            <TableHead className="text-right">Sevk Hazır</TableHead>
                                            <TableHead className="text-right">Yeniden İşlemde</TableHead>
                                            <TableHead className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    Kalite İndeksi
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p className="font-semibold mb-2">Kalite İndeksi</p>
                                                                <p className="text-sm">
                                                                    Üretilen araçların ne kadarının başarıyla sevk edilebilir duruma geldiğini gösterir.
                                                                </p>
                                                                <p className="text-sm mt-2">
                                                                    <strong>Hesaplama:</strong> (Sevk Edilen + Sevk Hazır) / Toplam × 100
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </TableHead>
                                            <TableHead className="text-right">Hata Oranı</TableHead>
                                            <TableHead className="text-right">Araç Başı Hata</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {vehicleTypeQuality.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    Veri bulunamadı.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            vehicleTypeQuality.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">{item.vehicleType}</TableCell>
                                                    <TableCell className="text-right">{item.total}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline">{item.shipped}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="secondary">{item.readyForShipment}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="destructive">{item.inRework}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge 
                                                            variant={
                                                                parseFloat(item.qualityIndex) >= 90 ? 'default' :
                                                                parseFloat(item.qualityIndex) >= 75 ? 'secondary' :
                                                                'destructive'
                                                            }
                                                        >
                                                            {item.qualityIndex}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge 
                                                            variant={
                                                                parseFloat(item.faultRate) <= 5 ? 'default' :
                                                                parseFloat(item.faultRate) <= 15 ? 'secondary' :
                                                                'destructive'
                                                            }
                                                        >
                                                            {item.faultRate}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.avgFaultsPerVehicle}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Üretim Hatları Bazında Araç Başı Kalite İndeksi */}
                <TabsContent value="production-line" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Üretim Hattı Kalite İndeksi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={productionLineQuality} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <XAxis 
                                            dataKey="productionLine" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem'
                                            }}
                                            formatter={(value) => `${parseFloat(value).toFixed(2)}%`}
                                        />
                                        <Bar dataKey="qualityIndex" name="Kalite İndeksi (%)" radius={[4, 4, 0, 0]}>
                                            {productionLineQuality.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={entry.qualityIndex >= 90 ? '#22c55e' : 
                                                          entry.qualityIndex >= 75 ? '#eab308' : 
                                                          '#ef4444'} 
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Ortalama Kontrol Süresi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={productionLineQuality} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <XAxis 
                                            dataKey="productionLine" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem'
                                            }}
                                            formatter={(value) => `${parseFloat(value).toFixed(1)} dk`}
                                        />
                                        <Bar dataKey="avgInspectionTime" name="Ortalama Süre (dk)" radius={[4, 4, 0, 0]}>
                                            {productionLineQuality.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Üretim Hattı Detay Tablosu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Üretim Hattı</TableHead>
                                            <TableHead className="text-right">Toplam Araç</TableHead>
                                            <TableHead className="text-right">Sevk Edildi</TableHead>
                                            <TableHead className="text-right">Sevk Hazır</TableHead>
                                            <TableHead className="text-right">Kalite İndeksi</TableHead>
                                            <TableHead className="text-right">Hata Oranı</TableHead>
                                            <TableHead className="text-right">Araç Başı Hata</TableHead>
                                            <TableHead className="text-right">Ort. Kontrol Süresi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {productionLineQuality.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    Veri bulunamadı.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            productionLineQuality.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">{item.productionLine}</TableCell>
                                                    <TableCell className="text-right">{item.total}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline">{item.shipped}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="secondary">{item.readyForShipment}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge 
                                                            variant={
                                                                item.qualityIndex >= 90 ? 'default' :
                                                                item.qualityIndex >= 75 ? 'secondary' :
                                                                'destructive'
                                                            }
                                                        >
                                                            {item.qualityIndex.toFixed(2)}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge 
                                                            variant={
                                                                parseFloat(item.faultRate) <= 5 ? 'default' :
                                                                parseFloat(item.faultRate) <= 15 ? 'secondary' :
                                                                'destructive'
                                                            }
                                                        >
                                                            {item.faultRate}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.avgFaultsPerVehicle}</TableCell>
                                                    <TableCell className="text-right">{item.avgInspectionTime.toFixed(1)} dk</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Kritik Karakteristiklerin Kontrol Yüzdesi */}
                <TabsContent value="critical" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Kritik Karakteristiklerin Kontrol Yüzdesi</CardTitle>
                            <p className="text-sm text-muted-foreground mt-2">
                                Kritik karakteristikler için kontrol yüzdesi ve hata oranları
                            </p>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={criticalCharacteristics} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <XAxis 
                                        dataKey="category" 
                                        angle={-45} 
                                        textAnchor="end" 
                                        height={100}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'hsl(var(--background))', 
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '0.5rem'
                                        }}
                                        formatter={(value) => `${parseFloat(value).toFixed(2)}%`}
                                    />
                                    <Bar dataKey="controlPercentage" name="Kontrol Yüzdesi (%)" radius={[4, 4, 0, 0]}>
                                        {criticalCharacteristics.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.controlPercentage >= 95 ? '#22c55e' : 
                                                      entry.controlPercentage >= 85 ? '#eab308' : 
                                                      '#ef4444'} 
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kritik Karakteristik Detay Tablosu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead className="text-right">Toplam Araç</TableHead>
                                            <TableHead className="text-right">Hatalı Araç</TableHead>
                                            <TableHead className="text-right">Toplam Hata</TableHead>
                                            <TableHead className="text-right">Kontrol Yüzdesi</TableHead>
                                            <TableHead className="text-right">Hata Oranı</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {criticalCharacteristics.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    Kritik karakteristik verisi bulunamadı. Hata kayıtlarında kritik karakteristik işaretlemesi yapılmamış olabilir.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            criticalCharacteristics.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">{item.category}</TableCell>
                                                    <TableCell className="text-right">{item.totalVehicles}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="destructive">{item.vehiclesWithFault}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.totalFaults}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge 
                                                            variant={
                                                                item.controlPercentage >= 95 ? 'default' :
                                                                item.controlPercentage >= 85 ? 'secondary' :
                                                                'destructive'
                                                            }
                                                        >
                                                            {item.controlPercentage.toFixed(2)}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline">{item.faultRate}%</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default VehicleQualityAnalytics;

