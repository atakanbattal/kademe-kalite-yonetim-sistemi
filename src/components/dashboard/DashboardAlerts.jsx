import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, FileText, WalletCards, Bell, CheckCircle, Lightbulb } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { differenceInDays, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildSmartQualityInsights } from '@/lib/smartQualityInsights';

const toneStyles = {
  red: 'border-red-200 bg-red-50/80 dark:bg-red-950/25 dark:border-red-900/60',
  amber: 'border-amber-200 bg-amber-50/80 dark:bg-amber-950/25 dark:border-amber-900/50',
  slate: 'border-border bg-muted/40 dark:bg-muted/20',
};

function SmartQualityInsightsCard({ insights, onModuleNavigate, loading }) {
  if (loading) {
    return (
      <Card className="border-primary/20 animate-pulse">
        <CardContent className="py-8">
          <p className="text-center text-sm text-muted-foreground">Öncelikli uyarılar hazırlanıyor…</p>
        </CardContent>
      </Card>
    );
  }
  if (!insights.length) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
        <CardContent className="py-4 flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm tracking-tight">Öncelikli kalite uyarısı yok</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Mevcut verilerinize göre acil müdahale gerektiren bir başlık bulunmuyor. Periyodik tetkik ve uygunsuzluk takibinizi sürdürmeniz yeterli.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/25 shadow-sm overflow-hidden">
      <CardHeader className="py-4 px-4 sm:px-5 border-b bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-md bg-primary/10 p-2 shrink-0 mt-0.5">
              <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                Öncelikli kalite uyarıları
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                Operasyonel verilerinizden türetilen risk, gecikme ve iyileştirme fırsatları. Önem sırasına göre listelenir; ilgili modüle tek tıkla geçebilirsiniz.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 text-[11px] font-medium tabular-nums border-primary/20 bg-background/80">
            {insights.length} başlık
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-2 max-h-[min(70vh,560px)] overflow-y-auto">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={cn('rounded-lg border p-3 flex flex-col sm:flex-row sm:items-start gap-3', toneStyles[item.tone] || toneStyles.slate)}
            >
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', item.tone === 'red' ? 'text-red-600' : item.tone === 'amber' ? 'text-amber-600' : 'text-muted-foreground')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
                {item.module && onModuleNavigate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-8 text-xs"
                    onClick={() => onModuleNavigate(item.module)}
                  >
                    {item.actionLabel || 'İlgili modüle git'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const DashboardAlerts = ({
  onAlertClick,
  onModuleNavigate,
  showSmartInsightsStandalone,
  hideSmartInsights,
}) => {
  const {
    nonConformities,
    equipments,
    documents,
    qualityCosts,
    audits,
    deviations,
    trainings,
    tasks,
    quarantineRecords,
    incomingInspections,
    supplierNonConformities,
    customerComplaints,
    kaizenEntries,
    kpis,
    auditFindings,
    producedVehicles,
    stockRiskControls,
    inkrReports,
    incomingControlPlans,
    processControlPlans,
    suppliers,
    nonconformityRecords,
    auditLogs,
    loading,
  } = useData();

  const smartInsights = useMemo(
    () =>
      buildSmartQualityInsights({
        loading,
        audits,
        nonConformities,
        deviations,
        trainings,
        tasks,
        quarantineRecords,
        incomingInspections,
        supplierNonConformities,
        customerComplaints,
        kaizenEntries,
        kpis,
        auditFindings,
        producedVehicles,
        stockRiskControls,
        inkrReports,
        incomingControlPlans,
        processControlPlans,
        suppliers,
        nonconformityRecords,
        qualityCosts,
        documents,
        equipments,
        auditLogs,
      }),
    [
      loading,
      audits,
      nonConformities,
      deviations,
      trainings,
      tasks,
      quarantineRecords,
      incomingInspections,
      supplierNonConformities,
      customerComplaints,
      kaizenEntries,
      kpis,
      auditFindings,
      producedVehicles,
      stockRiskControls,
      inkrReports,
      incomingControlPlans,
      processControlPlans,
      suppliers,
      nonconformityRecords,
      qualityCosts,
      documents,
      equipments,
      auditLogs,
    ]
  );

  // 30 gün üzerinde kapanmayan DF/8D (Kapatılan ve Reddedilen hariç)
  const overdueNCs = useMemo(() => {
    if (!nonConformities) return [];
    const thirtyDaysAgo = addDays(new Date(), -30);
    return nonConformities
      .filter((nc) => {
        if (nc.status === 'Kapatıldı' || nc.status === 'Reddedildi') return false;
        const openingDate = new Date(nc.opening_date || nc.created_at);
        return openingDate < thirtyDaysAgo;
      })
      .map((nc) => ({
        ...nc,
        daysOverdue: differenceInDays(new Date(), new Date(nc.opening_date || nc.created_at)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [nonConformities]);

  const overdueCalibrations = useMemo(() => {
    if (!equipments) return [];
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const overdue = [];

    equipments.forEach((eq) => {
      const calibrations = eq.equipment_calibrations || [];
      if (calibrations.length > 0) {
        const sortedCalibrations = [...calibrations].sort((a, b) => {
          const dateA = new Date(a.calibration_date || 0);
          const dateB = new Date(b.calibration_date || 0);
          return dateB - dateA;
        });
        const latestCalibration = sortedCalibrations[0];
        if (latestCalibration.next_calibration_date) {
          const dueDate = new Date(latestCalibration.next_calibration_date);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < day) {
            overdue.push({
              equipment: eq.name,
              dueDate: latestCalibration.next_calibration_date,
              daysOverdue: differenceInDays(day, dueDate),
            });
          }
        }
      }
    });
    return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [equipments]);

  const expiringDocuments = useMemo(() => {
    if (!documents) return [];
    const thirtyDaysFromNow = addDays(new Date(), 30);
    const today = new Date();
    return documents
      .filter((doc) => {
        if (!doc.valid_until) return false;
        const validUntil = new Date(doc.valid_until);
        return validUntil >= today && validUntil <= thirtyDaysFromNow;
      })
      .map((doc) => ({
        ...doc,
        daysRemaining: differenceInDays(new Date(doc.valid_until), new Date()),
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [documents]);

  const costAnomalies = useMemo(() => {
    if (!qualityCosts) return [];
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const thisMonthCosts = qualityCosts.filter((c) => new Date(c.cost_date) >= firstDayOfMonth);
    const lastMonthCosts = qualityCosts.filter((c) => {
      const costDate = new Date(c.cost_date);
      return costDate >= firstDayOfLastMonth && costDate <= lastDayOfLastMonth;
    });
    const thisMonthTotal = thisMonthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
    const lastMonthTotal = lastMonthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
    if (lastMonthTotal === 0) return [];
    const increasePercentage = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    if (increasePercentage > 50) {
      return [
        {
          type: 'Maliyet Anomalisi',
          message: `Bu ay maliyet geçen aya göre %${increasePercentage.toFixed(1)} arttı`,
          thisMonth: thisMonthTotal,
          lastMonth: lastMonthTotal,
          increase: increasePercentage,
        },
      ];
    }
    return [];
  }, [qualityCosts]);

  const totalAlerts =
    overdueNCs.length + overdueCalibrations.length + expiringDocuments.length + costAnomalies.length;

  if (loading && !showSmartInsightsStandalone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" />
            Uyarılar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Yükleniyor...</div>
        </CardContent>
      </Card>
    );
  }

  if (showSmartInsightsStandalone) {
    return (
      <SmartQualityInsightsCard
        insights={smartInsights}
        onModuleNavigate={onModuleNavigate}
        loading={loading}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!hideSmartInsights && (
        <SmartQualityInsightsCard
          insights={smartInsights}
          onModuleNavigate={onModuleNavigate}
          loading={false}
        />
      )}

      {totalAlerts === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-green-500" />
              Kritik uyarılar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 text-green-600 dark:text-green-400">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Kritik uyarı yok</p>
              <p className="text-xs text-muted-foreground mt-1">
                Geciken DF/8D, kalibrasyon veya doküman uyarısı bulunmuyor.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-orange-500/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Kritik uyarılar
              <Badge variant="destructive" className="ml-2">
                {totalAlerts}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overdueNCs.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-red-900 dark:text-red-100">30+ Gün Açık DF/8D</span>
                  </div>
                  <Badge variant="destructive">{overdueNCs.length}</Badge>
                </div>
                <div className="space-y-1 text-sm text-red-800 dark:text-red-200">
                  {overdueNCs.slice(0, 3).map((nc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded transition-colors"
                      onClick={() => onAlertClick && onAlertClick('overdue-nc-detail', nc)}
                    >
                      <span className="font-medium">{nc.nc_number || nc.mdi_no || 'N/A'}</span>
                      <span className="font-medium">{nc.daysOverdue} gün</span>
                    </div>
                  ))}
                  {overdueNCs.length > 3 && (
                    <p className="text-xs mt-2">+{overdueNCs.length - 3} kayıt daha...</p>
                  )}
                </div>
                {onAlertClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onAlertClick('overdue-nc', overdueNCs)}
                  >
                    Tümünü Gör
                  </Button>
                )}
              </div>
            )}

            {overdueCalibrations.length > 0 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-semibold text-orange-900 dark:text-orange-100">Geciken Kalibrasyonlar</span>
                  </div>
                  <Badge variant="destructive">{overdueCalibrations.length}</Badge>
                </div>
                <div className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                  {overdueCalibrations.slice(0, 3).map((cal, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 p-1 rounded transition-colors"
                      onClick={() => onAlertClick && onAlertClick('overdue-calibration-detail', cal)}
                    >
                      <span className="font-medium">{cal.equipment}</span>
                      <span className="font-medium">{cal.daysOverdue} gün gecikme</span>
                    </div>
                  ))}
                  {overdueCalibrations.length > 3 && (
                    <p className="text-xs mt-2">+{overdueCalibrations.length - 3} kayıt daha...</p>
                  )}
                </div>
                {onAlertClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onAlertClick('overdue-calibration', overdueCalibrations)}
                  >
                    Tümünü Gör
                  </Button>
                )}
              </div>
            )}

            {expiringDocuments.length > 0 && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-yellow-600" />
                    <span className="font-semibold text-yellow-900 dark:text-yellow-100">
                      Geçerliliği Dolacak Dokümanlar
                    </span>
                  </div>
                  <Badge variant="secondary">{expiringDocuments.length}</Badge>
                </div>
                <div className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                  {expiringDocuments.slice(0, 3).map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 p-1 rounded transition-colors"
                      onClick={() => onAlertClick && onAlertClick('expiring-docs-detail', doc)}
                    >
                      <span className="font-medium">{doc.name}</span>
                      <span className="font-medium">{doc.daysRemaining} gün kaldı</span>
                    </div>
                  ))}
                  {expiringDocuments.length > 3 && (
                    <p className="text-xs mt-2">+{expiringDocuments.length - 3} kayıt daha...</p>
                  )}
                </div>
                {onAlertClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onAlertClick('expiring-docs', expiringDocuments)}
                  >
                    Tümünü Gör
                  </Button>
                )}
              </div>
            )}

            {costAnomalies.length > 0 && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-purple-900 dark:text-purple-100">Maliyet Anomalisi</span>
                  </div>
                </div>
                <div className="text-sm text-purple-800 dark:text-purple-200">
                  <p>{costAnomalies[0].message}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span>
                      Bu Ay:{' '}
                      {costAnomalies[0].thisMonth.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </span>
                    <span>
                      Geçen Ay:{' '}
                      {costAnomalies[0].lastMonth.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </span>
                  </div>
                </div>
                {onAlertClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onAlertClick('cost-anomaly', costAnomalies)}
                  >
                    Detaylı Analiz
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardAlerts;
