import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, CartesianGrid, LineChart, Line } from 'recharts';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { useData } from '@/contexts/DataContext';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Skeleton } from '@/components/ui/skeleton';
    import { AlertCircle, Car, Settings, Percent, GitCommitVertical, Calendar, Clock, Wrench } from 'lucide-react';
    import DepartmentFaultDetailModal from './DepartmentFaultDetailModal';
    import { format, parseISO, startOfMonth, eachMonthOfInterval, isValid, getYear, getMonth, differenceInMilliseconds } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { formatDuration } from '@/lib/formatDuration.js';

    const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#10b981', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl text-sm transition-all">
                <p className="label font-bold text-foreground mb-2">{`${label}`}</p>
                {payload.map(pld => (
                    <p key={pld.dataKey} style={{ color: pld.stroke }} className="flex justify-between items-center">
                        <span className='mr-4'>{pld.name}:</span>
                        <span className="font-semibold">{pld.value}{pld.unit || ''}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const DurationTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl text-sm transition-all">
                <p className="label font-bold text-foreground mb-2">{`${label}`}</p>
                {payload.map(pld => {
                    const durationInMillis = pld.value * 60000;
                    const formattedDuration = formatDuration(durationInMillis);
                    return (
                        <p key={pld.dataKey} style={{ color: pld.stroke }} className="flex justify-between items-center gap-4">
                            <span>{pld.name}:</span>
                            <span className="font-semibold">{formattedDuration}</span>
                        </p>
                    );
                })}
            </div>
        );
    }
    return null;
};


    // Sayı formatlama fonksiyonu - tüm sayıları doğru gösterir
    const formatNumber = (value) => {
        if (value === null || value === undefined || value === '') return '0';
        
        // Yüzde değerleri için
        if (typeof value === 'string' && value.startsWith('%')) {
            return value;
        }
        
        // Eğer zaten number ise direkt kullan
        if (typeof value === 'number') {
            if (isNaN(value) || !isFinite(value)) return '0';
            // Büyük sayılar için binlik ayırıcı kullan (ondalık kısım yok)
            return value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        }
        
        // String ise parse et
        // Türkçe formatındaki binlik ayırıcıları temizle (1.000 -> 1000)
        const cleanValue = String(value).replace(/\./g, '').replace(',', '.');
        const numValue = parseFloat(cleanValue);
        
        if (isNaN(numValue) || !isFinite(numValue)) {
            // Parse edilemezse orijinal değeri döndür
            return String(value);
        }
        
        // Büyük sayılar için binlik ayırıcı kullan (ondalık kısım yok)
        return numValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    };

    const StatCard = ({ title, value, icon, description, loading }) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <>
                        <Skeleton className="h-8 w-1/2 mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{formatNumber(value)}</div>
                        <p className="text-xs text-muted-foreground">{description}</p>
                    </>
                )}
            </CardContent>
        </Card>
    );

    const VehicleFaultAnalytics = ({ refreshTrigger }) => {
        const { toast } = useToast();
        const { producedVehicles } = useData();
        const [faults, setFaults] = useState([]);
        const [vehicles, setVehicles] = useState([]);
        const [timelineEvents, setTimelineEvents] = useState([]);
        const [loading, setLoading] = useState(true);
        const [period, setPeriod] = useState('all'); // 'all' or 'YYYY-MM'
        const [isDetailModalOpen, setDetailModalOpen] = useState(false);
        const [detailModalData, setDetailModalData] = useState({ title: '', faults: [] });
        const [allDepartments, setAllDepartments] = useState([]);

        const fetchAnalyticsData = useCallback(async () => {
            setLoading(true);
            try {
                // Supabase varsayılan olarak 1000 kayıt limiti uygular
                // Tüm kayıtları almak için select('*', { count: 'exact' }) ve limit kullanıyoruz
                const faultsPromise = supabase
                    .from('quality_inspection_faults')
                    .select(`*, department:production_departments(id, name), inspection:quality_inspections(vehicle_type, serial_no, id), category:fault_categories(name)`, { count: 'exact' })
                    .limit(50000);
                const vehiclesPromise = supabase
                    .from('quality_inspections')
                    .select('id, created_at', { count: 'exact' })
                    .limit(50000);
                const departmentsPromise = supabase.from('production_departments').select('id, name');
                const timelinePromise = supabase
                    .from('vehicle_timeline_events')
                    .select('*', { count: 'exact' })
                    .limit(50000);

                const [faultsResult, vehiclesResult, departmentsResult, timelineResult] = await Promise.all([faultsPromise, vehiclesPromise, departmentsPromise, timelinePromise]);

                if (faultsResult.error) throw faultsResult.error;
                console.log('🔍 VehicleFaultAnalytics - Toplam hata kaydı:', faultsResult.data?.length);
                setFaults(faultsResult.data || []);

                if (vehiclesResult.error) throw vehiclesResult.error;
                setVehicles(vehiclesResult.data || []);

                if (departmentsResult.error) throw departmentsResult.error;
                setAllDepartments(departmentsResult.data || []);

                if (timelineResult.error) throw timelineResult.error;
                setTimelineEvents(timelineResult.data || []);

            } catch (error) {
                toast({ variant: "destructive", title: "Hata", description: "Analiz verileri alınamadı: " + error.message });
            } finally {
                setLoading(false);
            }
        }, [toast]);

        useEffect(() => {
            fetchAnalyticsData();
        }, [fetchAnalyticsData]);

        // producedVehicles veya refreshTrigger değiştiğinde verileri yenile
        useEffect(() => {
            if (refreshTrigger || producedVehicles) {
                fetchAnalyticsData();
            }
        }, [refreshTrigger, producedVehicles?.length, fetchAnalyticsData]);

        const filteredData = useMemo(() => {
            if (period === 'all') {
                return { faults, vehicles, timelineEvents };
            }
            const [year, month] = period.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 1);

            const periodFaults = faults.filter(f => {
                // fault_date yoksa created_at kullan veya tüm zamanlar için dahil et
                const dateToCheck = f.fault_date || f.created_at;
                if (!dateToCheck) return true; // Tarih yoksa dahil et
                const faultDate = parseISO(dateToCheck);
                if (!isValid(faultDate)) return true; // Geçersiz tarihse dahil et
                return faultDate >= startDate && faultDate < endDate;
            });
            const periodVehicles = vehicles.filter(v => {
                const vehicleDate = parseISO(v.created_at);
                return isValid(vehicleDate) && vehicleDate >= startDate && vehicleDate < endDate;
            });
            const periodTimelineEvents = timelineEvents.filter(e => {
                const eventDate = parseISO(e.event_timestamp);
                return isValid(eventDate) && eventDate >= startDate && eventDate < endDate;
            });

            return { faults: periodFaults, vehicles: periodVehicles, timelineEvents: periodTimelineEvents };
        }, [period, faults, vehicles, timelineEvents]);

        const analyticsData = useMemo(() => {
            const { faults: currentFaults, vehicles: currentVehicles, timelineEvents: currentTimelineEvents } = filteredData;
            const totalVehiclesInPeriod = currentVehicles.length;
            
            const departmentStats = allDepartments.reduce((acc, dept) => {
                acc[dept.name] = { totalFaults: 0, faultyVehicles: new Set() };
                return acc;
            }, {});

            const faultCategoryData = {};
            const vehicleTypeData = {};
            const faultyVehiclesWithAnyFault = new Set();
            let totalFaults = 0;

            const monthlyData = {};

            const processTimeline = (events) => {
                let totalInspectionMillis = 0;
                let inspectionCount = 0;
                let totalReworkMillis = 0;
                let reworkCount = 0;

                for (let i = 0; i < events.length; i++) {
                    const currentEvent = events[i];
                    if (currentEvent.event_type === 'control_start') {
                        const nextEnd = events.slice(i + 1).find(e => e.event_type === 'control_end' && e.inspection_id === currentEvent.inspection_id);
                        if (nextEnd) {
                            totalInspectionMillis += differenceInMilliseconds(parseISO(nextEnd.event_timestamp), parseISO(currentEvent.event_timestamp));
                            inspectionCount++;
                        }
                    } else if (currentEvent.event_type === 'rework_start') {
                        const nextEnd = events.slice(i + 1).find(e => e.event_type === 'rework_end' && e.inspection_id === currentEvent.inspection_id);
                        if (nextEnd) {
                            totalReworkMillis += differenceInMilliseconds(parseISO(nextEnd.event_timestamp), parseISO(currentEvent.event_timestamp));
                            reworkCount++;
                        }
                    }
                }
                return {
                    avgInspectionTime: inspectionCount > 0 ? totalInspectionMillis / inspectionCount : 0,
                    avgReworkTime: reworkCount > 0 ? totalReworkMillis / reworkCount : 0,
                };
            };

            const allDates = [...currentFaults.map(f => f.fault_date), ...currentVehicles.map(v => v.created_at)].filter(Boolean);
            const minDate = allDates.length > 0 ? parseISO(allDates.reduce((a, b) => a < b ? a : b)) : new Date();
            const maxDate = allDates.length > 0 ? parseISO(allDates.reduce((a, b) => a > b ? a : b)) : new Date();
            
            if (isValid(minDate) && isValid(maxDate)) {
                const monthInterval = eachMonthOfInterval({ start: startOfMonth(minDate), end: startOfMonth(maxDate) });
                monthInterval.forEach(m => {
                    const monthKey = format(m, 'yyyy-MM');
                    monthlyData[monthKey] = { name: format(m, 'MMM yy', { locale: tr }), faultCount: 0, vehicleCount: 0, timelineEvents: [], sortKey: m };
                });
            }

            console.log('🔍 analyticsData - currentFaults sayısı:', currentFaults.length);
            
            currentFaults.forEach(fault => {
                // quantity değerini sayıya çevir - string formatındaki binlik ayırıcıları temizle
                let quantity = fault.quantity;
                if (quantity === null || quantity === undefined || quantity === '') {
                    quantity = 1;
                } else if (typeof quantity === 'string') {
                    // Türkçe formatındaki binlik ayırıcıları temizle (1.000 -> 1000)
                    quantity = parseFloat(quantity.replace(/\./g, '').replace(',', '.')) || 1;
                } else {
                    quantity = Number(quantity) || 1;
                }
                totalFaults += quantity;

                const deptName = fault.department?.name || 'Bilinmeyen';
                if (departmentStats[deptName]) {
                    departmentStats[deptName].totalFaults += quantity;
                    if (fault.inspection?.id) departmentStats[deptName].faultyVehicles.add(fault.inspection.id);
                }

                if (fault.inspection?.id) faultyVehiclesWithAnyFault.add(fault.inspection.id);
                
                const categoryName = fault.category?.name || 'Kategorisiz';
                faultCategoryData[categoryName] = (faultCategoryData[categoryName] || 0) + quantity;
                
                const vehicleType = fault.inspection?.vehicle_type || 'Bilinmeyen';
                vehicleTypeData[vehicleType] = (vehicleTypeData[vehicleType] || 0) + quantity;

                // fault_date yoksa created_at kullan
                const dateToCheck = fault.fault_date || fault.created_at;
                if (dateToCheck) {
                    const faultDate = parseISO(dateToCheck);
                    if (isValid(faultDate)) {
                        const monthKey = format(faultDate, 'yyyy-MM');
                        if (monthlyData[monthKey]) {
                            monthlyData[monthKey].faultCount += quantity;
                        } else {
                            // Eğer ay verisi yoksa, bugünün ayına ekle
                            const today = new Date();
                            const todayMonthKey = format(today, 'yyyy-MM');
                            if (!monthlyData[todayMonthKey]) {
                                monthlyData[todayMonthKey] = { 
                                    name: format(today, 'MMM yy', { locale: tr }), 
                                    faultCount: 0, 
                                    vehicleCount: 0, 
                                    timelineEvents: [], 
                                    sortKey: startOfMonth(today) 
                                };
                            }
                            monthlyData[todayMonthKey].faultCount += quantity;
                        }
                    }
                }
            });

            currentVehicles.forEach(vehicle => {
                const vehicleDate = parseISO(vehicle.created_at);
                if (isValid(vehicleDate)) {
                    const monthKey = format(vehicleDate, 'yyyy-MM');
                    if (monthlyData[monthKey]) monthlyData[monthKey].vehicleCount++;
                }
            });

            currentTimelineEvents.forEach(event => {
                const eventDate = parseISO(event.event_timestamp);
                if (isValid(eventDate)) {
                    const monthKey = format(eventDate, 'yyyy-MM');
                    if (monthlyData[monthKey]) monthlyData[monthKey].timelineEvents.push(event);
                }
            });

            const monthlyTrendData = Object.values(monthlyData).map(data => {
                const { avgInspectionTime, avgReworkTime } = processTimeline(data.timelineEvents);
                return {
                    name: data.name,
                    "Hata Sayısı": data.faultCount,
                    "Araç Sayısı": data.vehicleCount,
                    "Ort. Kontrol Süresi": parseFloat((avgInspectionTime / 60000).toFixed(1)),
                    "Ort. Yeniden İşlem Süresi": parseFloat((avgReworkTime / 60000).toFixed(1)),
                    sortKey: data.sortKey,
                };
            }).sort((a, b) => a.sortKey - b.sortKey);
            
            const faultyVehicleCount = faultyVehiclesWithAnyFault.size;
            const faultyVehicleRate = totalVehiclesInPeriod > 0 ? ((faultyVehicleCount / totalVehiclesInPeriod) * 100).toFixed(1) : 0;
            const avgFaultsPerFaultyVehicle = faultyVehicleCount > 0 ? (totalFaults / faultyVehicleCount).toFixed(2) : 0;
            
            const processChartData = (data, topN = 10) => {
                const sortedData = Object.entries(data).map(([name, value]) => ({ name, count: value })).sort((a, b) => b.count - a.count);
                if (sortedData.length <= topN) return sortedData;
                const topData = sortedData.slice(0, topN);
                const otherCount = sortedData.slice(topN).reduce((acc, item) => acc + item.count, 0);
                return [...topData, { name: 'Diğer', count: otherCount }];
            };
            
            const departmentTotalFaultsSimple = Object.entries(departmentStats).reduce((acc, [name, stats]) => {
                acc[name] = stats.totalFaults;
                return acc;
            }, {});

            const departmentChartData = Object.entries(departmentStats).map(([deptName, stats]) => ({
                name: deptName,
                "Toplam Hata": stats.totalFaults,
                "Hatalı Araç": stats.faultyVehicles.size,
                "İşlem Gören Araç": totalVehiclesInPeriod,
                "Araç Başına Hata Ort.": totalVehiclesInPeriod > 0 ? parseFloat((stats.totalFaults / totalVehiclesInPeriod).toFixed(2)) : 0,
            })).filter(dept => dept["Toplam Hata"] > 0).sort((a, b) => b["Toplam Hata"] - a["Toplam Hata"]);

            console.log('🔍 analyticsData - Hesaplanan totalFaults:', totalFaults);
            
            return {
                byDepartment: departmentChartData,
                byDepartmentTotalFaults: processChartData(departmentTotalFaultsSimple, 10),
                byFaultCategory: processChartData(faultCategoryData, 10),
                byVehicleType: processChartData(vehicleTypeData, 10),
                totalFaults,
                faultyVehicleCount,
                faultyVehicleRate,
                avgFaultsPerFaultyVehicle,
                totalVehiclesInPeriod,
                monthlyTrendData,
            };
        }, [filteredData, allDepartments]);

        const handleBarClick = (data, type) => {
            if (!data || !data.activePayload || !data.activePayload.length) return;
            const payload = data.activePayload[0].payload;
            const name = payload.name;
            if (name === 'Diğer') return;
            
            let filteredFaultsList = [];
            let title = '';

            if(type === 'department'){
                filteredFaultsList = filteredData.faults.filter(f => (f.department?.name || 'Bilinmeyen') === name);
                title = `${name} Departmanı Hata Detayları`;
            } else if (type === 'category') {
                filteredFaultsList = filteredData.faults.filter(f => (f.category?.name || 'Kategorisiz') === name);
                title = `${name} Kategorisi Hata Detayları`;
            } else if (type === 'vehicleType') {
                filteredFaultsList = filteredData.faults.filter(f => (f.inspection?.vehicle_type || 'Bilinmeyen') === name);
                title = `${name} Araç Tipi Hata Detayları`;
            }
            
            setDetailModalData({ title: title, faults: filteredFaultsList });
            setDetailModalOpen(true);
        };

        const periodOptions = useMemo(() => {
            const options = [{ value: 'all', label: 'Tüm Zamanlar' }];
            const allDates = faults.map(f => f.fault_date).filter(Boolean);
            if (allDates.length === 0) return options;
            
            const minDate = parseISO(allDates.reduce((a, b) => a < b ? a : b));
            const maxDate = parseISO(allDates.reduce((a, b) => a > b ? a : b));

            if (isValid(minDate) && isValid(maxDate)) {
                const monthInterval = eachMonthOfInterval({ start: startOfMonth(minDate), end: startOfMonth(maxDate) });
                monthInterval.reverse().forEach(m => {
                    options.push({
                        value: format(m, 'yyyy-MM'),
                        label: format(m, 'MMMM yyyy', { locale: tr })
                    });
                });
            }
            return options;
        }, [faults]);

        const renderHorizontalChart = (data, title, dataKey, type) => (
          <Card className="col-span-1 lg:col-span-2">
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent>
                  {loading ? <Skeleton className="h-[400px] w-full" /> : data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }} barCategoryGap="35%" onClick={(payload) => handleBarClick(payload, type)}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} interval={0} stroke="hsl(var(--muted-foreground))" />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.1)' }} />
                              <Bar dataKey={dataKey} name="Adet" radius={[0, 4, 4, 0]} className="cursor-pointer">
                                 {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  ) : <div className="h-[400px] flex items-center justify-center text-muted-foreground">Bu dönem için veri bulunmuyor.</div>}
              </CardContent>
          </Card>
        );

        const dynamicHeight = useMemo(() => {
            const baseHeight = 150;
            const heightPerItem = 50;
            return baseHeight + analyticsData.byDepartment.length * heightPerItem;
        }, [analyticsData.byDepartment]);

        return (
            <div className="space-y-6">
                <DepartmentFaultDetailModal isOpen={isDetailModalOpen} setIsOpen={setDetailModalOpen} departmentName={detailModalData.title} faults={detailModalData.faults} />
                <div className="flex items-center gap-4">
                     <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Dönem Seçin" /></SelectTrigger>
                        <SelectContent>{periodOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     <StatCard title="Toplam Hatalı Araç" value={analyticsData.faultyVehicleCount} description={`${analyticsData.totalVehiclesInPeriod} araç içerisinden`} icon={<Car className="h-4 w-4 text-muted-foreground" />} loading={loading} />
                     <StatCard title="Hatalı Araç Oranı" value={`%${analyticsData.faultyVehicleRate}`} description="Dönemdeki araçlara göre" icon={<Percent className="h-4 w-4 text-muted-foreground" />} loading={loading} />
                     <StatCard title="Toplam Hata Adedi" value={analyticsData.totalFaults} description="Seçilen dönemdeki toplam hata sayısı" icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />} loading={loading} />
                     <StatCard title="Hatalı Araç Başına Hata" value={analyticsData.avgFaultsPerFaultyVehicle} description="Hatalı araç başına düşen ortalama" icon={<GitCommitVertical className="h-4 w-4 text-muted-foreground" />} loading={loading} />
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart className="h-5 w-5" />
                                Aylık Adet Trendi
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? <Skeleton className="h-[400px] w-full" /> : (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={analyticsData.monthlyTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={13} />
                                        <YAxis label={{ value: 'Adet', angle: -90, position: 'insideLeft' }} stroke="hsl(var(--muted-foreground))" fontSize={13} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="Hata Sayısı" name="Hata Sayısı" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                                        <Line type="monotone" dataKey="Araç Sayısı" name="Araç Sayısı" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Aylık Süre Performansı
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? <Skeleton className="h-[400px] w-full" /> : (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={analyticsData.monthlyTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={13} />
                                        <YAxis label={{ value: 'Süre (dk)', angle: -90, position: 'insideLeft' }} unit=" dk" stroke="hsl(var(--muted-foreground))" fontSize={13} />
                                        <Tooltip content={<DurationTooltip />} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="Ort. Kontrol Süresi" name="Ort. Kontrol Süresi" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                                        <Line type="monotone" dataKey="Ort. Yeniden İşlem Süresi" name="Ort. Yeniden İşlem Süresi" stroke="#f97316" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="col-span-1 lg:col-span-2">
                        <CardHeader><CardTitle>Birim Performans Karnesi</CardTitle></CardHeader>
                        <CardContent>
                            {loading ? <Skeleton className="h-[400px] w-full" /> : analyticsData.byDepartment.length > 0 ? (
                                <ResponsiveContainer width="100%" height={dynamicHeight}>
                                    <BarChart data={analyticsData.byDepartment} layout="vertical" margin={{ left: 100, right: 20 }} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} interval={0} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.1)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="İşlem Gören Araç" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="Hatalı Araç" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="Araç Başına Hata Ort." fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="h-[400px] flex items-center justify-center text-muted-foreground">Bu dönem için veri bulunmuyor.</div>}
                        </CardContent>
                    </Card>

                    {renderHorizontalChart(analyticsData.byDepartmentTotalFaults, 'Birimlere Göre Toplam Hata Dağılımı (Top 10)', 'count', 'department')}
                    {renderHorizontalChart(analyticsData.byVehicleType, 'Araç Tipine Göre Hata Dağılımı (Top 10)', 'count', 'vehicleType')}
                    {renderHorizontalChart(analyticsData.byFaultCategory, 'Hata Kategorisi Dağılımı (Adet - Top 10)', 'count', 'category')}
                </div>
            </div>
        );
    };

    export default VehicleFaultAnalytics;