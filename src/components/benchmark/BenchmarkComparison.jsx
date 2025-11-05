import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    X, Plus, Trash2, Save, Download, TrendingUp, Award,
    ThumbsUp, ThumbsDown, BarChart3, PieChart, FileText,
    Edit, Check, AlertCircle
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

const BenchmarkComparison = ({ isOpen, onClose, benchmark, onRefresh }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('items');

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
        if (benchmark?.id) {
            fetchComparisonData();
        }
    }, [benchmark?.id]);

    const fetchComparisonData = async () => {
        if (!benchmark?.id) return;

        setLoading(true);
        try {
            const [itemsRes, criteriaRes, scoresRes, prosConsRes] = await Promise.all([
                supabase
                    .from('benchmark_items')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('rank_order'),
                supabase
                    .from('benchmark_criteria')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('order_index'),
                supabase
                    .from('benchmark_scores')
                    .select('*'),
                supabase
                    .from('benchmark_pros_cons')
                    .select('*')
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (criteriaRes.error) throw criteriaRes.error;
            if (scoresRes.error) throw scoresRes.error;
            if (prosConsRes.error) throw prosConsRes.error;

            setItems(itemsRes.data || []);
            setCriteria(criteriaRes.data || []);

            // Organize scores by item and criterion
            const scoresMap = {};
            (scoresRes.data || []).forEach(score => {
                const key = `${score.benchmark_item_id}_${score.criterion_id}`;
                scoresMap[key] = score;
            });
            setScores(scoresMap);

            // Organize pros/cons by item
            const prosConsMap = {};
            (prosConsRes.data || []).forEach(pc => {
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
            console.error('Karşılaştırma verileri yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Veriler yüklenirken bir hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate total weighted score for each item
    const itemScores = useMemo(() => {
        const result = {};
        items.forEach(item => {
            let totalScore = 0;
            let totalWeight = 0;
            
            criteria.forEach(criterion => {
                const key = `${item.id}_${criterion.id}`;
                const score = scores[key];
                if (score && score.weighted_score) {
                    totalScore += score.weighted_score;
                    totalWeight += criterion.weight || 0;
                }
            });

            result[item.id] = {
                total: totalScore,
                average: totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0
            };
        });
        return result;
    }, [items, criteria, scores]);

    // Handlers for Items
    const handleAddItem = () => {
        setNewItem({
            item_name: '',
            item_code: '',
            description: '',
            unit_price: '',
            currency: 'TRY',
            lead_time_days: '',
            quality_score: '',
            performance_score: '',
            reliability_score: ''
        });
    };

    const handleSaveNewItem = async () => {
        if (!newItem.item_name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Alternatif adı zorunludur.'
            });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('benchmark_items')
                .insert({
                    benchmark_id: benchmark.id,
                    ...newItem,
                    unit_price: newItem.unit_price ? parseFloat(newItem.unit_price) : null,
                    lead_time_days: newItem.lead_time_days ? parseInt(newItem.lead_time_days) : null,
                    quality_score: newItem.quality_score ? parseFloat(newItem.quality_score) : null,
                    performance_score: newItem.performance_score ? parseFloat(newItem.performance_score) : null,
                    reliability_score: newItem.reliability_score ? parseFloat(newItem.reliability_score) : null
                })
                .select()
                .single();

            if (error) throw error;

            setItems([...items, data]);
            setNewItem(null);
            toast({
                title: 'Başarılı',
                description: 'Yeni alternatif eklendi.'
            });
        } catch (error) {
            console.error('Alternatif eklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Alternatif eklenirken bir hata oluştu.'
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

    if (!benchmark) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] max-h-[95vh]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl">
                            <TrendingUp className="inline-block mr-2 h-6 w-6" />
                            Benchmark Karşılaştırma
                        </DialogTitle>
                        <Button size="sm" variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Rapor İndir
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {benchmark.title}
                    </p>
                </DialogHeader>

                <ScrollArea className="h-[calc(95vh-120px)]">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="items">
                                Alternatifler ({items.length})
                            </TabsTrigger>
                            <TabsTrigger value="criteria">
                                Kriterler ({criteria.length})
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
                                        <CardTitle className="text-base">Yeni Alternatif</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div>
                                                <Label>Alternatif Adı *</Label>
                                                <Input
                                                    value={newItem.item_name}
                                                    onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                                                    placeholder="Örn: Alternatif A"
                                                />
                                            </div>
                                            <div>
                                                <Label>Kod</Label>
                                                <Input
                                                    value={newItem.item_code}
                                                    onChange={(e) => setNewItem({...newItem, item_code: e.target.value})}
                                                    placeholder="Ürün/Parça kodu"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Açıklama</Label>
                                            <Textarea
                                                value={newItem.description}
                                                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div>
                                                <Label>Birim Fiyat</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={newItem.unit_price}
                                                    onChange={(e) => setNewItem({...newItem, unit_price: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <Label>Kalite Skoru (0-100)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={newItem.quality_score}
                                                    onChange={(e) => setNewItem({...newItem, quality_score: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <Label>Tedarik Süresi (gün)</Label>
                                                <Input
                                                    type="number"
                                                    value={newItem.lead_time_days}
                                                    onChange={(e) => setNewItem({...newItem, lead_time_days: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
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
                                {items.map((item) => (
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
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {item.description && (
                                                <p className="text-sm mb-3">{item.description}</p>
                                            )}
                                            <div className="space-y-2 text-sm">
                                                {item.unit_price && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Fiyat:</span>
                                                        <span className="font-medium">
                                                            {new Intl.NumberFormat('tr-TR', {
                                                                style: 'currency',
                                                                currency: item.currency || 'TRY'
                                                            }).format(item.unit_price)}
                                                        </span>
                                                    </div>
                                                )}
                                                {item.quality_score && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Kalite:</span>
                                                        <Badge variant="outline">{item.quality_score}/100</Badge>
                                                    </div>
                                                )}
                                                {itemScores[item.id] && (
                                                    <div className="flex justify-between pt-2 border-t">
                                                        <span className="font-medium">Toplam Skor:</span>
                                                        <Badge className="bg-primary">
                                                            {itemScores[item.id].average.toFixed(1)}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
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
                                                    {items.map((item) => (
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
                                                    ))}
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
                                        {items
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
                                            ))}
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
                                        {items.map((item) => (
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
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default BenchmarkComparison;

