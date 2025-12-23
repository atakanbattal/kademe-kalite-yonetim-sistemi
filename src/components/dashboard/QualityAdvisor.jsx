import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Brain, 
    TrendingUp, 
    TrendingDown, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle,
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
    MessageSquareWarning,
    Target,
    Sparkles,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const moduleIcons = {
    nc: <FileWarning className="h-4 w-4" />,
    audit: <ClipboardCheck className="h-4 w-4" />,
    supplier: <Users className="h-4 w-4" />,
    calibration: <Gauge className="h-4 w-4" />,
    document: <Shield className="h-4 w-4" />,
    training: <Target className="h-4 w-4" />,
    complaint: <MessageSquareWarning className="h-4 w-4" />,
    kpi: <Activity className="h-4 w-4" />,
    kaizen: <Sparkles className="h-4 w-4" />,
    quarantine: <Package className="h-4 w-4" />,
    task: <CheckCircle2 className="h-4 w-4" />,
    incoming: <Package className="h-4 w-4" />
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
        return <ArrowUpRight className="h-3 w-3 text-green-500" />;
    } else if (trend === 'down' || trend === 'Kötüleşiyor') {
        return <ArrowDownRight className="h-3 w-3 text-red-500" />;
    }
    return <Minus className="h-3 w-3 text-gray-400" />;
};

const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 75) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
};

const getProgressColor = (score) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
};

const getPriorityColor = (priority) => {
    switch (priority) {
        case 'CRITICAL': return 'bg-red-500 text-white';
        case 'HIGH': return 'bg-orange-500 text-white';
        case 'MEDIUM': return 'bg-yellow-500 text-white';
        default: return 'bg-blue-500 text-white';
    }
};

const getPriorityLabel = (priority) => {
    switch (priority) {
        case 'CRITICAL': return 'KRİTİK';
        case 'HIGH': return 'YÜKSEK';
        case 'MEDIUM': return 'ORTA';
        default: return 'NORMAL';
    }
};

