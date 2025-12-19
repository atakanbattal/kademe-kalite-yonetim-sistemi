import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Factory, Car, Package } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const RiskBasedIndicators = () => {
    const { nonConformities, suppliers, producedVehicles, loading } = useData();
    const [riskAssessments, setRiskAssessments] = useState([]);

    useEffect(() => {
        const fetchRiskAssessments = async () => {
            try {
                // Risk değerlendirmeleri tablosu henüz oluşturulmamış olabilir
                // Mevcut NC verilerinden risk analizi yapılıyor
                console.warn('Risk değerlendirmeleri tablosu henüz oluşturulmamış, NC verilerinden hesaplanıyor');
                setRiskAssessments([]);
            } catch (error) {
                console.warn('Risk değerlendirmeleri yüklenemedi:', error.message);
                setRiskAssessments([]);
            }
        };

        fetchRiskAssessments();
    }, []);

    // En riskli prosesler (sorumlu birim bazında)
    // NOT: Kalite birimi hariç tutulur çünkü onlar bildiren birim, sorumlu birim değil
    const riskyProcesses = useMemo(() => {
        if (!nonConformities) return [];
        
        // Kalite birimlerini hariç tut (bildiren birimler, sorumlu değiller)
        const qualityDepartments = [
            'kalite', 'kalite kontrol', 'kalite güvence', 'kalite kontrol ve güvence',
            'quality', 'quality control', 'quality assurance', 'qc', 'qa'
        ];
        
        const processMap = {};
        nonConformities.forEach(nc => {
            // Sorumlu birimi kullan (responsible_unit), yoksa department
            const dept = nc.responsible_unit || nc.department || 'Belirtilmemiş';
            
            // Kalite birimlerini hariç tut
            if (qualityDepartments.some(q => dept.toLowerCase().includes(q))) {
                return;
            }
            
            if (!processMap[dept]) {
                processMap[dept] = {
                    name: dept,
                    openNCs: 0,
                    totalNCs: 0,
                    avgSeverity: 0,
                    severitySum: 0
                };
            }
            processMap[dept].totalNCs++;
            if (nc.status !== 'Kapatıldı') {
                processMap[dept].openNCs++;
            }
            processMap[dept].severitySum += nc.severity || 5;
        });

        return Object.values(processMap)
            .map(p => ({
                ...p,
                avgSeverity: p.totalNCs > 0 ? (p.severitySum / p.totalNCs) : 0,
                riskScore: p.openNCs * 2 + (p.avgSeverity * 1.5) // Basit risk skoru
            }))
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5);
    }, [nonConformities]);

    // En riskli tedarikçiler
    const riskySuppliers = useMemo(() => {
        if (!suppliers || !nonConformities) return [];
        
        const supplierMap = {};
        nonConformities.forEach(nc => {
            if (nc.supplier_id) {
                const supplier = suppliers.find(s => s.id === nc.supplier_id);
                if (supplier) {
                    const supplierName = supplier.name;
                    if (!supplierMap[supplierName]) {
                        supplierMap[supplierName] = {
                            name: supplierName,
                            openNCs: 0,
                            totalNCs: 0,
                            status: supplier.status
                        };
                    }
                    supplierMap[supplierName].totalNCs++;
                    if (nc.status !== 'Kapatıldı') {
                        supplierMap[supplierName].openNCs++;
                    }
                }
            }
        });

        return Object.values(supplierMap)
            .map(s => ({
                ...s,
                riskScore: s.openNCs * 3 + (s.status !== 'Onaylı' ? 10 : 0)
            }))
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5);
    }, [suppliers, nonConformities]);

    // En riskli araç tipleri
    const riskyVehicles = useMemo(() => {
        if (!producedVehicles || !nonConformities) return [];
        
        const vehicleMap = {};
        nonConformities.forEach(nc => {
            if (nc.vehicle_type) {
                if (!vehicleMap[nc.vehicle_type]) {
                    vehicleMap[nc.vehicle_type] = {
                        vehicleType: nc.vehicle_type,
                        openNCs: 0,
                        totalNCs: 0
                    };
                }
                vehicleMap[nc.vehicle_type].totalNCs++;
                if (nc.status !== 'Kapatıldı') {
                    vehicleMap[nc.vehicle_type].openNCs++;
                }
            }
        });

        return Object.values(vehicleMap)
            .map(v => ({
                ...v,
                riskScore: v.openNCs * 2
            }))
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5);
    }, [producedVehicles, nonConformities]);

    const getRiskLevel = (score) => {
        if (score >= 20) return { level: 'KRİTİK', color: 'destructive' };
        if (score >= 10) return { level: 'YÜKSEK', color: 'destructive' };
        if (score >= 5) return { level: 'ORTA', color: 'secondary' };
        return { level: 'DÜŞÜK', color: 'outline' };
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Risk Bazlı Göstergeler
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* En Riskli Prosesler */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Factory className="h-5 w-5 text-orange-500" />
                        En Riskli Prosesler
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        ISO 9001:2015 Madde 6.1
                    </p>
                </CardHeader>
                <CardContent>
                    {riskyProcesses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Veri bulunamadı.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {riskyProcesses.map((process, idx) => {
                                const risk = getRiskLevel(process.riskScore);
                                return (
                                    <div key={idx} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-sm">{process.name}</span>
                                            <Badge variant={risk.color}>{risk.level}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <span>Açık: {process.openNCs}</span>
                                            <span>Toplam: {process.totalNCs}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* En Riskli Tedarikçiler */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-purple-500" />
                        En Riskli Tedarikçiler
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        IATF 16949 Gereklilik
                    </p>
                </CardHeader>
                <CardContent>
                    {riskySuppliers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Veri bulunamadı.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {riskySuppliers.map((supplier, idx) => {
                                const risk = getRiskLevel(supplier.riskScore);
                                return (
                                    <div key={idx} className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-sm">{supplier.name}</span>
                                            <Badge variant={risk.color}>{risk.level}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <span>Açık: {supplier.openNCs}</span>
                                            <span>
                                                Durum: <Badge variant="outline" className="text-xs">
                                                    {supplier.status || 'Bilinmiyor'}
                                                </Badge>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* En Riskli Araç Tipleri */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-blue-500" />
                        En Riskli Araç Tipleri
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Üretim Kalite Riski
                    </p>
                </CardHeader>
                <CardContent>
                    {riskyVehicles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Veri bulunamadı.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {riskyVehicles.map((vehicle, idx) => {
                                const risk = getRiskLevel(vehicle.riskScore);
                                return (
                                    <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-sm">{vehicle.vehicleType}</span>
                                            <Badge variant={risk.color}>{risk.level}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                            <span>Açık: {vehicle.openNCs}</span>
                                            <span>Toplam: {vehicle.totalNCs}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Risk Değerlendirmeleri Tablosu */}
            {riskAssessments.length > 0 && (
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Kayıtlı Risk Değerlendirmeleri</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Risk Tipi</TableHead>
                                        <TableHead>Risk Adı</TableHead>
                                        <TableHead>Olasılık</TableHead>
                                        <TableHead>Etki</TableHead>
                                        <TableHead>Risk Skoru</TableHead>
                                        <TableHead>Risk Seviyesi</TableHead>
                                        <TableHead>Durum</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {riskAssessments.slice(0, 10).map((risk, idx) => {
                                        const riskInfo = getRiskLevel(risk.risk_score);
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell>{risk.risk_type}</TableCell>
                                                <TableCell className="font-medium">{risk.risk_name}</TableCell>
                                                <TableCell>{risk.probability}/5</TableCell>
                                                <TableCell>{risk.impact}/5</TableCell>
                                                <TableCell>{risk.risk_score}</TableCell>
                                                <TableCell>
                                                    <Badge variant={riskInfo.color}>{risk.risk_level}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{risk.status}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default RiskBasedIndicators;

