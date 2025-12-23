import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    AlertTriangle, 
    CheckCircle2,
    Lightbulb,
    RefreshCw,
    ChevronRight,
    Activity,
    Shield,
    FileWarning,
    Users,
    ClipboardCheck,
    Gauge,
    Package,
    MessageSquare,
    Target,
    GraduationCap,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    BarChart3,
    TrendingUp,
    TrendingDown,
    X
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

const moduleIcons = {
    nc: FileWarning,
    audit: ClipboardCheck,
    supplier: Users,
    calibration: Gauge,
    document: Shield,
    training: GraduationCap,
    complaint: MessageSquare,
    kpi: Activity,
    kaizen: Target,
    quarantine: Package,
    task: CheckCircle2,
    incoming: Package
};

const moduleNames = {
    nc: 'Uygunsuzluklar',
    audit: 'İç Tetkikler',
    supplier: 'Tedarikçi Kalite',
    calibration: 'Kalibrasyon',
    document: 'Doküman Yönetimi',
    training: 'Eğitim Yönetimi',
    complaint: 'Müşteri Şikayetleri',
    kpi: 'KPI Takibi',
    kaizen: 'Kaizen/İyileştirme',
    quarantine: 'Karantina',
    task: 'Görev Yönetimi',
    incoming: 'Giriş Kalite'
};

const getTrendIcon = (trend) => {
    if (trend === 'up' || trend === 'İyileşiyor') {
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    } else if (trend === 'down' || trend === 'Kötüleşiyor') {
        return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
};

const getScoreBgColor = (score) => {
    if (score >= 90) return 'from-green-50 to-green-100 border-green-200';
    if (score >= 75) return 'from-blue-50 to-blue-100 border-blue-200';
    if (score >= 60) return 'from-yellow-50 to-yellow-100 border-yellow-200';
    if (score >= 40) return 'from-orange-50 to-orange-100 border-orange-200';
    return 'from-red-50 to-red-100 border-red-200';
};

const getProgressColor = (score) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
};

const getStatusConfig = (status) => {
    switch(status) {
        case 'Mükemmel':
            return { bg: 'bg-green-500', text: 'text-white', icon: CheckCircle2 };
        case 'İyi':
            return { bg: 'bg-blue-500', text: 'text-white', icon: TrendingUp };
        case 'Orta':
            return { bg: 'bg-yellow-500', text: 'text-white', icon: Activity };
        case 'Dikkat Gerekli':
            return { bg: 'bg-orange-500', text: 'text-white', icon: AlertTriangle };
        default:
            return { bg: 'bg-red-500', text: 'text-white', icon: AlertTriangle };
    }
};

const getPriorityBadge = (priority) => {
    switch (priority) {
        case 'CRITICAL':
            return <Badge variant="destructive">KRİTİK</Badge>;
        case 'HIGH':
            return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">YÜKSEK</Badge>;
        case 'MEDIUM':
            return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">ORTA</Badge>;
        default:
            return <Badge variant="secondary">NORMAL</Badge>;
    }
};

