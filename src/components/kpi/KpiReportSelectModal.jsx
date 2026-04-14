import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KPI_CATEGORIES, getAutoKpiDisplayMeta } from '@/components/kpi/kpi-definitions';
import { FileSpreadsheet, ListChecks, ListX } from 'lucide-react';

/**
 * KPI performans raporu için KPI seçimi — kategori bazında toplu veya tek tek.
 */
const KpiReportSelectModal = ({
    open,
    onOpenChange,
    kpis,
    /** Modal açıldığında işaretli gelsin (ör. mevcut filtredeki KPI id'leri) */
    defaultSelectedIds,
    onConfirm,
    isGenerating,
}) => {
    const [selected, setSelected] = useState(() => new Set());

    useEffect(() => {
        if (!open) return;
        if (defaultSelectedIds?.length) {
            setSelected(new Set(defaultSelectedIds));
        } else if (kpis?.length) {
            setSelected(new Set(kpis.map((k) => k.id)));
        } else {
            setSelected(new Set());
        }
    }, [open, defaultSelectedIds, kpis]);

    const grouped = useMemo(() => {
        const byCat = {};
        for (const k of kpis || []) {
            const cat = k.category || 'default';
            if (!byCat[cat]) byCat[cat] = [];
            byCat[cat].push(k);
        }
        const sortItems = (arr) =>
            [...arr].sort((a, b) =>
                (getAutoKpiDisplayMeta(a).name || '').localeCompare(
                    getAutoKpiDisplayMeta(b).name || '',
                    'tr',
                    { sensitivity: 'base' }
                )
            );
        const out = [];
        for (const c of KPI_CATEGORIES) {
            if (c.id === 'all') continue;
            const items = byCat[c.id];
            if (items?.length) {
                out.push({ id: c.id, label: c.label, items: sortItems(items) });
                delete byCat[c.id];
            }
        }
        for (const id of Object.keys(byCat)) {
            const items = byCat[id];
            if (items?.length) {
                const label = id === 'default' ? 'Diğer' : id;
                out.push({ id, label, items: sortItems(items) });
            }
        }
        return out;
    }, [kpis]);

    const toggleOne = useCallback((id) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }, []);

    const setCategory = useCallback((items, checked) => {
        setSelected((prev) => {
            const n = new Set(prev);
            items.forEach((k) => {
                if (checked) n.add(k.id);
                else n.delete(k.id);
            });
            return n;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelected(new Set((kpis || []).map((k) => k.id)));
    }, [kpis]);

    const clearAll = useCallback(() => {
        setSelected(new Set());
    }, []);

    const selectedCount = selected.size;
    const totalCount = kpis?.length || 0;

    const handleConfirm = async () => {
        const chosen = (kpis || []).filter((k) => selected.has(k.id));
        await onConfirm(chosen);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col gap-0 p-0">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                        KPI raporu — seçim
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground text-left font-normal pt-1">
                        Raporda yer alacak KPI’ları işaretleyin. İsterseniz bir kategorideki tümünü tek tıkla seçebilirsiniz.
                    </p>
                </DialogHeader>

                <div className="flex flex-wrap gap-2 px-6 pb-2 shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={!totalCount}>
                        <ListChecks className="w-3.5 h-3.5 mr-1.5" />
                        Tümünü seç
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                        <ListX className="w-3.5 h-3.5 mr-1.5" />
                        Tümünü kaldır
                    </Button>
                    <span className="text-xs text-muted-foreground self-center ml-auto tabular-nums">
                        Seçili: <strong className="text-foreground">{selectedCount}</strong> / {totalCount}
                    </span>
                </div>

                <ScrollArea className="flex-1 min-h-0 max-h-[min(420px,55vh)] px-6">
                    <div className="space-y-5 pr-3 pb-4">
                        {grouped.map((group) => {
                            return (
                                <div key={group.id} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                                    <div
                                        className={`flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 ${
                                            KPI_CATEGORIES.find((c) => c.id === group.id)?.bg || 'bg-muted/40'
                                        }`}
                                    >
                                        <span className={`text-xs font-bold uppercase tracking-wide ${
                                            KPI_CATEGORIES.find((c) => c.id === group.id)?.text || 'text-foreground'
                                        }`}>
                                            {group.label}
                                        </span>
                                        <div className="flex gap-1 shrink-0">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[10px] px-2"
                                                onClick={() => setCategory(group.items, true)}
                                            >
                                                Grubu seç
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[10px] px-2"
                                                onClick={() => setCategory(group.items, false)}
                                            >
                                                Grubu kaldır
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-border/50 bg-background">
                                        {group.items.map((k) => {
                                            const meta = getAutoKpiDisplayMeta(k);
                                            const checked = selected.has(k.id);
                                            return (
                                                <label
                                                    key={k.id}
                                                    className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() => toggleOne(k.id)}
                                                        className="mt-0.5"
                                                        aria-label={meta.name}
                                                    />
                                                    <span className="text-sm leading-snug">{meta.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {grouped.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">Gösterilecek KPI yok.</p>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t border-border bg-muted/10 shrink-0 gap-2 sm:gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        İptal
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={isGenerating || selectedCount === 0}
                    >
                        {isGenerating ? 'Hazırlanıyor…' : 'Raporu oluştur'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default KpiReportSelectModal;
