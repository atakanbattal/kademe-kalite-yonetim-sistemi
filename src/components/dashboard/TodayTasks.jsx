import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Clock, Users, Calendar } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { format, isToday, isPast, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const TodayTasks = ({ onTaskClick }) => {
    const { nonConformities, equipments, trainings, loading } = useData();

    const todayTasks = useMemo(() => {
        const today = new Date();
        const tasks = {
            overdue8D: [],
            dueCalibrations: [],
            dueTrainings: [],
            overdueActions: []
        };

        // Bugün kapanması gereken 8D
        (nonConformities || []).forEach(nc => {
            if (nc.type === '8D' && nc.status !== 'Kapatıldı' && nc.target_close_date) {
                const dueDate = new Date(nc.target_close_date);
                if (isToday(dueDate) || isPast(dueDate)) {
                    tasks.overdue8D.push({
                        ...nc,
                        isOverdue: isPast(dueDate),
                        daysOverdue: isPast(dueDate) ? differenceInDays(today, dueDate) : 0
                    });
                }
            }
        });

        // Bugün kalibrasyonu dolan cihazlar
        (equipments || []).forEach(eq => {
            const calibrations = eq.equipment_calibrations || [];
            calibrations.forEach(cal => {
                if (cal.next_calibration_date) {
                    const dueDate = new Date(cal.next_calibration_date);
                    dueDate.setHours(0, 0, 0, 0); // Tarih kısmını gece yarısına ayarla

                    if (isToday(dueDate) || isPast(dueDate)) {
                        tasks.dueCalibrations.push({
                            equipment: eq.name,
                            dueDate: cal.next_calibration_date,
                            isOverdue: isPast(dueDate),
                            daysOverdue: isPast(dueDate) ? differenceInDays(today, dueDate) : 0
                        });
                    }
                }
            });
        });

        // Bugün eğitim yapılması gereken personel
        // Bu kısım trainings verisine bağlı olarak geliştirilebilir

        return tasks;
    }, [nonConformities, equipments, trainings]);

    const totalTasks = todayTasks.overdue8D.length + todayTasks.dueCalibrations.length;

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Bugünün Görevleri
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Bugünün Görevleri & Riskleri
                    {totalTasks > 0 && (
                        <Badge variant="destructive">{totalTasks}</Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Bugün Kapanması Gereken 8D */}
                {todayTasks.overdue8D.length > 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <span className="font-semibold text-red-900 dark:text-red-100">
                                    Bugün Kapanması Gereken 8D
                                </span>
                            </div>
                            <Badge variant="destructive">{todayTasks.overdue8D.length}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-red-800 dark:text-red-200">
                            {todayTasks.overdue8D.slice(0, 3).map((nc, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <span>{nc.nc_number || nc.mdi_no || 'N/A'}</span>
                                    {nc.isOverdue && (
                                        <Badge variant="destructive" className="text-xs">
                                            {nc.daysOverdue} gün gecikme
                                        </Badge>
                                    )}
                                </div>
                            ))}
                            {todayTasks.overdue8D.length > 3 && (
                                <p className="text-xs mt-2">+{todayTasks.overdue8D.length - 3} kayıt daha...</p>
                            )}
                        </div>
                        {onTaskClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => onTaskClick('overdue-8d', todayTasks.overdue8D)}
                            >
                                Tümünü Gör
                            </Button>
                        )}
                    </div>
                )}

                {/* Bugün Kalibrasyonu Dolan Cihazlar */}
                {todayTasks.dueCalibrations.length > 0 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-orange-600" />
                                <span className="font-semibold text-orange-900 dark:text-orange-100">
                                    Bugün Kalibrasyonu Dolan Cihazlar
                                </span>
                            </div>
                            <Badge variant="destructive">{todayTasks.dueCalibrations.length}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                            {todayTasks.dueCalibrations.slice(0, 3).map((cal, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <span>{cal.equipment}</span>
                                    {cal.isOverdue && (
                                        <Badge variant="destructive" className="text-xs">
                                            {cal.daysOverdue} gün gecikme
                                        </Badge>
                                    )}
                                </div>
                            ))}
                            {todayTasks.dueCalibrations.length > 3 && (
                                <p className="text-xs mt-2">+{todayTasks.dueCalibrations.length - 3} kayıt daha...</p>
                            )}
                        </div>
                        {onTaskClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => onTaskClick('due-calibration', todayTasks.dueCalibrations)}
                            >
                                Tümünü Gör
                            </Button>
                        )}
                    </div>
                )}

                {totalTasks === 0 && (
                    <div className="text-center py-8 text-green-600">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-medium">Bugün için kritik görev bulunmuyor</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TodayTasks;

