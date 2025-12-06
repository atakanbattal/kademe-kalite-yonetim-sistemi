import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    X, Plus, Trash2, Save, Download, TrendingUp, Award,
    ThumbsUp, ThumbsDown, BarChart3, PieChart, FileText,
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
import { ScrollArea } from '@/components/ui/scroll-area';
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

const BenchmarkComparison = ({ isOpen, onClose, benchmark, onRefresh }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('items');
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
        console.log('BenchmarkComparison useEffect:', { benchmark, isOpen, benchmarkId: benchmark?.id });
        if (benchmark?.id && isOpen) {
            fetchComparisonData();
        } else if (!isOpen) {
            // Modal kapandığında state'leri temizle
            console.log('BenchmarkComparison: Modal kapandı, state temizleniyor');
            setItems([]);
            setCriteria([]);
            setScores({});
            setProsConsData({});
            setLoading(false);
        }
    }, [benchmark?.id, isOpen]);

    const fetchComparisonData = useCallback(async () => {
        console.log('fetchComparisonData called', { benchmarkId: benchmark?.id });
        if (!benchmark?.id) {
            console.log('fetchComparisonData: No benchmark ID, returning');
            return;
        }

        setLoading(true);
        // itemsData ve criteriaData'yı try bloğu dışında tanımla ki catch bloğunda erişilebilir olsun
        let itemsData = [];
        let criteriaData = [];
        
        try {
            console.log('fetchComparisonData: Starting data fetch');
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
            criteriaData = criteriaRes.data || [];
            
            console.log('fetchComparisonData: Items loaded', { count: itemsData.length, items: itemsData });
            console.log('fetchComparisonData: Criteria loaded', { count: criteriaData.length, criteria: criteriaData });
            
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
            
            console.log('fetchComparisonData: Data loaded successfully', {
                itemsCount: itemsData.length,
                criteriaCount: criteriaData.length,
                scoresCount: Object.keys(scoresMap).length,
                prosConsCount: Object.keys(prosConsMap).length
            });
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
                    console.log('Items korunuyor:', itemsData.length);
                }
                if (criteriaLoaded) {
                    setCriteria(criteriaData);
                    console.log('Criteria korunuyor:', criteriaData.length);
                }
                // Sadece scores ve prosCons'u temizle
                setScores({});
                setProsConsData({});
                console.log('Items ve criteria korunuyor, sadece scores ve prosCons temizlendi');
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
            console.log('fetchComparisonData: Finished');
        }
    }, [benchmark?.id, toast]);

    // Calculate total weighted score for each item
    const itemScores = useMemo(() => {
        const result = {};
        if (!items || items.length === 0) return result;
        
        // Otomatik skorlama fonksiyonu - itemScores içinde tanımlanıyor circular dependency'yi önlemek için
        const calculateAutoScoreLocal = (item) => {
            if (!item || !items || items.length === 0) return 0;
            
            let totalScore = 0;
            let maxScore = 0;
            const weights = {
                unit_price: 15, total_cost_of_ownership: 20, roi_percentage: 15, maintenance_cost: 10,
                quality_score: 25, performance_score: 20, reliability_score: 20,
                after_sales_service_score: 15, technical_support_score: 15, warranty_period_months: 10, documentation_quality_score: 10,
                delivery_time_days: 15, lead_time_days: 15, implementation_time_days: 10, training_required_hours: 10,
                energy_efficiency_score: 10, environmental_impact_score: 10,
                ease_of_use_score: 15, scalability_score: 15, compatibility_score: 15, innovation_score: 10,
                market_reputation_score: 15, customer_references_count: 10
            };

            if (item.unit_price) {
                const allPrices = items.map(i => i.unit_price).filter(p => p);
                if (allPrices.length > 0) {
                    const maxPrice = Math.max(...allPrices);
                    const minPrice = Math.min(...allPrices);
                    if (maxPrice > minPrice) {
                        const priceScore = 100 - ((item.unit_price - minPrice) / (maxPrice - minPrice)) * 100;
                        totalScore += (priceScore * weights.unit_price) / 100;
                    } else {
                        totalScore += weights.unit_price;
                    }
                }
                maxScore += weights.unit_price;
            }

            if (item.total_cost_of_ownership) {
                const allTCOs = items.map(i => i.total_cost_of_ownership).filter(t => t);
                if (allTCOs.length > 0) {
                    const maxTCO = Math.max(...allTCOs);
                    const minTCO = Math.min(...allTCOs);
                    if (maxTCO > minTCO) {
                        const tcoScore = 100 - ((item.total_cost_of_ownership - minTCO) / (maxTCO - minTCO)) * 100;
                        totalScore += (tcoScore * weights.total_cost_of_ownership) / 100;
                    } else {
                        totalScore += weights.total_cost_of_ownership;
                    }
                }
                maxScore += weights.total_cost_of_ownership;
            }

            if (item.roi_percentage) {
                totalScore += (Math.min(item.roi_percentage, 100) * weights.roi_percentage) / 100;
                maxScore += weights.roi_percentage;
            }

            if (item.maintenance_cost) {
                const allMaintenance = items.map(i => i.maintenance_cost).filter(m => m);
                if (allMaintenance.length > 0) {
                    const maxMaintenance = Math.max(...allMaintenance);
                    const minMaintenance = Math.min(...allMaintenance);
                    if (maxMaintenance > minMaintenance) {
                        const maintenanceScore = 100 - ((item.maintenance_cost - minMaintenance) / (maxMaintenance - minMaintenance)) * 100;
                        totalScore += (maintenanceScore * weights.maintenance_cost) / 100;
                    } else {
                        totalScore += weights.maintenance_cost;
                    }
                }
                maxScore += weights.maintenance_cost;
            }

            const directScores = ['quality_score', 'performance_score', 'reliability_score', 'after_sales_service_score', 'technical_support_score', 'documentation_quality_score', 'energy_efficiency_score', 'environmental_impact_score', 'ease_of_use_score', 'scalability_score', 'compatibility_score', 'innovation_score', 'market_reputation_score'];
            directScores.forEach(scoreKey => {
                if (item[scoreKey] !== null && item[scoreKey] !== undefined) {
                    totalScore += (item[scoreKey] * weights[scoreKey]) / 100;
                    maxScore += weights[scoreKey];
                }
            });

            if (item.warranty_period_months) {
                const warrantyScore = Math.min((item.warranty_period_months / 60) * 100, 100);
                totalScore += (warrantyScore * weights.warranty_period_months) / 100;
                maxScore += weights.warranty_period_months;
            }

            const deliveryDays = item.delivery_time_days || item.lead_time_days;
            if (deliveryDays) {
                const allDelivery = items.map(i => i.delivery_time_days || i.lead_time_days).filter(d => d);
                if (allDelivery.length > 0) {
                    const maxDelivery = Math.max(...allDelivery);
                    const minDelivery = Math.min(...allDelivery);
                    if (maxDelivery > minDelivery) {
                        const deliveryScore = 100 - ((deliveryDays - minDelivery) / (maxDelivery - minDelivery)) * 100;
                        totalScore += (deliveryScore * weights.delivery_time_days) / 100;
                    } else {
                        totalScore += weights.delivery_time_days;
                    }
                }
                maxScore += weights.delivery_time_days;
            }

            if (item.implementation_time_days) {
                const allImplementation = items.map(i => i.implementation_time_days).filter(i => i);
                if (allImplementation.length > 0) {
                    const maxImpl = Math.max(...allImplementation);
                    const minImpl = Math.min(...allImplementation);
                    if (maxImpl > minImpl) {
                        const implScore = 100 - ((item.implementation_time_days - minImpl) / (maxImpl - minImpl)) * 100;
                        totalScore += (implScore * weights.implementation_time_days) / 100;
                    } else {
                        totalScore += weights.implementation_time_days;
                    }
                }
                maxScore += weights.implementation_time_days;
            }

            if (item.training_required_hours) {
                const allTraining = items.map(i => i.training_required_hours).filter(t => t);
                if (allTraining.length > 0) {
                    const maxTraining = Math.max(...allTraining);
                    const minTraining = Math.min(...allTraining);
                    if (maxTraining > minTraining) {
                        const trainingScore = 100 - ((item.training_required_hours - minTraining) / (maxTraining - minTraining)) * 100;
                        totalScore += (trainingScore * weights.training_required_hours) / 100;
                    } else {
                        totalScore += weights.training_required_hours;
                    }
                }
                maxScore += weights.training_required_hours;
            }

            if (item.customer_references_count) {
                const refScore = Math.min((item.customer_references_count / 50) * 100, 100);
                totalScore += (refScore * weights.customer_references_count) / 100;
                maxScore += weights.customer_references_count;
            }

            if (item.risk_level) {
                const riskScores = { 'Düşük': 100, 'Orta': 70, 'Yüksek': 40, 'Kritik': 10 };
                const riskScore = riskScores[item.risk_level] || 50;
                totalScore += (riskScore * 10) / 100;
                maxScore += 10;
            }

            return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        };
        
        items.forEach(item => {
            let totalScore = 0;
            let totalWeight = 0;
            
            // Önce kullanıcı tanımlı kriterlerden skor al
            criteria.forEach(criterion => {
                const key = `${item.id}_${criterion.id}`;
                const score = scores[key];
                if (score && score.weighted_score) {
                    totalScore += score.weighted_score;
                    totalWeight += criterion.weight || 0;
                }
            });

            // Eğer kullanıcı tanımlı kriter yoksa veya eksikse, otomatik skorlama kullan
            if (totalWeight === 0 || criteria.length === 0) {
                const autoScore = calculateAutoScoreLocal(item);
                result[item.id] = {
                    total: autoScore,
                    average: autoScore,
                    isAutoCalculated: true
                };
            } else {
                result[item.id] = {
                    total: totalScore,
                    average: totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0,
                    isAutoCalculated: false
                };
            }
        });
        return result;
    }, [items, criteria, scores]);

    // Handlers for Items
    const handleAddItem = () => {
        setNewItem({
            item_name: '',
            item_code: '',
            description: '',
            supplier_id: '',
            manufacturer: '',
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
            console.log('handleSaveNewItem: Kaydetme başlıyor', { benchmarkId: benchmark.id, newItem });
            
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
                item_code: newItem.item_code?.trim() || null,
                description: newItem.description?.trim() || null,
                supplier_id: newItem.supplier_id?.trim() || null,
                manufacturer: newItem.manufacturer?.trim() || null,
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

            console.log('handleSaveNewItem: Insert data', insertData);

            const { data, error } = await supabase
                .from('benchmark_items')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('handleSaveNewItem: Database error', error);
                throw error;
            }

            console.log('handleSaveNewItem: Kayıt başarılı', data);

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
        setNewCriterion({
            criterion_name: '',
            description: '',
            category: '',
            weight: '1',
            measurement_unit: '',
            scoring_method: 'Numerical'
        });
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
                    ...newCriterion,
                    weight: parseFloat(newCriterion.weight) || 1
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

    const handleDownloadReport = () => {
        if (!benchmark) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Benchmark bilgisi bulunamadı.'
            });
            return;
        }
        
        const htmlContent = generateComparisonReport();
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.'
            });
            return;
        }
        
        if (printWindow) {
            printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(url));
        }
    };

    const generateComparisonReport = () => {
        if (!benchmark) return '';
        
        const sortedItems = [...items].sort((a, b) => {
            const scoreA = itemScores[a.id]?.average || 0;
            const scoreB = itemScores[b.id]?.average || 0;
            return scoreB - scoreA;
        });

        // Kriter kategorilerine göre grupla
        const getCriterionCategory = (item, key) => {
            if (['unit_price', 'total_cost_of_ownership', 'roi_percentage', 'maintenance_cost'].includes(key)) return 'Maliyet';
            if (['quality_score', 'performance_score', 'reliability_score'].includes(key)) return 'Kalite';
            if (['after_sales_service_score', 'technical_support_score', 'warranty_period_months', 'documentation_quality_score'].includes(key)) return 'Hizmet';
            if (['delivery_time_days', 'lead_time_days', 'implementation_time_days', 'training_required_hours'].includes(key)) return 'Operasyonel';
            if (['energy_efficiency_score', 'environmental_impact_score'].includes(key)) return 'Çevresel';
            if (['ease_of_use_score', 'scalability_score', 'compatibility_score', 'innovation_score'].includes(key)) return 'Teknik';
            if (['market_reputation_score', 'customer_references_count', 'risk_level'].includes(key)) return 'Pazar';
            return 'Diğer';
        };

        const formatValue = (item, key) => {
            const value = item[key];
            if (value === null || value === undefined || value === '') return '-';
            if (key.includes('score') && typeof value === 'number') return `${value.toFixed(1)}/100`;
            if (key.includes('price') || key.includes('cost') || key.includes('ownership')) {
                return new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: item.currency || 'TRY'
                }).format(value);
            }
            if (key.includes('percentage') || key.includes('roi')) return `${value}%`;
            if (key.includes('days') || key.includes('hours') || key.includes('months') || key.includes('count')) return `${value} ${key.includes('days') ? 'gün' : key.includes('hours') ? 'saat' : key.includes('months') ? 'ay' : 'adet'}`;
            return value.toString();
        };

        const creationDate = new Date().toLocaleDateString('tr-TR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        const preparedBy = "Atakan BATTAL";

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Benchmark Karşılaştırma Raporu - ${benchmark?.title || 'Benchmark'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        
        * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            line-height: 1.6;
        }
        .page {
            background-color: white;
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            padding: 0;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
        }
        .page::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8mm;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            z-index: 1;
        }
        .page-content {
            padding: 25mm 20mm 20mm 20mm;
            position: relative;
            z-index: 2;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 20px;
            margin-bottom: 30px;
            position: relative;
        }
        .header-left {
            flex: 1;
        }
        .header h1 {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            font-weight: 700;
            color: #1e40af;
            margin: 0 0 5px 0;
            letter-spacing: -0.5px;
        }
        .header p {
            font-size: 13px;
            color: #64748b;
            margin: 0;
            font-weight: 500;
            letter-spacing: 0.5px;
        }
        .header-right {
            text-align: right;
        }
        .report-number {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 5px;
        }
        .report-date {
            font-size: 11px;
            color: #64748b;
        }
        .report-title-section {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            border-left: 5px solid #1e40af;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .report-title h2 {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 8px 0;
            letter-spacing: -0.3px;
        }
        .report-title p {
            font-size: 15px;
            color: #475569;
            margin: 0;
            font-weight: 500;
        }

        .section {
            margin-bottom: 35px;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px 8px 0 0;
            margin: 0 0 0 0;
            letter-spacing: -0.2px;
        }
        .section-content {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-top: none;
            padding: 20px;
            border-radius: 0 0 8px 8px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            font-size: 11px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        th, td { 
            border: 1px solid #e2e8f0; 
            padding: 10px 12px; 
            text-align: left; 
        }
        th { 
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            font-weight: 600; 
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        td {
            background: #ffffff;
        }
        tr:nth-child(even) td {
            background: #f8fafc;
        }
        .rank-1 { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; font-weight: 600; }
        .rank-2 { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important; font-weight: 600; }
        .rank-3 { background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%) !important; font-weight: 600; }
        .score-high { color: #059669; font-weight: bold; }
        .score-medium { color: #d97706; font-weight: bold; }
        .score-low { color: #dc2626; font-weight: bold; }
        .pros-cons-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-bottom: 20px;
        }
        .pros-box {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-left: 4px solid #22c55e;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(34, 197, 94, 0.1);
        }
        .cons-box {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border-left: 4px solid #ef4444;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.1);
        }
        .pros-box h4 {
            color: #15803d;
            margin: 0 0 10px 0;
            font-size: 14px;
            font-weight: 700;
        }
        .cons-box h4 {
            color: #dc2626;
            margin: 0 0 10px 0;
            font-size: 14px;
            font-weight: 700;
        }
        .pros-box ul, .cons-box ul {
            margin: 0;
            padding-left: 20px;
            font-size: 12px;
            line-height: 1.8;
        }
        .pros-box li, .cons-box li {
            margin-bottom: 6px;
        }
        .footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 15px 20mm;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .footer-left {
            text-align: left;
        }
        .footer-right {
            text-align: right;
        }
        .footer-center {
            flex: 1;
            text-align: center;
        }
        .page-number {
            font-weight: 600;
            color: #1e40af;
        }
        @media print {
            body { background-color: white; margin: 0; padding: 0; }
            .page { margin: 0; box-shadow: none; border: none; }
            .page::before { display: none; }
            @page {
                size: A4;
                margin: 0;
            }
            .footer {
                position: fixed;
                bottom: 0;
            }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="page-content">
        <div class="header">
            <div class="header-left">
                <h1>KADEME A.Ş.</h1>
                <p>Kalite Yönetim Sistemi</p>
            </div>
            <div class="header-right">
                <div class="report-number">Rapor No: ${benchmark?.benchmark_number || 'N/A'}</div>
                <div class="report-date">${creationDate}</div>
            </div>
        </div>
        <div class="report-title-section">
            <div class="report-title">
                <h2>Benchmark Karşılaştırma Raporu</h2>
                <p>${benchmark?.title || '-'}</p>
            </div>
        </div>

    <div class="section">
        <div class="section-title">Genel Sıralama</div>
        <div class="section-content">
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">Sıra</th>
                    <th>Alternatif</th>
                    <th>Açıklama</th>
                    <th style="width: 120px; text-align: center;">Toplam Skor</th>
                </tr>
            </thead>
            <tbody>
                ${sortedItems.map((item, index) => {
                    const avgScore = itemScores[item.id]?.average || 0;
                    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
                    const scoreClass = avgScore >= 80 ? 'score-high' : avgScore >= 60 ? 'score-medium' : 'score-low';
                    return `
                    <tr class="${rankClass}">
                        <td style="text-align: center; font-size: 18px; font-weight: bold;">${index + 1}</td>
                        <td><strong>${item.item_name}</strong>${item.item_code ? `<br><small>${item.item_code}</small>` : ''}</td>
                        <td>${item.description || '-'}</td>
                        <td style="text-align: center;" class="${scoreClass}">${avgScore.toFixed(1)}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    </div>

    ${criteria.length > 0 ? `
    <div class="section">
        <div class="section-title">Detaylı Karşılaştırma Matrisi</div>
        <div class="section-content">
        <table>
            <thead>
                <tr>
                    <th>Alternatif</th>
                    ${criteria.map(c => `<th style="text-align: center;">${c.criterion_name}<br><small>(${c.weight}%)</small></th>`).join('')}
                    <th style="text-align: center; background: #dbeafe;">Toplam</th>
                </tr>
            </thead>
            <tbody>
                ${sortedItems.map(item => {
                    const criteriaScores = criteria.map(criterion => {
                        const key = `${item.id}_${criterion.id}`;
                        const score = scores[key];
                        const normalized = score?.normalized_score || 0;
                        return `<td style="text-align: center;">${normalized.toFixed(1)}</td>`;
                    }).join('');
                    
                    return `
                    <tr>
                        <td><strong>${item.item_name}</strong></td>
                        ${criteriaScores}
                        <td style="text-align: center; background: #dbeafe; font-weight: bold;">
                            ${(itemScores[item.id]?.average || 0).toFixed(1)}
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    </div>
    ` : ''}

    ${Object.keys(prosConsData).length > 0 ? `
    <div class="section">
        <div class="section-title">Avantaj & Dezavantaj Analizi</div>
        <div class="section-content">
        ${sortedItems.map(item => {
            const itemData = prosConsData[item.id];
            if (!itemData || (itemData.pros.length === 0 && itemData.cons.length === 0)) return '';
            return `
            <div style="margin-bottom: 20px; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background: #f9fafb;">
                <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">${item.item_name}</h3>
                <div class="pros-cons-container">
                    <div class="pros-box">
                        <h4>✓ Avantajlar</h4>
                        <ul>
                            ${(itemData.pros || []).length > 0 
                                ? (itemData.pros || []).map(pro => `<li>${pro.description || '-'}</li>`).join('')
                                : '<li>Avantaj belirtilmemiş</li>'
                            }
                        </ul>
                    </div>
                    <div class="cons-box">
                        <h4>✗ Dezavantajlar</h4>
                        <ul>
                            ${(itemData.cons || []).length > 0 
                                ? (itemData.cons || []).map(con => `<li>${con.description || '-'}</li>`).join('')
                                : '<li>Dezavantaj belirtilmemiş</li>'
                            }
                        </ul>
                    </div>
                </div>
            </div>
            `;
        }).join('')}
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">Detaylı Kriter Karşılaştırması</div>
        <div class="section-content">
        <table>
            <thead>
                <tr>
                    <th style="width: 200px;">Kriter</th>
                    ${sortedItems.map(item => `<th style="text-align: center;">${item.item_name}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${['unit_price', 'total_cost_of_ownership', 'roi_percentage', 'quality_score', 'performance_score', 'reliability_score', 'after_sales_service_score', 'technical_support_score', 'warranty_period_months', 'delivery_time_days', 'lead_time_days', 'implementation_time_days', 'energy_efficiency_score', 'environmental_impact_score', 'ease_of_use_score', 'scalability_score', 'compatibility_score', 'innovation_score', 'market_reputation_score', 'customer_references_count', 'risk_level'].map(key => {
                    const criterionNames = {
                        'unit_price': 'Birim Fiyat',
                        'total_cost_of_ownership': 'Toplam Sahiplik Maliyeti (TCO)',
                        'roi_percentage': 'Yatırım Getirisi (ROI)',
                        'quality_score': 'Kalite Skoru',
                        'performance_score': 'Performans Skoru',
                        'reliability_score': 'Güvenilirlik Skoru',
                        'after_sales_service_score': 'Satış Sonrası Hizmet',
                        'technical_support_score': 'Teknik Destek',
                        'warranty_period_months': 'Garanti Süresi',
                        'delivery_time_days': 'Teslimat Süresi',
                        'lead_time_days': 'Tedarik Süresi',
                        'implementation_time_days': 'Uygulama Süresi',
                        'energy_efficiency_score': 'Enerji Verimliliği',
                        'environmental_impact_score': 'Çevresel Etki',
                        'ease_of_use_score': 'Kullanılabilirlik',
                        'scalability_score': 'Ölçeklenebilirlik',
                        'compatibility_score': 'Uyumluluk',
                        'innovation_score': 'İnovasyon',
                        'market_reputation_score': 'Pazar İtibarı',
                        'customer_references_count': 'Müşteri Referans Sayısı',
                        'risk_level': 'Risk Seviyesi'
                    };
                    
                    const hasValue = sortedItems.some(item => item[key] !== null && item[key] !== undefined && item[key] !== '');
                    if (!hasValue) return '';
                    
                    return `
                    <tr>
                        <td style="font-weight: 600;">${criterionNames[key] || key}</td>
                        ${sortedItems.map(item => {
                            const value = formatValue(item, key);
                            const bestValue = sortedItems.reduce((best, current) => {
                                const currentVal = current[key];
                                const bestVal = best[key];
                                if (currentVal === null || currentVal === undefined || currentVal === '') return best;
                                if (bestVal === null || bestVal === undefined || bestVal === '') return current;
                                
                                // Fiyat ve süre için en düşük değer en iyi
                                if (key.includes('price') || key.includes('cost') || key.includes('days') || key.includes('hours')) {
                                    return currentVal < bestVal ? current : best;
                                }
                                // Skorlar ve yüzdeler için en yüksek değer en iyi
                                if (key.includes('score') || key.includes('percentage') || key.includes('count') || key.includes('months')) {
                                    return currentVal > bestVal ? current : best;
                                }
                                return best;
                            }, sortedItems[0]);
                            const isBest = bestValue && item[key] === bestValue[key] && item[key] !== null && item[key] !== undefined && item[key] !== '';
                            return `<td style="text-align: center; ${isBest ? 'background: #dbeafe; font-weight: bold;' : ''}">${value}</td>`;
                        }).join('')}
                    </tr>
                    `;
                }).filter(row => row !== '').join('')}
            </tbody>
        </table>
        </div>
    </div>

        </div>
        <div class="footer">
            <div class="footer-left">
                <div>KADEME A.Ş.</div>
                <div style="font-size: 10px; margin-top: 2px;">Kalite Yönetim Sistemi</div>
            </div>
            <div class="footer-center">
                Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.
            </div>
            <div class="footer-right">
                <div class="page-number">Sayfa <span id="pageNum">1</span></div>
                <div style="font-size: 10px; margin-top: 2px;">${creationDate}</div>
            </div>
        </div>
    </div>
    <script>
        const images = document.querySelectorAll('.attachment-image');
        const promises = Array.from(images).map(img => {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve; // Resolve on error too, to not block printing
                }
            });
        });

        Promise.all(promises).then(() => {
            setTimeout(() => {
                window.print();
            }, 500); // Increased delay to ensure rendering
        });
    </script>
</body>
</html>
        `;
    };

    console.log('BenchmarkComparison render:', { benchmark, isOpen, loading, itemsCount: items?.length, criteriaCount: criteria?.length, benchmarkId: benchmark?.id });

    // Eğer modal açık değilse hiçbir şey render etme
    if (!isOpen) {
        console.log('BenchmarkComparison: Modal kapalı, returning null');
        return null;
    }

    // Eğer benchmark yoksa bile modal'ı göster ama içeriği loading olarak göster
    if (!benchmark) {
        console.log('BenchmarkComparison: Benchmark yok, loading gösteriliyor');
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-[95vw] max-h-[95vh]">
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

    // Benchmark var ama id yoksa da loading göster
    if (!benchmark.id) {
        console.log('BenchmarkComparison: Benchmark ID yok, loading gösteriliyor');
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-[95vw] max-h-[95vh]">
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] max-h-[95vh]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl">
                            <TrendingUp className="inline-block mr-2 h-6 w-6" />
                            Benchmark Karşılaştırma
                        </DialogTitle>
                        <Button size="sm" variant="outline" onClick={handleDownloadReport} disabled={!benchmark}>
                            <Download className="mr-2 h-4 w-4" />
                            Rapor İndir
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {benchmark?.title || 'Yükleniyor...'}
                    </p>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center h-[calc(95vh-120px)]">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                            <p className="text-sm text-muted-foreground">Veriler yükleniyor...</p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-[calc(95vh-120px)]">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="items">
                                Alternatifler ({items?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="criteria">
                                Kriterler ({criteria?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="matrix">
                                Karşılaştırma Matrisi
                            </TabsTrigger>
                            <TabsTrigger value="analysis">
                                Analiz & Sonuçlar
                            </TabsTrigger>
                        </TabsList>

                        {/* Alternatifler */}
                        <TabsContent value="items" className="space-y-4 mt-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Karşılaştırılan Alternatifler</h3>
                                <Button size="sm" onClick={handleAddItem}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Alternatif Ekle
                                </Button>
                            </div>

                            {newItem && (
                                <Card className="border-2 border-primary">
                                    <CardHeader>
                                        <CardTitle className="text-base">Yeni Alternatif Ekle</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Tabs defaultValue="basic" className="w-full">
                                            <TabsList className="grid w-full grid-cols-5">
                                                <TabsTrigger value="basic">Temel</TabsTrigger>
                                                <TabsTrigger value="cost">Maliyet</TabsTrigger>
                                                <TabsTrigger value="quality">Kalite</TabsTrigger>
                                                <TabsTrigger value="service">Hizmet</TabsTrigger>
                                                <TabsTrigger value="other">Diğer</TabsTrigger>
                                            </TabsList>

                                            {/* Temel Bilgiler */}
                                            <TabsContent value="basic" className="space-y-4 mt-4">
                                                <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
                                                    <p className="text-sm text-muted-foreground">
                                                        <strong>ℹ️ Bilgi:</strong> Sadece "Alternatif Adı" zorunludur. Diğer tüm alanlar opsiyoneldir.
                                                    </p>
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <LabelWithTooltip tooltip="Karşılaştırma için benzersiz bir isim verin" required>
                                                            Alternatif Adı
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.item_name}
                                                            onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                                                            placeholder="Örn: Alternatif A, Ürün X, Tedarikçi Y"
                                                        />
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ürün, parça veya hizmet için kullanılan kod/numara">
                                                            Kod/Referans No
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.item_code}
                                                            onChange={(e) => setNewItem({...newItem, item_code: e.target.value})}
                                                            placeholder="Ürün/Parça kodu"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ürünü üreten veya hizmeti sağlayan firma adı">
                                                            Üretici/Tedarikçi
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.manufacturer}
                                                            onChange={(e) => setNewItem({...newItem, manufacturer: e.target.value})}
                                                            placeholder="Üretici firma adı"
                                                        />
                                                    </div>
                                                    <div>
                                                        <LabelWithTooltip tooltip="Ürün model numarası, seri numarası veya versiyon bilgisi">
                                                            Model/Seri No
                                                        </LabelWithTooltip>
                                                        <Input
                                                            value={newItem.model_number}
                                                            onChange={(e) => setNewItem({...newItem, model_number: e.target.value})}
                                                            placeholder="Model numarası"
                                                        />
                                                    </div>
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

                            <div className="grid gap-4 md:grid-cols-2">
                                {items && items.length > 0 ? items.map((item) => (
                                    <Card key={item.id}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2">
                                                        {item.item_name}
                                                        {item.is_recommended && (
                                                            <Award className="h-4 w-4 text-yellow-500" />
                                                        )}
                                                    </CardTitle>
                                                    {item.item_code && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {item.item_code}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setSelectedItemDetail(item)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {item.description && (
                                                <p className="text-sm mb-3">{item.description}</p>
                                            )}
                                            <div className="space-y-2 text-sm">
                                                {/* Maliyet Bilgileri */}
                                                {item.unit_price && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Birim Fiyat:</span>
                                                        <span className="font-medium">
                                                            {new Intl.NumberFormat('tr-TR', {
                                                                style: 'currency',
                                                                currency: item.currency || 'TRY'
                                                            }).format(item.unit_price)}
                                                        </span>
                                                    </div>
                                                )}
                                                {item.total_cost_of_ownership && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">TCO:</span>
                                                        <span className="font-medium">
                                                            {new Intl.NumberFormat('tr-TR', {
                                                                style: 'currency',
                                                                currency: item.currency || 'TRY'
                                                            }).format(item.total_cost_of_ownership)}
                                                        </span>
                                                    </div>
                                                )}
                                                {item.roi_percentage && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">ROI:</span>
                                                        <Badge variant="outline">{item.roi_percentage}%</Badge>
                                                    </div>
                                                )}
                                                
                                                {/* Teslimat ve Süre */}
                                                {(item.delivery_time_days || item.lead_time_days) && (
                                                    <div className="flex justify-between pt-2 border-t">
                                                        <span className="text-muted-foreground">Teslimat:</span>
                                                        <span className="font-medium">
                                                            {item.delivery_time_days || item.lead_time_days} gün
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                {/* Kalite Skorları */}
                                                <div className="pt-2 border-t space-y-1">
                                                    {item.quality_score && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Kalite:</span>
                                                            <Badge variant="outline">{item.quality_score}/100</Badge>
                                                        </div>
                                                    )}
                                                    {item.performance_score && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Performans:</span>
                                                            <Badge variant="outline">{item.performance_score}/100</Badge>
                                                        </div>
                                                    )}
                                                    {item.reliability_score && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Güvenilirlik:</span>
                                                            <Badge variant="outline">{item.reliability_score}/100</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Hizmet Skorları */}
                                                {(item.after_sales_service_score || item.technical_support_score) && (
                                                    <div className="pt-2 border-t space-y-1">
                                                        {item.after_sales_service_score && (
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Satış Sonrası:</span>
                                                                <Badge variant="outline">{item.after_sales_service_score}/100</Badge>
                                                            </div>
                                                        )}
                                                        {item.technical_support_score && (
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Teknik Destek:</span>
                                                                <Badge variant="outline">{item.technical_support_score}/100</Badge>
                                                            </div>
                                                        )}
                                                        {item.warranty_period_months && (
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Garanti:</span>
                                                                <span className="font-medium">{item.warranty_period_months} ay</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Risk ve Diğer */}
                                                {item.risk_level && (
                                                    <div className="flex justify-between pt-2 border-t">
                                                        <span className="text-muted-foreground">Risk:</span>
                                                        <Badge 
                                                            variant={
                                                                item.risk_level === 'Düşük' ? 'default' :
                                                                item.risk_level === 'Orta' ? 'secondary' :
                                                                item.risk_level === 'Yüksek' ? 'destructive' : 'destructive'
                                                            }
                                                        >
                                                            {item.risk_level}
                                                        </Badge>
                                                    </div>
                                                )}
                                                
                                                {/* Toplam Skor */}
                                                {itemScores[item.id] && (
                                                    <div className="flex justify-between pt-2 border-t mt-2">
                                                        <span className="font-semibold">Toplam Skor:</span>
                                                        <Badge className="bg-primary text-lg px-3 py-1">
                                                            {itemScores[item.id].average.toFixed(1)}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )) : (
                                    <div className="col-span-2">
                                        <Card className="p-6 text-center">
                                            <p className="text-muted-foreground">
                                                Henüz alternatif eklenmemiş. Yeni alternatif eklemek için yukarıdaki butona tıklayın.
                                            </p>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Kriterler */}
                        <TabsContent value="criteria" className="space-y-4 mt-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Değerlendirme Kriterleri</h3>
                                <Button size="sm" onClick={handleAddCriterion}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Kriter Ekle
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
                                                <Input
                                                    value={newCriterion.category}
                                                    onChange={(e) => setNewCriterion({...newCriterion, category: e.target.value})}
                                                    placeholder="Örn: Finansal"
                                                />
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
                                                <Label>Ölçüm Birimi</Label>
                                                <Input
                                                    value={newCriterion.measurement_unit}
                                                    onChange={(e) => setNewCriterion({...newCriterion, measurement_unit: e.target.value})}
                                                    placeholder="TRY, Gün, Puan vb."
                                                />
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

                            <div className="space-y-3">
                                {criteria.map((criterion) => (
                                    <Card key={criterion.id}>
                                        <CardContent className="py-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
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
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* Karşılaştırma Matrisi */}
                        <TabsContent value="matrix" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Değerlendirme Matrisi</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        Her alternatif için her kriterde 0-100 arası puan verin
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {items.length === 0 || criteria.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <AlertCircle className="h-12 w-12 mx-auto mb-3" />
                                            <p>
                                                Karşılaştırma yapmak için en az 1 alternatif ve 1 kriter ekleyin.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-48">Alternatif</TableHead>
                                                        {criteria.map((criterion) => (
                                                            <TableHead key={criterion.id} className="text-center">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="font-semibold">
                                                                        {criterion.criterion_name}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        (Ağırlık: {criterion.weight}%)
                                                                    </span>
                                                                </div>
                                                            </TableHead>
                                                        ))}
                                                        <TableHead className="text-center">
                                                            Toplam Skor
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {items && items.length > 0 ? items.map((item) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium">
                                                                <div>
                                                                    {item.item_name}
                                                                    {item.is_recommended && (
                                                                        <Award className="inline-block ml-2 h-4 w-4 text-yellow-500" />
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            {criteria.map((criterion) => {
                                                                const key = `${item.id}_${criterion.id}`;
                                                                const score = scores[key];
                                                                return (
                                                                    <TableCell key={criterion.id} className="text-center">
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            step="0.1"
                                                                            value={score?.normalized_score || ''}
                                                                            onChange={(e) => handleScoreChange(
                                                                                item.id,
                                                                                criterion.id,
                                                                                e.target.value
                                                                            )}
                                                                            className="w-20 text-center"
                                                                        />
                                                                    </TableCell>
                                                                );
                                                            })}
                                                            <TableCell className="text-center">
                                                                <Badge className="text-base px-3 py-1">
                                                                    {itemScores[item.id]?.average.toFixed(1) || '0.0'}
                                                                </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={criteria && criteria.length > 0 ? criteria.length + 2 : 3} className="text-center text-muted-foreground py-8">
                                                            Henüz alternatif eklenmemiş.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Analiz & Sonuçlar */}
                        <TabsContent value="analysis" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Genel Sıralama</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {items && items.length > 0 ? items
                                            .sort((a, b) => {
                                                const scoreA = itemScores[a.id]?.average || 0;
                                                const scoreB = itemScores[b.id]?.average || 0;
                                                return scoreB - scoreA;
                                            })
                                            .map((item, index) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-4 border rounded-lg"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`text-2xl font-bold ${
                                                            index === 0 ? 'text-yellow-500' :
                                                            index === 1 ? 'text-gray-400' :
                                                            index === 2 ? 'text-orange-600' :
                                                            'text-gray-400'
                                                        }`}>
                                                            #{index + 1}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold">{item.item_name}</h4>
                                                            {item.description && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-primary">
                                                            {itemScores[item.id]?.average.toFixed(1) || '0.0'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">puan</div>
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
                    </ScrollArea>
                )}
            </DialogContent>
            
            {/* Alternatif Detay Modal */}
            {selectedItemDetail && (
                <Dialog open={!!selectedItemDetail} onOpenChange={() => setSelectedItemDetail(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-xl">
                                {selectedItemDetail.item_name}
                                {selectedItemDetail.item_code && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                        ({selectedItemDetail.item_code})
                                    </span>
                                )}
                            </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
                            <div className="space-y-6">
                                {/* Temel Bilgiler */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Temel Bilgiler</h3>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {selectedItemDetail.manufacturer && (
                                            <div>
                                                <Label className="text-muted-foreground">Üretici</Label>
                                                <p className="font-medium">{selectedItemDetail.manufacturer}</p>
                                            </div>
                                        )}
                                        {selectedItemDetail.model_number && (
                                            <div>
                                                <Label className="text-muted-foreground">Model/Seri No</Label>
                                                <p className="font-medium">{selectedItemDetail.model_number}</p>
                                            </div>
                                        )}
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
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
};

export default BenchmarkComparison;


