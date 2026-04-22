import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Boxes,
    CalendarClock,
    GitBranch,
    Layers3,
    Loader2,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
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
import {
    findMatchingBomRevision,
    getBomRevisionDisplayLabel,
    getVehicleModelsForCategory,
    isBomRevisionEffectiveForDate,
    VEHICLE_CATEGORY_OPTIONS,
} from '@/components/customer-complaints/afterSalesConfig';

const EMPTY_BOM_ITEM = {
    part_id: '',
    part_revision_id: '',
    part_code: '',
    part_name: '',
    quantity: '1',
    unit: 'Adet',
    level: '1',
};

const createEmptyBomForm = () => ({
    vehicle_category: '',
    vehicle_model_code: '',
    bom_name: '',
    revision_no: '1',
    revision_date: new Date().toISOString().split('T')[0],
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    notes: '',
    is_active: 'true',
    items: [EMPTY_BOM_ITEM],
});

const CompactStatCard = ({ title, value, helper, icon: Icon }) => (
    <Card>
        <CardContent className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
                    <div className="text-2xl font-semibold text-foreground">{value}</div>
                    {helper && <div className="text-xs leading-5 text-muted-foreground">{helper}</div>}
                </div>
                <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('tr-TR') : '-');
const normalizeBomLookup = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');

