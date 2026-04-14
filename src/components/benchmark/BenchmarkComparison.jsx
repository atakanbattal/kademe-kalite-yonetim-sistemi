import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    X, Plus, Trash2, Save, Download, TrendingUp, Award,
    ThumbsUp, ThumbsDown, BarChart3, PieChart, FileText, Target,
    Edit, Check, AlertCircle, Loader2, Eye
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, HelpCircle } from 'lucide-react';
import { computeBenchmarkItemScores, syncAutoBenchmarkCriteria } from '@/lib/benchmarkScoring';
import { fetchBenchmarkComparisonReportPayload } from '@/lib/benchmarkComparisonReportData';
import { buildAutoProsConsInserts, replaceAutoProsConsInSupabase } from '@/lib/benchmarkAutoProsCons';
import { generateBenchmarkComparisonReportHtml } from '@/lib/benchmarkComparisonReportHtml';
import {
    BenchmarkOverviewHero,
    BenchmarkRankingBars,
    BenchmarkCriteriaRadar,
} from '@/components/benchmark/BenchmarkComparisonVisuals';

const CRITERION_CATEGORY_OPTIONS = [
    'Maliyet', 'Kalite', 'Teknik', 'Operasyonel', 'Çevresel', 'Hizmet', 'Finansal', 'Teslimat', 'Pazar', 'Diğer',
];
const MEASUREMENT_UNIT_OPTIONS = [
    'Puan', 'TRY', 'USD', 'EUR', 'Gün', 'Ay', 'Saat', 'Adet', '%', 'kg', 'm', 'Diğer',
];

