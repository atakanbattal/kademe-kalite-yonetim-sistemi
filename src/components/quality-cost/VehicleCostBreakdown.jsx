import React, { useMemo, useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import VehiclePerformanceModal from './VehiclePerformanceModal';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Target, Car } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import { useData } from '@/contexts/DataContext';

    const formatCurrency = (value) => {
        if (typeof value !== 'number' || isNaN(value)) return '-';
        return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    const formatNumber = (value) => {
        if (typeof value !== 'number' || isNaN(value)) return '-';
        return value.toFixed(2).replace('.', ',');
    };

    const MetricDisplay = ({ label, value, unit, target, isCurrency = false }) => {
        const targetValue = target?.value ?? 0;
        const isOverTarget = targetValue > 0 && value > targetValue;
        const isApproachingTarget = targetValue > 0 && value > targetValue * 0.8 && value <= targetValue;
        const isUnderTarget = targetValue > 0 && value < targetValue * 0.8;

        const valueColor = isOverTarget
            ? 'text-red-500'
            : isApproachingTarget
            ? 'text-yellow-500'
            : isUnderTarget
            ? 'text-green-500'
            : 'text-foreground';

        const formattedValue = isCurrency ? formatCurrency(value) : formatNumber(value);
        const formattedTarget = isCurrency ? formatCurrency(targetValue) : formatNumber(targetValue);

        return (
            <div className="flex justify-between items-baseline text-sm py-2 border-b border-border/50 last:border-b-0">
                <span className="text-muted-foreground">{label}</span>
                <div className="text-right">
                    <p className={cn("font-bold text-lg", valueColor)}>
                        {formattedValue} <span className="text-xs font-normal">{unit}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/80 flex items-center justify-end gap-1">
                        <Target className="h-3 w-3" /> Hedef: {formattedTarget} {unit}
                    </p>
                </div>
            </div>
        );
    };

    const VehicleCostBreakdown = ({ costs, loading }) => {
        const [isPerformanceModalOpen, setPerformanceModalOpen] = useState(false);
        const [selectedVehicleType, setSelectedVehicleType] = useState(null);
        const [targets, setTargets] = useState({});
        
        // DataContext'ten doğrudan producedVehicles, products ve productCategories al
        const { producedVehicles, products, productCategories } = useData();
        
        // Araç tipi kategorisini bul (VEHICLE_TYPES)
        const vehicleTypeCategory = useMemo(() => {
            return (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
        }, [productCategories]);
        
        // Üretilen araçlardan model bazlı sayıları al
        const producedVehiclesByType = useMemo(() => {
            const vehicles = producedVehicles || [];
            const counts = {};
            vehicles.forEach(v => {
                const vehicleType = v.vehicle_type || 'Bilinmiyor';
                if (vehicleType && vehicleType !== 'Bilinmiyor') {
                    counts[vehicleType] = (counts[vehicleType] || 0) + 1;
                }
            });
            return counts;
        }, [producedVehicles]);
        
        // Gizlenecek araç tipleri (istisnai durumlar)
        const excludedVehicleTypes = [
            'Traktör Kabin',
            'Traktör Kabini',
            'Kabin',
        ];
        
        // SADECE araç tipi kategorisindeki ürünleri al (Tümosan, Hattat gibi gerçek araç modelleri)
        const validProductNames = useMemo(() => {
            if (!vehicleTypeCategory) {
                console.log('VehicleCostBreakdown - VEHICLE_TYPES kategorisi bulunamadı');
                return [];
            }
            
            const productList = products || [];
            // Sadece VEHICLE_TYPES kategorisindeki ürünleri filtrele
            const vehicleProducts = productList.filter(p => p.category_id === vehicleTypeCategory.id);
            
            // İstisnai durumları çıkar (Traktör Kabin gibi)
            const names = vehicleProducts
                .map(p => p.product_name)
                .filter(Boolean)
                .filter(name => !excludedVehicleTypes.some(excluded => 
                    name.toLowerCase().includes(excluded.toLowerCase())
                ));
            
            console.log('VehicleCostBreakdown - Araç Tipi Kategorisi:', vehicleTypeCategory);
            console.log('VehicleCostBreakdown - Araç Modelleri:', names.length, 'model', names);
            console.log('VehicleCostBreakdown - Üretilen araçlar:', Object.keys(producedVehiclesByType).length, 'model', producedVehiclesByType);
            
            return names;
        }, [products, productCategories, vehicleTypeCategory, producedVehiclesByType]);

        const fetchTargets = async () => {
            const { data, error } = await supabase.from('quality_cost_targets').select('*');
            if (!error && data) {
                const newTargets = {};
                data.forEach(target => {
                    const vehicleType = target.vehicle_type || 'global';
                    if (!newTargets[vehicleType]) {
                        newTargets[vehicleType] = {};
                    }
                    newTargets[vehicleType][target.target_type] = { value: target.value, unit: target.unit };
                });
                setTargets(newTargets);
            }
        };

        useEffect(() => {
            fetchTargets();
        }, []);

        const breakdownData = useMemo(() => {
            if (loading) return [];
            
            // Ürün listesi boşsa hiçbir şey gösterme
            if (!validProductNames || validProductNames.length === 0) {
                console.log('VehicleCostBreakdown - Ürün listesi boş, kart gösterilmeyecek');
                return [];
            }

            const vehicleData = {};
            
            // SADECE ürün listesindeki ürünleri kart olarak göster
            // Plaka numaraları, "Traktör Kabin" gibi değerler kesinlikle dahil edilmez
            validProductNames.forEach(productName => {
                // Ürün adı geçerli mi kontrol et (en az 2 karakter, sayı ile başlamıyor)
                if (!productName || productName.length < 2) return;
                // Plaka formatı kontrolü (sayı ile başlıyorsa veya "-" içeriyorsa atla)
                if (/^\d/.test(productName) || /^\d{2}-/.test(productName)) return;
                
                vehicleData[productName] = {
                    totalCost: 0,
                    scrapCost: 0,
                    reworkCost: 0,
                    scrapWeight: 0,
                    wasteWeight: 0,
                    rejectionCount: 0,
                    vehicleSet: new Set(),
                    // Üretilen araçlardan model sayısını al
                    producedVehicleCount: producedVehiclesByType[productName] || 0,
                };
            });

            // Maliyet verilerini işle (sadece geçerli ürün adlarına sahip olanları)
            if (costs && costs.length > 0) {
                costs.forEach(cost => {
                    const vehicleType = cost.vehicle_type;
                    
                    // "Bilinmiyor" veya boş olanları atla
                    if (!vehicleType || vehicleType === 'Bilinmiyor') return;
                    
                    // Sadece ürün listesinde olan VE vehicleData'da bulunan tipleri kabul et
                    if (!vehicleData[vehicleType]) return;

                    if (cost.part_code) vehicleData[vehicleType].vehicleSet.add(cost.part_code);
                    vehicleData[vehicleType].totalCost += cost.amount || 0;

                    if (cost.cost_type === 'Hurda Maliyeti') {
                        vehicleData[vehicleType].scrapCost += cost.amount || 0;
                        vehicleData[vehicleType].scrapWeight += cost.scrap_weight || 0;
                        vehicleData[vehicleType].rejectionCount += cost.quantity || 0;
                    }
                    if (cost.cost_type === 'Fire Maliyeti') {
                        vehicleData[vehicleType].wasteWeight += cost.scrap_weight || 0;
                    }
                    if (cost.cost_type === 'Yeniden İşlem Maliyeti') {
                        vehicleData[vehicleType].reworkCost += cost.amount || 0;
                    }
                });
            }

            return Object.entries(vehicleData).map(([vehicle, data]) => {
                // Üretilen araç sayısını kullan (0 ise en az 1 olarak hesapla bölme için)
                const totalVehicles = data.producedVehicleCount || data.vehicleSet.size || 1;
                const hasData = data.totalCost > 0 || data.vehicleSet.size > 0;
                
                return {
                    vehicle,
                    totalCost: data.totalCost,
                    totalVehicles: totalVehicles,
                    producedVehicleCount: data.producedVehicleCount,
                    hasData,
                    metrics: {
                        scrap_cost_per_vehicle: data.scrapCost / totalVehicles,
                        rework_cost_per_vehicle: data.reworkCost / totalVehicles,
                        scrap_kg_per_vehicle: data.scrapWeight / totalVehicles,
                        waste_kg_per_vehicle: data.wasteWeight / totalVehicles,
                        rejection_count_per_vehicle: data.rejectionCount / totalVehicles,
                    }
                };
            }).sort((a, b) => b.totalCost - a.totalCost);

        }, [costs, loading, validProductNames, producedVehiclesByType]);

        const handleCardClick = (vehicleType) => {
            setSelectedVehicleType(vehicleType);
            setPerformanceModalOpen(true);
        };

        if (loading) {
            return <div className="text-center text-muted-foreground p-8">Detaylı analiz verileri yükleniyor...</div>;
        }

        if (breakdownData.length === 0) {
            return (
                <div className="text-center text-muted-foreground p-8 bg-muted/30 rounded-xl border border-dashed">
                    <Car className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">Detaylı Analiz için Araç Tipi Tanımı Gerekli</p>
                    <p className="text-sm mb-4">
                        Bu sekme, "Genel Ayarlar → Ürünler" bölümündeki <strong>"Araç Tipleri"</strong> kategorisindeki 
                        ürünleri (örn: Tümosan, Hattat, vb.) üretilen araç sayılarıyla eşleştirerek model bazlı maliyet analizi sunar.
                    </p>
                    <div className="text-xs space-y-1 bg-background/50 p-3 rounded-lg inline-block">
                        <p>🏷️ Araç Tipi kategorisi: <span className="font-bold">{vehicleTypeCategory ? 'Mevcut ✓' : 'Bulunamadı ✗'}</span></p>
                        <p>🚗 Tanımlı araç modeli: <span className="font-bold">{validProductNames?.length || 0}</span></p>
                        <p>📋 Üretilen araç kaydı: <span className="font-bold">{producedVehicles?.length || 0}</span></p>
                        <p>📊 Eşleşen model tipi: <span className="font-bold">{Object.keys(producedVehiclesByType).length}</span></p>
                    </div>
                    {!vehicleTypeCategory && (
                        <p className="text-sm mt-4 text-destructive">
                            → "Genel Ayarlar → Ürün Kategorileri" bölümünden "VEHICLE_TYPES" kategorisi ekleyin.
                        </p>
                    )}
                    {vehicleTypeCategory && validProductNames?.length === 0 && (
                        <p className="text-sm mt-4 text-primary">
                            → "Genel Ayarlar → Ürünler" bölümünden "Araç Tipleri" kategorisine araç modellerini ekleyin.
                        </p>
                    )}
                </div>
            );
        }

        const allVehicleCosts = selectedVehicleType ? costs.filter(c => c.vehicle_type === selectedVehicleType) : [];

        return (
            <>
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.05 }}
                >
                    {breakdownData.map(({ vehicle, totalCost, totalVehicles, producedVehicleCount, hasData, metrics }) => {
                        const vehicleTargets = targets[vehicle] || targets['global'] || {};
                        return (
                            <motion.div key={vehicle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                <Card
                                    className={cn(
                                        "h-full flex flex-col cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm",
                                        !hasData && "opacity-60"
                                    )}
                                    onClick={() => handleCardClick(vehicle)}
                                >
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center gap-2">
                                            <Car className="h-5 w-5 text-primary" />
                                            <CardTitle className="text-lg text-primary">{vehicle}</CardTitle>
                                        </div>
                                        <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                            <p className="flex items-center gap-1">
                                                <span className="font-medium">{producedVehicleCount || 0}</span> araç üretildi
                                            </p>
                                            {hasData && (
                                                <p className="text-muted-foreground/70">
                                                    ({totalVehicles} araç bazında hesaplandı)
                                                </p>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        {hasData ? (
                                            <div className="space-y-1">
                                                <MetricDisplay label="Hurda Maliyeti" value={metrics.scrap_cost_per_vehicle} unit="TRY/Araç" target={vehicleTargets.scrap_cost_per_vehicle} isCurrency />
                                                <MetricDisplay label="Yeniden İşlem" value={metrics.rework_cost_per_vehicle} unit="TRY/Araç" target={vehicleTargets.rework_cost_per_vehicle} isCurrency />
                                                <MetricDisplay label="Hurda Ağırlığı" value={metrics.scrap_kg_per_vehicle} unit="Kg/Araç" target={vehicleTargets.scrap_kg_per_vehicle} />
                                                <MetricDisplay label="Fire Ağırlığı" value={metrics.waste_kg_per_vehicle} unit="Kg/Araç" target={vehicleTargets.waste_kg_per_vehicle} />
                                                <MetricDisplay label="Ret Adedi" value={metrics.rejection_count_per_vehicle} unit="Adet/Araç" target={vehicleTargets.rejection_count_per_vehicle} />
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground py-4">
                                                <p className="text-sm">Bu dönemde maliyet kaydı yok</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </motion.div>

                {selectedVehicleType && (
                    <VehiclePerformanceModal
                        isOpen={isPerformanceModalOpen}
                        setIsOpen={setPerformanceModalOpen}
                        vehicleType={selectedVehicleType}
                        costs={allVehicleCosts}
                        onTargetsUpdate={fetchTargets}
                    />
                )}
            </>
        );
    };

    export default VehicleCostBreakdown;