// Metrik isimlerini Türkçeleştir
const metricLabels = {
    // NC Metrikleri
    open_count: 'Açık Uygunsuzluk',
    avg_close_days: 'Ort. Kapanma Süresi (Gün)',
    old_open_count: '60+ Gün Açık Kayıt',
    last_month_count: 'Geçen Ay Açılan',
    this_month_count: 'Bu Ay Açılan',
    overdue_8d_count: 'Gecikmiş 8D/DF',
    
    // Denetim Metrikleri
    total_audits_this_year: 'Bu Yıl Yapılan Denetim',
    completed_audits: 'Tamamlanan Denetim',
    planned_next_30_days: '30 Gün İçinde Planlanan',
    days_since_last_audit: 'Son Denetimden Bu Yana (Gün)',
    
    // Tedarikçi Metrikleri
    total_approved_suppliers: 'Onaylı Tedarikçi Sayısı',
    low_performance_count: 'Düşük Performanslı',
    no_audit_90_days: '90+ Gündür Denetlenmemiş',
    pending_audits: 'Bekleyen Denetim',
    rejection_rate_30_days: '30 Günlük Red Oranı (%)',
    
    // Kalibrasyon Metrikleri
    total_equipment: 'Toplam Ekipman',
    overdue_calibrations: 'Gecikmiş Kalibrasyon',
    due_in_30_days: '30 Gün İçinde Gerekecek',
    no_calibration_record: 'Kayıt Girilmemiş',
    
    // Doküman Metrikleri
    total_documents: 'Toplam Doküman',
    expired: 'Süresi Dolmuş',
    expiring_30_days: '30 Gün İçinde Dolacak',
    review_overdue: 'Gözden Geçirme Gecikmiş',
    
    // Eğitim Metrikleri
    total_trainings_this_year: 'Bu Yıl Planlanan Eğitim',
    completed_trainings: 'Tamamlanan Eğitim',
    upcoming_30_days: '30 Gün İçinde Yaklaşan',
    avg_participation_rate: 'Ort. Katılım Oranı (%)',
    
    // Şikayet Metrikleri
    open_complaints: 'Açık Şikayet',
    overdue_complaints: 'SLA Aşımı',
    avg_resolution_days: 'Ort. Çözüm Süresi (Gün)',
    
    // KPI Metrikleri
    total_kpis: 'Toplam KPI',
    on_target: 'Hedefte',
    below_target: 'Hedef Altı',
    no_data: 'Veri Yok',
    achievement_rate: 'Başarı Oranı (%)',
    
    // Kaizen Metrikleri
    total_kaizen: 'Toplam Kaizen',
    pending: 'Beklemede',
    completed: 'Tamamlanan',
    this_year_count: 'Bu Yıl',
    
    // Karantina Metrikleri
    active_count: 'Aktif Karantina',
    long_stay_count: '30+ Gün Bekleyen',
    pending_decision: 'Karar Bekleyen',
    
    // Görev Metrikleri
    open_tasks: 'Açık Görev',
    overdue_tasks: 'Gecikmiş Görev',
    blocked_tasks: 'Engellenmiş Görev',
    
    // Giriş Kalite Metrikleri
    total_inspections_30_days: 'Son 30 Gün Kontrol',
    rejection_rate: 'Red Oranı (%)',
    conditional_rate: 'Şartlı Kabul Oranı (%)',
    pending_inkr: 'Bekleyen Kontrol'
};