// Helper component for Label with Tooltip
const LabelWithTooltip = ({ children, tooltip, required = false }) => (
    <div className="flex items-center gap-1.5">
        <Label className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>
            {children}
        </Label>
        {tooltip && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <p className="text-xs">{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
    </div>
);

const BenchmarkComparison = ({
    isOpen,
    onClose,
    benchmark,
    onRefresh,
    embedded = false,
}) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedItemDetail, setSelectedItemDetail] = useState(null);

    // Data states
    const [items, setItems] = useState([]);
    const [criteria, setCriteria] = useState([]);
    const [scores, setScores] = useState({});
    const [prosConsData, setProsConsData] = useState({});

    // Edit states
    const [editingItem, setEditingItem] = useState(null);
    const [editingCriterion, setEditingCriterion] = useState(null);
    const [newItem, setNewItem] = useState(null);
    const [newCriterion, setNewCriterion] = useState(null);
    const [editingProsCons, setEditingProsCons] = useState(null);

    useEffect(() => {
        if (benchmark?.id && (embedded || isOpen)) {
            fetchComparisonData();
        } else if (!embedded && !isOpen) {
            setItems([]);
            setCriteria([]);
            setScores({});
            setProsConsData({});
            setLoading(false);
            setActiveTab('overview');
            setSelectedItemDetail(null);
            setEditingCriterion(null);
            setNewCriterion(null);
            setNewItem(null);
        }
    }, [benchmark?.id, isOpen, embedded]);

    const fetchComparisonData = useCallback(async () => {
        if (!benchmark?.id) {
            return;
        }

        setLoading(true);
        // itemsData ve criteriaData'yı try bloğu dışında tanımla ki catch bloğunda erişilebilir olsun
        let itemsData = [];
        let criteriaData = [];
        
        try {
            // Önce items ve criteria'yı çek
            const [itemsRes, criteriaRes] = await Promise.all([
                supabase
                    .from('benchmark_items')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('rank_order'),
                supabase
                    .from('benchmark_criteria')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('order_index')
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (criteriaRes.error) throw criteriaRes.error;

            itemsData = itemsRes.data || [];
            criteriaData = (criteriaRes.data || []).map((row) => ({
                ...row,
                include_in_matrix: row.include_in_matrix !== false,
            }));

            /** Matriste en az 2 kriter yoksa (çoğu kayıtta sadece alternatifler var) otomatik kriter+skor üret */
            const matrixCountInitial = criteriaData.filter((c) => c.include_in_matrix !== false).length;
            if (itemsData.length >= 2 && matrixCountInitial < 2) {
                try {
                    await syncAutoBenchmarkCriteria(supabase, benchmark.id);
                    const { data: critAfter, error: critAfterErr } = await supabase
                        .from('benchmark_criteria')
                        .select('*')
                        .eq('benchmark_id', benchmark.id)
                        .order('order_index');
                    if (!critAfterErr && critAfter?.length) {
                        criteriaData = critAfter.map((row) => ({
                            ...row,
                            include_in_matrix: row.include_in_matrix !== false,
                        }));
                    }
                } catch (syncErr) {
                    console.warn('Otomatik kriter senkronu atlandı:', syncErr);
                }
            }

            setItems(itemsData);
            setCriteria(criteriaData);

            // Item ID'leri al
            const itemIds = itemsData.map(item => item.id);
            
            // Scores ve pros_cons'u item ID'leri ile filtrele
            let scoresData = [];
            let prosConsData = [];
            
            if (itemIds.length > 0) {
                // Scores sorgusu - zorunlu
                const scoresRes = await supabase
                    .from('benchmark_scores')
                    .select('*')
                    .in('benchmark_item_id', itemIds);

                if (scoresRes.error) {
                    console.warn('benchmark_scores sorgusu hatası:', scoresRes.error);
                    // Scores hatası kritik değil, devam et
                } else {
                    scoresData = scoresRes.data || [];
                }

                // Pros/cons sorgusu - opsiyonel (tablo yoksa hata verme)
                try {
                    const prosConsRes = await supabase
                        .from('benchmark_pros_cons')
                        .select('*')
                        .in('benchmark_item_id', itemIds);

                    if (prosConsRes.error) {
                        console.warn('benchmark_pros_cons sorgusu hatası (tablo mevcut olmayabilir):', prosConsRes.error);
                        // Pros/cons hatası kritik değil, devam et
                        prosConsData = [];
                    } else {
                        prosConsData = prosConsRes.data || [];
                    }
                } catch (prosConsError) {
                    console.warn('benchmark_pros_cons sorgusu exception:', prosConsError);
                    // Pros/cons hatası kritik değil, devam et
                    prosConsData = [];
                }
            }

            // Organize scores by item and criterion
            const scoresMap = {};
            scoresData.forEach(score => {
                const key = `${score.benchmark_item_id}_${score.criterion_id}`;
                scoresMap[key] = score;
            });
            setScores(scoresMap);

            // Otomatik avantaj/dezavantaj (kriter skorlarına göre), ardından güncel listeyi çek
            if (itemIds.length > 0 && criteriaData.length > 0) {
                try {
                    const inserts = buildAutoProsConsInserts({
                        items: itemsData,
                        criteria: criteriaData,
                        scores: scoresMap,
                    }).map((row) => ({ ...row, created_by: user?.id }));
                    await replaceAutoProsConsInSupabase(supabase, { itemIds, inserts });
                    const prosRefresh = await supabase
                        .from('benchmark_pros_cons')
                        .select('*')
                        .in('benchmark_item_id', itemIds);
                    if (!prosRefresh.error && prosRefresh.data) {
                        prosConsData = prosRefresh.data;
                    }
                } catch (syncErr) {
                    console.warn('Otomatik avantaj/dezavantaj senkronu atlandı:', syncErr);
                }
            }

            // Organize pros/cons by item
            const prosConsMap = {};
            prosConsData.forEach(pc => {
                if (!prosConsMap[pc.benchmark_item_id]) {
                    prosConsMap[pc.benchmark_item_id] = { pros: [], cons: [] };
                }
                if (pc.type === 'Avantaj') {
                    prosConsMap[pc.benchmark_item_id].pros.push(pc);
                } else {
                    prosConsMap[pc.benchmark_item_id].cons.push(pc);
                }
            });
            setProsConsData(prosConsMap);
        } catch (error) {
            console.error('Karşılaştırma verileri yüklenirken kritik hata:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                benchmarkId: benchmark?.id
            });
            
            // Items ve criteria yüklenmişse koru, sadece scores ve prosCons'u temizle
            // itemsData ve criteriaData değişkenlerini kontrol et (henüz state'e set edilmemiş olabilir)
            const itemsLoaded = itemsData && itemsData.length > 0;
            const criteriaLoaded = criteriaData && criteriaData.length > 0;
            
            if (itemsLoaded || criteriaLoaded) {
                // Items veya criteria yüklenmişse, onları koru
                if (itemsLoaded) {
                    setItems(itemsData);
                }
                if (criteriaLoaded) {
                    setCriteria(criteriaData);
                }
                setScores({});
                setProsConsData({});
            } else {
                // Hiçbir veri yüklenmemişse, state'leri temizle
                setItems([]);
                setCriteria([]);
                setScores({});
                setProsConsData({});
            }
            
            toast({
                variant: 'destructive',
                title: 'Uyarı',
                description: 'Bazı veriler yüklenirken bir hata oluştu, ancak temel veriler korundu.'
            });
        } finally {
            setLoading(false);
        }
    }, [benchmark?.id, toast, user?.id]);

    const matrixCriteria = useMemo(
        () => criteria.filter((c) => c.include_in_matrix !== false),
        [criteria]
    );

    const itemScores = useMemo(
        () => computeBenchmarkItemScores(items, criteria, scores),
        [items, criteria, scores]
    );

    const itemsSortedByScore = useMemo(() => {
        if (!items?.length) return [];
        return [...items].sort((a, b) => {
            const sa = itemScores[a.id]?.average ?? 0;
            const sb = itemScores[b.id]?.average ?? 0;
            return sb - sa;
        });
    }, [items, itemScores]);

    const winner = useMemo(() => {
        if (!itemsSortedByScore.length) return null;
        const top = itemsSortedByScore[0];
        const s = itemScores[top.id]?.average;
        if (s == null || Number.isNaN(s)) return null;
        return { item: top, score: s };
    }, [itemsSortedByScore, itemScores]);

    const radarCompareItems = useMemo(() => itemsSortedByScore.slice(0, 5), [itemsSortedByScore]);

    const showRadar = matrixCriteria.length >= 2 && radarCompareItems.length >= 2;

    /** Radar boşsa kullanıcıya net sebep (otomatik kriter oluşmadıysa / alternatif eksik) */
    const radarEmptyExplanation = useMemo(() => {
        if (items.length < 2) {
            return 'Radar için en az iki alternatif gerekir. Alternatifler sekmesinden ekleyin.';
        }
        if (matrixCriteria.length < 2) {
            return (
                <>
                    Matriste en az <strong className="text-foreground">2 kriter</strong> olmalı. İki alternatifiniz
                    varken sistem otomatik kriter üretmeyi dener; üretim için her iki alternatifte de ortak doldurulmuş
                    alanlar (ör. birim fiyat, kalite puanı, teslimat süresi) gerekir. Otomatik oluşmadıysa{' '}
                    <strong className="text-foreground">Kriterler</strong> sekmesinden kriter ekleyip{' '}
                    <strong className="text-foreground">Matris</strong> sekmesinde puanları girin.
                </>
            );
        }
        return null;
    }, [items.length, matrixCriteria.length]);

    // Handlers for Items
    const handleAddItem = () => {
        setNewItem({
            item_name: '',
            description: '',
            supplier_id: '',
            model_number: '',
            // Maliyet Bilgileri
            unit_price: '',
            currency: 'TRY',
            minimum_order_quantity: '',
            lead_time_days: '',
            payment_terms: '',
            total_cost_of_ownership: '',
            roi_percentage: '',
            // Kalite ve Performans
            quality_score: '',
            performance_score: '',
            reliability_score: '',
            // Satış Sonrası Hizmet
            after_sales_service_score: '',
            warranty_period_months: '',
            support_availability: '',
            technical_support_score: '',
            // Teslimat ve Operasyonel
            delivery_time_days: '',
            implementation_time_days: '',
            training_required_hours: '',
            // Bakım ve Maliyet
            maintenance_cost: '',
            maintenance_frequency_months: '',
            // Çevresel ve Sürdürülebilirlik
            energy_efficiency_score: '',
            environmental_impact_score: '',
            // Kullanılabilirlik ve Teknik
            ease_of_use_score: '',
            documentation_quality_score: '',
            scalability_score: '',
            compatibility_score: '',
            innovation_score: '',
            // Pazar ve Referanslar
            market_reputation_score: '',
            customer_references_count: '',
            risk_level: '',
            // Yeni eklenen alanlar
            category: '',
            origin: '',
            implementation_cost: '',
            durability_score: '',
            safety_score: '',
            standards_compliance_score: ''
        });
    };

    const handleSaveNewItem = async () => {
        if (!benchmark?.id) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Benchmark bilgisi bulunamadı.'
            });
            return;
        }

        if (!newItem || !newItem.item_name || !newItem.item_name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Alternatif adı zorunludur.'
            });
            return;
        }

        try {
            // Tüm sayısal değerleri parse et
            const parseDecimal = (val) => {
                if (val === null || val === undefined || val === '') return null;
                const parsed = parseFloat(val);
                return isNaN(parsed) ? null : parsed;
            };
            const parseIntValue = (val) => {
                if (val === null || val === undefined || val === '') return null;
                const parsed = parseInt(val);
                return isNaN(parsed) ? null : parsed;
            };

            const insertData = {
                benchmark_id: benchmark.id,
                item_name: newItem.item_name.trim(),
                description: newItem.description?.trim() || null,
                supplier_id: newItem.supplier_id?.trim() || null,
                model_number: newItem.model_number?.trim() || null,
                // Maliyet Bilgileri
                unit_price: parseDecimal(newItem.unit_price),
                currency: newItem.currency || 'TRY',
                minimum_order_quantity: parseIntValue(newItem.minimum_order_quantity),
                lead_time_days: parseIntValue(newItem.lead_time_days),
                payment_terms: newItem.payment_terms?.trim() || null,
                total_cost_of_ownership: parseDecimal(newItem.total_cost_of_ownership),
                roi_percentage: parseDecimal(newItem.roi_percentage),
                // Kalite ve Performans
                quality_score: parseDecimal(newItem.quality_score),
                performance_score: parseDecimal(newItem.performance_score),
                reliability_score: parseDecimal(newItem.reliability_score),
                // Satış Sonrası Hizmet
                after_sales_service_score: parseDecimal(newItem.after_sales_service_score),
                warranty_period_months: parseIntValue(newItem.warranty_period_months),
                support_availability: newItem.support_availability?.trim() || null,
                technical_support_score: parseDecimal(newItem.technical_support_score),
                // Teslimat ve Operasyonel
                delivery_time_days: parseIntValue(newItem.delivery_time_days),
                implementation_time_days: parseIntValue(newItem.implementation_time_days),
                training_required_hours: parseIntValue(newItem.training_required_hours),
                // Bakım ve Maliyet
                maintenance_cost: parseDecimal(newItem.maintenance_cost),
                maintenance_frequency_months: parseIntValue(newItem.maintenance_frequency_months),
                // Çevresel ve Sürdürülebilirlik
                energy_efficiency_score: parseDecimal(newItem.energy_efficiency_score),
                environmental_impact_score: parseDecimal(newItem.environmental_impact_score),
                // Kullanılabilirlik ve Teknik
                ease_of_use_score: parseDecimal(newItem.ease_of_use_score),
                documentation_quality_score: parseDecimal(newItem.documentation_quality_score),
                scalability_score: parseDecimal(newItem.scalability_score),
                compatibility_score: parseDecimal(newItem.compatibility_score),
                innovation_score: parseDecimal(newItem.innovation_score),
                // Pazar ve Referanslar
                market_reputation_score: parseDecimal(newItem.market_reputation_score),
                customer_references_count: parseIntValue(newItem.customer_references_count),
                risk_level: newItem.risk_level?.trim() || null,
                // Yeni eklenen alanlar
                category: newItem.category?.trim() || null,
                origin: newItem.origin?.trim() || null,
                implementation_cost: parseDecimal(newItem.implementation_cost),
                durability_score: parseDecimal(newItem.durability_score),
                safety_score: parseDecimal(newItem.safety_score),
                standards_compliance_score: parseDecimal(newItem.standards_compliance_score)
            };

            const { data, error } = await supabase
                .from('benchmark_items')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('handleSaveNewItem: Database error', error);
                throw error;
            }

            // Verileri yeniden yükle
            await fetchComparisonData();
            
            setNewItem(null);
            toast({
                title: 'Başarılı',
                description: 'Yeni alternatif eklendi.'
            });
        } catch (error) {
            console.error('Alternatif eklenirken hata:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Alternatif eklenirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('Bu alternatifi silmek istediğinizden emin misiniz?')) return;

        try {
            const { error } = await supabase
                .from('benchmark_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;

            setItems(items.filter(i => i.id !== itemId));
            toast({
                title: 'Başarılı',
                description: 'Alternatif silindi.'
            });
        } catch (error) {
            console.error('Silme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Alternatif silinirken bir hata oluştu.'
            });
        }
    };

    // Handlers for Criteria
    const handleAddCriterion = () => {
        setEditingCriterion(null);
        setNewCriterion({
            criterion_name: '',
            description: '',
            category: '',
            weight: '1',
            measurement_unit: '',
            scoring_method: 'Numerical'
        });
    };

    const handleStartEditCriterion = (criterion) => {
        setNewCriterion(null);
        setEditingCriterion({
            id: criterion.id,
            criterion_name: criterion.criterion_name || '',
            description: criterion.description || '',
            category: criterion.category || '',
            weight: String(criterion.weight ?? 1),
            measurement_unit: criterion.measurement_unit || '',
            scoring_method: criterion.scoring_method || 'Numerical',
        });
    };

    const handleSaveEditCriterion = async () => {
        if (!editingCriterion?.criterion_name?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kriter adı zorunludur.',
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('benchmark_criteria')
                .update({
                    criterion_name: editingCriterion.criterion_name.trim(),
                    description: editingCriterion.description?.trim() || null,
                    category: editingCriterion.category?.trim() || null,
                    measurement_unit: editingCriterion.measurement_unit?.trim() || null,
                    weight: parseFloat(editingCriterion.weight) || 1,
                    scoring_method: editingCriterion.scoring_method || 'Numerical',
                })
                .eq('id', editingCriterion.id)
                .select()
                .single();

            if (error) throw error;

            setCriteria((prev) => prev.map((c) => (c.id === data.id ? data : c)));
            setEditingCriterion(null);
            toast({
                title: 'Güncellendi',
                description: 'Kriter kaydedildi.',
            });
            onRefresh?.();
        } catch (error) {
            console.error('Kriter güncellenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kriter güncellenemedi.',
            });
        }
    };

    const handleDeleteCriterion = async (criterionId) => {
        if (!confirm('Bu kriter silinsin mi? Matristeki bu kritere ait puanlar da silinir.')) {
            return;
        }

        try {
            const { error } = await supabase.from('benchmark_criteria').delete().eq('id', criterionId);

            if (error) throw error;

            setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
            setScores((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                    if (k.endsWith(`_${criterionId}`)) delete next[k];
                });
                return next;
            });
            if (editingCriterion?.id === criterionId) {
                setEditingCriterion(null);
            }
            toast({
                title: 'Silindi',
                description: 'Kriter kaldırıldı.',
            });
            onRefresh?.();
        } catch (error) {
            console.error('Kriter silinirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kriter silinemedi.',
            });
        }
    };

    const handleSaveNewCriterion = async () => {
        if (!newCriterion.criterion_name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kriter adı zorunludur.'
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('benchmark_criteria')
                .insert({
                    benchmark_id: benchmark.id,
                    criterion_name: newCriterion.criterion_name.trim(),
                    description: newCriterion.description?.trim() || null,
                    category: newCriterion.category?.trim() || null,
                    measurement_unit: newCriterion.measurement_unit?.trim() || null,
                    weight: parseFloat(newCriterion.weight) || 1,
                    scoring_method: newCriterion.scoring_method || 'Numerical',
                    order_index: criteria.length,
                    include_in_matrix: true,
                })
                .select()
                .single();

            if (error) throw error;

            setCriteria([...criteria, data]);
            setNewCriterion(null);
            toast({
                title: 'Başarılı',
                description: 'Yeni kriter eklendi.'
            });
        } catch (error) {
            console.error('Kriter eklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kriter eklenirken bir hata oluştu.'
            });
        }
    };

    // Handlers for Scores
    const handleScoreChange = async (itemId, criterionId, value) => {
        const key = `${itemId}_${criterionId}`;
        const criterion = criteria.find(c => c.id === criterionId);
        
        if (!criterion) return;

        const rawValue = parseFloat(value) || 0;
        const normalizedScore = Math.min(Math.max(rawValue, 0), 100);
        const weightedScore = (normalizedScore * (criterion.weight || 1)) / 100;

        try {
            const existingScore = scores[key];
            
            let result;
            if (existingScore) {
                const { data, error } = await supabase
                    .from('benchmark_scores')
                    .update({
                        raw_value: rawValue,
                        normalized_score: normalizedScore,
                        weighted_score: weightedScore
                    })
                    .eq('id', existingScore.id)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            } else {
                const { data, error } = await supabase
                    .from('benchmark_scores')
                    .insert({
                        benchmark_item_id: itemId,
                        criterion_id: criterionId,
                        raw_value: rawValue,
                        normalized_score: normalizedScore,
                        weighted_score: weightedScore
                    })
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            }

            setScores({
                ...scores,
                [key]: result
            });
        } catch (error) {
            console.error('Skor kaydedilirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Skor kaydedilemedi.'
            });
        }
    };

    // Handlers for Pros/Cons
    const handleAddProCon = async (itemId, type) => {
        const description = prompt(`${type === 'Avantaj' ? 'Avantaj' : 'Dezavantaj'} açıklaması girin:`);
        if (!description?.trim()) return;

        try {
            const { data, error } = await supabase
                .from('benchmark_pros_cons')
                .insert({
                    benchmark_item_id: itemId,
                    type: type,
                    description: description.trim(),
                    source: 'manual',
                    created_by: user?.id
                })
                .select()
                .single();

            if (error) throw error;

            setProsConsData(prev => {
                const itemData = prev[itemId] || { pros: [], cons: [] };
                return {
                    ...prev,
                    [itemId]: {
                        ...itemData,
                        [type === 'Avantaj' ? 'pros' : 'cons']: [
                            ...(type === 'Avantaj' ? itemData.pros : itemData.cons),
                            data
                        ]
                    }
                };
            });

            toast({
                title: 'Başarılı',
                description: `${type} eklendi.`
            });
        } catch (error) {
            console.error('Ekleme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `${type} eklenirken bir hata oluştu.`
            });
        }
    };

    const handleDeleteProCon = async (id, itemId, type) => {
        if (!confirm('Silmek istediğinizden emin misiniz?')) return;

        try {
            const { error } = await supabase
                .from('benchmark_pros_cons')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setProsConsData(prev => {
                const itemData = prev[itemId] || { pros: [], cons: [] };
                const key = type === 'Avantaj' ? 'pros' : 'cons';
                return {
                    ...prev,
                    [itemId]: {
                        ...itemData,
                        [key]: itemData[key].filter(pc => pc.id !== id)
                    }
                };
            });

            toast({
                title: 'Başarılı',
                description: 'Silindi.'
            });
        } catch (error) {
            console.error('Silme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Silinirken bir hata oluştu.'
            });
        }
    };

    const handleDownloadReport = async () => {
        if (!benchmark) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Benchmark bilgisi bulunamadı.'
            });
            return;
        }

        try {
            const payload = await fetchBenchmarkComparisonReportPayload(supabase, benchmark.id);
            const htmlContent = await generateBenchmarkComparisonReportHtml({
                benchmark,
                ...payload,
            });
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (!printWindow) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.'
                });
                URL.revokeObjectURL(url);
                return;
            }

            printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(url));
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturulamadı.'
            });
        }
    };

    if (!embedded && !isOpen) {
        return null;
    }

    if (!benchmark) {
        if (embedded) return null;
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    hideCloseButton
                    className="!fixed !inset-0 !left-0 !top-0 z-[60] !m-0 flex h-[100dvh] !max-h-[100dvh] w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 shadow-xl sm:!max-h-[100dvh]"
                >
                    <DialogHeader>
                        <DialogTitle className="text-2xl">
                            <TrendingUp className="inline-block mr-2 h-6 w-6" />
                            Benchmark Karşılaştırma
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center h-[calc(95vh-120px)]">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                            <p className="text-sm text-muted-foreground">Benchmark bilgisi yükleniyor...</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!benchmark.id) {
        if (embedded) return null;
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    hideCloseButton
                    className="!fixed !inset-0 !left-0 !top-0 z-[60] !m-0 flex h-[100dvh] !max-h-[100dvh] w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 shadow-xl sm:!max-h-[100dvh]"
                >
                    <DialogHeader>
                        <DialogTitle className="text-2xl">
                            <TrendingUp className="inline-block mr-2 h-6 w-6" />
                            Benchmark Karşılaştırma
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center h-[calc(95vh-120px)]">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                            <p className="text-sm text-muted-foreground">Benchmark bilgisi yükleniyor...</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const inner = (
                <>
                {loading ? (
                    <div
                        className={cn(
                            embedded
                                ? 'flex justify-center py-16'
                                : 'flex items-center justify-center h-[calc(95vh-140px)]'
                        )}
                    >
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                            {!embedded && (
                                <p className="text-sm text-muted-foreground">Veriler yükleniyor...</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div
                        className={cn(
                            embedded
                                ? 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain'
                                : 'h-[calc(95vh-140px)] min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain'
                        )}
                    >
                        <div
                            className={cn(
                                embedded ? 'min-w-0 pt-1 pb-2' : 'px-6 pt-4 pb-6 min-w-0'
                            )}
                        >
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="!inline-flex !h-auto w-full min-w-0 flex-wrap items-stretch justify-start gap-1.5 rounded-lg border bg-muted/50 p-1.5 sm:p-2 overflow-x-visible overflow-y-visible">
                            <TabsTrigger
                                value="overview"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Özet
                            </TabsTrigger>
                            <TabsTrigger
                                value="items"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Alternatifler ({items?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger
                                value="criteria"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Kriterler ({criteria?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger
                                value="matrix"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Matris (puan)
                            </TabsTrigger>
                            <TabsTrigger
                                value="analysis"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Avantaj / dezavantaj
                            </TabsTrigger>
                        </TabsList>
                        <p className="text-xs text-muted-foreground mt-2">
                            Akış: <strong className="text-foreground">Kriterler</strong> →{' '}
                            <strong className="text-foreground">Matris</strong> ile puan girin; grafikler Özet sekmesindedir.
                        </p>

                        {/* Özet — grafikler */}
                        <TabsContent value="overview" className="space-y-6 mt-4">
                            <BenchmarkOverviewHero
                                winner={winner}
                                itemCount={items?.length ?? 0}
                                criteriaCount={criteria?.length ?? 0}
                                hasRadar={showRadar}
                            />
                            <div className="grid gap-6 xl:grid-cols-2">
                                <Card className="overflow-hidden shadow-sm">
                                    <CardHeader className="border-b bg-muted/30 py-4">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-primary" />
                                            Skor sıralaması
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground font-normal mt-1">
                                            Ağırlıklı toplam skor (yüksek daha iyi). En fazla 14 alternatif gösterilir.
                                        </p>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="w-full min-w-0 self-start text-left [&_.recharts-responsive-container]:!mx-0 [&_.recharts-wrapper]:!mx-0">
                                            <BenchmarkRankingBars
                                                itemsSortedByScore={itemsSortedByScore}
                                                itemScores={itemScores}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="overflow-hidden shadow-sm">
                                    <CardHeader className="border-b bg-muted/30 py-4">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <Target className="h-4 w-4 text-primary" />
                                            Kriter profili (radar)
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground font-normal mt-1">
                                            Her eksen bir kriter; değerler 0–100 normalize puandır. En fazla 5 alternatif, 12 kriter.
                                        </p>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        {showRadar ? (
                                            <BenchmarkCriteriaRadar
                                                radarItems={radarCompareItems}
                                                criteria={matrixCriteria}
                                                scores={scores}
                                            />
                                        ) : (
                                            <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground leading-relaxed">
                                                {radarEmptyExplanation}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                            {criteria.length > 0 && items.length > 0 && (
                                <Card className="border-dashed bg-muted/20">
                                    <CardContent className="py-4 text-sm text-muted-foreground">
                                        <strong className="text-foreground">Nasıl okunur?</strong> Çubuk grafik genel skoru özetler;
                                        radar aynı kriterlerde alternatiflerin profilini üst üste gösterir. Matris sekmesinde hücre
                                        hücre düzenleme yapabilirsiniz.
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* Alternatifler */}
                        <TabsContent value="items" className="space-y-4 mt-4">
                            <div className="flex flex-wrap justify-between items-start gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold tracking-tight">Alternatifler</h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Genel skora göre sıralı. Satırdaki göz ile tüm alanları açın.
                                    </p>
                                </div>
                                <Button size="sm" onClick={handleAddItem}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Alternatif ekle
                                </Button>
                            </div>

                            {newItem && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-base">Yeni Alternatif Ekle</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Tabs defaultValue="basic" className="w-full">
                                            <TabsList className="!inline-flex !h-auto w-full min-w-0 flex-wrap items-stretch justify-start gap-1.5 rounded-md bg-muted p-1.5">
                                                <TabsTrigger value="basic" className="shrink-0 flex-none px-3 py-2 text-sm">
                                                    Temel
                                                </TabsTrigger>
                                                <TabsTrigger value="cost" className="shrink-0 flex-none px-3 py-2 text-sm">
                                                    Maliyet
                                                </TabsTrigger>
                                                <TabsTrigger value="quality" className="shrink-0 flex-none px-3 py-2 text-sm">
                                                    Kalite
                                                </TabsTrigger>
                                                <TabsTrigger value="service" className="shrink-0 flex-none px-3 py-2 text-sm">
                                                    Hizmet
                                                </TabsTrigger>
                                                <TabsTrigger value="other" className="shrink-0 flex-none px-3 py-2 text-sm">
                                                    Diğer
                                                </TabsTrigger>
                                            </TabsList>

                                            {/* Temel Bilgiler */}
                                            <TabsContent value="basic" className="space-y-4 mt-4">
                                                <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
                                                    <p className="text-sm text-muted-foreground">
                                                        <strong>ℹ️ Bilgi:</strong> Sadece "Alternatif Adı" zorunludur. Diğer tüm alanlar opsiyoneldir.
                                                    </p>
                                                </div>
                                                
                                                <div>
                                                    <LabelWithTooltip tooltip="Karşılaştırma için benzersiz bir isim verin" required>
                                                        Alternatif adı
                                                    </LabelWithTooltip>
                                                    <Input
                                                        value={newItem.item_name}
                                                        onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                                                        placeholder="Örn: Çözüm A, tedarikçi teklifi"
                                                    />
                                                </div>

                                                <div>
                                                    <LabelWithTooltip tooltip="Model, seri veya versiyon bilgisi">
                                                        Model / seri no
                                                    </LabelWithTooltip>
                                                    <Input
                                                        value={newItem.model_number}
                                                        onChange={(e) => setNewItem({...newItem, model_number: e.target.value})}
                                                        placeholder="İsteğe bağlı"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <LabelWithTooltip tooltip="Alternatif hakkında detaylı açıklama, özellikler ve notlar">
                                                        Açıklama
                                                    </LabelWithTooltip>
                                                    <Textarea
                                                        value={newItem.description}
                                                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                                                        rows={4}
                                                        placeholder="Alternatif hakkında detaylı açıklama, özellikler, avantajlar ve dezavantajlar..."
                                                    />
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ürün/hizmetin kategorisi veya tipi">
                                                            Kategori/Tip
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.category || ''}
                                                            onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                                                            placeholder="Örn: Endüstriyel, Ticari, Profesyonel"
                                                        />
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ürün/hizmetin menşei veya üretim yeri">
                                                            Menşei/Üretim Yeri
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.origin || ''}
                                                            onChange={(e) => setNewItem({...newItem, origin: e.target.value})}
                                                            placeholder="Örn: Türkiye, Almanya, Çin"
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            {/* Maliyet Bilgileri */}
                                            <TabsContent value="cost" className="space-y-4 mt-4">
                                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                                    <p className="text-sm text-blue-900 dark:text-blue-100">
                                                        <strong>💡 İpucu:</strong> Tüm maliyet alanları opsiyoneldir. Sadece mevcut bilgileri girin.
                                                    </p>
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ürün/hizmetin birim fiyatı (satın alma fiyatı)">
                                                            Birim Fiyat
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={newItem.unit_price}
                                                            onChange={(e) => setNewItem({...newItem, unit_price: e.target.value})}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Para Birimi</Label>
                                                        <Select
                                                            value={newItem.currency}
                                                            onValueChange={(value) => setNewItem({...newItem, currency: value})}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="TRY">TRY</SelectItem>
                                                                <SelectItem value="USD">USD</SelectItem>
                                                                <SelectItem value="EUR">EUR</SelectItem>
                                                                <SelectItem value="GBP">GBP</SelectItem>
                                                                <SelectItem value="JPY">JPY</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Tek seferde sipariş edilebilecek minimum miktar">
                                                            Minimum Sipariş Miktarı
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            value={newItem.minimum_order_quantity}
                                                            onChange={(e) => setNewItem({...newItem, minimum_order_quantity: e.target.value})}
                                                            placeholder="Adet"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <LabelWithTooltip tooltip="TCO (Total Cost of Ownership): Ürün/hizmetin satın alma fiyatı dahil olmak üzere, tüm yaşam döngüsü boyunca oluşan tüm maliyetlerin toplamıdır. Satın alma, kurulum, bakım, onarım, enerji, eğitim ve hurda maliyetlerini içerir.">
                                                            Toplam Sahiplik Maliyeti (TCO)
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={newItem.total_cost_of_ownership}
                                                            onChange={(e) => setNewItem({...newItem, total_cost_of_ownership: e.target.value})}
                                                            placeholder="0.00"
                                                        />
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Satın alma + kurulum + bakım + enerji + diğer maliyetler
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="ROI (Return on Investment): Yatırım getirisi, bir yatırımdan elde edilen kârın yatırım maliyetine oranıdır. Formül: ((Kazanç - Maliyet) / Maliyet) × 100. Örneğin, %150 ROI, yatırılan her 1 TL için 1.5 TL kazanç anlamına gelir.">
                                                            Yatırım Getirisi (ROI) %
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={newItem.roi_percentage}
                                                            onChange={(e) => setNewItem({...newItem, roi_percentage: e.target.value})}
                                                            placeholder="0.00"
                                                        />
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Örnek: %150 = Yatırılan 1 TL için 1.5 TL kazanç
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ödeme koşulları: Peşin, vadeli (30/60/90 gün), taksitli ödeme gibi ödeme seçenekleri">
                                                            Ödeme Koşulları
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.payment_terms}
                                                            onChange={(e) => setNewItem({...newItem, payment_terms: e.target.value})}
                                                            placeholder="Örn: Peşin, 30 gün vadeli, %2 iskonto"
                                                        />
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Tedarik süresi: Siparişten teslimata kadar geçen süre">
                                                            Tedarik Süresi (Gün)
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            value={newItem.lead_time_days}
                                                            onChange={(e) => setNewItem({...newItem, lead_time_days: e.target.value})}
                                                            placeholder="Gün"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div>
                                                        <LabelWithTooltip tooltip="Yıllık bakım maliyeti (ortalama)">
                                                            Yıllık Bakım Maliyeti
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={newItem.maintenance_cost}
                                                            onChange={(e) => setNewItem({...newItem, maintenance_cost: e.target.value})}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Bakım yapılması gereken sıklık (ay cinsinden)">
                                                            Bakım Sıklığı (Ay)
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            value={newItem.maintenance_frequency_months}
                                                            onChange={(e) => setNewItem({...newItem, maintenance_frequency_months: e.target.value})}
                                                            placeholder="Ay"
                                                        />
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Kurulum/uygulama için gereken ek maliyetler">
                                                            Kurulum Maliyeti
                                                        </LabelWithTooltip>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={newItem.implementation_cost || ''}
                                                            onChange={(e) => setNewItem({...newItem, implementation_cost: e.target.value})}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            {/* Kalite ve Performans */}
                                            <TabsContent value="quality" className="space-y-4 mt-4">
                                                <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                                    <p className="text-sm text-green-900 dark:text-green-100">
                                                        <strong>📊 Skorlama:</strong> Tüm skorlar 0-100 arası değer alır. 100 en yüksek, 0 en düşük performansı temsil eder. Boş bırakabilirsiniz.
                                                    </p>
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <div>
                                                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Temel Kalite Kriterleri</h4>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div>
                                                                <LabelWithTooltip tooltip="Ürün/hizmetin genel kalite seviyesi. Malzeme kalitesi, işçilik, standartlara uygunluk gibi faktörleri değerlendirin.">
                                                                    Kalite Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.quality_score}
                                                                    onChange={(e) => setNewItem({...newItem, quality_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                            <div>
                                                                <LabelWithTooltip tooltip="Ürün/hizmetin performans seviyesi. Hız, verimlilik, kapasite, çıktı kalitesi gibi faktörleri değerlendirin.">
                                                                    Performans Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.performance_score}
                                                                    onChange={(e) => setNewItem({...newItem, performance_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                            <div>
                                                                <LabelWithTooltip tooltip="Ürün/hizmetin güvenilirlik seviyesi. Arıza sıklığı, dayanıklılık, uzun ömür, bakım gereksinimi gibi faktörleri değerlendirin.">
                                                                    Güvenilirlik Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.reliability_score}
                                                                    onChange={(e) => setNewItem({...newItem, reliability_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Çevresel ve Sürdürülebilirlik</h4>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div>
                                                                <LabelWithTooltip tooltip="Enerji tüketimi ve verimlilik seviyesi. Düşük enerji tüketimi, yüksek verimlilik = yüksek skor.">
                                                                    Enerji Verimliliği (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.energy_efficiency_score}
                                                                    onChange={(e) => setNewItem({...newItem, energy_efficiency_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                            <div>
                                                                <LabelWithTooltip tooltip="Çevresel etki seviyesi. Karbon ayak izi, geri dönüşüm, atık miktarı, sürdürülebilirlik gibi faktörleri değerlendirin.">
                                                                    Çevresel Etki Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.environmental_impact_score}
                                                                    onChange={(e) => setNewItem({...newItem, environmental_impact_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                            <div>
                                                                <LabelWithTooltip tooltip="Ürün/hizmetin kullanım kolaylığı. Kullanıcı dostu arayüz, basit kurulum, anlaşılır dokümantasyon gibi faktörleri değerlendirin.">
                                                                    Kullanılabilirlik Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.ease_of_use_score}
                                                                    onChange={(e) => setNewItem({...newItem, ease_of_use_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Teknik Özellikler</h4>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div>
                                                                <LabelWithTooltip tooltip="Büyüme ve genişleme potansiyeli. Artan ihtiyaçlara uyum sağlama, modüler yapı, yükseltilebilirlik gibi faktörleri değerlendirin.">
                                                                    Ölçeklenebilirlik Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.scalability_score}
                                                                    onChange={(e) => setNewItem({...newItem, scalability_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                            <div>
                                                                <LabelWithTooltip tooltip="Mevcut sistemler ve standartlarla uyumluluk seviyesi. Entegrasyon kolaylığı, uyumluluk, standartlara uygunluk gibi faktörleri değerlendirin.">
                                                                    Uyumluluk Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.compatibility_score}
                                                                    onChange={(e) => setNewItem({...newItem, compatibility_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                            <div>
                                                                <LabelWithTooltip tooltip="Yenilikçilik ve teknolojik gelişmişlik seviyesi. Yeni teknolojiler, inovatif özellikler, gelecek potansiyeli gibi faktörleri değerlendirin.">
                                                                    İnovasyon Skoru (0-100)
                                                                </LabelWithTooltip>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    value={newItem.innovation_score}
                                                                    onChange={(e) => setNewItem({...newItem, innovation_score: e.target.value})}
                                                                    placeholder="0-100"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div>
                                                            <LabelWithTooltip tooltip="Ürün/hizmetin dayanıklılık ve uzun ömür seviyesi">
                                                                Dayanıklılık Skoru (0-100)
                                                            </LabelWithTooltip>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={newItem.durability_score || ''}
                                                                onChange={(e) => setNewItem({...newItem, durability_score: e.target.value})}
                                                                placeholder="0-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <LabelWithTooltip tooltip="Ürün/hizmetin güvenlik seviyesi ve risk faktörleri">
                                                                Güvenlik Skoru (0-100)
                                                            </LabelWithTooltip>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={newItem.safety_score || ''}
                                                                onChange={(e) => setNewItem({...newItem, safety_score: e.target.value})}
                                                                placeholder="0-100"
                                                            />
                                                        </div>
                                                        <div>
                                                            <LabelWithTooltip tooltip="Ürün/hizmetin standartlara ve sertifikalara uygunluk seviyesi">
                                                                Standart Uygunluk Skoru (0-100)
                                                            </LabelWithTooltip>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="100"
                                                                value={newItem.standards_compliance_score || ''}
                                                                onChange={(e) => setNewItem({...newItem, standards_compliance_score: e.target.value})}
                                                                placeholder="0-100"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            {/* Satış Sonrası Hizmet */}
                                            <TabsContent value="service" className="space-y-3 mt-4">
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div>
                                                        <Label>Satış Sonrası Hizmet Skoru (0-100)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                            value={newItem.after_sales_service_score}
                                                            onChange={(e) => setNewItem({...newItem, after_sales_service_score: e.target.value})}
                                                            placeholder="0-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Teknik Destek Skoru (0-100)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                            value={newItem.technical_support_score}
                                                            onChange={(e) => setNewItem({...newItem, technical_support_score: e.target.value})}
                                                            placeholder="0-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Dokümantasyon Kalitesi (0-100)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                            value={newItem.documentation_quality_score}
                                                            onChange={(e) => setNewItem({...newItem, documentation_quality_score: e.target.value})}
                                                            placeholder="0-100"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div>
                                                        <Label>Garanti Süresi (Ay)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newItem.warranty_period_months}
                                                            onChange={(e) => setNewItem({...newItem, warranty_period_months: e.target.value})}
                                                            placeholder="Ay"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Destek Erişilebilirliği</Label>
                                                        <Select
                                                            value={newItem.support_availability}
                                                            onValueChange={(value) => setNewItem({...newItem, support_availability: value})}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Seçin" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="7/24">7/24</SelectItem>
                                                                <SelectItem value="İş Saatleri">İş Saatleri</SelectItem>
                                                                <SelectItem value="Hafta İçi">Hafta İçi</SelectItem>
                                                                <SelectItem value="Sınırlı">Sınırlı</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label>Pazar İtibarı Skoru (0-100)</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                            value={newItem.market_reputation_score}
                                                            onChange={(e) => setNewItem({...newItem, market_reputation_score: e.target.value})}
                                                            placeholder="0-100"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <Label>Müşteri Referans Sayısı</Label>
                                                        <Input
                                                            type="number"
                                                            value={newItem.customer_references_count}
                                                            onChange={(e) => setNewItem({...newItem, customer_references_count: e.target.value})}
                                                            placeholder="Adet"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Risk Seviyesi</Label>
                                                        <Select
                                                            value={newItem.risk_level}
                                                            onValueChange={(value) => setNewItem({...newItem, risk_level: value})}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Seçin" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Düşük">Düşük</SelectItem>
                                                                <SelectItem value="Orta">Orta</SelectItem>
                                                                <SelectItem value="Yüksek">Yüksek</SelectItem>
                                                                <SelectItem value="Kritik">Kritik</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            {/* Diğer Bilgiler */}
                                            <TabsContent value="other" className="space-y-3 mt-4">
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div>
                                                        <Label>Teslimat Süresi (Gün)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newItem.delivery_time_days}
                                                            onChange={(e) => setNewItem({...newItem, delivery_time_days: e.target.value})}
                                                            placeholder="Gün"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Uygulama Süresi (Gün)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newItem.implementation_time_days}
                                                            onChange={(e) => setNewItem({...newItem, implementation_time_days: e.target.value})}
                                                            placeholder="Gün"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Eğitim Gereksinimi (Saat)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newItem.training_required_hours}
                                                            onChange={(e) => setNewItem({...newItem, training_required_hours: e.target.value})}
                                                            placeholder="Saat"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <Label>Bakım Maliyeti</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={newItem.maintenance_cost}
                                                            onChange={(e) => setNewItem({...newItem, maintenance_cost: e.target.value})}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Bakım Sıklığı (Ay)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newItem.maintenance_frequency_months}
                                                            onChange={(e) => setNewItem({...newItem, maintenance_frequency_months: e.target.value})}
                                                            placeholder="Ay"
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                        <div className="flex gap-2 mt-4 pt-4 border-t">
                                            <Button size="sm" onClick={handleSaveNewItem}>
                                                <Check className="mr-2 h-4 w-4" />
                                                Kaydet
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setNewItem(null)}>
                                                İptal
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {itemsSortedByScore.length > 0 ? (
                                <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/60 hover:bg-muted/60 border-b">
                                                <TableHead className="w-11 text-center font-semibold">#</TableHead>
                                                <TableHead className="min-w-[200px] font-semibold">Alternatif</TableHead>
                                                <TableHead className="text-right whitespace-nowrap font-semibold">Birim fiyat</TableHead>
                                                <TableHead className="text-center whitespace-nowrap font-semibold">Kalite</TableHead>
                                                <TableHead className="text-center whitespace-nowrap font-semibold">Teslimat</TableHead>
                                                <TableHead className="text-right whitespace-nowrap font-semibold">Toplam skor</TableHead>
                                                <TableHead className="w-[100px] text-right font-semibold">İşlem</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {itemsSortedByScore.map((item, idx) => (
                                                <TableRow
                                                    key={item.id}
                                                    className={idx === 0 ? 'bg-primary/[0.06]' : ''}
                                                >
                                                    <TableCell className="text-center text-muted-foreground tabular-nums font-medium">
                                                        {idx + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-start gap-2">
                                                            {item.is_recommended && (
                                                                <Award className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-semibold leading-tight">{item.item_name}</div>
                                                                {item.model_number && (
                                                                    <div className="text-xs text-muted-foreground mt-0.5">{item.model_number}</div>
                                                                )}
                                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                                    {item.is_current_solution && (
                                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                                                            Mevcut
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums">
                                                        {item.unit_price != null && item.unit_price !== ''
                                                            ? new Intl.NumberFormat('tr-TR', {
                                                                  style: 'currency',
                                                                  currency: item.currency || 'TRY',
                                                              }).format(item.unit_price)
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-center text-sm tabular-nums">
                                                        {item.quality_score != null && item.quality_score !== '' ? item.quality_score : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-center text-sm tabular-nums">
                                                        {item.delivery_time_days ?? item.lead_time_days ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="inline-flex font-mono text-sm font-semibold tabular-nums px-2 py-1 rounded-md bg-muted">
                                                            {itemScores[item.id]?.average != null
                                                                ? itemScores[item.id].average.toFixed(1)
                                                                : '—'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-0.5">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8"
                                                                onClick={() => setSelectedItemDetail(item)}
                                                                title="Detay"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                title="Sil"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <Card className="border-dashed">
                                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                        Henüz alternatif yok. Yukarıdan ekleyin.
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* Kriterler */}
                        <TabsContent value="criteria" className="space-y-4 mt-4">
                            <div className="flex flex-wrap justify-between items-start gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold tracking-tight">Kriterler</h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Manuel kriter ekleyebilir veya alternatif verilerinden otomatik üretilenleri matriste kullanabilirsiniz.
                                    </p>
                                </div>
                                <Button size="sm" onClick={handleAddCriterion}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Kriter ekle
                                </Button>
                            </div>

                            {newCriterion && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-base">Yeni Kriter</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div>
                                                <Label>Kriter Adı *</Label>
                                                <Input
                                                    value={newCriterion.criterion_name}
                                                    onChange={(e) => setNewCriterion({...newCriterion, criterion_name: e.target.value})}
                                                    placeholder="Örn: Maliyet"
                                                />
                                            </div>
                                            <div>
                                                <Label>Kategori</Label>
                                                <Select
                                                    value={newCriterion.category || '__none__'}
                                                    onValueChange={(v) =>
                                                        setNewCriterion({ ...newCriterion, category: v === '__none__' ? '' : v })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seçin" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">—</SelectItem>
                                                        {CRITERION_CATEGORY_OPTIONS.map((c) => (
                                                            <SelectItem key={c} value={c}>
                                                                {c}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Açıklama</Label>
                                            <Textarea
                                                value={newCriterion.description}
                                                onChange={(e) => setNewCriterion({...newCriterion, description: e.target.value})}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div>
                                                <Label>Ağırlık (%) *</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={newCriterion.weight}
                                                    onChange={(e) => setNewCriterion({...newCriterion, weight: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <Label>Ölçüm birimi</Label>
                                                <Select
                                                    value={newCriterion.measurement_unit || '__none__'}
                                                    onValueChange={(v) =>
                                                        setNewCriterion({
                                                            ...newCriterion,
                                                            measurement_unit: v === '__none__' ? '' : v,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seçin" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">—</SelectItem>
                                                        {MEASUREMENT_UNIT_OPTIONS.map((u) => (
                                                            <SelectItem key={u} value={u}>
                                                                {u}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleSaveNewCriterion}>
                                                <Check className="mr-2 h-4 w-4" />
                                                Kaydet
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setNewCriterion(null)}>
                                                İptal
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {editingCriterion && (
                                <Card className="border-2 border-amber-500/60">
                                    <CardHeader>
                                        <CardTitle className="text-base">Kriteri düzenle</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div>
                                                <Label>Kriter adı *</Label>
                                                <Input
                                                    value={editingCriterion.criterion_name}
                                                    onChange={(e) =>
                                                        setEditingCriterion({
                                                            ...editingCriterion,
                                                            criterion_name: e.target.value,
                                                        })
                                                    }
                                                    placeholder="Örn: Maliyet"
                                                />
                                            </div>
                                            <div>
                                                <Label>Kategori</Label>
                                                <Select
                                                    value={editingCriterion.category || '__none__'}
                                                    onValueChange={(v) =>
                                                        setEditingCriterion({
                                                            ...editingCriterion,
                                                            category: v === '__none__' ? '' : v,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seçin" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">—</SelectItem>
                                                        {CRITERION_CATEGORY_OPTIONS.map((c) => (
                                                            <SelectItem key={c} value={c}>
                                                                {c}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Açıklama</Label>
                                            <Textarea
                                                value={editingCriterion.description}
                                                onChange={(e) =>
                                                    setEditingCriterion({
                                                        ...editingCriterion,
                                                        description: e.target.value,
                                                    })
                                                }
                                                rows={2}
                                            />
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div>
                                                <Label>Ağırlık (%) *</Label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={editingCriterion.weight}
                                                    onChange={(e) =>
                                                        setEditingCriterion({
                                                            ...editingCriterion,
                                                            weight: e.target.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <Label>Ölçüm birimi</Label>
                                                <Select
                                                    value={editingCriterion.measurement_unit || '__none__'}
                                                    onValueChange={(v) =>
                                                        setEditingCriterion({
                                                            ...editingCriterion,
                                                            measurement_unit: v === '__none__' ? '' : v,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seçin" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">—</SelectItem>
                                                        {MEASUREMENT_UNIT_OPTIONS.map((u) => (
                                                            <SelectItem key={u} value={u}>
                                                                {u}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleSaveEditCriterion}>
                                                <Save className="mr-2 h-4 w-4" />
                                                Kaydet
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingCriterion(null)}>
                                                İptal
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <div className="space-y-3">
                                {criteria.map((criterion) => (
                                    <Card key={criterion.id}>
                                        <CardContent className="py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <h4 className="font-semibold">{criterion.criterion_name}</h4>
                                                        <Badge variant="secondary">
                                                            Ağırlık: %{criterion.weight}
                                                        </Badge>
                                                        {criterion.category && (
                                                            <Badge variant="outline">{criterion.category}</Badge>
                                                        )}
                                                    </div>
                                                    {criterion.description && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {criterion.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleStartEditCriterion(criterion)}
                                                    >
                                                        <Edit className="h-4 w-4 mr-1" />
                                                        Düzenle
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteCriterion(criterion.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* Karşılaştırma Matrisi */}
                        <TabsContent value="matrix" className="mt-4 space-y-2">
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight">Puan matrisi</h3>
                                <p className="text-sm text-muted-foreground">
                                    Kriter başına 0–100. Otomatik kriterlerde skorlar veriden gelir; manuel kriter eklediyseniz buradan düzenleyin.
                                </p>
                            </div>
                            {items.length === 0 || matrixCriteria.length === 0 ? (
                                <Card className="border-dashed">
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">En az bir alternatif ve bir kriter gerekli.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="rounded-lg border bg-card shadow-sm min-w-0">
                                    <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[min(78vh,780px)] overscroll-x-contain touch-pan-x">
                                        <Table className="min-w-max w-full">
                                            <TableHeader>
                                                <TableRow className="bg-muted/60 hover:bg-muted/60">
                                                    <TableHead className="sticky left-0 z-20 min-w-[200px] bg-muted/95 backdrop-blur border-r font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                                        Alternatif
                                                    </TableHead>
                                                    {matrixCriteria.map((criterion) => (
                                                        <TableHead key={criterion.id} className="text-center min-w-[120px] whitespace-normal font-semibold">
                                                            <span className="text-foreground">{criterion.criterion_name}</span>
                                                            <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                                                                %{criterion.weight}
                                                            </span>
                                                        </TableHead>
                                                    ))}
                                                    <TableHead className="text-center min-w-[100px] bg-muted/80 font-semibold border-l">
                                                        Toplam
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {itemsSortedByScore.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="sticky left-0 z-10 border-r bg-background font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                                            {item.item_name}
                                                        </TableCell>
                                                        {matrixCriteria.map((criterion) => {
                                                            const key = `${item.id}_${criterion.id}`;
                                                            const score = scores[key];
                                                            return (
                                                                <TableCell key={criterion.id} className="text-center p-2">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        step="0.1"
                                                                        value={score?.normalized_score ?? ''}
                                                                        onChange={(e) =>
                                                                            handleScoreChange(
                                                                                item.id,
                                                                                criterion.id,
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        className="h-9 w-full min-w-[4.5rem] max-w-[6rem] mx-auto text-center tabular-nums"
                                                                    />
                                                                </TableCell>
                                                            );
                                                        })}
                                                        <TableCell className="text-center bg-muted/30 border-l font-mono font-semibold tabular-nums">
                                                            {itemScores[item.id]?.average != null
                                                                ? itemScores[item.id].average.toFixed(1)
                                                                : '—'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Analiz & Sonuçlar */}
                        <TabsContent value="analysis" className="space-y-4 mt-4">
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight">Sıralama ve avantaj / dezavantaj</h3>
                                <p className="text-sm text-muted-foreground">
                                    Çubuk ve radar grafikleri için <strong className="text-foreground">Özet &amp; grafikler</strong>{' '}
                                    sekmesini kullanın. Bu sekmede tablo ve metin notları düzenlenir.
                                </p>
                            </div>
                            {itemsSortedByScore.length > 0 ? (
                                <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/60 hover:bg-muted/60">
                                                <TableHead className="w-14 text-center font-semibold">#</TableHead>
                                                <TableHead className="font-semibold">Alternatif</TableHead>
                                                <TableHead className="text-right font-semibold">Skor</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {itemsSortedByScore.map((item, index) => (
                                                <TableRow key={item.id} className={index === 0 ? 'bg-primary/5' : ''}>
                                                    <TableCell className="text-center font-medium text-muted-foreground tabular-nums">
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-medium">{item.item_name}</span>
                                                        {item.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                                                        {itemScores[item.id]?.average != null
                                                            ? itemScores[item.id].average.toFixed(1)
                                                            : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <Card className="border-dashed">
                                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                        Henüz alternatif yok.
                                    </CardContent>
                                </Card>
                            )}

                            {/* Avantaj/Dezavantaj Analizi */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Avantaj & Dezavantaj Analizi</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        {items && items.length > 0 ? items.map((item) => (
                                            <div key={item.id} className="border-b last:border-0 pb-6 last:pb-0">
                                                <h4 className="font-semibold mb-3">{item.item_name}</h4>
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h5 className="text-sm font-medium text-green-600 flex items-center gap-1">
                                                                <ThumbsUp className="h-4 w-4" />
                                                                Avantajlar
                                                            </h5>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleAddProCon(item.id, 'Avantaj')}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {(prosConsData[item.id]?.pros || []).map((pro) => (
                                                                <li
                                                                    key={pro.id}
                                                                    className="flex items-start gap-2 text-sm group"
                                                                >
                                                                    <span className="text-green-500">•</span>
                                                                    <span className="flex-1">{pro.description}</span>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                                                        onClick={() => handleDeleteProCon(pro.id, item.id, 'Avantaj')}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </li>
                                                            ))}
                                                            {(!prosConsData[item.id]?.pros || prosConsData[item.id].pros.length === 0) && (
                                                                <li className="text-sm text-muted-foreground italic">
                                                                    Henüz avantaj eklenmemiş
                                                                </li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h5 className="text-sm font-medium text-red-600 flex items-center gap-1">
                                                                <ThumbsDown className="h-4 w-4" />
                                                                Dezavantajlar
                                                            </h5>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleAddProCon(item.id, 'Dezavantaj')}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {(prosConsData[item.id]?.cons || []).map((con) => (
                                                                <li
                                                                    key={con.id}
                                                                    className="flex items-start gap-2 text-sm group"
                                                                >
                                                                    <span className="text-red-500">•</span>
                                                                    <span className="flex-1">{con.description}</span>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                                                        onClick={() => handleDeleteProCon(con.id, item.id, 'Dezavantaj')}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </li>
                                                            ))}
                                                            {(!prosConsData[item.id]?.cons || prosConsData[item.id].cons.length === 0) && (
                                                                <li className="text-sm text-muted-foreground italic">
                                                                    Henüz dezavantaj eklenmemiş
                                                                </li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="text-center text-muted-foreground py-8">
                                                Henüz alternatif eklenmemiş.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                    </div>
                    </div>
                )}
                </>
    );

    return (
        <>
            {!embedded ? (
                <Dialog open={isOpen} onOpenChange={onClose}>
                    <DialogContent
                        hideCloseButton
                        className="!fixed !inset-0 !left-0 !top-0 z-[60] !m-0 flex h-[100dvh] !max-h-[100dvh] w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 shadow-xl sm:!max-h-[100dvh]"
                    >
                        <DialogHeader className="sr-only">
                            <DialogTitle>Benchmark karşılaştırma</DialogTitle>
                        </DialogHeader>

                        <div className="relative bg-gradient-to-r from-primary to-blue-800 px-4 py-4 pr-3 sm:px-6 sm:py-5 text-primary-foreground shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
                            <div className="space-y-1 min-w-0 flex-1 pr-2">
                                <p className="text-[10px] uppercase tracking-widest opacity-90">Benchmark karşılaştırması</p>
                                <h2 className="text-xl font-bold tracking-tight truncate">{benchmark.title}</h2>
                                <p className="text-xs font-mono opacity-90">{benchmark.benchmark_number}</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleDownloadReport}
                                    disabled={!benchmark}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Rapor indir
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 shrink-0 rounded-full border border-white/40 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                                    onClick={() => onClose?.()}
                                    aria-label="Kapat"
                                >
                                    <X className="h-5 w-5" strokeWidth={2.25} />
                                </Button>
                            </div>
                        </div>
                        {inner}
                    </DialogContent>
                </Dialog>
            ) : (
                <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                    <div className="mb-2 flex shrink-0 flex-wrap items-center justify-end gap-2 border-b pb-3">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleDownloadReport}
                            disabled={!benchmark}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Karşılaştırma raporu
                        </Button>
                    </div>
                    {inner}
                </div>
            )}

            {selectedItemDetail && (
                <Dialog open={!!selectedItemDetail} onOpenChange={() => setSelectedItemDetail(null)}>
                    <DialogContent className="!fixed !inset-0 !left-0 !top-0 z-[70] !m-0 flex h-[100dvh] !max-h-[100dvh] w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 shadow-xl sm:!max-h-[100dvh]">
                        <div className="shrink-0 border-b bg-muted/40 px-6 py-4">
                            <DialogHeader className="space-y-1">
                                <DialogTitle className="text-lg font-semibold leading-tight pr-8">
                                    {selectedItemDetail.item_name}
                                </DialogTitle>
                                {selectedItemDetail.model_number && (
                                    <p className="text-sm text-muted-foreground font-mono">{selectedItemDetail.model_number}</p>
                                )}
                            </DialogHeader>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
                            <div className="space-y-6">
                                {/* Temel Bilgiler */}
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Temel</h3>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {selectedItemDetail.category && (
                                            <div>
                                                <Label className="text-muted-foreground">Kategori</Label>
                                                <p className="font-medium">{selectedItemDetail.category}</p>
                                            </div>
                                        )}
                                        {selectedItemDetail.origin && (
                                            <div>
                                                <Label className="text-muted-foreground">Menşei</Label>
                                                <p className="font-medium">{selectedItemDetail.origin}</p>
                                            </div>
                                        )}
                                    </div>
                                    {selectedItemDetail.description && (
                                        <div className="mt-3">
                                            <Label className="text-muted-foreground">Açıklama</Label>
                                            <p className="text-sm mt-1">{selectedItemDetail.description}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Maliyet Bilgileri */}
                                {(selectedItemDetail.unit_price || selectedItemDetail.total_cost_of_ownership || selectedItemDetail.roi_percentage) && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Maliyet Bilgileri</h3>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {selectedItemDetail.unit_price && (
                                                <div className="p-3 bg-muted/50 rounded-lg">
                                                    <Label className="text-muted-foreground">Birim Fiyat</Label>
                                                    <p className="font-semibold text-lg">
                                                        {new Intl.NumberFormat('tr-TR', {
                                                            style: 'currency',
                                                            currency: selectedItemDetail.currency || 'TRY'
                                                        }).format(selectedItemDetail.unit_price)}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedItemDetail.total_cost_of_ownership && (
                                                <div className="p-3 bg-muted/50 rounded-lg">
                                                    <Label className="text-muted-foreground">TCO (Toplam Sahiplik Maliyeti)</Label>
                                                    <p className="font-semibold text-lg">
                                                        {new Intl.NumberFormat('tr-TR', {
                                                            style: 'currency',
                                                            currency: selectedItemDetail.currency || 'TRY'
                                                        }).format(selectedItemDetail.total_cost_of_ownership)}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedItemDetail.roi_percentage && (
                                                <div className="p-3 bg-muted/50 rounded-lg">
                                                    <Label className="text-muted-foreground">ROI (Yatırım Getirisi)</Label>
                                                    <p className="font-semibold text-lg">{selectedItemDetail.roi_percentage}%</p>
                                                </div>
                                            )}
                                        </div>
                                        {selectedItemDetail.minimum_order_quantity && (
                                            <div className="mt-3">
                                                <Label className="text-muted-foreground">Minimum Sipariş Miktarı</Label>
                                                <p className="font-medium">{selectedItemDetail.minimum_order_quantity} adet</p>
                                            </div>
                                        )}
                                        {selectedItemDetail.payment_terms && (
                                            <div className="mt-3">
                                                <Label className="text-muted-foreground">Ödeme Koşulları</Label>
                                                <p className="font-medium">{selectedItemDetail.payment_terms}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Kalite ve Performans */}
                                {(selectedItemDetail.quality_score || selectedItemDetail.performance_score || selectedItemDetail.reliability_score) && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Kalite ve Performans</h3>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {selectedItemDetail.quality_score && (
                                                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                                    <Label className="text-muted-foreground">Kalite Skoru</Label>
                                                    <p className="font-semibold text-lg">{selectedItemDetail.quality_score}/100</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.performance_score && (
                                                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                                    <Label className="text-muted-foreground">Performans Skoru</Label>
                                                    <p className="font-semibold text-lg">{selectedItemDetail.performance_score}/100</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.reliability_score && (
                                                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                                    <Label className="text-muted-foreground">Güvenilirlik Skoru</Label>
                                                    <p className="font-semibold text-lg">{selectedItemDetail.reliability_score}/100</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-3 mt-3">
                                            {selectedItemDetail.durability_score && (
                                                <div>
                                                    <Label className="text-muted-foreground">Dayanıklılık Skoru</Label>
                                                    <p className="font-medium">{selectedItemDetail.durability_score}/100</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.safety_score && (
                                                <div>
                                                    <Label className="text-muted-foreground">Güvenlik Skoru</Label>
                                                    <p className="font-medium">{selectedItemDetail.safety_score}/100</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.standards_compliance_score && (
                                                <div>
                                                    <Label className="text-muted-foreground">Standart Uygunluk Skoru</Label>
                                                    <p className="font-medium">{selectedItemDetail.standards_compliance_score}/100</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Hizmet Bilgileri */}
                                {(selectedItemDetail.after_sales_service_score || selectedItemDetail.technical_support_score || selectedItemDetail.warranty_period_months) && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Satış Sonrası Hizmet</h3>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {selectedItemDetail.after_sales_service_score && (
                                                <div>
                                                    <Label className="text-muted-foreground">Satış Sonrası Hizmet Skoru</Label>
                                                    <p className="font-medium">{selectedItemDetail.after_sales_service_score}/100</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.technical_support_score && (
                                                <div>
                                                    <Label className="text-muted-foreground">Teknik Destek Skoru</Label>
                                                    <p className="font-medium">{selectedItemDetail.technical_support_score}/100</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.warranty_period_months && (
                                                <div>
                                                    <Label className="text-muted-foreground">Garanti Süresi</Label>
                                                    <p className="font-medium">{selectedItemDetail.warranty_period_months} ay</p>
                                                </div>
                                            )}
                                        </div>
                                        {selectedItemDetail.support_availability && (
                                            <div className="mt-3">
                                                <Label className="text-muted-foreground">Destek Erişilebilirliği</Label>
                                                <p className="font-medium">{selectedItemDetail.support_availability}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Operasyonel Bilgiler */}
                                {(selectedItemDetail.delivery_time_days || selectedItemDetail.implementation_time_days || selectedItemDetail.training_required_hours) && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Operasyonel Bilgiler</h3>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {selectedItemDetail.delivery_time_days && (
                                                <div>
                                                    <Label className="text-muted-foreground">Teslimat Süresi</Label>
                                                    <p className="font-medium">{selectedItemDetail.delivery_time_days} gün</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.implementation_time_days && (
                                                <div>
                                                    <Label className="text-muted-foreground">Uygulama Süresi</Label>
                                                    <p className="font-medium">{selectedItemDetail.implementation_time_days} gün</p>
                                                </div>
                                            )}
                                            {selectedItemDetail.training_required_hours && (
                                                <div>
                                                    <Label className="text-muted-foreground">Eğitim Gereksinimi</Label>
                                                    <p className="font-medium">{selectedItemDetail.training_required_hours} saat</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Avantaj / Dezavantaj (otomatik + kayıtlı) */}
                                {(prosConsData[selectedItemDetail.id]?.pros?.length > 0 ||
                                    prosConsData[selectedItemDetail.id]?.cons?.length > 0) && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Avantaj ve dezavantaj</h3>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="rounded-lg border border-green-200/80 bg-green-50/80 p-4 dark:border-green-900 dark:bg-green-950/40">
                                                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-200">
                                                    <ThumbsUp className="h-4 w-4" />
                                                    Avantajlar
                                                </h4>
                                                <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground">
                                                    {(prosConsData[selectedItemDetail.id]?.pros || []).map((pro) => (
                                                        <li key={pro.id}>{pro.description}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="rounded-lg border border-red-200/80 bg-red-50/80 p-4 dark:border-red-900 dark:bg-red-950/40">
                                                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200">
                                                    <ThumbsDown className="h-4 w-4" />
                                                    Dezavantajlar
                                                </h4>
                                                <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground">
                                                    {(prosConsData[selectedItemDetail.id]?.cons || []).map((con) => (
                                                        <li key={con.id}>{con.description}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Risk ve Diğer */}
                                {selectedItemDetail.risk_level && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3">Risk Değerlendirmesi</h3>
                                        <Badge 
                                            variant={
                                                selectedItemDetail.risk_level === 'Düşük' ? 'default' :
                                                selectedItemDetail.risk_level === 'Orta' ? 'secondary' :
                                                selectedItemDetail.risk_level === 'Yüksek' ? 'destructive' : 'destructive'
                                            }
                                            className="text-lg px-4 py-2"
                                        >
                                            {selectedItemDetail.risk_level}
                                        </Badge>
                                    </div>
                                )}

                                {/* Toplam Skor */}
                                {itemScores[selectedItemDetail.id] && (
                                    <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-semibold">Toplam Skor</span>
                                            <Badge className="bg-primary text-xl px-4 py-2">
                                                {itemScores[selectedItemDetail.id].average.toFixed(1)}/100
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

export default BenchmarkComparison;