const ProductBomManagerTab = () => {
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [bomRevisions, setBomRevisions] = useState([]);
    const [partMasters, setPartMasters] = useState([]);
    const [partRevisions, setPartRevisions] = useState([]);
    const [vehicleRegistry, setVehicleRegistry] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterModel, setFilterModel] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState('create');
    const [editingBom, setEditingBom] = useState(null);
    const [supersededBom, setSupersededBom] = useState(null);
    const [formData, setFormData] = useState(createEmptyBomForm());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError('');

        try {
            const [bomsResult, itemsResult, partMasterResult, partRevisionResult, registryResult] = await Promise.all([
                supabase
                    .from('after_sales_product_boms')
                    .select('*')
                    .order('vehicle_category', { ascending: true })
                    .order('vehicle_model_code', { ascending: true })
                    .order('revision_no', { ascending: false }),
                supabase
                    .from('after_sales_bom_items')
                    .select('*')
                    .order('level', { ascending: true })
                    .order('part_code', { ascending: true }),
                supabase
                    .from('after_sales_part_master')
                    .select('*')
                    .order('part_code', { ascending: true }),
                supabase
                    .from('after_sales_part_revisions')
                    .select('*')
                    .order('revision_date', { ascending: false })
                    .order('created_at', { ascending: false }),
                supabase
                    .from('after_sales_vehicle_registry')
                    .select('id, vehicle_category, vehicle_model_code, production_date, delivery_date, vehicle_serial_number')
                    .order('delivery_date', { ascending: false }),
            ]);

            if (bomsResult.error) throw bomsResult.error;
            if (itemsResult.error) throw itemsResult.error;
            if (partMasterResult.error) throw partMasterResult.error;
            if (partRevisionResult.error) throw partRevisionResult.error;
            if (registryResult.error && !['42P01', 'PGRST205'].includes(registryResult.error.code)) {
                throw registryResult.error;
            }

            const itemsByBomId = (itemsResult.data || []).reduce((map, item) => {
                const current = map.get(item.bom_id) || [];
                current.push(item);
                map.set(item.bom_id, current);
                return map;
            }, new Map());

            setBomRevisions(
                (bomsResult.data || []).map((bom) => ({
                    ...bom,
                    items: itemsByBomId.get(bom.id) || [],
                }))
            );
            setPartMasters(partMasterResult.data || []);
            setPartRevisions(partRevisionResult.data || []);
            setVehicleRegistry(registryResult.data || []);
        } catch (error) {
            console.error('After sales BOM load error:', error);
            if (['42P01', 'PGRST205'].includes(error.code)) {
                setLoadError('BOM ve parça tabloları henüz kurulmamış. Ürün ağacı sekmesini kullanmak için yeni satış sonrası migrasyonunu uygulayın.');
            } else {
                setLoadError(error.message || 'BOM kayıtları yüklenemedi.');
            }
            setBomRevisions([]);
            setPartMasters([]);
            setPartRevisions([]);
            setVehicleRegistry([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const partMasterMap = useMemo(
        () => new Map(partMasters.map((part) => [part.id, part])),
        [partMasters]
    );

    const partRevisionsByPartId = useMemo(() => {
        return partRevisions.reduce((map, revision) => {
            const current = map.get(revision.part_id) || [];
            current.push(revision);
            map.set(revision.part_id, current);
            return map;
        }, new Map());
    }, [partRevisions]);

    const getRevisionListForPart = useCallback(
        (partId) => (partRevisionsByPartId.get(partId) || []).sort((left, right) => {
            if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
            const leftDate = new Date(left.revision_date || left.created_at || 0).getTime();
            const rightDate = new Date(right.revision_date || right.created_at || 0).getTime();
            return rightDate - leftDate;
        }),
        [partRevisionsByPartId]
    );

    const getPreferredRevisionForPart = useCallback(
        (partId) => getRevisionListForPart(partId)[0] || null,
        [getRevisionListForPart]
    );

    const partCatalog = useMemo(() => {
        return partMasters
            .map((part) => {
                const activeRevision = getPreferredRevisionForPart(part.id);
                return {
                    ...part,
                    activeRevision,
                    displayName: part.current_part_name || activeRevision?.part_name || '-',
                };
            })
            .sort((left, right) => String(left.part_code || '').localeCompare(String(right.part_code || ''), 'tr'));
    }, [getPreferredRevisionForPart, partMasters]);

    const partOptions = useMemo(
        () =>
            partCatalog.map((part) => ({
                value: part.id,
                label: `${part.part_code} • ${part.displayName}`,
            })),
        [partCatalog]
    );

    const filteredBoms = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr-TR');

        return bomRevisions.filter((bom) => {
            if (filterCategory !== 'all' && bom.vehicle_category !== filterCategory) return false;
            if (filterModel !== 'all' && bom.vehicle_model_code !== filterModel) return false;
            if (!normalizedSearch) return true;

            return [
                bom.vehicle_category,
                bom.vehicle_model_code,
                bom.bom_name,
                bom.notes,
                `rev ${bom.revision_no}`,
                ...(bom.items || []).flatMap((item) => [item.part_code, item.part_name]),
            ]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(normalizedSearch));
        });
    }, [bomRevisions, filterCategory, filterModel, searchTerm]);

    const filteredParts = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr-TR');
        if (!normalizedSearch) return partCatalog;

        return partCatalog.filter((part) =>
            [
                part.part_code,
                part.displayName,
                part.activeRevision?.revision_no,
                part.activeRevision?.change_summary,
                part.activeRevision?.specification_summary,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(normalizedSearch))
        );
    }, [partCatalog, searchTerm]);

    const stats = useMemo(() => {
        const matchedVehicleCount = vehicleRegistry.filter((vehicle) => {
            const matched = findMatchingBomRevision(bomRevisions, {
                vehicleCategory: vehicle.vehicle_category,
                vehicleModelCode: vehicle.vehicle_model_code,
                productionDate: vehicle.production_date,
                deliveryDate: vehicle.delivery_date,
            });
            return Boolean(matched);
        }).length;

        return {
            activeBoms: bomRevisions.filter((bom) => bom.is_active !== false).length,
            activeParts: partCatalog.length,
            totalPartRevisions: partRevisions.length,
            matchedVehicleCount,
        };
    }, [bomRevisions, partCatalog.length, partRevisions.length, vehicleRegistry]);

    const vehicleRevisionMatches = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr-TR');

        return vehicleRegistry
            .filter((vehicle) => {
                if (filterCategory !== 'all' && vehicle.vehicle_category !== filterCategory) return false;
                if (filterModel !== 'all' && vehicle.vehicle_model_code !== filterModel) return false;
                if (!normalizedSearch) return true;

                return [vehicle.vehicle_serial_number, vehicle.vehicle_category, vehicle.vehicle_model_code]
                    .filter(Boolean)
                    .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(normalizedSearch));
            })
            .map((vehicle) => {
                const matchedRevision = findMatchingBomRevision(bomRevisions, {
                    vehicleCategory: vehicle.vehicle_category,
                    vehicleModelCode: vehicle.vehicle_model_code,
                    productionDate: vehicle.production_date,
                    deliveryDate: vehicle.delivery_date,
                });

                return {
                    ...vehicle,
                    matchedRevision,
                    referenceDate: vehicle.production_date || vehicle.delivery_date || '',
                };
            })
            .filter((vehicle) => vehicle.matchedRevision)
            .sort((left, right) => String(right.referenceDate || '').localeCompare(String(left.referenceDate || '')))
            .slice(0, 16);
    }, [bomRevisions, filterCategory, filterModel, searchTerm, vehicleRegistry]);

    const availableFilterModels = useMemo(() => {
        if (filterCategory !== 'all') {
            return getVehicleModelsForCategory(filterCategory);
        }

        return Array.from(
            new Set(
                [
                    ...bomRevisions.map((bom) => bom.vehicle_model_code),
                    ...vehicleRegistry.map((vehicle) => vehicle.vehicle_model_code),
                    ...VEHICLE_CATEGORY_OPTIONS.flatMap((category) => getVehicleModelsForCategory(category)),
                ].filter(Boolean)
            )
        ).sort((left, right) => String(left).localeCompare(String(right), 'tr'));
    }, [bomRevisions, filterCategory, vehicleRegistry]);

    const vehicleModelOptions = useMemo(() => {
        const modelPairs = new Map();

        VEHICLE_CATEGORY_OPTIONS.forEach((category) => {
            getVehicleModelsForCategory(category).forEach((modelCode) => {
                const key = `${category}__${modelCode}`;
                modelPairs.set(key, {
                    value: key,
                    vehicle_category: category,
                    vehicle_model_code: modelCode,
                    label: `${category} • ${modelCode}`,
                });
            });
        });

        vehicleRegistry.forEach((vehicle) => {
            if (!vehicle.vehicle_category || !vehicle.vehicle_model_code) return;
            const key = `${vehicle.vehicle_category}__${vehicle.vehicle_model_code}`;
            if (!modelPairs.has(key)) {
                modelPairs.set(key, {
                    value: key,
                    vehicle_category: vehicle.vehicle_category,
                    vehicle_model_code: vehicle.vehicle_model_code,
                    label: `${vehicle.vehicle_category} • ${vehicle.vehicle_model_code}`,
                });
            }
        });

        return Array.from(modelPairs.values()).sort((left, right) =>
            String(left.label).localeCompare(String(right.label), 'tr')
        );
    }, [vehicleRegistry]);

    const resetForm = useCallback(() => {
        setFormData(createEmptyBomForm());
        setEditingBom(null);
        setSupersededBom(null);
        setDialogMode('create');
    }, []);

    const buildBomFormItems = useCallback(
        (items = []) =>
            items.length > 0
                ? items.map((item) => {
                    const matchedPart = item.part_id
                        ? partMasterMap.get(item.part_id)
                        : partCatalog.find((part) => part.part_code === item.part_code);
                    const matchedRevision = item.part_revision_id
                        ? partRevisions.find((revision) => revision.id === item.part_revision_id)
                        : matchedPart
                            ? getRevisionListForPart(matchedPart.id).find((revision) => revision.part_name === item.part_name) ||
                              getPreferredRevisionForPart(matchedPart.id)
                            : null;

                    return {
                        part_id: matchedPart?.id || '',
                        part_revision_id: matchedRevision?.id || '',
                        part_code: item.part_code || matchedPart?.part_code || '',
                        part_name: item.part_name || matchedRevision?.part_name || matchedPart?.current_part_name || '',
                        quantity: String(item.quantity || 1),
                        unit: item.unit || matchedPart?.base_unit || 'Adet',
                        level: String(item.level || 1),
                    };
                })
                : [EMPTY_BOM_ITEM],
        [getPreferredRevisionForPart, getRevisionListForPart, partCatalog, partMasterMap, partRevisions]
    );

    const openCreateDialog = () => {
        resetForm();
        const defaultCategory = filterCategory !== 'all' ? filterCategory : '';
        const defaultModel = filterModel !== 'all' ? filterModel : '';
        setFormData((prev) => ({
            ...prev,
            vehicle_category: defaultCategory,
            vehicle_model_code: defaultModel,
            bom_name: defaultModel ? `${defaultModel} Ana Ürün Ağacı` : '',
        }));
        setDialogOpen(true);
    };

    const openEditDialog = (bom) => {
        setDialogMode('edit');
        setEditingBom(bom);
        setSupersededBom(null);
        setFormData({
            vehicle_category: bom.vehicle_category || '',
            vehicle_model_code: bom.vehicle_model_code || '',
            bom_name: bom.bom_name || '',
            revision_no: String(bom.revision_no || 1),
            revision_date: bom.revision_date || '',
            effective_from: bom.effective_from || '',
            effective_to: bom.effective_to || '',
            notes: bom.notes || '',
            is_active: bom.is_active === false ? 'false' : 'true',
            items: buildBomFormItems(bom.items || []),
        });
        setDialogOpen(true);
    };

    const openReviseDialog = (bom) => {
        setDialogMode('revise');
        setEditingBom(null);
        setSupersededBom(bom);
        setFormData({
            vehicle_category: bom.vehicle_category || '',
            vehicle_model_code: bom.vehicle_model_code || '',
            bom_name: bom.bom_name || '',
            revision_no: String((Number(bom.revision_no) || 0) + 1),
            revision_date: new Date().toISOString().split('T')[0],
            effective_from: new Date().toISOString().split('T')[0],
            effective_to: '',
            notes: bom.notes || '',
            is_active: 'true',
            items: buildBomFormItems(bom.items || []),
        });
        setDialogOpen(true);
    };

    const handleFormChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
            ...(field === 'vehicle_category' ? { vehicle_model_code: '' } : {}),
        }));
    };

    const handleVehicleModelSelection = (value) => {
        const selectedOption = vehicleModelOptions.find((option) => option.value === value);
        setFormData((prev) => ({
            ...prev,
            vehicle_category: selectedOption?.vehicle_category || '',
            vehicle_model_code: selectedOption?.vehicle_model_code || '',
            bom_name:
                prev.bom_name ||
                (selectedOption?.vehicle_model_code
                    ? `${selectedOption.vehicle_model_code} Ana Ürün Ağacı`
                    : ''),
        }));
    };

    const findMatchingPartByInputs = useCallback(
        (partCode, partName) => {
            const normalizedCode = normalizeBomLookup(partCode);
            const normalizedName = normalizeBomLookup(partName);

            if (!normalizedCode && !normalizedName) {
                return { matchedPart: null, matchedRevision: null };
            }

            const matchedPart =
                partCatalog.find((part) => normalizedCode && normalizeBomLookup(part.part_code) === normalizedCode) ||
                partCatalog.find((part) =>
                    normalizedName &&
                    [
                        part.current_part_name,
                        part.displayName,
                        getPreferredRevisionForPart(part.id)?.part_name,
                    ]
                        .filter(Boolean)
                        .some((value) => normalizeBomLookup(value) === normalizedName)
                ) ||
                null;

            const matchedRevision = matchedPart
                ? getRevisionListForPart(matchedPart.id).find(
                      (revision) => normalizedName && normalizeBomLookup(revision.part_name) === normalizedName
                  ) || getPreferredRevisionForPart(matchedPart.id)
                : null;

            return { matchedPart, matchedRevision };
        },
        [getPreferredRevisionForPart, getRevisionListForPart, partCatalog]
    );

    const handleItemChange = (index, field, value) => {
        setFormData((prev) => {
            const nextItems = [...prev.items];
            const nextItem = {
                ...nextItems[index],
                [field]: value,
            };

            if (field === 'part_code' || field === 'part_name') {
                const nextCode = field === 'part_code' ? value : nextItem.part_code;
                const nextName = field === 'part_name' ? value : nextItem.part_name;
                const { matchedPart, matchedRevision } = findMatchingPartByInputs(nextCode, nextName);

                if (!String(nextCode || '').trim() && !String(nextName || '').trim()) {
                    nextItem.part_id = '';
                    nextItem.part_revision_id = '';
                } else if (matchedPart) {
                    nextItem.part_id = matchedPart.id;
                    nextItem.part_revision_id = matchedRevision?.id || '';
                    if (field === 'part_code' && !String(nextItem.part_name || '').trim()) {
                        nextItem.part_name = matchedRevision?.part_name || matchedPart.displayName || '';
                    }
                    if (field === 'part_name' && !String(nextItem.part_code || '').trim()) {
                        nextItem.part_code = matchedPart.part_code || '';
                    }
                    if (!String(nextItem.unit || '').trim()) {
                        nextItem.unit = matchedPart.base_unit || 'Adet';
                    }
                } else {
                    nextItem.part_id = '';
                    nextItem.part_revision_id = '';
                }
            }

            nextItems[index] = nextItem;
            return {
                ...prev,
                items: nextItems,
            };
        });
    };

    const handlePartSelection = (index, partId) => {
        const selectedPart = partCatalog.find((part) => part.id === partId);
        const revision = selectedPart ? getPreferredRevisionForPart(selectedPart.id) : null;

        setFormData((prev) => {
            const nextItems = [...prev.items];
            nextItems[index] = {
                ...nextItems[index],
                part_id: selectedPart?.id || '',
                part_revision_id: revision?.id || '',
                part_code: selectedPart?.part_code || '',
                part_name: revision?.part_name || selectedPart?.displayName || '',
                unit: selectedPart?.base_unit || 'Adet',
            };
            return {
                ...prev,
                items: nextItems,
            };
        });
    };

    const handleRevisionSelection = (index, revisionId) => {
        const selectedRevision = partRevisions.find((revision) => revision.id === revisionId);
        const selectedPart = selectedRevision ? partMasterMap.get(selectedRevision.part_id) : null;

        setFormData((prev) => {
            const nextItems = [...prev.items];
            nextItems[index] = {
                ...nextItems[index],
                part_id: selectedPart?.id || nextItems[index].part_id,
                part_revision_id: selectedRevision?.id || '',
                part_code: selectedPart?.part_code || nextItems[index].part_code,
                part_name: selectedRevision?.part_name || selectedPart?.current_part_name || nextItems[index].part_name,
                unit: selectedPart?.base_unit || nextItems[index].unit || 'Adet',
            };
            return {
                ...prev,
                items: nextItems,
            };
        });
    };

    const addItemRow = () => {
        setFormData((prev) => ({
            ...prev,
            items: [...prev.items, EMPTY_BOM_ITEM],
        }));
    };

    const removeItemRow = (index) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.length === 1 ? prev.items : prev.items.filter((_, currentIndex) => currentIndex !== index),
        }));
    };

    const handleSave = async () => {
        const cleanItems = formData.items
            .map((item) => ({
                part_id: item.part_id || null,
                part_revision_id: item.part_revision_id || null,
                part_code: item.part_code.trim(),
                part_name: item.part_name.trim(),
                quantity: Number(item.quantity || 1),
                unit: item.unit.trim() || 'Adet',
                level: Number(item.level || 1),
            }))
            .filter((item) => item.part_id || item.part_code || item.part_name);

        if (!formData.vehicle_category || !formData.vehicle_model_code || cleanItems.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Araç kategorisi, model ve en az bir BOM kalemi zorunludur.',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const bomPayload = {
                vehicle_category: formData.vehicle_category,
                vehicle_model_code: formData.vehicle_model_code,
                bom_name: formData.bom_name || null,
                revision_no: Number(formData.revision_no || 1),
                revision_date: formData.revision_date || null,
                effective_from: formData.effective_from || null,
                effective_to: formData.effective_to || null,
                notes: formData.notes || null,
                is_active: formData.is_active !== 'false',
            };

            let bomId = editingBom?.id || null;

            if (dialogMode === 'edit' && bomId) {
                const { error: updateError } = await supabase
                    .from('after_sales_product_boms')
                    .update(bomPayload)
                    .eq('id', bomId);

                if (updateError) throw updateError;

                const { error: deleteItemsError } = await supabase
                    .from('after_sales_bom_items')
                    .delete()
                    .eq('bom_id', bomId);

                if (deleteItemsError) throw deleteItemsError;
            } else {
                const { data: createdBom, error: createError } = await supabase
                    .from('after_sales_product_boms')
                    .insert([bomPayload])
                    .select()
                    .single();

                if (createError) throw createError;
                bomId = createdBom.id;

                if (dialogMode === 'revise' && supersededBom?.id && formData.effective_from) {
                    const previousEffectiveTo = new Date(`${formData.effective_from}T00:00:00`);
                    previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);

                    await supabase
                        .from('after_sales_product_boms')
                        .update({
                            effective_to: previousEffectiveTo.toISOString().split('T')[0],
                            is_active: false,
                        })
                        .eq('id', supersededBom.id);
                }
            }

            const itemsPayload = cleanItems.map((item) => ({
                bom_id: bomId,
                part_id: item.part_id,
                part_revision_id: item.part_revision_id,
                part_code: item.part_code || null,
                part_name: item.part_name || 'Parça',
                quantity: item.quantity,
                unit: item.unit,
                level: item.level,
                parent_part_code: null,
                notes: null,
            }));

            const { error: insertItemsError } = await supabase
                .from('after_sales_bom_items')
                .insert(itemsPayload);

            if (insertItemsError) throw insertItemsError;

            toast({
                title: 'Başarılı',
                description: dialogMode === 'edit' ? 'Ürün ağacı güncellendi.' : 'Ürün ağacı kaydedildi.',
            });

            setDialogOpen(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('After sales BOM save error:', error);
            toast({
                variant: 'destructive',
                title: 'Kayıt Hatası',
                description: error.message || 'Ürün ağacı kaydedilemedi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const [deleteBomTarget, setDeleteBomTarget] = useState(null);

    const executeDeleteBom = async () => {
        if (!deleteBomTarget) return;
        try {
            const { error } = await supabase
                .from('after_sales_product_boms')
                .delete()
                .eq('id', deleteBomTarget);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Ürün ağacı silindi.',
            });
            setDeleteBomTarget(null);
            loadData();
        } catch (error) {
            console.error('After sales BOM delete error:', error);
            toast({
                variant: 'destructive',
                title: 'Silme Hatası',
                description: error.message || 'Ürün ağacı silinemedi.',
            });
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Ürün Ağaçları</h3>
                    <p className="text-sm text-muted-foreground">
                        Supabase CSV ile içe aldığınız ürün ağaçlarını burada izleyin; gerektiğinde aynı model için parça kodu ve parça adlarını manuel olarak da tamamlayın.
                    </p>
                </div>

                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Ürün Ağacı
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CompactStatCard title="Aktif Ürün Ağacı" value={stats.activeBoms} helper="Kullanıma açık ürün ağaçları" icon={GitBranch} />
                <CompactStatCard title="Parça Kartı" value={stats.activeParts} helper="Parça kartları SSH Depo tarafından yönetilir" icon={Boxes} />
                <CompactStatCard title="Revizyon Kaydı" value={stats.totalPartRevisions} helper="Yanlış sevki önlemek için izlenen parça değişiklik kayıtları" icon={Layers3} />
                <CompactStatCard title="Eşleşen Araç" value={stats.matchedVehicleCount} helper="Üretim veya teslim tarihine göre ürün ağacı eşleşmesi olan araçlar" icon={CalendarClock} />
            </div>

            <Card>
                <CardContent className="px-5 py-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.75fr_0.75fr_auto]">
                        <div className="flex h-11 items-center gap-3 rounded-xl border bg-background px-4">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Model, ürün, parça kodu veya parça adı ara..."
                            />
                        </div>

                        <Select
                            value={filterCategory}
                            onValueChange={(value) => {
                                setFilterCategory(value);
                                setFilterModel('all');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tüm kategoriler" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm kategoriler</SelectItem>
                                {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filterModel}
                            onValueChange={setFilterModel}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tüm modeller" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm modeller</SelectItem>
                                {availableFilterModels.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearchTerm('');
                                setFilterCategory('all');
                                setFilterModel('all');
                            }}
                        >
                            Filtreleri Temizle
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loadError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {loadError}
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.45fr_1fr]">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Ürün Ağacı Kayıtları</CardTitle>
                        <CardDescription>Model bazlı ürün ağaçları, geçerlilik pencereleri ve revizyon geçmişi</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loading ? (
                            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Ürün ağacı kayıtları yükleniyor...
                            </div>
                        ) : filteredBoms.length === 0 ? (
                            <div className="py-10 text-sm text-muted-foreground">Görüntülenecek ürün ağacı kaydı bulunmuyor.</div>
                        ) : (
                            filteredBoms.map((bom) => {
                                const matchedVehicleCount = vehicleRegistry.filter((vehicle) =>
                                    vehicle.vehicle_category === bom.vehicle_category &&
                                    vehicle.vehicle_model_code === bom.vehicle_model_code &&
                                    isBomRevisionEffectiveForDate(bom, vehicle.production_date || vehicle.delivery_date)
                                ).length;

                                return (
                                    <div key={bom.id} className="rounded-xl border p-4">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-semibold text-foreground">{getBomRevisionDisplayLabel(bom)}</div>
                                                    <Badge variant={bom.is_active === false ? 'secondary' : 'default'}>
                                                        {bom.is_active === false ? 'Pasif' : 'Aktif'}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {bom.bom_name || 'BOM adı belirtilmedi'}
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span>Geçerlilik: {formatDate(bom.effective_from)} - {formatDate(bom.effective_to)}</span>
                                                    <span>Kalem: {(bom.items || []).length}</span>
                                                    <span>Eşleşen araç: {matchedVehicleCount}</span>
                                                </div>
                                                {bom.notes && (
                                                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                                        {bom.notes}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(bom)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Düzenle
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => openReviseDialog(bom)}>
                                                    <GitBranch className="mr-2 h-4 w-4" />
                                                    Revize Et
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => setDeleteBomTarget(bom.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Sil
                                                </Button>
                                            </div>
                                        </div>

                                        {(bom.items || []).length > 0 && (
                                            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {bom.items.slice(0, 6).map((item, index) => (
                                                    <div key={`${bom.id}-item-${index}`} className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                                                        <div className="font-medium">{item.part_name || 'Parça'}</div>
                                                        <div className="mt-1 text-muted-foreground">
                                                            {item.part_code || '-'} • {item.quantity} {item.unit || 'Adet'}
                                                            {item.part_revision_id
                                                                ? ` • Kontrol Rev. ${partRevisions.find((revision) => revision.id === item.part_revision_id)?.revision_no || '-'}`
                                                                : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Parça Kataloğu</CardTitle>
                        <CardDescription>Parça kodu ve parça adı ana kimliktir; revizyonlar sevk doğrulaması için ikincil tutulur</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {filteredParts.length === 0 ? (
                            <div className="py-10 text-sm text-muted-foreground">Parça kataloğu için kayıt bulunmuyor.</div>
                        ) : (
                            filteredParts.slice(0, 16).map((part) => (
                                <div key={part.id} className="rounded-xl border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium text-foreground">{part.part_code}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">{part.displayName}</div>
                                        </div>
                                        {part.activeRevision?.revision_no && (
                                            <Badge variant="outline">Kontrol Rev. {part.activeRevision.revision_no}</Badge>
                                        )}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <span>Stok: {Number(part.current_stock || 0).toLocaleString('tr-TR')}</span>
                                        <span>Kritik: {Number(part.critical_stock_level || 0).toLocaleString('tr-TR')}</span>
                                        <span>Termin min: {part.min_lead_time_days || 0} gün</span>
                                    </div>
                                    {part.activeRevision?.change_summary && (
                                        <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                            {part.activeRevision.change_summary}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Araç - Ürün Ağacı Eşleşmeleri</CardTitle>
                    <CardDescription>Üretim veya teslim tarihine göre hangi aracın hangi ürün ağacı kaydıyla izlendiğini görün</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {vehicleRevisionMatches.length === 0 ? (
                        <div className="py-10 text-sm text-muted-foreground">
                            Seçili filtrelerde ürün ağacıyla eşleşen araç bulunmuyor.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                            {vehicleRevisionMatches.map((vehicle) => (
                                <div
                                    key={`${vehicle.id}-${vehicle.matchedRevision?.id || 'no-rev'}`}
                                    className="rounded-xl border p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-foreground">
                                                {vehicle.vehicle_serial_number || '-'}
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                {[vehicle.vehicle_category, vehicle.vehicle_model_code].filter(Boolean).join(' / ') || '-'}
                                            </div>
                                        </div>
                                        <Badge variant="outline">
                                            {vehicle.production_date ? 'Üretim Tarihi' : 'Teslim Tarihi'}
                                        </Badge>
                                    </div>

                                        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                            <div className="rounded-lg bg-muted/40 px-3 py-3">
                                                <div className="text-muted-foreground">Referans Tarih</div>
                                                <div className="mt-1 font-medium">{formatDate(vehicle.referenceDate)}</div>
                                            </div>
                                            <div className="rounded-lg bg-muted/40 px-3 py-3">
                                                <div className="text-muted-foreground">Eşleşen Ürün Ağacı</div>
                                                <div className="mt-1 font-medium">{getBomRevisionDisplayLabel(vehicle.matchedRevision)}</div>
                                            </div>
                                        </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="w-[99vw] sm:w-[98vw] max-w-none sm:max-w-[1880px] h-[95vh] max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === 'edit'
                                ? 'Ürün Ağacını Düzenle'
                                : dialogMode === 'revise'
                                    ? 'Yeni Ürün Ağacı Revizyonu'
                                    : 'Yeni Ürün Ağacı'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-7">
                        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            Araç modelini belirleyin, ardından bu modele ait tüm parça kodu ve parça adlarını satır satır ekleyin. Buradaki liste üretimde kullanılan ana parça listesidir.
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <div className="xl:col-span-2">
                                <Label>Araç / Model</Label>
                                <SearchableSelectDialog
                                    options={vehicleModelOptions}
                                    value={
                                        formData.vehicle_category && formData.vehicle_model_code
                                            ? `${formData.vehicle_category}__${formData.vehicle_model_code}`
                                            : ''
                                    }
                                    onChange={handleVehicleModelSelection}
                                    triggerPlaceholder="Araç kategorisi ve model seçin..."
                                    dialogTitle="Araç / Model Seç"
                                    searchPlaceholder="Kategori veya model ara..."
                                    notFoundText="Eşleşen araç modeli bulunamadı."
                                />
                            </div>
                            <div>
                                <Label>Araç Kategorisi</Label>
                                <Input value={formData.vehicle_category || '-'} readOnly className="bg-muted/30" />
                            </div>
                            <div>
                                <Label>Model Kodu</Label>
                                <Input value={formData.vehicle_model_code || '-'} readOnly className="bg-muted/30" />
                            </div>
                            <div>
                                <Label htmlFor="bom_name">Ürün Ağacı Adı</Label>
                                <Input
                                    id="bom_name"
                                    value={formData.bom_name}
                                    onChange={(event) => handleFormChange('bom_name', event.target.value)}
                                    placeholder="Örn. AGA3000 Ana Ürün Ağacı"
                                />
                            </div>
                            <div>
                                <Label htmlFor="revision_no">Ürün Ağacı Revizyonu</Label>
                                <Input
                                    id="revision_no"
                                    type="number"
                                    min="1"
                                    value={formData.revision_no}
                                    onChange={(event) => handleFormChange('revision_no', event.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="revision_date">Revizyon Tarihi</Label>
                                <Input
                                    id="revision_date"
                                    type="date"
                                    value={formData.revision_date}
                                    onChange={(event) => handleFormChange('revision_date', event.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="effective_from">Geçerlilik Başlangıcı</Label>
                                <Input
                                    id="effective_from"
                                    type="date"
                                    value={formData.effective_from}
                                    onChange={(event) => handleFormChange('effective_from', event.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="effective_to">Geçerlilik Bitişi</Label>
                                <Input
                                    id="effective_to"
                                    type="date"
                                    value={formData.effective_to}
                                    onChange={(event) => handleFormChange('effective_to', event.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Durum</Label>
                                <Select value={formData.is_active} onValueChange={(value) => handleFormChange('is_active', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Aktif</SelectItem>
                                        <SelectItem value="false">Pasif</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2 xl:col-span-5">
                                <Label htmlFor="notes">Açıklama</Label>
                                <Textarea
                                    id="notes"
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(event) => handleFormChange('notes', event.target.value)}
                                    placeholder="Bu ürün ağacında değişen yapı, kapsanan montaj veya kritik açıklama..."
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border p-4 space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="font-medium">Ürün Ağacı Kalemleri</div>
                                    <div className="text-sm text-muted-foreground">
                                        Ürün ağacını parça kodu ve parça adı üzerinden manuel kurun. Parça SSH Depo'da varsa sistem eşleşmeyi otomatik yakalar.
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={addItemRow}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Kalem Ekle
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item, index) => {
                                    const revisionOptions = getRevisionListForPart(item.part_id).map((revision) => ({
                                        value: revision.id,
                                        label: `Kontrol Rev. ${revision.revision_no} • ${revision.part_name}`,
                                    }));

                                    return (
                                        <div key={`bom-item-${index}`} className="rounded-xl border bg-background p-4">
                                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.8fr_1.35fr_0.95fr_0.55fr_0.55fr_0.75fr_auto]">
                                                <div>
                                                    <Label>Parça Kodu</Label>
                                                    <Input
                                                        value={item.part_code}
                                                        onChange={(event) => handleItemChange(index, 'part_code', event.target.value)}
                                                        placeholder="Parça kodunu yazın"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Parça Adı</Label>
                                                    <Input
                                                        value={item.part_name}
                                                        onChange={(event) => handleItemChange(index, 'part_name', event.target.value)}
                                                        placeholder="Parça adını yazın"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Revizyon</Label>
                                                    <Select
                                                        value={item.part_revision_id || 'none'}
                                                        onValueChange={(value) => handleRevisionSelection(index, value === 'none' ? '' : value)}
                                                        disabled={!item.part_id}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Depoda varsa seçin" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Belirtilmedi</SelectItem>
                                                            {revisionOptions.map((option) => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Miktar</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.quantity}
                                                        onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Seviye</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={item.level}
                                                        onChange={(event) => handleItemChange(index, 'level', event.target.value)}
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    {formData.items.length > 1 && (
                                                        <Button type="button" variant="destructive" onClick={() => removeItemRow(index)}>
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Sil
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1.25fr_0.75fr]">
                                                <div>
                                                    <Label>Depo Eşleşmesi</Label>
                                                    <div className="flex h-10 items-center rounded-lg border bg-muted/20 px-3 text-sm text-muted-foreground">
                                                        {item.part_id
                                                            ? `${partMasterMap.get(item.part_id)?.part_code || item.part_code} • ${partMasterMap.get(item.part_id)?.current_part_name || item.part_name}`
                                                            : 'Bu kalem depoda yoksa manuel BOM satırı olarak kaydedilir.'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label>Birim</Label>
                                                    <Input
                                                        value={item.unit}
                                                        onChange={(event) => handleItemChange(index, 'unit', event.target.value)}
                                                        placeholder="Adet"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                            İptal
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? (
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

            <AlertDialog open={!!deleteBomTarget} onOpenChange={(open) => { if (!open) setDeleteBomTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ürün Ağacını Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu ürün ağacı ve tüm kalem bilgileri kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDeleteBom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ProductBomManagerTab;
