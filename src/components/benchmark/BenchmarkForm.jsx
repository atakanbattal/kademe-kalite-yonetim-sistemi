import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Save,
    Loader2,
    Plus,
    Trash2,
    Upload,
    File,
    Search,
    UserPlus,
    BarChart3,
    Sparkles,
    Edit,
    EyeOff,
    RotateCcw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeCostSettingsRows } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    syncAutoBenchmarkCriteria,
    listActiveComparisonsFromDraft,
    previewRankingFromDraftAlternatives,
} from '@/lib/benchmarkScoring';

const CRITERION_CATEGORY_OPTIONS = [
    'Maliyet', 'Kalite', 'Teknik', 'Operasyonel', 'Çevresel', 'Hizmet', 'Finansal', 'Teslimat', 'Pazar', 'Diğer',
];
const MEASUREMENT_UNIT_OPTIONS = [
    'Puan', 'TRY', 'USD', 'EUR', 'Gün', 'Ay', 'Saat', 'Adet', '%', 'kg', 'm', 'Diğer',
];

const createEmptyCriterionDraft = () => ({
    criterion_name: '',
    description: '',
    category: '',
    weight: '10',
    measurement_unit: 'Puan',
    scoring_method: 'Numerical',
});

/**
 * Yeni benchmark açılışında matris dolu gelsin; kullanıcı istemediği satırı silebilir.
 * 38 satır; kategori ve ölçü birimleri çeşitlendirilmiştir. Ağırlıkları listeden düzenleyebilirsiniz.
 */
