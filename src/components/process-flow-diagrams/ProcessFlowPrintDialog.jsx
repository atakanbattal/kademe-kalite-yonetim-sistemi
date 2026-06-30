import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { printProcessFlowDocument } from './processFlowPrintUtils';

const ALL_FLOWS_VALUE = '__all__';

export default function ProcessFlowPrintDialog({
    open,
    onOpenChange,
    unit,
    editMode,
    hasUnsavedChanges,
    onError,
}) {
    const flows = unit?.flows || [];
    const [flowSelection, setFlowSelection] = useState('');
    const [includeMeta, setIncludeMeta] = useState(true);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        if (!open || !flows.length) return;
        setFlowSelection(flows.length === 1 ? flows[0].id : ALL_FLOWS_VALUE);
        setIncludeMeta(true);
    }, [open, flows]);

    const selectedFlowLabel = useMemo(() => {
        if (flowSelection === ALL_FLOWS_VALUE) return 'Tüm süreçler';
        return flows.find((f) => f.id === flowSelection)?.title || '';
    }, [flowSelection, flows]);

    const handlePrint = () => {
        if (!unit || !flowSelection) return;

        if (editMode && hasUnsavedChanges) {
            if (!window.confirm('Kaydedilmemiş değişiklikler yazdırmaya yansımaz. Devam edilsin mi?')) return;
        }

        setPrinting(true);
        try {
            const flowIds = flowSelection === ALL_FLOWS_VALUE
                ? flows.map((f) => f.id)
                : [flowSelection];
            printProcessFlowDocument({ unit, flowIds, includeMeta });
            onOpenChange(false);
        } catch (err) {
            onError?.(err.message || 'Yazdırma başlatılamadı.');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Süreç Yazdır / PDF</DialogTitle>
                    <DialogDescription>
                        {unit ? `${unit.code} — ${unit.name} biriminden yazdırılacak süreci seçin.` : 'Birim yükleniyor...'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-2">
                        <Label htmlFor="pfd-print-flow">Süreç</Label>
                        <Select value={flowSelection} onValueChange={setFlowSelection} disabled={!flows.length}>
                            <SelectTrigger id="pfd-print-flow">
                                <SelectValue placeholder="Süreç seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {flows.length > 1 ? (
                                    <SelectItem value={ALL_FLOWS_VALUE}>Tüm süreçler ({flows.length})</SelectItem>
                                ) : null}
                                {flows.map((flow) => (
                                    <SelectItem key={flow.id} value={flow.id}>
                                        {flow.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-start gap-2">
                        <Checkbox
                            id="pfd-print-meta"
                            checked={includeMeta}
                            onCheckedChange={(checked) => setIncludeMeta(checked === true)}
                        />
                        <Label htmlFor="pfd-print-meta" className="font-normal leading-snug cursor-pointer">
                            Birim bilgilerini ekle (süreç sahibi, amaç, roller)
                        </Label>
                    </div>

                    {selectedFlowLabel ? (
                        <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                            Yazdırılacak: <strong>{selectedFlowLabel}</strong>
                            {includeMeta ? ' · birim özeti dahil' : ' · yalnızca akış şeması'}
                        </p>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        İptal
                    </Button>
                    <Button type="button" onClick={handlePrint} disabled={!flowSelection || printing}>
                        <Printer className="h-4 w-4 mr-1" />
                        Yazdır
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