export default function QualityAdvisor() {
    const { user } = useAuth();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedModule, setExpandedModule] = useState(null);
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
                toast.success('Sistem analizi tamamlandı', {
                    description: `Toplam skor: ${data?.total_score || 0}/100`
                });
            }
        } catch (error) {
            console.error('Analiz hatası:', error);
            if (showToast) {
                toast.error('Analiz yapılamadı', {
                    description: error.message
                });
            }
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [user?.id, refreshing]);

    useEffect(() => {
        if (user?.email === 'atakan.battal@kademe.com.tr') {
            runAnalysis(false);
        }
    }, [user]);

    if (loading) {
        return (
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-xl">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Brain className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                            <Skeleton className="h-6 w-48 bg-slate-700" />
                            <Skeleton className="h-4 w-32 mt-1 bg-slate-700" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-20 bg-slate-700" />
                    <div className="grid grid-cols-3 gap-2">
                        {[1,2,3].map(i => (
                            <Skeleton key={i} className="h-16 bg-slate-700" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const moduleScores = analysis?.module_scores || {};
    const recommendations = analysis?.recommendations || [];
    const alerts = analysis?.alerts || [];
    const summary = analysis?.summary || {};

    return (
        <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-0 shadow-2xl overflow-hidden">
            {/* Header */}
            <CardHeader className="pb-2 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10" />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <motion.div 
                            className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Brain className="h-6 w-6" />
                        </motion.div>
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                Kalite Yönetim Danışmanı
                                <Zap className="h-4 w-4 text-yellow-400" />
                            </CardTitle>
                            <p className="text-xs text-slate-400">
                                Yapay zeka destekli sistem analizi
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runAnalysis()}
                        disabled={refreshing}
                        className="text-slate-300 hover:text-white hover:bg-white/10"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} />
                        {refreshing ? 'Analiz...' : 'Yenile'}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
                {/* Ana Skor */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white/5 to-white/10 backdrop-blur">
                    <div className={cn(
                        "relative w-24 h-24 rounded-full flex items-center justify-center",
                        "bg-gradient-to-br",
                        analysis?.total_score >= 75 ? "from-green-500/20 to-emerald-500/20" :
                        analysis?.total_score >= 50 ? "from-yellow-500/20 to-orange-500/20" :
                        "from-red-500/20 to-rose-500/20"
                    )}>
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                                cx="48"
                                cy="48"
                                r="42"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                className="text-slate-700"
                            />
                            <motion.circle
                                cx="48"
                                cy="48"
                                r="42"
                                fill="none"
                                stroke="url(#scoreGradient)"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={264}
                                initial={{ strokeDashoffset: 264 }}
                                animate={{ strokeDashoffset: 264 - (264 * (analysis?.total_score || 0) / 100) }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                            <defs>
                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#a855f7" />
                                    <stop offset="100%" stopColor="#3b82f6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="text-center z-10">
                            <motion.span 
                                className="text-2xl font-bold"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                {analysis?.total_score || 0}
                            </motion.span>
                            <span className="text-xs text-slate-400 block">/100</span>
                        </div>
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                                "px-3 py-1 rounded-full text-sm font-medium",
                                analysis?.total_score >= 90 ? "bg-green-500/20 text-green-400" :
                                analysis?.total_score >= 75 ? "bg-blue-500/20 text-blue-400" :
                                analysis?.total_score >= 60 ? "bg-yellow-500/20 text-yellow-400" :
                                analysis?.total_score >= 40 ? "bg-orange-500/20 text-orange-400" :
                                "bg-red-500/20 text-red-400"
                            )}>
                                {analysis?.health_status || 'Analiz Bekleniyor'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <span className="text-lg font-bold text-red-400">{summary.critical_alerts || 0}</span>
                                <p className="text-xs text-slate-400">Kritik</p>
                            </div>
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <span className="text-lg font-bold text-orange-400">{summary.high_alerts || 0}</span>
                                <p className="text-xs text-slate-400">Yüksek</p>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <span className="text-lg font-bold text-blue-400">{summary.total_recommendations || 0}</span>
                                <p className="text-xs text-slate-400">Öneri</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 p-1 rounded-lg bg-white/5">
                    {[
                        { id: 'overview', label: 'Genel Bakış', icon: Activity },
                        { id: 'alerts', label: 'Uyarılar', icon: AlertTriangle },
                        { id: 'recommendations', label: 'Öneriler', icon: Lightbulb }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                activeTab === tab.id 
                                    ? "bg-white/10 text-white" 
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {/* Genel Bakış */}
                    {activeTab === 'overview' && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <ScrollArea className="h-[280px] pr-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(moduleScores).map(([key, module]) => {
                                        const score = module?.score || 0;
                                        const trend = module?.trend;
                                        const status = module?.status;
                                        const alertCount = module?.alerts?.length || 0;
                                        
                                        return (
                                            <motion.div
                                                key={key}
                                                className={cn(
                                                    "p-3 rounded-lg cursor-pointer transition-all",
                                                    "bg-white/5 hover:bg-white/10 border border-transparent",
                                                    expandedModule === key && "border-purple-500/50 bg-white/10"
                                                )}
                                                onClick={() => setExpandedModule(expandedModule === key ? null : key)}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400">{moduleIcons[key]}</span>
                                                        <span className="text-xs font-medium text-slate-300">
                                                            {moduleNames[key] || key}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {alertCount > 0 && (
                                                            <span className="px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                                                                {alertCount}
                                                            </span>
                                                        )}
                                                        {getTrendIcon(trend)}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                                                        <motion.div
                                                            className={cn("h-full rounded-full", getProgressColor(score))}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${score}%` }}
                                                            transition={{ duration: 1, delay: 0.2 }}
                                                        />
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm font-bold",
                                                        score >= 75 ? "text-green-400" :
                                                        score >= 50 ? "text-yellow-400" :
                                                        "text-red-400"
                                                    )}>
                                                        {score}
                                                    </span>
                                                </div>
                                                
                                                {expandedModule === key && module?.recommendations && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-2 pt-2 border-t border-slate-700"
                                                    >
                                                        {module.recommendations.slice(0, 2).map((rec, idx) => (
                                                            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-400 mb-1">
                                                                <Lightbulb className="h-3 w-3 text-yellow-400 mt-0.5 shrink-0" />
                                                                <span>{rec.text || rec}</span>
                                                            </div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </motion.div>
                    )}

                    {/* Uyarılar */}
                    {activeTab === 'alerts' && (
                        <motion.div
                            key="alerts"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <ScrollArea className="h-[280px] pr-2">
                                {alerts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <CheckCircle2 className="h-12 w-12 mb-2 text-green-400" />
                                        <p className="text-sm font-medium">Harika! Aktif uyarı yok</p>
                                        <p className="text-xs">Sisteminiz sorunsuz çalışıyor</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {alerts.map((alert, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "p-1.5 rounded-lg shrink-0",
                                                        alert.priority === 'CRITICAL' ? "bg-red-500/20" :
                                                        alert.priority === 'HIGH' ? "bg-orange-500/20" :
                                                        "bg-yellow-500/20"
                                                    )}>
                                                        <AlertTriangle className={cn(
                                                            "h-4 w-4",
                                                            alert.priority === 'CRITICAL' ? "text-red-400" :
                                                            alert.priority === 'HIGH' ? "text-orange-400" :
                                                            "text-yellow-400"
                                                        )} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-medium text-white truncate">
                                                                {alert.title}
                                                            </span>
                                                            <Badge className={cn("text-xs shrink-0", getPriorityColor(alert.priority))}>
                                                                {getPriorityLabel(alert.priority)}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-slate-400 line-clamp-2">
                                                            {alert.description}
                                                        </p>
                                                        {alert.action && (
                                                            <div className="mt-2 flex items-center gap-1 text-xs text-purple-400">
                                                                <ChevronRight className="h-3 w-3" />
                                                                <span>{alert.action}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </motion.div>
                    )}

                    {/* Öneriler */}
                    {activeTab === 'recommendations' && (
                        <motion.div
                            key="recommendations"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <ScrollArea className="h-[280px] pr-2">
                                {recommendations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <Sparkles className="h-12 w-12 mb-2 text-purple-400" />
                                        <p className="text-sm font-medium">Öneri bulunamadı</p>
                                        <p className="text-xs">Sistem optimum çalışıyor</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recommendations.map((rec, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="p-1.5 rounded-lg bg-purple-500/20 shrink-0">
                                                        <Lightbulb className="h-4 w-4 text-purple-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-200">
                                                            {rec.text || rec}
                                                        </p>
                                                        {rec.module && (
                                                            <div className="mt-1 flex items-center gap-1.5">
                                                                <span className="text-xs text-slate-500">
                                                                    {moduleNames[rec.module] || rec.module}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        Son analiz: {analysis?.analysis_date 
                            ? new Date(analysis.analysis_date).toLocaleString('tr-TR') 
                            : '-'}
                    </span>
                    {analysis?.notifications_created > 0 && (
                        <span className="text-purple-400">
                            {analysis.notifications_created} yeni bildirim oluşturuldu
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