const DEFAULT_MANUAL_METRICS_TEMPLATE = [
    // Kalite & uygunluk
    { criterion_name: 'Genel kalite / uygunluk', category: 'Kalite', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Performans / kapasite', category: 'Kalite', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Güvenilirlik / arıza riski', category: 'Kalite', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Tekrarlanabilirlik / tutarlılık', category: 'Kalite', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Standart & regülasyon uyumu', category: 'Kalite', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Sertifikasyon & denetim geçmişi', category: 'Kalite', weight: 2, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Maliyet & finansal
    { criterion_name: 'Birim fiyat / teklif uygunluğu', category: 'Maliyet', weight: 4, measurement_unit: 'TRY', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Toplam sahip olma maliyeti (TCO)', category: 'Maliyet', weight: 4, measurement_unit: 'TRY', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Gizli / ek maliyet riski', category: 'Maliyet', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'ROI / geri ödeme süresi', category: 'Finansal', weight: 3, measurement_unit: '%', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Ödeme vadeleri & nakit akışı', category: 'Finansal', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Kur / fiyat istikrarı', category: 'Finansal', weight: 2, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Teslimat & tedarik
    { criterion_name: 'Teslimat süresi', category: 'Teslimat', weight: 4, measurement_unit: 'Gün', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Termin esnekliği / hızlandırma', category: 'Teslimat', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Stok & tedarik sürekliliği', category: 'Teslimat', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Minimum sipariş / parti büyüklüğü uyumu', category: 'Teslimat', weight: 2, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Teknik
    { criterion_name: 'Teknik özellikler / şartname uyumu', category: 'Teknik', weight: 4, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Entegrasyon & arayüz kolaylığı', category: 'Teknik', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Ölçeklenebilirlik / genişleme', category: 'Teknik', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Uyumluluk (mevcut sistem / ekipman)', category: 'Teknik', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Bilgi güvenliği & erişim kontrolü', category: 'Teknik', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Dokümantasyon & veri kalitesi', category: 'Teknik', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Operasyonel
    { criterion_name: 'Uygulama / devreye alma süresi', category: 'Operasyonel', weight: 4, measurement_unit: 'Gün', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Eğitim ihtiyacı (süre)', category: 'Operasyonel', weight: 3, measurement_unit: 'Saat', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Bakım kolaylığı & erişilebilirlik', category: 'Operasyonel', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'İş güvenliği / ergonomi', category: 'Operasyonel', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Kullanım kolaylığı (UX)', category: 'Operasyonel', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Hizmet
    { criterion_name: 'Satış öncesi & satış sonrası destek', category: 'Hizmet', weight: 4, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Teknik destek & SLA', category: 'Hizmet', weight: 4, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Garanti süresi & kapsamı', category: 'Hizmet', weight: 3, measurement_unit: 'Ay', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Yedek parça & sarf erişimi', category: 'Hizmet', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Yerel / bölgesel servis ağı', category: 'Hizmet', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Çevresel
    { criterion_name: 'Enerji verimliliği', category: 'Çevresel', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Çevresel etki / sürdürülebilirlik', category: 'Çevresel', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Atık / geri dönüşüm uyumu', category: 'Çevresel', weight: 2, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    // Pazar & risk
    { criterion_name: 'Pazar itibarı & referanslar', category: 'Pazar', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'İnovasyon & yol haritası', category: 'Pazar', weight: 3, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
    { criterion_name: 'Genel risk (tedarik / proje)', category: 'Diğer', weight: 4, measurement_unit: 'Puan', scoring_method: 'Numerical', source: 'manual', description: '' },
];

function createDefaultManualMetricsSeed() {
    const rows = DEFAULT_MANUAL_METRICS_TEMPLATE.map((row, idx) => ({
        ...row,
        id: `temp_${crypto.randomUUID()}`,
        order_index: idx,
        include_in_matrix: true,
    }));
    return normalizeMatrixWeightsTo100(rows);
}

const isTempCriterionId = (id) => id != null && String(id).startsWith('temp_');

/** Matris/karşılaştırmada kullanılan metrikler */
function criteriaInMatrix(criteria) {
    return (criteria || []).filter((c) => c.include_in_matrix !== false);
}

/** Dahil matriklerin ağırlıklarını toplamı 100 olacak şekilde oransal normalize eder */
function normalizeMatrixWeightsTo100(rows) {
    const included = rows.filter((c) => c.include_in_matrix !== false);
    if (included.length === 0) return rows;
    const sum = included.reduce((s, c) => s + Number(c.weight || 0), 0);
    if (sum <= 0) {
        const eq = 100 / included.length;
        return rows.map((c) =>
            c.include_in_matrix === false ? c : { ...c, weight: Math.round(eq * 100) / 100 }
        );
    }
    return rows.map((c) => {
        if (c.include_in_matrix === false) return c;
        const w = Number(c.weight || 0);
        return { ...c, weight: Math.round(((w / sum) * 100) * 100) / 100 };
    });
}

/** Yeni metrik eklendiğinde mevcut dahil ağırlıkları bölüştürür (toplam 100) */
function growMatrixWithNewCriterion(prev, newCrit) {
    const active = prev.filter((c) => c.include_in_matrix !== false);
    const m = active.length;
    const factor = m > 0 ? m / (m + 1) : 1;
    const newShare = 100 / (m + 1);
    const updated = prev.map((c) => {
        if (c.include_in_matrix === false) return c;
        const w = Number(c.weight || 0);
        return { ...c, weight: Math.round(w * factor * 100) / 100 };
    });
    return [...updated, { ...newCrit, include_in_matrix: true, weight: Math.round(newShare * 100) / 100 }];
}

/** Karşılaştırmadan çıkar: ağırlığı kalan dahil metriklere oransal dağıtır */
function excludeCriterionFromMatrix(criteria, id) {
    const target = criteria.find((c) => c.id === id);
    if (!target || target.include_in_matrix === false) return criteria;
    const freed = Number(target.weight || 0);
    const next = criteria.map((c) => (c.id === id ? { ...c, include_in_matrix: false } : c));
    const active = next.filter((c) => c.include_in_matrix !== false);
    if (active.length === 0) return next;
    if (freed <= 0) return next;
    const sumW = active.reduce((s, c) => s + Number(c.weight || 0), 0);
    if (sumW <= 0) {
        const add = freed / active.length;
        return next.map((c) => {
            if (c.include_in_matrix === false) return c;
            const w = Number(c.weight || 0);
            return { ...c, weight: Math.round((w + add) * 100) / 100 };
        });
    }
    return next.map((c) => {
        if (c.include_in_matrix === false) return c;
        const w = Number(c.weight || 0);
        const add = freed * (w / sumW);
        return { ...c, weight: Math.round((w + add) * 100) / 100 };
    });
}

/** Matrise tekrar dahil et: mevcut dahil ağırlıklardan eşit pay bölüşür */
function includeCriterionInMatrix(criteria, id) {
    const target = criteria.find((c) => c.id === id);
    if (!target || target.include_in_matrix !== false) return criteria;
    const active = criteria.filter((c) => c.include_in_matrix !== false);
    const m = active.length;
    const factor = m > 0 ? m / (m + 1) : 1;
    const newShare = 100 / (m + 1);
    return criteria.map((c) => {
        if (c.id === id) return { ...c, include_in_matrix: true, weight: Math.round(newShare * 100) / 100 };
        if (c.include_in_matrix === false) return c;
        const w = Number(c.weight || 0);
        return { ...c, weight: Math.round(w * factor * 100) / 100 };
    });
}

async function upsertCriterionScoresForItem(supabase, itemId, alt, criteriaList, tempToReal) {
    if (!criteriaList?.length || !itemId) return;
    for (const crit of criteriaList) {
        const cid = isTempCriterionId(crit.id) ? tempToReal?.[crit.id] : crit.id;
        if (!cid) continue;
        if (crit.include_in_matrix === false) {
            await supabase
                .from('benchmark_scores')
                .delete()
                .eq('benchmark_item_id', itemId)
                .eq('criterion_id', cid);
            continue;
        }
        const rawVal = alt.criterionScores?.[crit.id];
        if (rawVal === '' || rawVal == null) {
            await supabase
                .from('benchmark_scores')
                .delete()
                .eq('benchmark_item_id', itemId)
                .eq('criterion_id', cid);
            continue;
        }
        const normalized = Math.min(100, Math.max(0, parseFloat(String(rawVal))));
        if (Number.isNaN(normalized)) continue;
        const w = Number(crit.weight) || 1;
        const weighted = (normalized * w) / 100;
        const { error } = await supabase.from('benchmark_scores').upsert(
            {
                benchmark_item_id: itemId,
                criterion_id: cid,
                raw_value: normalized,
                normalized_score: normalized,
                weighted_score: weighted,
            },
            { onConflict: 'benchmark_item_id,criterion_id' }
        );
        if (error) throw error;
    }
}

const createEmptyAlternative = () => ({
    item_name: '',
    description: '',
    supplier_id: '',
    model_number: '',
    unit_price: '',
    currency: 'TRY',
    minimum_order_quantity: '',
    lead_time_days: '',
    payment_terms: '',
    total_cost_of_ownership: '',
    roi_percentage: '',
    quality_score: '',
    performance_score: '',
    reliability_score: '',
    after_sales_service_score: '',
    warranty_period_months: '',
    support_availability: '',
    technical_support_score: '',
    delivery_time_days: '',
    implementation_time_days: '',
    training_required_hours: '',
    maintenance_cost: '',
    maintenance_frequency_months: '',
    energy_efficiency_score: '',
    environmental_impact_score: '',
    ease_of_use_score: '',
    documentation_quality_score: '',
    scalability_score: '',
    compatibility_score: '',
    innovation_score: '',
    market_reputation_score: '',
    customer_references_count: '',
    risk_level: '',
    is_current_solution: false,
    /** Metrikler sekmesindeki metrik (criterion) id → 0–100 puan (matris; benchmark_scores) */
    criterionScores: {},
});

const numToFormStr = (v) => {
    if (v === null || v === undefined) return '';
    return String(v);
};

/** DB satırı → form alternatif state (düzenlemede mevcut veriyi göstermek için) */
const mapBenchmarkItemRowToAlternative = (row) => ({
    ...createEmptyAlternative(),
    id: row.id,
    item_name: row.item_name ?? '',
    description: row.description ?? '',
    supplier_id: row.supplier_id ?? '',
    model_number: row.model_number ?? '',
    unit_price: numToFormStr(row.unit_price),
    currency: row.currency || 'TRY',
    minimum_order_quantity: numToFormStr(row.minimum_order_quantity),
    lead_time_days: numToFormStr(row.lead_time_days),
    payment_terms: row.payment_terms ?? '',
    total_cost_of_ownership: numToFormStr(row.total_cost_of_ownership),
    roi_percentage: numToFormStr(row.roi_percentage),
    quality_score: numToFormStr(row.quality_score),
    performance_score: numToFormStr(row.performance_score),
    reliability_score: numToFormStr(row.reliability_score),
    after_sales_service_score: numToFormStr(row.after_sales_service_score),
    warranty_period_months: numToFormStr(row.warranty_period_months),
    support_availability: row.support_availability ?? '',
    technical_support_score: numToFormStr(row.technical_support_score),
    delivery_time_days: numToFormStr(row.delivery_time_days),
    implementation_time_days: numToFormStr(row.implementation_time_days),
    training_required_hours: numToFormStr(row.training_required_hours),
    maintenance_cost: numToFormStr(row.maintenance_cost),
    maintenance_frequency_months: numToFormStr(row.maintenance_frequency_months),
    energy_efficiency_score: numToFormStr(row.energy_efficiency_score),
    environmental_impact_score: numToFormStr(row.environmental_impact_score),
    ease_of_use_score: numToFormStr(row.ease_of_use_score),
    documentation_quality_score: numToFormStr(row.documentation_quality_score),
    scalability_score: numToFormStr(row.scalability_score),
    compatibility_score: numToFormStr(row.compatibility_score),
    innovation_score: numToFormStr(row.innovation_score),
    market_reputation_score: numToFormStr(row.market_reputation_score),
    customer_references_count: numToFormStr(row.customer_references_count),
    risk_level: row.risk_level ?? '',
    is_current_solution: !!row.is_current_solution,
    criterionScores: {},
});

const buildBenchmarkItemPayload = (alt) => {
    const parseDecimal = (val) => (val !== '' && val != null ? parseFloat(val) : null);
    const parseIntValue = (val) => (val !== '' && val != null ? parseInt(val, 10) : null);
    const cleanSupplier =
        alt.supplier_id && String(alt.supplier_id).trim() !== ''
            ? alt.supplier_id
            : null;
    return {
        item_name: alt.item_name,
        description: alt.description || null,
        supplier_id: cleanSupplier,
        model_number: alt.model_number || null,
        specifications: null,
        unit_price: parseDecimal(alt.unit_price),
        currency: alt.currency || 'TRY',
        minimum_order_quantity: parseIntValue(alt.minimum_order_quantity),
        lead_time_days: parseIntValue(alt.lead_time_days),
        payment_terms: alt.payment_terms || null,
        total_cost_of_ownership: parseDecimal(alt.total_cost_of_ownership),
        roi_percentage: parseDecimal(alt.roi_percentage),
        quality_score: parseDecimal(alt.quality_score),
        performance_score: parseDecimal(alt.performance_score),
        reliability_score: parseDecimal(alt.reliability_score),
        after_sales_service_score: parseDecimal(alt.after_sales_service_score),
        warranty_period_months: parseIntValue(alt.warranty_period_months),
        support_availability: alt.support_availability || null,
        technical_support_score: parseDecimal(alt.technical_support_score),
        delivery_time_days: parseIntValue(alt.delivery_time_days),
        implementation_time_days: parseIntValue(alt.implementation_time_days),
        training_required_hours: parseIntValue(alt.training_required_hours),
        maintenance_cost: parseDecimal(alt.maintenance_cost),
        maintenance_frequency_months: parseIntValue(alt.maintenance_frequency_months),
        energy_efficiency_score: parseDecimal(alt.energy_efficiency_score),
        environmental_impact_score: parseDecimal(alt.environmental_impact_score),
        ease_of_use_score: parseDecimal(alt.ease_of_use_score),
        documentation_quality_score: parseDecimal(alt.documentation_quality_score),
        scalability_score: parseDecimal(alt.scalability_score),
        compatibility_score: parseDecimal(alt.compatibility_score),
        innovation_score: parseDecimal(alt.innovation_score),
        market_reputation_score: parseDecimal(alt.market_reputation_score),
        customer_references_count: parseIntValue(alt.customer_references_count),
        risk_level: alt.risk_level || null,
        is_current_solution: !!alt.is_current_solution,
    };
};

const BenchmarkForm = ({ 
    isOpen, 
    onClose, 
    benchmark = null,
    categories,
    personnel,
    onSuccess 
}) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    
    // Personel arama için state'ler
    const [ownerSearchOpen, setOwnerSearchOpen] = useState(false);
    const [ownerSearchValue, setOwnerSearchValue] = useState('');
    const [teamSearchValue, setTeamSearchValue] = useState('');
    
    // Alternatifler için state
    const [alternatives, setAlternatives] = useState([]);
    const [newAlternative, setNewAlternative] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
    const [supplierSearchValue, setSupplierSearchValue] = useState('');

    const [criteria, setCriteria] = useState([]);
    const [newCriterion, setNewCriterion] = useState(null);
    const [editingCriterion, setEditingCriterion] = useState(null);
    
    // Form state
    const [formData, setFormData] = useState({
        category_id: '',
        title: '',
        description: '',
        objective: '',
        scope: '',
        status: 'Taslak',
        priority: 'Normal',
        owner_id: '',
        department_id: '',
        team_members: [],
        start_date: '',
        target_completion_date: '',
        estimated_budget: '',
        currency: 'TRY',
        tags: [],
        notes: ''
    });

    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        fetchDepartments();
        
        if (benchmark) {
            setFormData({
                category_id: benchmark.category_id || '',
                title: benchmark.title || '',
                description: benchmark.description || '',
                objective: benchmark.objective || '',
                scope: benchmark.scope || '',
                status: benchmark.status || 'Taslak',
                priority: benchmark.priority || 'Normal',
                owner_id: benchmark.owner_id || '',
                department_id: benchmark.department_id || '',
                team_members: benchmark.team_members || [],
                start_date: benchmark.start_date || '',
                target_completion_date: benchmark.target_completion_date || '',
                estimated_budget: benchmark.estimated_budget || '',
                currency: benchmark.currency || 'TRY',
                tags: benchmark.tags || [],
                notes: benchmark.notes || ''
            });
        }
    }, [benchmark]);

    useEffect(() => {
        if (!isOpen) return;
        if (!benchmark?.id) {
            setAlternatives([]);
            setNewAlternative(null);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('benchmark_items')
                .select('*')
                .eq('benchmark_id', benchmark.id)
                .order('rank_order', { ascending: true });
            if (cancelled) return;
            if (error) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Alternatifler yüklenemedi',
                    description: error.message,
                });
                setAlternatives([]);
                return;
            }
            const rows = data || [];
            const itemIds = rows.map((r) => r.id);
            let scoresByItem = {};
            if (itemIds.length > 0) {
                const { data: scoreRows } = await supabase
                    .from('benchmark_scores')
                    .select('benchmark_item_id, criterion_id, normalized_score')
                    .in('benchmark_item_id', itemIds);
                for (const s of scoreRows || []) {
                    if (!scoresByItem[s.benchmark_item_id]) scoresByItem[s.benchmark_item_id] = {};
                    scoresByItem[s.benchmark_item_id][s.criterion_id] =
                        s.normalized_score != null ? String(s.normalized_score) : '';
                }
            }
            setAlternatives(
                rows.map((row) => {
                    const base = mapBenchmarkItemRowToAlternative(row);
                    return {
                        ...base,
                        criterionScores: scoresByItem[row.id] || {},
                    };
                })
            );
            setNewAlternative(null);
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, benchmark?.id]);

    useEffect(() => {
        if (!isOpen) return;
        if (!benchmark?.id) {
            setCriteria(createDefaultManualMetricsSeed());
            setNewCriterion(null);
            setEditingCriterion(null);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('benchmark_criteria')
                .select('*')
                .eq('benchmark_id', benchmark.id)
                .order('order_index', { ascending: true });
            if (cancelled) return;
            if (error) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Metrikler yüklenemedi',
                    description: error.message,
                });
                setCriteria([]);
                return;
            }
            setCriteria(
                (data || []).map((row) => ({
                    ...row,
                    include_in_matrix: row.include_in_matrix !== false,
                }))
            );
            setNewCriterion(null);
            setEditingCriterion(null);
        })();
        return () => {
            cancelled = true;
        };
        // toast bilinçli olarak dışarıda: yeni benchmarkta metrik listesinin toast ile sıfırlanmaması için
    }, [isOpen, benchmark?.id]);
    
    // Kategorileri kontrol et ve uyar
    useEffect(() => {
        console.log('📊 Kategoriler yüklendi:', categories);
        
        if (isOpen && categories.length === 0) {
            console.error('❌ Kategoriler boş!');
            toast({
                variant: 'destructive',
                title: 'Kategoriler Yüklenemedi',
                description: 'Lütfen Supabase SQL Editor\'de create-benchmark-module.sql dosyasını çalıştırın.'
            });
        } else if (isOpen && categories.length > 0) {
            console.log('✅ Kategoriler hazır:', categories.length);
        }
    }, [categories, isOpen, toast]);

    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name')
                .order('name');
            if (!error && data) setSuppliers(data);
        })();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || benchmark?.id) return;
        const today = new Date().toISOString().slice(0, 10);
        setFormData((prev) => ({
            ...prev,
            start_date: prev.start_date || today,
        }));
    }, [isOpen, benchmark?.id]);

    useEffect(() => {
        if (!isOpen || benchmark?.id || !user?.email) return;
        const me = personnel.find(
            (p) => p.email && p.email.toLowerCase() === user.email.toLowerCase()
        );
        if (me) {
            setFormData((prev) => ({
                ...prev,
                owner_id: prev.owner_id || me.id,
            }));
        }
    }, [isOpen, benchmark?.id, user?.email, personnel]);

    const fetchDepartments = async () => {
        try {
            // Önce cost_settings'den dene (unit_name kolonu kullanılıyor)
            const { data: costDepts, error: costError } = await supabase
                .from('cost_settings')
                .select('id, unit_name')
                .order('unit_name');

            if (costError) console.warn('cost_settings hatası:', costError);
            
            const formattedCostDepts = normalizeCostSettingsRows(costDepts || []).map((d) => ({
                id: d.id,
                name: d.unit_name,
            }));

            // Eğer cost_settings boşsa, boş liste kullan (personnel'den çekme)
            if (!formattedCostDepts || formattedCostDepts.length === 0) {
                console.log('⚠️ cost_settings boş - departman seçimi devre dışı');
                setDepartments([]);
            } else {
                console.log('✅ cost_settings\'den departmanlar yüklendi:', formattedCostDepts);
                setDepartments(formattedCostDepts);
            }
        } catch (error) {
            console.error('Departman yüklenirken hata:', error);
            setDepartments([]);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!formData.tags.includes(tagInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()]
                }));
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
    };

    const handleToggleTeamMember = (personId) => {
        setFormData(prev => {
            const isSelected = prev.team_members.includes(personId);
            return {
                ...prev,
                team_members: isSelected
                    ? prev.team_members.filter(id => id !== personId)
                    : [...prev.team_members, personId]
            };
        });
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Dosya boyutu kontrolü (10MB)
        const maxSize = 10 * 1024 * 1024;
        const oversizedFiles = files.filter(f => f.size > maxSize);
        
        if (oversizedFiles.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Dosya Çok Büyük',
                description: `Maksimum dosya boyutu 10MB. Lütfen daha küçük dosyalar seçin.`
            });
            return;
        }

        setUploading(true);
        const newFiles = [];

        try {
            for (const file of files) {
                // Dosya metadata'sını kaydet
                newFiles.push({
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploaded: false
                });
            }
            
            setUploadedFiles(prev => [...prev, ...newFiles]);
            
            toast({
                title: 'Dosyalar Hazır',
                description: `${files.length} dosya benchmark'a eklenmeye hazır. Formu kaydettiğinizde yüklenecek.`
            });
        } catch (error) {
            console.error('Dosya hazırlama hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosyalar hazırlanırken bir hata oluştu.'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Filtrelenmiş personel listeleri
    const filteredPersonnelForTeam = useMemo(() => {
        if (!teamSearchValue) return personnel;
        const search = teamSearchValue.toLowerCase();
        return personnel.filter(p => 
            p.full_name?.toLowerCase().includes(search) ||
            p.department?.toLowerCase().includes(search)
        );
    }, [personnel, teamSearchValue]);

    const selectedOwner = useMemo(() => {
        return personnel.find(p => p.id === formData.owner_id);
    }, [personnel, formData.owner_id]);

    const selectedTeamMembers = useMemo(() => {
        return personnel.filter(p => formData.team_members.includes(p.id));
    }, [personnel, formData.team_members]);

    const activeComparisons = useMemo(
        () => listActiveComparisonsFromDraft(alternatives),
        [alternatives]
    );

    const draftRankingPreview = useMemo(
        () => previewRankingFromDraftAlternatives(alternatives),
        [alternatives]
    );

    const filteredSuppliers = useMemo(() => {
        if (!supplierSearchValue) return suppliers;
        const q = supplierSearchValue.toLowerCase();
        return suppliers.filter((s) => s.name?.toLowerCase().includes(q));
    }, [suppliers, supplierSearchValue]);

    const selectedSupplierForAlt = useMemo(() => {
        if (!newAlternative?.supplier_id) return null;
        return suppliers.find((s) => s.id === newAlternative.supplier_id);
    }, [suppliers, newAlternative?.supplier_id]);

    const matrixCriteria = useMemo(() => criteriaInMatrix(criteria), [criteria]);

    const handleRemoveTeamMember = (personId) => {
        setFormData(prev => ({
            ...prev,
            team_members: prev.team_members.filter(id => id !== personId)
        }));
    };

    const handleOpenNewCriterion = () => {
        setEditingCriterion(null);
        setNewCriterion(createEmptyCriterionDraft());
    };

    const handleSaveNewCriterion = async () => {
        if (!newCriterion?.criterion_name?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Metrik adı zorunludur.',
            });
            return;
        }

        const base = {
            criterion_name: newCriterion.criterion_name.trim(),
            description: newCriterion.description?.trim() || null,
            category: newCriterion.category?.trim() || null,
            weight: parseFloat(newCriterion.weight) || 1,
            measurement_unit: newCriterion.measurement_unit?.trim() || null,
            scoring_method: newCriterion.scoring_method || 'Numerical',
            source: 'manual',
        };

        try {
            if (benchmark?.id) {
                const { data, error } = await supabase
                    .from('benchmark_criteria')
                    .insert({
                        benchmark_id: benchmark.id,
                        ...base,
                        order_index: criteria.length,
                        include_in_matrix: true,
                    })
                    .select()
                    .single();
                if (error) throw error;
                setCriteria((prev) =>
                    growMatrixWithNewCriterion(prev, {
                        ...data,
                        include_in_matrix: data.include_in_matrix !== false,
                    })
                );
            } else {
                const id = `temp_${crypto.randomUUID()}`;
                setCriteria((prev) =>
                    growMatrixWithNewCriterion(prev, {
                        id,
                        ...base,
                        order_index: criteria.length,
                        include_in_matrix: true,
                    })
                );
            }
            setNewCriterion(null);
            toast({ title: 'Metrik eklendi' });
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: err.message || 'Metrik eklenemedi.',
            });
        }
    };

    const handleStartEditCriterion = (row) => {
        setNewCriterion(null);
        setEditingCriterion({
            id: row.id,
            criterion_name: row.criterion_name || '',
            description: row.description || '',
            category: row.category || '',
            weight: String(row.weight ?? 1),
            measurement_unit: row.measurement_unit || '',
            scoring_method: row.scoring_method || 'Numerical',
        });
    };

    const handleSaveEditCriterion = async () => {
        if (!editingCriterion?.criterion_name?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Metrik adı zorunludur.',
            });
            return;
        }

        const fields = {
            criterion_name: editingCriterion.criterion_name.trim(),
            description: editingCriterion.description?.trim() || null,
            category: editingCriterion.category?.trim() || null,
            weight: parseFloat(editingCriterion.weight) || 1,
            measurement_unit: editingCriterion.measurement_unit?.trim() || null,
            scoring_method: editingCriterion.scoring_method || 'Numerical',
        };

        try {
            if (isTempCriterionId(editingCriterion.id)) {
                setCriteria((prev) =>
                    prev.map((c) => (c.id === editingCriterion.id ? { ...c, ...fields } : c))
                );
                setEditingCriterion(null);
                toast({ title: 'Güncellendi' });
                return;
            }

            if (!benchmark?.id) return;

            const { data, error } = await supabase
                .from('benchmark_criteria')
                .update(fields)
                .eq('id', editingCriterion.id)
                .select()
                .single();
            if (error) throw error;
            setCriteria((prev) =>
                prev.map((c) =>
                    c.id === data.id
                        ? { ...c, ...data, include_in_matrix: data.include_in_matrix !== false }
                        : c
                )
            );
            setEditingCriterion(null);
            toast({ title: 'Güncellendi' });
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: err.message || 'Metrik güncellenemedi.',
            });
        }
    };

    const handleDeleteCriterion = async (row) => {
        if (
            !confirm(
                'Bu metrik silinsin mi? Kayıtlı matris puanları varsa ilişkili skorlar da kaldırılabilir.'
            )
        ) {
            return;
        }

        try {
            if (isTempCriterionId(row.id)) {
                setCriteria((prev) =>
                    normalizeMatrixWeightsTo100(prev.filter((c) => c.id !== row.id))
                );
                if (editingCriterion?.id === row.id) setEditingCriterion(null);
                toast({ title: 'Metrik kaldırıldı' });
                return;
            }

            if (!benchmark?.id) return;

            const { error } = await supabase.from('benchmark_criteria').delete().eq('id', row.id);
            if (error) throw error;
            setCriteria((prev) => normalizeMatrixWeightsTo100(prev.filter((c) => c.id !== row.id)));
            if (editingCriterion?.id === row.id) setEditingCriterion(null);
            toast({ title: 'Metrik silindi' });
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: err.message || 'Metrik silinemedi.',
            });
        }
    };

    const handleMatrixExclude = (id) => {
        setCriteria((prev) => excludeCriterionFromMatrix(prev, id));
        toast({
            title: 'Karşılaştırmadan çıkarıldı',
            description:
                'Ağırlık kalan metriklere oransal dağıtıldı. Tanım Metrikler sekmesinde duruyor; istediğinizde tekrar ekleyebilirsiniz.',
        });
    };

    const handleMatrixInclude = (id) => {
        setCriteria((prev) => includeCriterionInMatrix(prev, id));
        toast({
            title: 'Matrise eklendi',
            description: 'Ağırlıklar yeniden paylaştırıldı.',
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.category_id) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kategori seçimi zorunludur.'
            });
            return;
        }

        if (!formData.title.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Başlık zorunludur.'
            });
            return;
        }

        if (!formData.description.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Açıklama zorunludur.'
            });
            return;
        }

        setLoading(true);

        try {
            // UUID alanlarını temizle - boş string'leri null'a çevir
            const cleanOwnerId = formData.owner_id && formData.owner_id.trim() !== '' ? formData.owner_id : null;
            const cleanDepartmentId = formData.department_id && 
                                     formData.department_id.trim() !== '' &&
                                     !formData.department_id.startsWith('dept_') 
                                     ? formData.department_id 
                                     : null;
            
            // Tarih alanlarını temizle - boş string'leri null'a çevir
            const cleanStartDate = formData.start_date && formData.start_date.trim() !== '' ? formData.start_date : null;
            const cleanTargetCompletionDate = formData.target_completion_date && formData.target_completion_date.trim() !== '' ? formData.target_completion_date : null;
            
            const dataToSave = {
                ...formData,
                owner_id: cleanOwnerId,
                department_id: cleanDepartmentId,
                team_members: formData.team_members && formData.team_members.length > 0 ? formData.team_members : null,
                start_date: cleanStartDate,
                target_completion_date: cleanTargetCompletionDate,
                estimated_budget: formData.estimated_budget 
                    ? parseFloat(formData.estimated_budget) 
                    : null,
                created_by: user?.id
            };

            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in dataToSave) {
                if (dataToSave[key] !== undefined && key !== 'undefined') {
                    cleanedData[key] = dataToSave[key];
                }
            }

            let result;

            if (benchmark?.id) {
                // Update existing
                const { data, error } = await supabase
                    .from('benchmarks')
                    .update(cleanedData)
                    .eq('id', benchmark.id)
                    .select()
                    .single();

                if (error) throw error;
                result = data;

                // Log activity
                await supabase.from('benchmark_activity_log').insert({
                    benchmark_id: benchmark.id,
                    activity_type: 'Güncellendi',
                    description: 'Benchmark kaydı güncellendi',
                    performed_by: user?.id
                });
            } else {
                // Generate benchmark number
                const { data: numberData, error: numberError } = await supabase
                    .rpc('generate_benchmark_number');

                if (numberError) throw numberError;

                cleanedData.benchmark_number = numberData;

                // Create new
                const { data, error } = await supabase
                    .from('benchmarks')
                    .insert(cleanedData)
                    .select()
                    .single();

                if (error) throw error;
                result = data;

                // Log activity
                await supabase.from('benchmark_activity_log').insert({
                    benchmark_id: result.id,
                    activity_type: 'Oluşturuldu',
                    description: 'Yeni benchmark kaydı oluşturuldu',
                    performed_by: user?.id
                });
            }

            /** Yeni benchmark: taslak temp_* kriterleri DB'ye yaz → benchmark_scores için id eşlemesi */
            let tempToRealCriterionIds = {};
            if (result?.id && !benchmark?.id && criteria.length > 0) {
                for (let i = 0; i < criteria.length; i++) {
                    const c = criteria[i];
                    if (!isTempCriterionId(c.id)) continue;
                    const { data: insertedCrit, error: critErr } = await supabase
                        .from('benchmark_criteria')
                        .insert({
                            benchmark_id: result.id,
                            criterion_name: c.criterion_name,
                            description: c.description ?? null,
                            category: c.category ?? null,
                            weight: c.weight ?? 1,
                            measurement_unit: c.measurement_unit ?? null,
                            scoring_method: c.scoring_method || 'Numerical',
                            order_index: i,
                            source: 'manual',
                            include_in_matrix: c.include_in_matrix !== false,
                        })
                        .select()
                        .single();
                    if (critErr) throw critErr;
                    tempToRealCriterionIds[c.id] = insertedCrit.id;
                }
            }

            /** Kayıtlı benchmark: metrik satırları (ağırlık, matrise dahil) güncelle */
            if (result?.id && benchmark?.id && criteria.length > 0) {
                for (let i = 0; i < criteria.length; i++) {
                    const c = criteria[i];
                    if (isTempCriterionId(c.id)) continue;
                    const { error: critUpErr } = await supabase
                        .from('benchmark_criteria')
                        .update({
                            criterion_name: c.criterion_name,
                            description: c.description ?? null,
                            category: c.category ?? null,
                            weight: c.weight ?? 1,
                            measurement_unit: c.measurement_unit ?? null,
                            scoring_method: c.scoring_method || 'Numerical',
                            order_index: i,
                            include_in_matrix: c.include_in_matrix !== false,
                        })
                        .eq('id', c.id);
                    if (critUpErr) throw critUpErr;
                }
            }

            // Alternatifleri kaydet: mevcut kayıtta önce silinenleri ayıkla, sonra güncelle / ekle
            if (result?.id) {
                const editingBenchmark = !!benchmark?.id;

                if (editingBenchmark) {
                    const keptIds = alternatives.filter((a) => a.id).map((a) => a.id);
                    if (keptIds.length > 0) {
                        const { error: delErr } = await supabase
                            .from('benchmark_items')
                            .delete()
                            .eq('benchmark_id', result.id)
                            .not('id', 'in', `(${keptIds.join(',')})`);
                        if (delErr) throw delErr;
                    } else {
                        const { error: delErr } = await supabase
                            .from('benchmark_items')
                            .delete()
                            .eq('benchmark_id', result.id);
                        if (delErr) throw delErr;
                    }
                }

                if (alternatives.length > 0) {
                    console.log(`📦 ${alternatives.length} alternatif kaydediliyor...`);

                    for (const alt of alternatives) {
                        try {
                            const payload = buildBenchmarkItemPayload(alt);
                            if (editingBenchmark && alt.id) {
                                const { error: altError } = await supabase
                                    .from('benchmark_items')
                                    .update(payload)
                                    .eq('id', alt.id);
                                if (altError) throw altError;
                                await upsertCriterionScoresForItem(
                                    supabase,
                                    alt.id,
                                    alt,
                                    criteria,
                                    tempToRealCriterionIds
                                );
                                console.log(`✅ Alternatif güncellendi: ${alt.item_name}`);
                            } else {
                                const { data: insertedItem, error: altError } = await supabase
                                    .from('benchmark_items')
                                    .insert({
                                        benchmark_id: result.id,
                                        ...payload,
                                    })
                                    .select('id')
                                    .single();
                                if (altError) throw altError;
                                await upsertCriterionScoresForItem(
                                    supabase,
                                    insertedItem.id,
                                    alt,
                                    criteria,
                                    tempToRealCriterionIds
                                );
                                console.log(`✅ Alternatif kaydedildi: ${alt.item_name}`);
                            }
                        } catch (altError) {
                            console.error(`❌ Alternatif kaydetme hatası (${alt.item_name}):`, altError);
                            toast({
                                variant: 'destructive',
                                title: 'Alternatif Kaydetme Hatası',
                                description: `${alt.item_name} kaydedilemedi: ${altError.message}`,
                            });
                        }
                    }
                }
            }

            if (result?.id) {
                try {
                    await syncAutoBenchmarkCriteria(supabase, result.id);
                } catch (syncErr) {
                    console.warn('Otomatik kriter senkronu:', syncErr);
                }
            }

            // Dosyaları yükle
            if (uploadedFiles.length > 0) {
                console.log(`📤 ${uploadedFiles.length} dosya yükleniyor...`);
                
                for (const fileData of uploadedFiles) {
                    try {
                        const fileExt = fileData.name.split('.').pop();
                        const fileName = `${result.id}/${Date.now()}_${fileData.name}`;
                        const filePath = `benchmark-documents/${fileName}`;

                        // Dosyayı storage'a yükle
                        const { error: uploadError } = await supabase.storage
                            .from('documents')
                            .upload(filePath, fileData.file, {
                                cacheControl: '3600',
                                upsert: false
                            });

                        if (uploadError) throw uploadError;

                        // Public URL al
                        const { data: { publicUrl } } = supabase.storage
                            .from('documents')
                            .getPublicUrl(filePath);

                        // Metadata kaydet
                        const { error: metaError } = await supabase
                            .from('benchmark_documents')
                            .insert({
                                benchmark_id: result.id,
                                document_title: fileData.name,
                                title: fileData.name, // Alternatif alan
                                file_path: filePath,
                                file_url: publicUrl,
                                file_name: fileData.name,
                                file_type: fileData.type || 'application/octet-stream',
                                file_size: fileData.size,
                                uploaded_by: user?.id
                            });

                        if (metaError) throw metaError;
                        
                        console.log(`✅ Dosya yüklendi: ${fileData.name}`);
                    } catch (fileError) {
                        console.error(`❌ Dosya yükleme hatası (${fileData.name}):`, fileError);
                        toast({
                            variant: 'destructive',
                            title: 'Dosya Yükleme Hatası',
                            description: `${fileData.name} yüklenemedi: ${fileError.message}`
                        });
                    }
                }
                
                // Activity log
                await supabase.from('benchmark_activity_log').insert({
                    benchmark_id: result.id,
                    activity_type: 'Doküman Eklendi',
                    description: `${uploadedFiles.length} dosya yüklendi`,
                    performed_by: user?.id
                });
            }

            const manualCritCount =
                !benchmark?.id ? criteria.filter((c) => isTempCriterionId(c.id)).length : 0;

            toast({
                title: 'Başarılı',
                description: benchmark?.id 
                    ? 'Benchmark başarıyla güncellendi.' 
                    : `Yeni benchmark oluşturuldu${manualCritCount > 0 ? `, ${manualCritCount} manuel metrik` : ''}${alternatives.length > 0 ? `, ${alternatives.length} alternatif` : ''}${uploadedFiles.length > 0 ? `, ${uploadedFiles.length} dosya` : ''}.`
            });

            // Formu temizle
            setUploadedFiles([]);
            setAlternatives([]);
            setNewAlternative(null);
            setCriteria([]);
            setNewCriterion(null);
            setEditingCriterion(null);
            
            onSuccess(result);
        } catch (error) {
            console.error('Kaydetme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Benchmark kaydedilirken bir hata oluştu: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const statuses = [
        'Taslak',
        'Devam Ediyor',
        'Analiz Aşamasında',
        'Onay Bekliyor',
        'Tamamlandı',
        'İptal'
    ];

    const priorities = ['Kritik', 'Yüksek', 'Normal', 'Düşük'];
    const currencies = ['TRY', 'USD', 'EUR'];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="!fixed !inset-0 !left-0 !top-0 z-50 !m-0 flex h-[100dvh] !max-h-[100dvh] w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 shadow-xl sm:!max-h-[100dvh]">
                <DialogHeader className="sr-only"><DialogTitle>{benchmark?.id ? 'Benchmark Düzenle' : 'Yeni Benchmark Oluştur'}</DialogTitle></DialogHeader>
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><BarChart3 className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{benchmark?.id ? 'Benchmark Düzenle' : 'Yeni Benchmark Oluştur'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Karşılaştırma Yönetimi</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{benchmark?.id ? 'Düzenleme' : 'Yeni'}</span>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 overflow-hidden">
                <form id="benchmark-form" onSubmit={handleSubmit} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-4 border-r border-border pr-4">
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="!inline-flex !h-auto w-full min-w-0 flex-wrap items-stretch justify-start gap-1.5 rounded-md bg-muted p-1.5 sm:p-2">
                                <TabsTrigger value="basic" className="shrink-0 flex-none px-3 py-2 text-sm">
                                    Temel Bilgiler
                                </TabsTrigger>
                                <TabsTrigger value="details" className="shrink-0 flex-none px-3 py-2 text-sm">
                                    Detaylar
                                </TabsTrigger>
                                <TabsTrigger value="team" className="shrink-0 flex-none px-3 py-2 text-sm">
                                    Ekip & Tarihler
                                </TabsTrigger>
                                <TabsTrigger value="criteria" className="shrink-0 flex-none px-3 py-2 text-sm">
                                    Metrikler ({criteria.length})
                                </TabsTrigger>
                                <TabsTrigger value="alternatives" className="shrink-0 flex-none px-3 py-2 text-sm">
                                    Alternatifler
                                </TabsTrigger>
                            </TabsList>

                            {/* Temel Bilgiler */}
                            <TabsContent value="basic" className="space-y-4 mt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="category_id">
                                            Kategori <span className="text-red-500">*</span>
                                        </Label>
                                        {categories.length === 0 ? (
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    ⚠️ Kategoriler yüklenemedi. Lütfen veritabanında 
                                                    <code className="mx-1 px-2 py-1 bg-yellow-100 rounded">benchmark_categories</code> 
                                                    tablosunu kontrol edin.
                                                </p>
                                                <p className="text-xs text-yellow-700 mt-2">
                                                    SQL: <code>scripts/fix-benchmark-categories.sql</code> dosyasını çalıştırın.
                                                </p>
                                            </div>
                                        ) : (
                                            <Select
                                                value={formData.category_id}
                                                onValueChange={(value) => handleChange('category_id', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Kategori seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map((cat) => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="status">Durum</Label>
                                        <Select
                                            value={formData.status}
                                            onValueChange={(value) => handleChange('status', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statuses.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title">
                                        Başlık <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        placeholder="Benchmark başlığı"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">
                                        Açıklama <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="Benchmark detaylı açıklaması"
                                        rows={4}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Öncelik</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(value) => handleChange('priority', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {priorities.map((priority) => (
                                                <SelectItem key={priority} value={priority}>
                                                    {priority}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tags">Etiketler</Label>
                                    <Input
                                        id="tags"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        placeholder="Etiket eklemek için yazın ve Enter'a basın"
                                    />
                                    {formData.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {formData.tags.map((tag, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="secondary"
                                                    className="cursor-pointer"
                                                    onClick={() => handleRemoveTag(tag)}
                                                >
                                                    {tag}
                                                    <X className="ml-1 h-3 w-3" />
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Detaylar */}
                            <TabsContent value="details" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="objective">Benchmark Amacı</Label>
                                    <Textarea
                                        id="objective"
                                        value={formData.objective}
                                        onChange={(e) => handleChange('objective', e.target.value)}
                                        placeholder="Bu benchmark çalışmasının amacı nedir?"
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="scope">Kapsam</Label>
                                    <Textarea
                                        id="scope"
                                        value={formData.scope}
                                        onChange={(e) => handleChange('scope', e.target.value)}
                                        placeholder="Benchmark kapsamı ve sınırları"
                                        rows={3}
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="department_id">İlgili Departman</Label>
                                        <Select
                                            value={formData.department_id}
                                            onValueChange={(value) => handleChange('department_id', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Birim/Departman seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.length === 0 ? (
                                                    <div className="p-3 text-sm text-muted-foreground">
                                                        <p className="font-medium mb-1">ℹ️ Birim listesi boş</p>
                                                        <p className="text-xs">cost_settings tablosunda birim/departman tanımlı değil.</p>
                                                    </div>
                                                ) : (
                                                    departments.map((dept) => (
                                                        <SelectItem key={dept.id} value={dept.id}>
                                                            {dept.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {departments.length === 0 && (
                                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                <span>ℹ️</span>
                                                <span>Departman listesi boş. cost_settings tablosuna departman eklerseniz burada görünür.</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="estimated_budget">Tahmini Bütçe</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="estimated_budget"
                                                type="number"
                                                step="0.01"
                                                value={formData.estimated_budget}
                                                onChange={(e) => handleChange('estimated_budget', e.target.value)}
                                                placeholder="0.00"
                                                className="flex-1"
                                            />
                                            <Select
                                                value={formData.currency}
                                                onValueChange={(value) => handleChange('currency', value)}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {currencies.map((curr) => (
                                                        <SelectItem key={curr} value={curr}>
                                                            {curr}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notlar</Label>
                                    <Textarea
                                        id="notes"
                                        value={formData.notes}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        placeholder="Ek notlar ve açıklamalar"
                                        rows={4}
                                    />
                                </div>
                            </TabsContent>

                            {/* Ekip & Tarihler */}
                            <TabsContent value="team" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="owner_id">Benchmark Sorumlusu</Label>
                                    {personnel.length === 0 ? (
                                        <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                                            <p className="font-medium mb-1">⚠️ Personel bulunamadı</p>
                                            <p className="text-xs">Lütfen personnel tablosuna personel ekleyin.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Popover open={ownerSearchOpen} onOpenChange={setOwnerSearchOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={ownerSearchOpen}
                                                        className="w-full justify-between"
                                                    >
                                                        {selectedOwner ? (
                                                            <span className="flex items-center gap-2">
                                                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                                                {selectedOwner.full_name}
                                                                {selectedOwner.department && (
                                                                    <span className="text-muted-foreground text-sm">
                                                                        ({selectedOwner.department})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">Sorumlu ara ve seç...</span>
                                                        )}
                                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0">
                                                    <Command>
                                                        <CommandInput 
                                                            placeholder="İsim veya departman ara..." 
                                                            value={ownerSearchValue}
                                                            onValueChange={setOwnerSearchValue}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                                                            <CommandGroup>
                                                                {personnel
                                                                    .filter(p => {
                                                                        if (!ownerSearchValue) return true;
                                                                        const search = ownerSearchValue.toLowerCase();
                                                                        return p.full_name?.toLowerCase().includes(search) ||
                                                                               p.department?.toLowerCase().includes(search);
                                                                    })
                                                                    .map((person) => (
                                                                        <CommandItem
                                                                            key={person.id}
                                                                            value={person.full_name}
                                                                            onSelect={() => {
                                                                                handleChange('owner_id', person.id);
                                                                                setOwnerSearchOpen(false);
                                                                                setOwnerSearchValue('');
                                                                            }}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="font-medium">{person.full_name}</span>
                                                                                {person.department && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        {person.department}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            {selectedOwner && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleChange('owner_id', '')}
                                                    className="mt-1"
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Temizle
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Ekip Üyeleri</Label>
                                    {personnel.length === 0 ? (
                                        <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                                            <p className="font-medium mb-1">⚠️ Personel bulunamadı</p>
                                            <p className="text-xs">Lütfen önce personnel tablosuna personel ekleyin.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Arama Input'u */}
                                            <div className="search-box">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                                <input
                                                    type="text"
                                                    placeholder="İsim veya departman ara..."
                                                    value={teamSearchValue}
                                                    onChange={(e) => setTeamSearchValue(e.target.value)}
                                                    className="search-input"
                                                />
                                            </div>

                                            {/* Seçili Ekip Üyeleri */}
                                            {selectedTeamMembers.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-muted-foreground">
                                                        Seçili Üyeler ({selectedTeamMembers.length}):
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedTeamMembers.map((person) => (
                                                            <Badge
                                                                key={person.id}
                                                                variant="secondary"
                                                                className="pl-3 pr-1 py-1 flex items-center gap-1"
                                                            >
                                                                <span className="text-sm">
                                                                    {person.full_name}
                                                                    {person.department && (
                                                                        <span className="text-xs text-muted-foreground ml-1">
                                                                            ({person.department})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 p-0 hover:bg-transparent"
                                                                    onClick={() => handleRemoveTeamMember(person.id)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Personel Listesi */}
                                            <ScrollArea className="border rounded-lg h-48">
                                                <div className="p-2 space-y-1">
                                                    {filteredPersonnelForTeam.length === 0 ? (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            <p>Sonuç bulunamadı.</p>
                                                            <p className="text-xs mt-1">Farklı bir arama terimi deneyin.</p>
                                                        </div>
                                                    ) : (
                                                        filteredPersonnelForTeam.map((person) => {
                                                            const isSelected = formData.team_members.includes(person.id);
                                                            return (
                                                                <div
                                                                    key={person.id}
                                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                                                        isSelected 
                                                                            ? 'bg-primary/10 border border-primary/20' 
                                                                            : 'hover:bg-muted/50'
                                                                    }`}
                                                                    onClick={() => handleToggleTeamMember(person.id)}
                                                                >
                                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                                        isSelected 
                                                                            ? 'bg-primary border-primary' 
                                                                            : 'border-muted-foreground'
                                                                    }`}>
                                                                        {isSelected && (
                                                                            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium">{person.full_name}</p>
                                                                        {person.department && (
                                                                            <p className="text-xs text-muted-foreground">{person.department}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </ScrollArea>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>
                                                    {filteredPersonnelForTeam.length} personel gösteriliyor
                                                </span>
                                                {formData.team_members.length > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleChange('team_members', [])}
                                                        className="h-7"
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Tümünü Temizle
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                                        <Input
                                            id="start_date"
                                            type="date"
                                            value={formData.start_date}
                                            onChange={(e) => handleChange('start_date', e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="target_completion_date">
                                            Hedef Tamamlanma Tarihi
                                        </Label>
                                        <Input
                                            id="target_completion_date"
                                            type="date"
                                            value={formData.target_completion_date}
                                            onChange={(e) => handleChange('target_completion_date', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Dosya Yükleme Bölümü */}
                                <div className="space-y-2">
                                    <Label>Dokümanlar</Label>
                                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            className="hidden"
                                            multiple
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                                            onChange={handleFileSelect}
                                            disabled={uploading}
                                        />
                                        <label
                                            htmlFor="file-upload"
                                            className="cursor-pointer flex flex-col items-center gap-2"
                                        >
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">
                                                {uploading ? 'Dosyalar hazırlanıyor...' : 'Dosya seçmek için tıklayın'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                PDF, Word, Excel, PowerPoint, Resim (Max 10MB)
                                            </p>
                                        </label>
                                    </div>
                                    
                                    {uploadedFiles.length > 0 && (
                                        <div className="space-y-2 mt-3">
                                            <p className="text-sm font-medium">{uploadedFiles.length} dosya seçildi:</p>
                                            {uploadedFiles.map((file, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <File className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="text-sm font-medium">{file.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {(file.size / 1024).toFixed(2)} KB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveFile(index)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Metrikler (benchmark_criteria) */}
                            <TabsContent
                                value="criteria"
                                className="space-y-4 mt-4"
                                onKeyDown={(e) => {
                                    /* Form içinde Enter, ana formu gönderip benchmark kategori doğrulamasını tetiklemesin */
                                    if (e.key !== 'Enter') return;
                                    if (e.target instanceof HTMLTextAreaElement) return;
                                    if (e.target instanceof HTMLInputElement) {
                                        e.preventDefault();
                                    }
                                }}
                            >
                                <div className="rounded-lg border border-muted bg-muted/20 p-4 text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground">Manuel metrikler</p>
                                    <p className="mt-1 leading-relaxed">
                                        Karşılaştırma matrisinde kullanılacak metrikleri buradan tanımlayın. Yeni kayıtta
                                        yaygın metrikler otomatik eklenir; istemediğinizi silebilirsiniz. Kayıt sonrası
                                        alternatif alanlarından otomatik üretilen metrikler (akıllı karşılaştırma) buna eklenir;
                                        otomatik satırlar kayıt sırasında güncellenir, manuel satırlar korunur.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-lg font-semibold">Metrik listesi</h3>
                                    <Button type="button" size="sm" variant="secondary" onClick={handleOpenNewCriterion}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Metrik ekle
                                    </Button>
                                </div>

                                {newCriterion && (
                                    <Card className="border-2 border-primary">
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-base">Yeni metrik</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Metrik adı *</Label>
                                                    <Input
                                                        value={newCriterion.criterion_name}
                                                        onChange={(e) =>
                                                            setNewCriterion({
                                                                ...newCriterion,
                                                                criterion_name: e.target.value,
                                                            })
                                                        }
                                                        placeholder="Örn: Toplam sahip olma maliyeti"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Kategori</Label>
                                                    <Select
                                                        value={newCriterion.category || '__none__'}
                                                        onValueChange={(v) =>
                                                            setNewCriterion({
                                                                ...newCriterion,
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
                                            <div className="space-y-2">
                                                <Label>Açıklama</Label>
                                                <Textarea
                                                    value={newCriterion.description}
                                                    onChange={(e) =>
                                                        setNewCriterion({
                                                            ...newCriterion,
                                                            description: e.target.value,
                                                        })
                                                    }
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Ağırlık (%)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={newCriterion.weight}
                                                        onChange={(e) =>
                                                            setNewCriterion({
                                                                ...newCriterion,
                                                                weight: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
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
                                                            <SelectValue />
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
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" size="sm" onClick={handleSaveNewCriterion}>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Kaydet
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setNewCriterion(null)}
                                                >
                                                    İptal
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {editingCriterion && (
                                    <Card className="border border-muted">
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-base">Metriği düzenle</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Metrik adı *</Label>
                                                    <Input
                                                        value={editingCriterion.criterion_name}
                                                        onChange={(e) =>
                                                            setEditingCriterion({
                                                                ...editingCriterion,
                                                                criterion_name: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
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
                                            <div className="space-y-2">
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
                                                <div className="space-y-2">
                                                    <Label>Ağırlık (%)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={editingCriterion.weight}
                                                        onChange={(e) =>
                                                            setEditingCriterion({
                                                                ...editingCriterion,
                                                                weight: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
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
                                                            <SelectValue />
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
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" size="sm" onClick={handleSaveEditCriterion}>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Kaydet
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setEditingCriterion(null)}
                                                >
                                                    İptal
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {criteria.length === 0 && !newCriterion ? (
                                    <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                                        Henüz metrik yok. Manuel metrik eklemek için &quot;Metrik ekle&quot;ye tıklayın veya
                                        önce alternatifleri doldurup kaydederek otomatik metrik üretin.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {criteria.map((c) => (
                                            <Card key={c.id}>
                                                <CardContent className="py-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h4 className="font-semibold">{c.criterion_name}</h4>
                                                                <Badge variant="secondary">Ağırlık: %{c.weight}</Badge>
                                                                <Badge variant="outline">
                                                                    {c.source === 'auto' ? 'Otomatik' : 'Manuel'}
                                                                </Badge>
                                                                {c.include_in_matrix === false && (
                                                                    <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
                                                                        <EyeOff className="h-3 w-3 mr-1 inline" />
                                                                        Matriste yok
                                                                    </Badge>
                                                                )}
                                                                {c.category && (
                                                                    <Badge variant="outline">{c.category}</Badge>
                                                                )}
                                                            </div>
                                                            {c.description && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    {c.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex shrink-0 flex-wrap gap-1 justify-end">
                                                            {c.include_in_matrix === false && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    onClick={() => handleMatrixInclude(c.id)}
                                                                    title="Bu benchmark karşılaştırma matrisine tekrar dahil et"
                                                                >
                                                                    <RotateCcw className="mr-1 h-4 w-4" />
                                                                    Matrise ekle
                                                                </Button>
                                                            )}
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleStartEditCriterion(c)}
                                                            >
                                                                <Edit className="mr-1 h-4 w-4" />
                                                                Düzenle
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() => handleDeleteCriterion(c)}
                                                                disabled={c.source === 'auto'}
                                                                title={
                                                                    c.source === 'auto'
                                                                        ? 'Otomatik metrik karşılaştırma ekranından yönetilir'
                                                                        : undefined
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Alternatifler Sekmesi */}
                            <TabsContent value="alternatives" className="space-y-4 mt-4">
                                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
                                    <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div className="text-sm space-y-1">
                                        <p className="font-semibold text-foreground">Akıllı karşılaştırma</p>
                                        <p className="text-muted-foreground leading-relaxed">
                                            Doldurduğunuz sayısal alanlar kayıt sonrası otomatik olarak matris metrikleri ve skorlara dönüştürülür (en az iki alternatifte veri olan alanlar).
                                            Maliyet ve süre gibi &quot;düşük iyidir&quot; alanlar alternatifler arasında normalize edilir; puan alanları doğrudan kullanılır.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap justify-between items-center gap-2">
                                    <h3 className="text-lg font-semibold">Karşılaştırılacak alternatifler</h3>
                                    <Button type="button" size="sm" onClick={() => setNewAlternative(createEmptyAlternative())}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Alternatif ekle
                                    </Button>
                                </div>

                                {newAlternative && (
                                    <div className="p-4 border-2 border-primary rounded-lg bg-muted/30 space-y-4">
                                        <div>
                                            <Label>Alternatif adı *</Label>
                                            <Input
                                                value={newAlternative.item_name}
                                                onChange={(e) => setNewAlternative({ ...newAlternative, item_name: e.target.value })}
                                                placeholder="Örn: Tedarikçi X çözümü"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="current-sol"
                                                checked={!!newAlternative.is_current_solution}
                                                onCheckedChange={(c) =>
                                                    setNewAlternative({ ...newAlternative, is_current_solution: !!c })
                                                }
                                            />
                                            <Label htmlFor="current-sol" className="text-sm font-normal cursor-pointer">
                                                Mevcut çözüm / referans (baz çizgisi)
                                            </Label>
                                        </div>

                                        <Accordion type="multiple" defaultValue={['core', 'cost', 'scores']} className="w-full">
                                            <AccordionItem value="core">
                                                <AccordionTrigger>Temel bilgiler & tedarikçi</AccordionTrigger>
                                                <AccordionContent className="space-y-3 pt-2">
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Tedarikçi</Label>
                                                            <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="w-full justify-between"
                                                                    >
                                                                        {selectedSupplierForAlt ? (
                                                                            <span className="truncate">{selectedSupplierForAlt.name}</span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground">Seç (isteğe bağlı)</span>
                                                                        )}
                                                                        <Search className="h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[340px] p-0">
                                                                    <Command>
                                                                        <CommandInput
                                                                            placeholder="Ara..."
                                                                            value={supplierSearchValue}
                                                                            onValueChange={setSupplierSearchValue}
                                                                        />
                                                                        <CommandList>
                                                                            <CommandEmpty>Sonuç yok</CommandEmpty>
                                                                            <CommandGroup>
                                                                                <CommandItem
                                                                                    value="__clear"
                                                                                    onSelect={() => {
                                                                                        setNewAlternative({
                                                                                            ...newAlternative,
                                                                                            supplier_id: '',
                                                                                        });
                                                                                        setSupplierSearchOpen(false);
                                                                                        setSupplierSearchValue('');
                                                                                    }}
                                                                                >
                                                                                    Temizle
                                                                                </CommandItem>
                                                                                {filteredSuppliers.map((s) => (
                                                                                    <CommandItem
                                                                                        key={s.id}
                                                                                        value={s.name}
                                                                                        onSelect={() => {
                                                                                            setNewAlternative({
                                                                                                ...newAlternative,
                                                                                                supplier_id: s.id,
                                                                                            });
                                                                                            setSupplierSearchOpen(false);
                                                                                            setSupplierSearchValue('');
                                                                                        }}
                                                                                    >
                                                                                        {s.name}
                                                                                    </CommandItem>
                                                                                ))}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                        <div>
                                                            <Label>Model / seri no</Label>
                                                            <Input
                                                                value={newAlternative.model_number}
                                                                onChange={(e) =>
                                                                    setNewAlternative({
                                                                        ...newAlternative,
                                                                        model_number: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label>Açıklama</Label>
                                                        <Textarea
                                                            value={newAlternative.description}
                                                            onChange={(e) =>
                                                                setNewAlternative({ ...newAlternative, description: e.target.value })
                                                            }
                                                            rows={2}
                                                        />
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>

                                            <AccordionItem value="cost">
                                                <AccordionTrigger>Maliyet & tedarik süreleri</AccordionTrigger>
                                                <AccordionContent className="space-y-3 pt-2">
                                                    <div className="grid gap-3 md:grid-cols-4">
                                                        <div>
                                                            <Label>Birim fiyat</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={newAlternative.unit_price}
                                                                onChange={(e) =>
                                                                    setNewAlternative({ ...newAlternative, unit_price: e.target.value })
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Para birimi</Label>
                                                            <Select
                                                                value={newAlternative.currency}
                                                                onValueChange={(v) =>
                                                                    setNewAlternative({ ...newAlternative, currency: v })
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {['TRY', 'USD', 'EUR'].map((c) => (
                                                                        <SelectItem key={c} value={c}>
                                                                            {c}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div>
                                                            <Label>Min. sipariş adedi</Label>
                                                            <Input
                                                                type="number"
                                                                value={newAlternative.minimum_order_quantity}
                                                                onChange={(e) =>
                                                                    setNewAlternative({
                                                                        ...newAlternative,
                                                                        minimum_order_quantity: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Termin (gün)</Label>
                                                            <Input
                                                                type="number"
                                                                value={newAlternative.lead_time_days}
                                                                onChange={(e) =>
                                                                    setNewAlternative({
                                                                        ...newAlternative,
                                                                        lead_time_days: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div>
                                                            <Label>TCO</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={newAlternative.total_cost_of_ownership}
                                                                onChange={(e) =>
                                                                    setNewAlternative({
                                                                        ...newAlternative,
                                                                        total_cost_of_ownership: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>ROI %</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={newAlternative.roi_percentage}
                                                                onChange={(e) =>
                                                                    setNewAlternative({
                                                                        ...newAlternative,
                                                                        roi_percentage: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Bakım maliyeti</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={newAlternative.maintenance_cost}
                                                                onChange={(e) =>
                                                                    setNewAlternative({
                                                                        ...newAlternative,
                                                                        maintenance_cost: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label>Ödeme koşulları</Label>
                                                        <Input
                                                            value={newAlternative.payment_terms}
                                                            onChange={(e) =>
                                                                setNewAlternative({
                                                                    ...newAlternative,
                                                                    payment_terms: e.target.value,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>

                                            <AccordionItem value="scores">
                                                <AccordionTrigger>Metrik matrisi (tek kaynak)</AccordionTrigger>
                                                <AccordionContent className="space-y-3 pt-2">
                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                        Tanımlar{' '}
                                                        <span className="font-medium text-foreground">Metrikler</span>{' '}
                                                        sekmesindedir. Bu bölümde yalnızca{' '}
                                                        <span className="font-medium">matriste kullanılan</span> metrikler
                                                        listelenir. Bir metni karşılaştırmadan çıkardığınızda ağırlık
                                                        kalanlara dağıtılır; metrik tanımı silinmez.
                                                    </p>
                                                    {matrixCriteria.length === 0 ? (
                                                        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-100">
                                                            Matriste kullanılacak metrik yok.{' '}
                                                            <span className="font-semibold">Metrikler</span> sekmesinden
                                                            metrik ekleyin veya &quot;Matrise ekle&quot; ile gizlediğinizi
                                                            geri açın.
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                                                            <p className="text-xs font-medium text-foreground">
                                                                Bu alternatif için puanlar ({matrixCriteria.length})
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground leading-snug">
                                                                Girdiğiniz değerler kayıtta skor matrisine yazılır.
                                                                Ölçüm birimi &quot;Puan&quot; olan satırlar için tipik
                                                                aralık 0–100&apos;dir.
                                                            </p>
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                {matrixCriteria.map((c) => (
                                                                    <div
                                                                        key={c.id}
                                                                        className="flex gap-2 items-end rounded-md border border-transparent bg-background/60 p-2"
                                                                    >
                                                                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                                            <Label className="text-xs font-medium leading-snug truncate">
                                                                                {c.criterion_name}
                                                                                {c.weight != null && (
                                                                                    <span className="text-muted-foreground font-normal">
                                                                                        {' '}
                                                                                        (ağırlık {c.weight})
                                                                                    </span>
                                                                                )}
                                                                                {c.measurement_unit ? (
                                                                                    <span className="text-muted-foreground font-normal">
                                                                                        {' '}
                                                                                        · {c.measurement_unit}
                                                                                    </span>
                                                                                ) : null}
                                                                            </Label>
                                                                            <Input
                                                                                type="number"
                                                                                min={0}
                                                                                max={100}
                                                                                step={0.01}
                                                                                placeholder="0–100"
                                                                                value={
                                                                                    newAlternative.criterionScores?.[
                                                                                        c.id
                                                                                    ] ?? ''
                                                                                }
                                                                                onChange={(e) =>
                                                                                    setNewAlternative({
                                                                                        ...newAlternative,
                                                                                        criterionScores: {
                                                                                            ...newAlternative.criterionScores,
                                                                                            [c.id]: e.target.value,
                                                                                        },
                                                                                    })
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="shrink-0 text-muted-foreground hover:text-amber-700"
                                                                            title="Bu benchmark karşılaştırmasında kullanma (tanım Metrikler’de kalır)"
                                                                            onClick={() => handleMatrixExclude(c.id)}
                                                                        >
                                                                            <EyeOff className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>

                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    if (!newAlternative.item_name.trim()) {
                                                        toast({
                                                            variant: 'destructive',
                                                            title: 'Hata',
                                                            description: 'Alternatif adı zorunludur.',
                                                        });
                                                        return;
                                                    }
                                                    setAlternatives([...alternatives, { ...newAlternative }]);
                                                    setNewAlternative(null);
                                                    toast({
                                                        title: 'Listeye eklendi',
                                                        description: 'Kaydettiğinizde veritabanına ve akıllı metriklere yazılacak.',
                                                    });
                                                }}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Listeye ekle
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setNewAlternative(null)}
                                            >
                                                İptal
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {alternatives.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Listeye eklenen alternatifler ({alternatives.length})</p>
                                        {alternatives.map((alt, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 border rounded-lg flex items-start justify-between gap-2"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium flex flex-wrap items-center gap-2">
                                                        {alt.item_name}
                                                        {alt.is_current_solution && (
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                Mevcut
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                                                        {alt.unit_price ? (
                                                            <span>
                                                                Fiyat:{' '}
                                                                {new Intl.NumberFormat('tr-TR', {
                                                                    style: 'currency',
                                                                    currency: alt.currency || 'TRY',
                                                                }).format(alt.unit_price)}
                                                            </span>
                                                        ) : null}
                                                        {(() => {
                                                            const filled = Object.entries(
                                                                alt.criterionScores || {}
                                                            ).filter(([, v]) => v !== '' && v != null);
                                                            return filled.length > 0 ? (
                                                                <span>Matris: {filled.length} metrik dolduruldu</span>
                                                            ) : null;
                                                        })()}
                                                        {alt.lead_time_days ? (
                                                            <span>Termin: {alt.lead_time_days} gün</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        title="Düzenle"
                                                        onClick={() => {
                                                            setNewAlternative({ ...alt });
                                                            setAlternatives(alternatives.filter((_, i) => i !== idx));
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setAlternatives(alternatives.filter((_, i) => i !== idx))
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {alternatives.length === 0 && !newAlternative && (
                                    <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                                        Henüz alternatif yok. &quot;Alternatif ekle&quot; ile ekleyin.
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </form>
                <aside className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4 px-6 space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">Özet</h3>
                        <div className="bg-background rounded-xl p-4 shadow-sm border border-border">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Benchmark</p>
                            <p className="font-bold text-foreground truncate">{formData.title || '-'}</p>
                        </div>
                        <div className="space-y-2 text-sm mt-3">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Durum</span>
                                <span className="font-semibold text-foreground">{formData.status || '-'}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Öncelik</span>
                                <span className="font-semibold text-foreground">{formData.priority || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Akıllı önizleme</p>
                        </div>
                        {alternatives.length >= 2 ? (
                            <>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                    Kayıt sonrası otomatik üretilecek metrikler (en az 2 alternatifte veri):
                                </p>
                                <ul className="text-[11px] space-y-1 max-h-32 overflow-y-auto text-foreground list-disc pl-4">
                                    {activeComparisons.length > 0 ? (
                                        activeComparisons.map((label) => <li key={label}>{label}</li>)
                                    ) : (
                                        <li className="text-muted-foreground list-none -ml-4">
                                            Karşılaştırma için ortak alan girin (ör. fiyat veya kalite).
                                        </li>
                                    )}
                                </ul>
                                <p className="text-[10px] font-medium text-muted-foreground mt-3 mb-1">Taslak sıralama (otomatik skor)</p>
                                <ol className="text-[11px] space-y-1 list-decimal pl-4">
                                    {draftRankingPreview.map((r) => (
                                        <li key={r.item_name}>
                                            <span className="font-medium">{r.item_name}</span>
                                            <span className="text-muted-foreground"> — {r.total.toFixed(1)} / 100</span>
                                        </li>
                                    ))}
                                </ol>
                            </>
                        ) : (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                En az iki alternatif ekleyin; doldurduğunuz alanlara göre hangi başlıkların otomatik
                                karşılaştırılacağı ve taslak sıralama burada görünür.
                            </p>
                        )}
                    </div>
                </aside>
                </div>
                <footer className="flex shrink-0 justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>İptal</Button>
                    <Button form="benchmark-form" type="submit" disabled={loading}>
                        {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor...</>) : (<><Save className="mr-2 h-4 w-4" />Kaydet</>)}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default BenchmarkForm;

