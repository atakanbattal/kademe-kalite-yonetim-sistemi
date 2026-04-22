import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Boxes,
    Clock3,
    GitBranch,
    Loader2,
    PackagePlus,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    Warehouse,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PART_FORM_TEMPLATE = {
    bom_part_key: '',
    part_code: '',
    current_part_name: '',
    base_unit: 'Adet',
    current_stock: '0',
    critical_stock_level: '0',
    min_lead_time_days: '0',
    notes: '',
    revision_no: '1',
    revision_date: new Date().toISOString().split('T')[0],
};

const STOCK_FORM_TEMPLATE = {
    part_revision_id: '',
    movement_type: 'Stok Girişi',
    quantity: '0',
    note: '',
};

const MOVEMENT_TYPE_OPTIONS = ['Stok Girişi', 'Stok Çıkışı', 'Sayım Düzeltmesi', 'Tedarik Girişi'];

const formatNumber = (value) => Number(value || 0).toLocaleString('tr-TR');
const normalizeDepotValue = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');

const DepotStatCard = ({ title, value, helper, accentClass, icon: Icon }) => (
    <Card className="border-border/70 shadow-sm">
        <CardContent className="flex items-start justify-between gap-4 px-5 py-5">
            <div className="min-w-0 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {title}
                </div>
                <div className={`text-3xl font-semibold leading-none ${accentClass}`}>{value}</div>
                {helper && <div className="text-sm leading-5 text-muted-foreground">{helper}</div>}
            </div>
            <div className="rounded-2xl border bg-muted/30 p-3 text-muted-foreground">
                <Icon className="h-5 w-5" />
            </div>
        </CardContent>
    </Card>
);