const getMetricLabel = (key) => {
    return metricLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Circular Progress Component
const CircularProgress = ({ value, size = 120, strokeWidth = 8 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;
    
    const getStrokeColor = (score) => {
        if (score >= 90) return '#22c55e';
        if (score >= 75) return '#3b82f6';
        if (score >= 60) return '#eab308';
        if (score >= 40) return '#f97316';
        return '#ef4444';
    };

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#e5e7eb"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={getStrokeColor(value)}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getScoreColor(value)}`}>{Math.round(value)}</span>
                <span className="text-xs text-muted-foreground">/100</span>
            </div>
        </div>
    );
};

export default function QualityAdvisor() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedModule, setSelectedModule] = useState(null);

    // Sadece atakan.battal@kademe.com.tr görebilsin
    if (!user || user.email !== 'atakan.battal@kademe.com.tr') {
        return null;
    }

    const runAnalysis = useCallback(async (showToast = true) => {
        if (refreshing) return;
        
        setRefreshing(true);
        try {
            const { data, error } = await supabase.rpc('run_quality_advisor', {
                p_user_id: user.id
            });

            if (error) throw error;
            
            setAnalysis(data);
            if (showToast) {
                toast({
                    title: 'Sistem analizi tamamlandı',
                    description: `Toplam skor: ${data?.total_score || 0}/100`
                });
            }
        } catch (error) {
            console.error('Analiz hatası:', error);
            if (showToast) {
                toast({
                    title: 'Analiz yapılamadı',
                    description: error.message,
                    variant: 'destructive'
                });
            }
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [user?.id, refreshing, toast]);

    useEffect(() => {
        if (user?.email === 'atakan.battal@kademe.com.tr') {
            runAnalysis(false);
        }
    }, [user]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Kalite Yönetim Danışmanı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Analiz yapılıyor...</div>
                </CardContent>
            </Card>
        );
    }

    const moduleScores = analysis?.module_scores || {};
    const recommendations = analysis?.recommendations || [];
    const alerts = analysis?.alerts || [];
    const summary = analysis?.summary || {};
    const statusConfig = getStatusConfig(analysis?.health_status);
    const StatusIcon = statusConfig.icon;

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Kalite Yönetim Danışmanı
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => runAnalysis()}
                                disabled={refreshing}
                            >
                                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                                Yenile
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tüm modüllerin analizi ve sistem sağlığı değerlendirmesi
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Ana Skor Bölümü - Profesyonel Tasarım */}
                    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${getScoreBgColor(analysis?.total_score || 0)} p-6`}>
                        <div className="flex items-center gap-8">
                            {/* Circular Progress */}
                            <CircularProgress value={analysis?.total_score || 0} />
                            
                            {/* Status ve Özet */}
                            <div className="flex-1">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${statusConfig.bg} ${statusConfig.text} mb-4`}>
                                    <StatusIcon className="h-4 w-4" />
                                    <span className="font-semibold text-sm">{analysis?.health_status || 'Analiz Bekleniyor'}</span>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="text-center p-3 bg-white/60 rounded-lg border border-red-200">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <AlertTriangle className="h-4 w-4 text-red-500" />
                                            <span className="text-2xl font-bold text-red-600">{summary.critical_alerts || 0}</span>
                                        </div>
                                        <div className="text-xs font-medium text-red-600">Kritik Uyarı</div>
                                    </div>
                                    <div className="text-center p-3 bg-white/60 rounded-lg border border-orange-200">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            <span className="text-2xl font-bold text-orange-600">{summary.high_alerts || 0}</span>
                                        </div>
                                        <div className="text-xs font-medium text-orange-600">Yüksek Öncelik</div>
                                    </div>
                                    <div className="text-center p-3 bg-white/60 rounded-lg border border-blue-200">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Lightbulb className="h-4 w-4 text-blue-500" />
                                            <span className="text-2xl font-bold text-blue-600">{summary.total_recommendations || 0}</span>
                                        </div>
                                        <div className="text-xs font-medium text-blue-600">İyileştirme Önerisi</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab Seçici */}
                    <div className="flex gap-1 border-b">
                        {[
                            { id: 'overview', label: 'Genel Bakış', icon: Activity },
                            { id: 'alerts', label: 'Uyarılar', icon: AlertTriangle },
                            { id: 'recommendations', label: 'Öneriler', icon: Lightbulb }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id 
                                        ? 'border-primary text-primary' 
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Genel Bakış */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                            {Object.entries(moduleScores).map(([key, module]) => {
                                const score = module?.score || 0;
                                const trend = module?.trend;
                                const alertCount = module?.alerts?.length || 0;
                                const IconComponent = moduleIcons[key] || Activity;
                                
                                return (
                                    <div
                                        key={key}
                                        onClick={() => alertCount > 0 ? setSelectedModule({ key, module, name: moduleNames[key] }) : null}
                                        className={`p-3 rounded-lg border bg-card transition-all ${
                                            alertCount > 0 ? 'cursor-pointer hover:shadow-md hover:border-primary/50' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <IconComponent className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium truncate">
                                                    {moduleNames[key] || key}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {alertCount > 0 && (
                                                    <Badge variant="destructive" className="text-xs px-1.5 cursor-pointer">
                                                        {alertCount}
                                                    </Badge>
                                                )}
                                                {getTrendIcon(trend)}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${getProgressColor(score)}`}
                                                    style={{ width: `${score}%` }}
                                                />
                                            </div>
                                            <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                                                {Math.round(score)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Uyarılar */}
                    {activeTab === 'alerts' && (
                        <div className="max-h-[400px] overflow-y-auto pr-2">
                            {alerts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                                    <p className="font-medium">Harika! Aktif uyarı yok</p>
                                    <p className="text-sm">Sisteminiz sorunsuz çalışıyor</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {alerts.map((alert, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${
                                                    alert.priority === 'CRITICAL' ? 'text-red-500' :
                                                    alert.priority === 'HIGH' ? 'text-orange-500' :
                                                    'text-yellow-500'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="font-medium">
                                                            {alert.title}
                                                        </span>
                                                        {getPriorityBadge(alert.priority)}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {alert.description}
                                                    </p>
                                                    {alert.action && (
                                                        <div className="mt-2 flex items-center gap-1 text-sm text-primary">
                                                            <ChevronRight className="h-4 w-4" />
                                                            <span>{alert.action}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Öneriler */}
                    {activeTab === 'recommendations' && (
                        <div className="max-h-[400px] overflow-y-auto pr-2">
                            {recommendations.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                                    <p className="font-medium">Öneri bulunamadı</p>
                                    <p className="text-sm">Sistem optimum çalışıyor</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recommendations.map((rec, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start gap-3">
                                                <Lightbulb className="h-5 w-5 mt-0.5 shrink-0 text-yellow-500" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium">
                                                        {rec.title || (typeof rec === 'string' ? rec : 'Öneri')}
                                                    </p>
                                                    {rec.description && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {rec.description}
                                                        </p>
                                                    )}
                                                    {(rec.module || rec.action) && (
                                                        <div className="mt-2 flex items-center gap-3 text-sm">
                                                            {rec.module && (
                                                                <Badge variant="outline">
                                                                    {moduleNames[rec.module] || rec.module}
                                                                </Badge>
                                                            )}
                                                            {rec.action && (
                                                                <span className="text-primary flex items-center gap-1">
                                                                    <ChevronRight className="h-4 w-4" />
                                                                    {rec.action}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            Son analiz: {analysis?.analysis_date 
                                ? new Date(analysis.analysis_date).toLocaleString('tr-TR') 
                                : '-'}
                        </span>
                        {analysis?.notifications_created > 0 && (
                            <Badge variant="secondary">
                                {analysis.notifications_created} yeni bildirim oluşturuldu
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Modül Detay Modal */}
            <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedModule && (() => {
                                const IconComponent = moduleIcons[selectedModule.key] || Activity;
                                return <IconComponent className="h-5 w-5" />;
                            })()}
                            {selectedModule?.name} - Detaylar
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedModule && (
                        <div className="space-y-4">
                            {/* Skor */}
                            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                                <div className={`text-3xl font-bold ${getScoreColor(selectedModule.module?.score || 0)}`}>
                                    {Math.round(selectedModule.module?.score || 0)}
                                </div>
                                <div className="flex-1">
                                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getProgressColor(selectedModule.module?.score || 0)}`}
                                            style={{ width: `${selectedModule.module?.score || 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Uyarılar */}
                            {selectedModule.module?.alerts && selectedModule.module.alerts.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        Uyarılar ({selectedModule.module.alerts.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedModule.module.alerts.map((alert, idx) => (
                                            <div key={idx} className="p-3 rounded-lg border bg-red-50 border-red-200">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-sm">{alert.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                                                        {alert.action && (
                                                            <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                                                <ChevronRight className="h-3 w-3" />
                                                                {alert.action}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Öneriler */}
                            {selectedModule.module?.recommendations && selectedModule.module.recommendations.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                                        Öneriler ({selectedModule.module.recommendations.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedModule.module.recommendations.map((rec, idx) => (
                                            <div key={idx} className="p-3 rounded-lg border bg-yellow-50 border-yellow-200">
                                                <div className="flex items-start gap-2">
                                                    <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-sm">{rec.title || (typeof rec === 'string' ? rec : rec.description)}</p>
                                                        {rec.description && rec.title && (
                                                            <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Metrikler */}
                            {selectedModule.module?.metrics && Object.keys(selectedModule.module.metrics).length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-blue-500" />
                                        Temel Metrikler
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(selectedModule.module.metrics).map(([key, value]) => {
                                            const isNegative = key.includes('overdue') || key.includes('expired') || key.includes('rejection') || key.includes('below');
                                            const isPositive = key.includes('completed') || key.includes('on_target') || key.includes('approved');
                                            
                                            return (
                                                <div 
                                                    key={key} 
                                                    className={`p-3 rounded-lg border ${
                                                        isNegative && value > 0 ? 'bg-red-50 border-red-200' :
                                                        isPositive ? 'bg-green-50 border-green-200' :
                                                        'bg-muted/30 border-muted'
                                                    }`}
                                                >
                                                    <div className={`text-lg font-bold ${
                                                        isNegative && value > 0 ? 'text-red-600' :
                                                        isPositive ? 'text-green-600' :
                                                        'text-foreground'
                                                    }`}>
                                                        {typeof value === 'number' ? Math.round(value * 100) / 100 : value}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {getMetricLabel(key)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
