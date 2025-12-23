import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    TrendingUp, 
    TrendingDown, 
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
    BarChart3
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

const getProgressColor = (score) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
};

const getStatusBadge = (status) => {
    switch(status) {
        case 'Mükemmel':
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Mükemmel</Badge>;
        case 'İyi':
            return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">İyi</Badge>;
        case 'Orta':
            return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Orta</Badge>;
        case 'Dikkat Gerekli':
            return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Dikkat Gerekli</Badge>;
        default:
            return <Badge variant="destructive">Kritik</Badge>;
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

export default function QualityAdvisor() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

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

    return (
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
                {/* Ana Skor Bölümü */}
                <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
                    <div className="text-center">
                        <div className={`text-4xl font-bold ${getScoreColor(analysis?.total_score || 0)}`}>
                            {Math.round(analysis?.total_score || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">/100</div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(analysis?.health_status)}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-red-600">{summary.critical_alerts || 0}</div>
                                <div className="text-xs text-muted-foreground">Kritik</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-orange-600">{summary.high_alerts || 0}</div>
                                <div className="text-xs text-muted-foreground">Yüksek</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-blue-600">{summary.total_recommendations || 0}</div>
                                <div className="text-xs text-muted-foreground">Öneri</div>
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
                                    className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow"
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
                                                <Badge variant="destructive" className="text-xs px-1.5">
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
    );
}