const SSHDepotTab = ({ onDepotChanged }) => {
    const { toast } = useToast();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [parts, setParts] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [movements, setMovements] = useState([]);
    const [bomItems, setBomItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('all');

    const [partDialogOpen, setPartDialogOpen] = useState(false);
    const [partDialogMode, setPartDialogMode] = useState('create');
    const [editingPart, setEditingPart] = useState(null);
    const [partForm, setPartForm] = useState(PART_FORM_TEMPLATE);
    const [isSavingPart, setIsSavingPart] = useState(false);

    const [stockDialogOpen, setStockDialogOpen] = useState(false);
    const [selectedPart, setSelectedPart] = useState(null);
    const [stockForm, setStockForm] = useState(STOCK_FORM_TEMPLATE);
    const [isSavingStock, setIsSavingStock] = useState(false);

    const loadDepot = useCallback(async () => {
        setLoading(true);
        setLoadError('');

        try {
            const [partsResult, revisionsResult, movementsResult, bomItemsResult] = await Promise.all([
                supabase.from('after_sales_part_master').select('*').order('part_code', { ascending: true }),
                supabase.from('after_sales_part_revisions').select('*').order('revision_date', { ascending: false }),
                supabase.from('after_sales_part_stock_movements').select('*').order('created_at', { ascending: false }),
                supabase
                    .from('after_sales_bom_items')
                    .select(`
                        id,
                        part_code,
                        part_name,
                        unit,
                        part_revision_id,
                        bom:bom_id (
                            id,
                            vehicle_category,
                            vehicle_model_code,
                            revision_no,
                            is_active
                        )
                    `)
                    .order('part_code', { ascending: true }),
            ]);

            if (partsResult.error) throw partsResult.error;
            if (revisionsResult.error) throw revisionsResult.error;
            if (movementsResult.error) throw movementsResult.error;
            if (bomItemsResult.error && !['42P01', 'PGRST205'].includes(bomItemsResult.error.code)) throw bomItemsResult.error;

            setParts(partsResult.data || []);
            setRevisions(revisionsResult.data || []);
            setMovements(movementsResult.data || []);
            setBomItems(bomItemsResult.data || []);
        } catch (error) {
            console.error('SSH depot load error:', error);
            if (['42P01', 'PGRST205'].includes(error.code)) {
                setLoadError('SSH depo tabloları henüz kurulmamış. Yeni satış sonrası migrasyonunu uyguladıktan sonra bu sekme aktif olacaktır.');
            } else {
                setLoadError(error.message || 'SSH depo verileri yüklenemedi.');
            }
            setParts([]);
            setRevisions([]);
            setMovements([]);
            setBomItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDepot();
    }, [loadDepot]);

    const revisionsByPartId = useMemo(() => {
        return revisions.reduce((map, revision) => {
            const current = map.get(revision.part_id) || [];
            current.push(revision);
            map.set(revision.part_id, current);
            return map;
        }, new Map());
    }, [revisions]);

    const movementsByPartId = useMemo(() => {
        return movements.reduce((map, movement) => {
            const current = map.get(movement.part_id) || [];
            current.push(movement);
            map.set(movement.part_id, current);
            return map;
        }, new Map());
    }, [movements]);

    const partCards = useMemo(() => {
        return parts.map((part) => {
            const partRevisions = (revisionsByPartId.get(part.id) || []).sort((left, right) => {
                if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
                const leftDate = new Date(left.revision_date || left.created_at || 0).getTime();
                const rightDate = new Date(right.revision_date || right.created_at || 0).getTime();
                return rightDate - leftDate;
            });

            const activeRevision = partRevisions[0] || null;
            const currentStock = Number(part.current_stock || 0);
            const criticalStock = Number(part.critical_stock_level || 0);
            const stockStatus =
                currentStock <= 0 ? 'Tükendi' : currentStock <= criticalStock ? 'Kritik' : 'Yeterli';

            const revisionStockMap = (movementsByPartId.get(part.id) || []).reduce((map, movement) => {
                const key = movement.part_revision_id || 'unknown';
                const current = map.get(key) || {
                    id: movement.part_revision_id || 'unknown',
                    revision_no: movement.part_revision_id
                        ? partRevisions.find((revision) => revision.id === movement.part_revision_id)?.revision_no || '-'
                        : 'Belirsiz',
                    quantity: 0,
                };

                current.quantity += Number(movement.quantity || 0);
                map.set(key, current);
                return map;
            }, new Map());

            let revisionStocks = Array.from(revisionStockMap.values())
                .filter((entry) => Number(entry.quantity || 0) !== 0)
                .sort((left, right) => {
                    if (left.id === activeRevision?.id) return -1;
                    if (right.id === activeRevision?.id) return 1;
                    return String(left.revision_no).localeCompare(String(right.revision_no), 'tr', { numeric: true });
                });

            if (revisionStocks.length === 0 && activeRevision && currentStock > 0) {
                revisionStocks = [
                    {
                        id: activeRevision.id,
                        revision_no: activeRevision.revision_no || '-',
                        quantity: currentStock,
                        estimated: true,
                    },
                ];
            }

            return {
                ...part,
                revisions: partRevisions,
                activeRevision,
                displayName: part.current_part_name || activeRevision?.part_name || '-',
                stockStatus,
                revisionStocks,
            };
        });
    }, [movementsByPartId, parts, revisions, revisionsByPartId]);

    const bomPartCatalog = useMemo(() => {
        const uniqueParts = new Map();

        (bomItems || []).forEach((item) => {
            const key = `${item.part_code || ''}__${item.part_name || ''}`;
            if (!item.part_code && !item.part_name) return;

            const existing = uniqueParts.get(key);
            const nextEntry = existing || {
                key,
                part_code: item.part_code || '',
                part_name: item.part_name || '',
                unit: item.unit || 'Adet',
                part_revision_id: item.part_revision_id || '',
                models: [],
            };

            const modelLabel = [item.bom?.vehicle_category, item.bom?.vehicle_model_code]
                .filter(Boolean)
                .join(' / ');

            if (modelLabel && !nextEntry.models.includes(modelLabel)) {
                nextEntry.models.push(modelLabel);
            }

            if (!nextEntry.part_revision_id && item.part_revision_id) {
                nextEntry.part_revision_id = item.part_revision_id;
            }

            uniqueParts.set(key, nextEntry);
        });

        return Array.from(uniqueParts.values()).sort((left, right) =>
            String(left.part_code || left.part_name).localeCompare(String(right.part_code || right.part_name), 'tr')
        );
    }, [bomItems]);

    const bomPartOptions = useMemo(
        () =>
            bomPartCatalog.map((item) => ({
                value: item.key,
                label: `${item.part_code || '-'} • ${item.part_name || 'Parça adı yok'}${item.models[0] ? ` • ${item.models[0]}` : ''}`,
            })),
        [bomPartCatalog]
    );

    const filteredParts = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr-TR');

        return partCards.filter((part) => {
            if (stockFilter === 'critical' && part.stockStatus !== 'Kritik') return false;
            if (stockFilter === 'empty' && part.stockStatus !== 'Tükendi') return false;
            if (stockFilter === 'healthy' && part.stockStatus !== 'Yeterli') return false;

            if (!normalizedSearch) return true;

            return [
                part.part_code,
                part.displayName,
                part.activeRevision?.revision_no,
                part.notes,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(normalizedSearch));
        });
    }, [partCards, searchTerm, stockFilter]);

    const stats = useMemo(() => {
        const criticalCount = partCards.filter((part) => part.stockStatus === 'Kritik').length;
        const emptyCount = partCards.filter((part) => part.stockStatus === 'Tükendi').length;
        const avgLeadTime =
            partCards.length > 0
                ? Math.round(partCards.reduce((sum, part) => sum + Number(part.min_lead_time_days || 0), 0) / partCards.length)
                : 0;

        return {
            totalParts: partCards.length,
            criticalCount,
            emptyCount,
            avgLeadTime,
        };
    }, [partCards]);

    const openCreatePartDialog = () => {
        setEditingPart(null);
        setPartDialogMode('create');
        setPartForm(PART_FORM_TEMPLATE);
        setPartDialogOpen(true);
    };

    const openEditPartDialog = (part) => {
        setEditingPart(part);
        setPartDialogMode('edit');
        setPartForm({
            bom_part_key: '',
            part_code: part.part_code || '',
            current_part_name: part.current_part_name || '',
            base_unit: part.base_unit || 'Adet',
            current_stock: String(part.current_stock || 0),
            critical_stock_level: String(part.critical_stock_level || 0),
            min_lead_time_days: String(part.min_lead_time_days || 0),
            notes: part.notes || '',
            revision_no: part.activeRevision?.revision_no || '1',
            revision_date: part.activeRevision?.revision_date || new Date().toISOString().split('T')[0],
        });
        setPartDialogOpen(true);
    };

    const openRevisePartDialog = (part) => {
        setEditingPart(part);
        setPartDialogMode('revise');
        setPartForm({
            bom_part_key: '',
            part_code: part.part_code || '',
            current_part_name: part.current_part_name || '',
            base_unit: part.base_unit || 'Adet',
            current_stock: String(part.current_stock || 0),
            critical_stock_level: String(part.critical_stock_level || 0),
            min_lead_time_days: String(part.min_lead_time_days || 0),
            notes: part.notes || '',
            revision_no: String(Number(part.activeRevision?.revision_no || 0) + 1),
            revision_date: new Date().toISOString().split('T')[0],
        });
        setPartDialogOpen(true);
    };

    const handleBomPartSelection = (value) => {
        const matchedBomPart = bomPartCatalog.find((item) => item.key === value);
        if (!matchedBomPart) {
            setPartForm((prev) => ({ ...prev, bom_part_key: '' }));
            return;
        }

        const matchedRevision = matchedBomPart.part_revision_id
            ? revisions.find((revision) => revision.id === matchedBomPart.part_revision_id)
            : null;

        setPartForm((prev) => ({
            ...prev,
            bom_part_key: matchedBomPart.key,
            part_code: matchedBomPart.part_code || prev.part_code,
            current_part_name: matchedBomPart.part_name || prev.current_part_name,
            base_unit: matchedBomPart.unit || prev.base_unit || 'Adet',
            revision_no: matchedRevision?.revision_no || prev.revision_no,
            revision_date: matchedRevision?.revision_date || prev.revision_date,
        }));
    };

    const openStockDialog = (part) => {
        setSelectedPart(part);
        setStockForm({
            ...STOCK_FORM_TEMPLATE,
            part_revision_id: part.activeRevision?.id || '',
        });
        setStockDialogOpen(true);
    };

    const [deleteTarget, setDeleteTarget] = useState(null);

    const handleDeletePart = async () => {
        if (!deleteTarget) return;
        try {
            await supabase.from('after_sales_part_stock_movements').delete().eq('part_master_id', deleteTarget.id);
            await supabase.from('after_sales_part_revisions').delete().eq('part_master_id', deleteTarget.id);
            const { error } = await supabase.from('after_sales_part_master').delete().eq('id', deleteTarget.id);
            if (error) throw error;
            toast({ title: 'Silindi', description: `${deleteTarget.part_name || deleteTarget.part_code} parça kartı silindi.` });
            setDeleteTarget(null);
            loadDepot();
            onDepotChanged?.();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: `Silme hatası: ${err.message}` });
        }
    };

    const findExistingPartByCode = useCallback(
        async (partCode) => {
            const normalizedPartCode = normalizeDepotValue(partCode);
            if (!normalizedPartCode) return null;

            const localMatch = partCards.find((part) => normalizeDepotValue(part.part_code) === normalizedPartCode);
            if (localMatch) {
                return localMatch;
            }

            const { data: remoteMatches, error: remoteMatchError } = await supabase
                .from('after_sales_part_master')
                .select('*')
                .ilike('part_code', String(partCode || '').trim());

            if (remoteMatchError) {
                throw remoteMatchError;
            }

            const matchedPart = (remoteMatches || []).find(
                (part) => normalizeDepotValue(part.part_code) === normalizedPartCode
            );

            if (!matchedPart) {
                return null;
            }

            const { data: revisionMatches, error: revisionMatchError } = await supabase
                .from('after_sales_part_revisions')
                .select('*')
                .eq('part_id', matchedPart.id)
                .order('revision_date', { ascending: false });

            if (revisionMatchError && revisionMatchError.code !== 'PGRST116') {
                throw revisionMatchError;
            }

            const matchedActiveRevision =
                (revisionMatches || []).find((revision) => revision.is_active) ||
                (revisionMatches || [])[0] ||
                null;

            return {
                ...matchedPart,
                activeRevision: matchedActiveRevision,
            };
        },
        [partCards]
    );

    const handleSavePart = async () => {
        if (!partForm.part_code || !partForm.current_part_name) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Parça kodu ve parça adı zorunludur.',
            });
            return;
        }

        setIsSavingPart(true);

        try {
            let partId = editingPart?.id || null;
            let revisionId = editingPart?.activeRevision?.id || null;
            let duplicatePart = partDialogMode === 'create' ? await findExistingPartByCode(partForm.part_code) : null;

            const partPayload = {
                part_code: partForm.part_code.trim(),
                current_part_name: partForm.current_part_name.trim(),
                base_unit: partForm.base_unit || 'Adet',
                current_stock:
                    partDialogMode === 'create' && !duplicatePart
                        ? Number(partForm.current_stock || 0)
                        : Number((duplicatePart || editingPart)?.current_stock || 0),
                critical_stock_level: Number(partForm.critical_stock_level || 0),
                min_lead_time_days: Number(partForm.min_lead_time_days || 0),
                notes: partForm.notes?.trim() || null,
                is_active: true,
                created_by: user?.id || null,
            };

            const updateExistingPart = async (existingPart) => {
                partId = existingPart.id;

                const { error } = await supabase
                    .from('after_sales_part_master')
                    .update({
                        current_part_name: partPayload.current_part_name,
                        base_unit: partPayload.base_unit,
                        critical_stock_level: partPayload.critical_stock_level,
                        min_lead_time_days: partPayload.min_lead_time_days,
                        notes: partPayload.notes,
                        is_active: true,
                    })
                    .eq('id', existingPart.id);

                if (error) throw error;
                revisionId = existingPart.activeRevision?.id || null;
            };

            if (partDialogMode === 'create' && duplicatePart) {
                await updateExistingPart(duplicatePart);
            } else if (partDialogMode === 'create') {
                const { data, error } = await supabase
                    .from('after_sales_part_master')
                    .insert([partPayload])
                    .select()
                    .single();

                if (error?.code === '23505') {
                    duplicatePart = await findExistingPartByCode(partForm.part_code);

                    if (!duplicatePart) {
                        throw error;
                    }

                    await updateExistingPart(duplicatePart);
                } else if (error) {
                    throw error;
                }

                if (data?.id) {
                    partId = data.id;
                }
            } else {
                const { error } = await supabase
                    .from('after_sales_part_master')
                    .update(partPayload)
                    .eq('id', editingPart.id);

                if (error) throw error;
                partId = editingPart.id;
            }

            if (!partId) throw new Error('Parça kaydı oluşturulamadı.');

            if ((partDialogMode === 'edit' || duplicatePart) && (editingPart?.activeRevision?.id || duplicatePart?.activeRevision?.id)) {
                const { error } = await supabase
                    .from('after_sales_part_revisions')
                    .update({
                        revision_no: partForm.revision_no.trim(),
                        revision_date: partForm.revision_date || null,
                        part_name: partForm.current_part_name.trim(),
                        is_active: true,
                    })
                    .eq('id', editingPart?.activeRevision?.id || duplicatePart?.activeRevision?.id);

                if (error) throw error;
                revisionId = editingPart?.activeRevision?.id || duplicatePart?.activeRevision?.id || null;
            } else {
                if (partDialogMode === 'revise' && editingPart?.activeRevision?.id) {
                    await supabase
                        .from('after_sales_part_revisions')
                        .update({ is_active: false })
                        .eq('part_id', partId)
                        .eq('is_active', true);
                }

                const { data: createdRevision, error } = await supabase
                    .from('after_sales_part_revisions')
                    .insert([
                        {
                            part_id: partId,
                            revision_no: partForm.revision_no.trim(),
                            revision_date: partForm.revision_date || null,
                            part_name: partForm.current_part_name.trim(),
                            is_active: true,
                            created_by: user?.id || null,
                        },
                    ])
                    .select('id')
                    .single();

                if (error) throw error;
                revisionId = createdRevision?.id || null;
            }

            if (partDialogMode === 'create' && Number(partForm.current_stock || 0) > 0) {
                const movementType = duplicatePart ? 'Stok Girişi' : 'İlk Stok';
                const movementNote = duplicatePart
                    ? 'Var olan parça kartına ek stok girişi'
                    : 'Parça kartı açılış stoku';

                const nextStock = Number((duplicatePart || editingPart)?.current_stock || 0) + Number(partForm.current_stock || 0);

                if (duplicatePart) {
                    const { error: stockUpdateError } = await supabase
                        .from('after_sales_part_master')
                        .update({ current_stock: nextStock })
                        .eq('id', partId);

                    if (stockUpdateError) throw stockUpdateError;
                }

                const { error: movementError } = await supabase
                    .from('after_sales_part_stock_movements')
                    .insert([
                        {
                            part_id: partId,
                            part_revision_id: revisionId,
                            movement_type: movementType,
                            quantity: Number(partForm.current_stock || 0),
                            note: movementNote,
                            created_by: user?.id || null,
                        },
                    ]);

                if (movementError && !['42P01', 'PGRST205'].includes(movementError.code)) {
                    throw movementError;
                }
            }

            toast({
                title: 'Başarılı',
                description:
                    partDialogMode === 'create'
                        ? duplicatePart
                            ? 'Var olan parça kartı bulundu; kart güncellendi ve stok eklendi.'
                            : 'Parça kartı oluşturuldu.'
                        : partDialogMode === 'revise'
                            ? 'Parça için yeni revizyon kaydı oluşturuldu.'
                            : 'Parça kartı güncellendi.',
            });

            setPartDialogOpen(false);
            await loadDepot();
            onDepotChanged?.();
        } catch (error) {
            console.error('SSH depot part save error:', error);
            toast({
                variant: 'destructive',
                title: 'Kayıt Hatası',
                description: error.message || 'Parça kaydedilemedi.',
            });
        } finally {
            setIsSavingPart(false);
        }
    };

    const handleSaveStock = async () => {
        if (!selectedPart || Number(stockForm.quantity || 0) <= 0) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Geçerli bir stok miktarı girin.',
            });
            return;
        }

        if (selectedPart.revisions?.length > 0 && !stockForm.part_revision_id) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Stok hareketi için revizyon seçin.',
            });
            return;
        }

        setIsSavingStock(true);

        try {
            const quantity = Number(stockForm.quantity || 0);
            const isOutbound = stockForm.movement_type === 'Stok Çıkışı';
            const signedQuantity = isOutbound ? -quantity : quantity;
            const nextStock = Number(selectedPart.current_stock || 0) + signedQuantity;

            const { error: updateError } = await supabase
                .from('after_sales_part_master')
                .update({ current_stock: nextStock })
                .eq('id', selectedPart.id);

            if (updateError) throw updateError;

            const { error: movementError } = await supabase
                .from('after_sales_part_stock_movements')
                .insert([
                    {
                        part_id: selectedPart.id,
                        part_revision_id: stockForm.part_revision_id || null,
                        movement_type: stockForm.movement_type,
                        quantity: signedQuantity,
                        note: stockForm.note?.trim() || null,
                        created_by: user?.id || null,
                    },
                ]);

            if (movementError) throw movementError;

            toast({
                title: 'Başarılı',
                description: 'Stok hareketi kaydedildi.',
            });

            setStockDialogOpen(false);
            await loadDepot();
            onDepotChanged?.();
        } catch (error) {
            console.error('SSH depot stock save error:', error);
            toast({
                variant: 'destructive',
                title: 'Stok Hatası',
                description: error.message || 'Stok hareketi kaydedilemedi.',
            });
        } finally {
            setIsSavingStock(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">SSH Depo</h3>
                    <p className="text-sm text-muted-foreground">
                        Ürün ağaçlarından gelen parça kodu ve adlarını SSH stoklarına alın; stok, kritik seviye, termin ve revizyon adetlerini listeden yönetin.
                    </p>
                </div>
                <Button onClick={openCreatePartDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Parça Kartı
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DepotStatCard title="Toplam Parça" value={stats.totalParts} helper="Depoda izlenen toplam kart" accentClass="text-foreground" icon={Boxes} />
                <DepotStatCard title="Kritik Stok" value={stats.criticalCount} helper="Kritik seviyeye yaklaşanlar" accentClass="text-amber-600" icon={AlertTriangle} />
                <DepotStatCard title="Stokta Yok" value={stats.emptyCount} helper="Acil tedarik gerektirenler" accentClass="text-rose-600" icon={Warehouse} />
                <DepotStatCard title="Ort. Min Termin" value={`${stats.avgLeadTime} gün`} helper="Tedarik telafi ortalaması" accentClass="text-blue-600" icon={Clock3} />
            </div>

            <Card className="border-border/70 shadow-sm">
                <CardContent className="px-5 py-5">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr] xl:grid-cols-[1.3fr_0.7fr]">
                        <div className="flex h-11 items-center gap-3 rounded-xl border bg-background px-4">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Parça kodu veya parça adı ara..."
                            />
                        </div>

                        <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tüm stok durumları" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm stok durumları</SelectItem>
                                <SelectItem value="critical">Kritik stok</SelectItem>
                                <SelectItem value="empty">Stokta yok</SelectItem>
                                <SelectItem value="healthy">Yeterli stok</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {loadError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {loadError}
                </div>
            )}

            {!loading && (stats.criticalCount > 0 || stats.emptyCount > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Kritik stokta {stats.criticalCount} parça, stokta olmayan {stats.emptyCount} parça var. SSH operasyonlarında sevk ve termin uyarılarını kontrol edin.
                </div>
            )}

            <Card className="overflow-hidden border-border/70 shadow-sm">
                <CardHeader className="space-y-1 border-b bg-muted/10 px-5 py-4">
                    <CardTitle className="text-lg">SSH Depo Listesi</CardTitle>
                    <CardDescription>Parça kodu, stok durumu, kritik seviye, termin ve revizyon bazlı stokları aynı tabloda izleyin.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            SSH depo yükleniyor...
                        </div>
                    ) : filteredParts.length === 0 ? (
                        <div className="px-5 py-10 text-sm text-muted-foreground">Gösterilecek parça kartı bulunmuyor.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1380px] table-fixed border-separate border-spacing-0">
                                <colgroup>
                                    <col className="w-[12%]" />
                                    <col className="w-[15%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[13%]" />
                                    <col className="w-[10%]" />
                                </colgroup>
                                <thead className="bg-muted/20">
                                    <tr>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Parça Kodu</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Parça Adı</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Stok Durumu</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mevcut Stok</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kritik Stok</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Min Termin</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Aktif Rev.</th>
                                        <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Revizyon Bazlı Stok</th>
                                        <th className="border-b px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredParts.map((part) => (
                                        <tr key={part.id} className="align-top transition-colors hover:bg-muted/5">
                                            <td className="border-b px-6 py-4.5 text-sm font-semibold text-foreground">{part.part_code}</td>
                                            <td className="border-b px-6 py-4.5 text-sm">
                                                <div className="space-y-2">
                                                    <div className="truncate font-medium text-foreground" title={part.displayName}>
                                                        {part.displayName}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {part.notes && <Badge variant="outline" className="whitespace-nowrap">Not var</Badge>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border-b px-6 py-4.5 text-sm">
                                                <Badge
                                                    variant={
                                                        part.stockStatus === 'Tükendi'
                                                            ? 'destructive'
                                                            : part.stockStatus === 'Kritik'
                                                                ? 'warning'
                                                                : 'secondary'
                                                    }
                                                    className="whitespace-nowrap"
                                                >
                                                    {part.stockStatus}
                                                </Badge>
                                            </td>
                                            <td className="border-b px-6 py-4.5 text-sm font-medium text-foreground">
                                                {formatNumber(part.current_stock)} {part.base_unit || 'Adet'}
                                            </td>
                                            <td className="border-b px-6 py-4.5 text-sm font-medium text-foreground">
                                                {formatNumber(part.critical_stock_level)} {part.base_unit || 'Adet'}
                                            </td>
                                            <td className="border-b px-6 py-4.5 text-sm font-medium text-foreground">{part.min_lead_time_days || 0} gün</td>
                                            <td className="border-b px-6 py-4.5 text-sm font-medium text-foreground">
                                                {part.activeRevision?.revision_no ? `Rev. ${part.activeRevision.revision_no}` : '-'}
                                            </td>
                                            <td className="border-b px-6 py-4.5 text-sm">
                                                {part.revisionStocks?.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {part.revisionStocks.map((revisionStock) => (
                                                            <Badge key={`${part.id}-${revisionStock.id}`} variant="outline" className="whitespace-nowrap text-xs">
                                                                Rev. {revisionStock.revision_no}: {formatNumber(revisionStock.quantity)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">Kayıt yok</span>
                                                )}
                                            </td>
                                            <td className="border-b px-6 py-4.5">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button size="sm" variant="outline" className="min-w-[98px]" onClick={() => openStockDialog(part)}>
                                                        <PackagePlus className="mr-2 h-4 w-4" />
                                                        Stok
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="min-w-[112px]" onClick={() => openEditPartDialog(part)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Düzenle
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="min-w-[114px]" onClick={() => openRevisePartDialog(part)}>
                                                        <GitBranch className="mr-2 h-4 w-4" />
                                                        Revize Et
                                                    </Button>
                                                    <Button size="sm" variant="destructive" className="min-w-[80px]" onClick={() => setDeleteTarget(part)}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Sil
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={partDialogOpen} onOpenChange={setPartDialogOpen}>
                <DialogContent className="w-[99vw] sm:w-[98vw] max-w-none sm:max-w-[1680px] h-[94vh] max-h-[94vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {partDialogMode === 'create'
                                ? 'Yeni Parça Kartı'
                                : partDialogMode === 'revise'
                                    ? 'Yeni Revizyon Ekle'
                                    : 'Parça Kartını Düzenle'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-3">
                            <div>
                                <div className="text-sm font-medium text-foreground">Parça Kartı</div>
                                <div className="text-xs text-muted-foreground">
                                    Ürün ağacındaki parçaları depoya alın; ana kimlik her zaman parça kodu ve parça adıdır.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="md:col-span-2 xl:col-span-4">
                                    <Label>Ürün Ağacından Parça</Label>
                                    <SearchableSelectDialog
                                        options={bomPartOptions}
                                        value={partForm.bom_part_key}
                                        onChange={handleBomPartSelection}
                                        triggerPlaceholder="Ürün ağacındaki parça kodu veya adını seçin..."
                                        dialogTitle="Ürün Ağacından Parça Seç"
                                        searchPlaceholder="Parça kodu veya adı ara..."
                                        notFoundText="Ürün ağacında eşleşen parça bulunamadı."
                                        allowClear
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="part_code">Parça Kodu</Label>
                                    <Input
                                        id="part_code"
                                        value={partForm.part_code}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, part_code: event.target.value }))}
                                    />
                                </div>
                                <div className="md:col-span-1 xl:col-span-3">
                                    <Label htmlFor="current_part_name">Parça Adı</Label>
                                    <Input
                                        id="current_part_name"
                                        value={partForm.current_part_name}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, current_part_name: event.target.value }))}
                                        placeholder="Parçanın sistemde takip edilecek ana adı"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="base_unit">Birim</Label>
                                    <Input
                                        id="base_unit"
                                        value={partForm.base_unit}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, base_unit: event.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="current_stock">{partDialogMode === 'create' ? 'Açılış Stoku' : 'Toplam Stok'}</Label>
                                    <Input
                                        id="current_stock"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={partForm.current_stock}
                                        disabled={partDialogMode !== 'create'}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, current_stock: event.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="critical_stock_level">Kritik Stok</Label>
                                    <Input
                                        id="critical_stock_level"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={partForm.critical_stock_level}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, critical_stock_level: event.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="min_lead_time_days">Min Termin (gün)</Label>
                                    <Input
                                        id="min_lead_time_days"
                                        type="number"
                                        min="0"
                                        value={partForm.min_lead_time_days}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, min_lead_time_days: event.target.value }))}
                                    />
                                </div>
                                <div className="md:col-span-2 xl:col-span-4">
                                    <Label htmlFor="notes">Parça Kartı Notu</Label>
                                    <Textarea
                                        id="notes"
                                        rows={3}
                                        value={partForm.notes}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, notes: event.target.value }))}
                                        placeholder="Depo veya parça yönetimi notları..."
                                    />
                                </div>
                            </div>

                            {partForm.part_code && partCards.some((part) => normalizeDepotValue(part.part_code) === normalizeDepotValue(partForm.part_code)) && partDialogMode === 'create' && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    Bu parça kodu depoda zaten var. Kaydettiğinizde yeni kart açılmayacak; mevcut kayıt güncellenecek ve girilen stok miktarı ek stok olarak işlenecek.
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 rounded-xl border border-dashed p-4">
                            <div>
                                <div className="text-sm font-medium text-foreground">Revizyon Bilgisi</div>
                                <div className="text-xs text-muted-foreground">
                                    Depoda hangi revizyonun tutulduğunu belirtin. Ürün özelliği yönetimi burada değil, sadece stok takibi yapılır.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
                                <div>
                                    <Label htmlFor="revision_no">Revizyon No</Label>
                                    <Input
                                        id="revision_no"
                                        value={partForm.revision_no}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, revision_no: event.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="revision_date">Revizyon Tarihi</Label>
                                    <Input
                                        id="revision_date"
                                        type="date"
                                        value={partForm.revision_date}
                                        onChange={(event) => setPartForm((prev) => ({ ...prev, revision_date: event.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPartDialogOpen(false)} disabled={isSavingPart}>
                            İptal
                        </Button>
                        <Button onClick={handleSavePart} disabled={isSavingPart}>
                            {isSavingPart ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Kaydediliyor...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Kaydet
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
                <DialogContent className="w-[98vw] sm:w-[92vw] max-w-none sm:max-w-[1100px] max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Stok Hareketi</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                            <div className="font-medium text-foreground">{selectedPart?.part_code} • {selectedPart?.displayName}</div>
                            <div className="mt-1 text-muted-foreground">
                                Mevcut stok: {formatNumber(selectedPart?.current_stock || 0)} {selectedPart?.base_unit || 'Adet'}
                            </div>
                            {selectedPart?.revisionStocks?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedPart.revisionStocks.map((revisionStock) => (
                                        <Badge key={`${selectedPart.id}-${revisionStock.id}`} variant="outline" className="text-xs">
                                            Rev. {revisionStock.revision_no}: {formatNumber(revisionStock.quantity)} {selectedPart.base_unit || 'Adet'}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <Label>Revizyon</Label>
                            <Select value={stockForm.part_revision_id || 'none'} onValueChange={(value) => setStockForm((prev) => ({ ...prev, part_revision_id: value === 'none' ? '' : value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Revizyon seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Belirtilmedi</SelectItem>
                                    {(selectedPart?.revisions || []).map((revision) => (
                                        <SelectItem key={revision.id} value={revision.id}>
                                            {`Rev. ${revision.revision_no}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Hareket Tipi</Label>
                            <Select value={stockForm.movement_type} onValueChange={(value) => setStockForm((prev) => ({ ...prev, movement_type: value }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MOVEMENT_TYPE_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="quantity">Miktar</Label>
                            <Input id="quantity" type="number" min="0" step="0.01" value={stockForm.quantity} onChange={(event) => setStockForm((prev) => ({ ...prev, quantity: event.target.value }))} />
                        </div>
                        <div>
                            <Label htmlFor="stock_note">Not</Label>
                            <Textarea id="stock_note" rows={3} value={stockForm.note} onChange={(event) => setStockForm((prev) => ({ ...prev, note: event.target.value }))} />
                        </div>

                        {selectedPart && Number(selectedPart.current_stock || 0) <= Number(selectedPart.critical_stock_level || 0) && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <div className="flex items-center gap-2 font-medium">
                                    <AlertTriangle className="h-4 w-4" />
                                    Bu parça kritik stok seviyesinde.
                                </div>
                                <div className="mt-1">
                                    Kritik: {formatNumber(selectedPart.critical_stock_level)} • Mevcut: {formatNumber(selectedPart.current_stock)}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStockDialogOpen(false)} disabled={isSavingStock}>
                            İptal
                        </Button>
                        <Button onClick={handleSaveStock} disabled={isSavingStock}>
                            {isSavingStock ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Kaydediliyor...
                                </>
                            ) : (
                                <>
                                    <Warehouse className="mr-2 h-4 w-4" />
                                    Stok Hareketini Kaydet
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Parça Kartını Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{deleteTarget?.part_name || deleteTarget?.part_code}</strong> parça kartı ve tüm ilişkili revizyonlar ile stok hareketleri kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default SSHDepotTab;
