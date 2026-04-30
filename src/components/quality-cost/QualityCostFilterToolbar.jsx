import React, { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import CostFilters from '@/components/quality-cost/CostFilters';
import { COST_TYPES } from '@/components/quality-cost/constants';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SOURCE_FINAL = 'final_fault_production';

const radioRow = 'flex items-start gap-2 rounded-md border border-transparent px-1 py-1.5 hover:bg-muted/60 has-[[data-state=checked]]:border-primary/30 has-[[data-state=checked]]:bg-muted/40';

/**
 * Kalite maliyeti süzgeçleri: tarih + arama her zaman görünür; kalanı tek panelde gruplanır.
 * Aktif süzgeçler rozet satırında tek tıkla kaldırılabilir.
 *
 * React.memo ile sarılı: ana modülde tablo/grafik re-render olurken filtre çubuğunun
 * (binlerce input ve radio) gereksiz yeniden çizilmesini engellemek için.
 */
const QualityCostFilterToolbarImpl = ({
    dateRange,
    setDateRange,
    unitFilter,
    setUnitFilter,
    unitFilterOptions = [],
    sourceFilter,
    setSourceFilter,
    costTypeDetailFilter,
    setCostTypeDetailFilter,
    recordModifiers,
    setRecordModifiers,
    searchTerm,
    setSearchTerm,
    onOpenReportModal,
    onOpenFormModal,
    onResetSecondaryFilters,
}) => {
    const [panelOpen, setPanelOpen] = useState(false);
    const [typeQuery, setTypeQuery] = useState('');
    const [unitQuery, setUnitQuery] = useState('');

    // Search input lokal state'te tutulur, üst state'e debounced yansır.
    // Aksi halde her tuş vuruşunda 1000+ kayıtlı tablo / grafikler yeniden hesaplanıyordu.
    const [localSearch, setLocalSearch] = useState(searchTerm || '');
    const debounceRef = useRef(null);
    useEffect(() => {
        // Üst state dışarıdan temizlenirse (chip × veya "Tümünü temizle") senkronize ol.
        setLocalSearch(searchTerm || '');
    }, [searchTerm]);
    const handleSearchChange = useCallback((e) => {
        const v = e.target.value;
        setLocalSearch(v);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            startTransition(() => setSearchTerm(v));
        }, 250);
    }, [setSearchTerm]);
    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    // Filtre değişimlerini "transition" olarak işaretle: radio tıklaması anlık tepki
    // verir, ağır liste/grafik hesabı React tarafından arka plana alınır.
    const setSourceFilterTx = useCallback((v) => {
        startTransition(() => setSourceFilter(v === SOURCE_FINAL ? SOURCE_FINAL : 'all'));
    }, [setSourceFilter]);
    const setCostTypeDetailFilterTx = useCallback((v) => {
        startTransition(() => setCostTypeDetailFilter(v));
    }, [setCostTypeDetailFilter]);
    const setUnitFilterTx = useCallback((v) => {
        startTransition(() => setUnitFilter(v));
    }, [setUnitFilter]);
    const setRecordModifiersTx = useCallback((updater) => {
        startTransition(() => setRecordModifiers(updater));
    }, [setRecordModifiers]);
    const setDateRangeTx = useCallback((v) => {
        startTransition(() => setDateRange(v));
    }, [setDateRange]);

    useEffect(() => {
        if (panelOpen) {
            setTypeQuery('');
            setUnitQuery('');
        }
    }, [panelOpen]);

    const filteredCostTypes = useMemo(() => {
        const q = typeQuery.trim().toLowerCase();
        let list = !q ? [...COST_TYPES] : COST_TYPES.filter((t) => t.toLowerCase().includes(q));
        const sel = costTypeDetailFilter !== 'all' ? costTypeDetailFilter : null;
        if (sel && !list.includes(sel)) list = [sel, ...list];
        return list;
    }, [costTypeDetailFilter, typeQuery]);

    const filteredUnits = useMemo(() => {
        const q = unitQuery.trim().toLowerCase();
        let list = !q
            ? unitFilterOptions
            : unitFilterOptions.filter(
                  ({ key, label }) =>
                      String(key).toLowerCase().includes(q) || String(label).toLowerCase().includes(q)
              );
        if (unitFilter !== 'all') {
            const selected = unitFilterOptions.find(({ key }) => String(key) === String(unitFilter));
            if (
                selected &&
                !list.some(({ key }) => String(key) === String(selected.key))
            ) {
                list = [selected, ...list];
            }
        }
        return list;
    }, [unitFilter, unitFilterOptions, unitQuery]);

    const modifierActive =
        recordModifiers.supplier || recordModifiers.indirect || recordModifiers.invoice;

    const activeFilterCount = useMemo(() => {
        let n = 0;
        if (dateRange?.key && dateRange.key !== 'all') n += 1;
        if (unitFilter !== 'all') n += 1;
        if (sourceFilter !== 'all') n += 1;
        if (costTypeDetailFilter !== 'all') n += 1;
        if (modifierActive) n += 1;
        if (searchTerm.trim().length > 0) n += 1;
        return n;
    }, [
        costTypeDetailFilter,
        dateRange?.key,
        dateRange?.label,
        modifierActive,
        searchTerm,
        sourceFilter,
        unitFilter,
    ]);

    const chips = useMemo(() => {
        const list = [];
        if (dateRange?.key && dateRange.key !== 'all') {
            list.push({
                key: 'date',
                label: `Dönem: ${dateRange.label || 'Seçili aralık'}`,
                onRemove: () =>
                    setDateRangeTx({ key: 'all', startDate: null, endDate: null, label: 'Tüm Zamanlar' }),
            });
        }
        if (unitFilter !== 'all') {
            const opt = unitFilterOptions.find((o) => o.key === unitFilter);
            list.push({
                key: 'unit',
                label: `Birim: ${opt?.label || unitFilter}`,
                onRemove: () => setUnitFilterTx('all'),
            });
        }
        if (sourceFilter === SOURCE_FINAL) {
            list.push({
                key: 'source',
                label: 'Kaynak: Final QC maliyetleri',
                onRemove: () => setSourceFilterTx('all'),
            });
        }
        if (costTypeDetailFilter !== 'all') {
            list.push({
                key: 'costType',
                label: `Tür: ${costTypeDetailFilter}`,
                onRemove: () => setCostTypeDetailFilterTx('all'),
            });
        }
        if (modifierActive) {
            const parts = [];
            if (recordModifiers.supplier) parts.push('tedarikçi NC');
            if (recordModifiers.indirect) parts.push('dolaylı maliyet');
            if (recordModifiers.invoice) parts.push('fatura kalemli');
            list.push({
                key: 'modifiers',
                label: `Kayıt: ${parts.join(' · ')}`,
                onRemove: () =>
                    setRecordModifiersTx({
                        supplier: false,
                        indirect: false,
                        invoice: false,
                    }),
            });
        }
        const q = searchTerm.trim();
        if (q.length > 0) {
            list.push({
                key: 'search',
                label: `Arama: "${q.length > 28 ? `${q.slice(0, 28)}…` : q}"`,
                onRemove: () => {
                    setLocalSearch('');
                    startTransition(() => setSearchTerm(''));
                },
            });
        }
        return list;
    }, [
        costTypeDetailFilter,
        dateRange?.key,
        dateRange?.label,
        modifierActive,
        recordModifiers.supplier,
        recordModifiers.indirect,
        recordModifiers.invoice,
        searchTerm,
        setCostTypeDetailFilterTx,
        setDateRangeTx,
        setRecordModifiersTx,
        setSearchTerm,
        setSourceFilterTx,
        setUnitFilterTx,
        sourceFilter,
        unitFilter,
        unitFilterOptions,
    ]);

    return (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
                Özet grafikleri ve tablo aşağıdaki süzgeçlere bağlıdır. İstersen tarih solda; diğer
                seçenekleri <strong className="text-foreground/90 font-medium">Filtreler</strong> panelinden
                aç — aktif seçimleri rozet olarak görebilir, tek tıkla kaldırabilirsin.
            </p>

            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
                <CostFilters dateRange={dateRange} setDateRange={setDateRange} />

                <div className="relative block flex-1 min-w-[min(100%,220px)] max-w-xl">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        autoFormat={false}
                        placeholder="Şununla ara: tür, parça, açıklama, birim…"
                        value={localSearch}
                        onChange={handleSearchChange}
                        className={cn(
                            'h-10 rounded-md border border-input bg-background !pl-10 shadow-sm placeholder:text-muted-foreground',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                        )}
                    />
                </div>

                <Popover open={panelOpen} onOpenChange={setPanelOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 shrink-0 gap-2 border-dashed lg:max-w-none"
                            title="Kaynak, maliyet türü, birim ve kayıt özellikleri"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            <span>Filtreler</span>
                            {activeFilterCount > 0 ? (
                                <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-semibold tabular-nums">
                                    {activeFilterCount}
                                </Badge>
                            ) : null}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[min(calc(100vw-2rem),400px)] p-0"
                        align="end"
                        sideOffset={6}
                        collisionPadding={12}
                    >
                        <ScrollArea className="h-[min(72vh,520px)]">
                            <div className="space-y-4 p-4">
                                <div>
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Kaynak
                                    </Label>
                                    <p className="mb-2 text-[11px] text-muted-foreground">
                                        Final seçeneği üretilmiş araç QC / finalize akışından gelen kayıtları daraltır.
                                    </p>
                                    <RadioGroup
                                        value={sourceFilter === SOURCE_FINAL ? SOURCE_FINAL : 'all'}
                                        onValueChange={setSourceFilterTx}
                                        className="gap-1"
                                    >
                                        <label className={radioRow}>
                                            <RadioGroupItem value="all" id="src-all" />
                                            <span className="text-sm leading-snug pt-px">Tüm kaynaklar</span>
                                        </label>
                                        <label className={radioRow}>
                                            <RadioGroupItem value={SOURCE_FINAL} id="src-final" />
                                            <span className="text-sm leading-snug pt-px">Final QC maliyetleri</span>
                                        </label>
                                    </RadioGroup>
                                </div>

                                <Separator />

                                <div>
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Maliyet türü
                                    </Label>
                                    <Input
                                        className="mt-2 h-9 text-sm"
                                        placeholder="Liste içinde ara…"
                                        value={typeQuery}
                                        onChange={(e) => setTypeQuery(e.target.value)}
                                    />
                                    <RadioGroup
                                        value={costTypeDetailFilter}
                                        onValueChange={setCostTypeDetailFilterTx}
                                        className="mt-2 gap-1"
                                    >
                                        <label className={radioRow}>
                                            <RadioGroupItem value="all" id="ct-all" />
                                            <span className="text-sm leading-snug pt-px">Tüm türler</span>
                                        </label>
                                        {filteredCostTypes.map((t, ti) => (
                                            <label key={t} className={radioRow}>
                                                <RadioGroupItem value={t} id={`ct-radio-${ti}`} />
                                                <span className="text-sm leading-snug pt-px">{t}</span>
                                            </label>
                                        ))}
                                    </RadioGroup>
                                </div>

                                <Separator />

                                <div>
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Birim
                                    </Label>
                                    <Input
                                        className="mt-2 h-9 text-sm"
                                        placeholder="Birim ara…"
                                        value={unitQuery}
                                        onChange={(e) => setUnitQuery(e.target.value)}
                                    />
                                    <RadioGroup
                                        value={unitFilter}
                                        onValueChange={setUnitFilterTx}
                                        className="mt-2 max-h-[200px] gap-1 overflow-y-auto pr-1"
                                    >
                                        <label className={radioRow}>
                                            <RadioGroupItem value="all" id="u-all" />
                                            <span className="text-sm leading-snug pt-px">Tüm birimler</span>
                                        </label>
                                        {filteredUnits.map(({ key, label }, ui) => (
                                            <label key={key} className={radioRow}>
                                                <RadioGroupItem value={String(key)} id={`u-radio-${ui}`} />
                                                <span className="text-sm leading-snug pt-px">{label}</span>
                                            </label>
                                        ))}
                                    </RadioGroup>
                                </div>

                                <Separator />

                                <div>
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Kayıt özellikleri
                                    </Label>
                                    <p className="mb-3 text-[11px] text-muted-foreground">
                                        İşaretlediğin özelliklere uygun kayıtlar birleştirilir (birine uyan satır dahil olur).
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="mod-supplier"
                                                className="mt-0.5"
                                                checked={recordModifiers.supplier}
                                                onCheckedChange={(v) =>
                                                    setRecordModifiersTx((prev) => ({
                                                        ...prev,
                                                        supplier: v === true,
                                                    }))
                                                }
                                            />
                                            <label htmlFor="mod-supplier" className="grid cursor-pointer gap-0.5 text-sm leading-snug">
                                                <span>Tedarikçi NC olarak işaretli</span>
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="mod-indirect"
                                                className="mt-0.5"
                                                checked={recordModifiers.indirect}
                                                onCheckedChange={(v) =>
                                                    setRecordModifiersTx((prev) => ({
                                                        ...prev,
                                                        indirect: v === true,
                                                    }))
                                                }
                                            />
                                            <label htmlFor="mod-indirect" className="grid cursor-pointer gap-0.5 text-sm leading-snug">
                                                <span>Dolaylı maliyet girdisi var</span>
                                            </label>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="mod-invoice"
                                                className="mt-0.5"
                                                checked={recordModifiers.invoice}
                                                onCheckedChange={(v) =>
                                                    setRecordModifiersTx((prev) => ({
                                                        ...prev,
                                                        invoice: v === true,
                                                    }))
                                                }
                                            />
                                            <label htmlFor="mod-invoice" className="grid cursor-pointer gap-0.5 text-sm leading-snug">
                                                <span>Fatura kalemleri tanımlı</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={() => {
                                            onResetSecondaryFilters?.();
                                            setPanelOpen(false);
                                        }}
                                    >
                                        Panel seçimlerini sıfırla
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>

                <div className="flex flex-wrap gap-2 lg:ml-auto lg:justify-end">
                    <Button onClick={onOpenReportModal} variant="outline" size="sm" className="h-10 shrink-0">
                        <FileText className="h-4 w-4 mr-1.5 sm:mr-2" />
                        <span className="hidden xs:inline">Rapor Al</span>
                        <span className="xs:hidden">Rapor</span>
                    </Button>
                    <Button onClick={onOpenFormModal} size="sm" className="h-10 shrink-0">
                        <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
                        <span className="hidden sm:inline">Yeni Maliyet Kaydı</span>
                        <span className="sm:hidden">Ekle</span>
                    </Button>
                </div>
            </div>

            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">Aktif:</span>
                    {chips.map((c) => (
                        <Badge
                            key={c.key}
                            variant="secondary"
                            className="h-7 max-w-[min(100%,280px)] gap-1 px-2 py-1 font-normal"
                        >
                            <span className="truncate">{c.label}</span>
                            <button
                                type="button"
                                className="rounded-sm p-0.5 hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
                                onClick={c.onRemove}
                                aria-label={`Kaldır: ${c.label}`}
                            >
                                <X className="h-3.5 w-3.5 opacity-70" />
                            </button>
                        </Badge>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-muted-foreground"
                        onClick={() => {
                            setLocalSearch('');
                            startTransition(() => {
                                setDateRange({ key: 'all', startDate: null, endDate: null, label: 'Tüm Zamanlar' });
                                onResetSecondaryFilters?.();
                                setSearchTerm('');
                            });
                        }}
                    >
                        Tümünü temizle
                    </Button>
                </div>
            )}
        </div>
    );
};

const QualityCostFilterToolbar = memo(QualityCostFilterToolbarImpl);

export default QualityCostFilterToolbar;
