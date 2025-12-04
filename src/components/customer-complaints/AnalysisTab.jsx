import React, { useState } from 'react';
import { Plus, Edit, Trash2, BarChart3, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import AnalysisFormModal from './AnalysisFormModal';

const ANALYSIS_TYPE_LABELS = {
    '5N1K': '5N1K Analizi',
    'Balık Kılçığı': 'Balık Kılçığı (Ishikawa)',
    '5 Neden': '5 Neden Analizi',
    'FMEA': 'FMEA',
    'Diğer': 'Diğer'
};

const ANALYSIS_TYPE_COLORS = {
    '5N1K': 'blue',
    'Balık Kılçığı': 'purple',
    '5 Neden': 'orange',
    'FMEA': 'green',
    'Diğer': 'default'
};

const AnalysisTab = ({ complaintId, analyses, onRefresh }) => {
    const { toast } = useToast();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingAnalysis, setEditingAnalysis] = useState(null);

    const openForm = (analysis = null) => {
        setEditingAnalysis(analysis);
        setFormOpen(true);
    };

    const closeForm = () => {
        setEditingAnalysis(null);
        setFormOpen(false);
    };

    const handleSuccess = () => {
        onRefresh();
        closeForm();
    };

    const deleteAnalysis = async (id) => {
        const { error } = await supabase
            .from('complaint_analyses')
            .delete()
            .eq('id', id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Analiz silinemedi.'
            });
        } else {
            toast({
                title: 'Başarılı',
                description: 'Analiz silindi.'
            });
            onRefresh();
        }
    };

    const renderAnalysisContent = (analysis) => {
        switch (analysis.analysis_type) {
            case '5N1K':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysis.what_ne && (
                            <div>
                                <div className="text-sm font-semibold text-muted-foreground">Ne?</div>
                                <div className="text-sm mt-1">{analysis.what_ne}</div>
                            </div>
                        )}
                        {analysis.where_nerede && (
                            <div>
                                <div className="text-sm font-semibold text-muted-foreground">Nerede?</div>
                                <div className="text-sm mt-1">{analysis.where_nerede}</div>
                            </div>
                        )}
                        {analysis.when_ne_zaman && (
                            <div>
                                <div className="text-sm font-semibold text-muted-foreground">Ne Zaman?</div>
                                <div className="text-sm mt-1">{analysis.when_ne_zaman}</div>
                            </div>
                        )}
                        {analysis.who_kim && (
                            <div>
                                <div className="text-sm font-semibold text-muted-foreground">Kim?</div>
                                <div className="text-sm mt-1">{analysis.who_kim}</div>
                            </div>
                        )}
                        {analysis.why_neden && (
                            <div>
                                <div className="text-sm font-semibold text-muted-foreground">Neden?</div>
                                <div className="text-sm mt-1">{analysis.why_neden}</div>
                            </div>
                        )}
                        {analysis.how_nasil && (
                            <div>
                                <div className="text-sm font-semibold text-muted-foreground">Nasıl?</div>
                                <div className="text-sm mt-1">{analysis.how_nasil}</div>
                            </div>
                        )}
                    </div>
                );

            case '5 Neden':
                return (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(num => {
                            const key = `why_${num}`;
                            if (!analysis[key]) return null;
                            return (
                                <div key={num} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                                        {num}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-muted-foreground">
                                            Neden {num}?
                                        </div>
                                        <div className="text-sm mt-1">{analysis[key]}</div>
                                    </div>
                                </div>
                            );
                        })}
                        {analysis.root_cause && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                                <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    Kök Neden
                                </div>
                                <div className="text-sm mt-1 text-red-900 dark:text-red-200">
                                    {analysis.root_cause}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'Balık Kılçığı':
                const categories = [
                    { key: 'fishbone_method', label: 'İnsan (Man)', icon: '👤' },
                    { key: 'fishbone_machine', label: 'Makine (Machine)', icon: '⚙️' },
                    { key: 'fishbone_material', label: 'Malzeme (Material)', icon: '📦' },
                    { key: 'fishbone_measurement', label: 'Ölçüm (Measurement)', icon: '📏' },
                    { key: 'fishbone_environment', label: 'Çevre (Environment)', icon: '🌍' },
                    { key: 'fishbone_management', label: 'Yönetim (Management)', icon: '📋' }
                ];

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map(cat => {
                            const data = analysis[cat.key];
                            if (!data) return null;
                            
                            // JSONB alanı, array veya string olabilir
                            let items = [];
                            if (Array.isArray(data)) {
                                items = data;
                            } else if (typeof data === 'string') {
                                items = [data];
                            } else if (data.items && Array.isArray(data.items)) {
                                items = data.items;
                            }

                            if (items.length === 0) return null;

                            return (
                                <Card key={cat.key}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <span>{cat.icon}</span>
                                            {cat.label}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {items.map((item, idx) => (
                                                <li key={idx} className="text-sm flex items-start gap-2">
                                                    <span className="text-muted-foreground">•</span>
                                                    <span>{typeof item === 'string' ? item : item.text || JSON.stringify(item)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                );

            default:
                return (
                    <div className="text-sm text-muted-foreground">
                        Detay bilgisi mevcut değil.
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Kök Neden Analizleri</h3>
                    <p className="text-sm text-muted-foreground">
                        5N1K, Balık Kılçığı ve 5 Neden analizleri yapın
                    </p>
                </div>
                <Button onClick={() => openForm()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Analiz
                </Button>
            </div>

            {analyses.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Henüz analiz yapılmamış.</p>
                            <p className="text-sm mt-1">
                                Yeni bir analiz eklemek için yukarıdaki butonu kullanın.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {analyses.map(analysis => (
                        <Card key={analysis.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge 
                                                variant="outline"
                                                className={`border-${ANALYSIS_TYPE_COLORS[analysis.analysis_type]}-500`}
                                            >
                                                {ANALYSIS_TYPE_LABELS[analysis.analysis_type] || analysis.analysis_type}
                                            </Badge>
                                            {analysis.analysis_date && (
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(analysis.analysis_date).toLocaleDateString('tr-TR')}
                                                </span>
                                            )}
                                        </div>
                                        {analysis.analysis_summary && (
                                            <CardDescription className="mt-2">
                                                {analysis.analysis_summary}
                                            </CardDescription>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openForm(analysis)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Bu analiz kalıcı olarak silinecektir.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => deleteAnalysis(analysis.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Sil
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {renderAnalysisContent(analysis)}

                                {/* Aksiyonlar */}
                                {(analysis.immediate_action || analysis.preventive_action) && (
                                    <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {analysis.immediate_action && (
                                            <div>
                                                <div className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2">
                                                    Anlık Aksiyon
                                                </div>
                                                <div className="text-sm bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
                                                    {analysis.immediate_action}
                                                </div>
                                            </div>
                                        )}
                                        {analysis.preventive_action && (
                                            <div>
                                                <div className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                                                    Önleyici Aksiyon
                                                </div>
                                                <div className="text-sm bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                                                    {analysis.preventive_action}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormOpen && (
                <AnalysisFormModal
                    open={isFormOpen}
                    setOpen={setFormOpen}
                    complaintId={complaintId}
                    existingAnalysis={editingAnalysis}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default AnalysisTab;

