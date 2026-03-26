import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Boxes,
    CarTaxiFront,
    CheckCircle2,
    Clock3,
    Loader2,
    MapPin,
    Pencil,
    Plus,
    Route,
    Trash2,
    User,
    Wrench,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { getAfterSalesCaseNumber, getCustomerDisplayName, getFaultPartSummaryLabel, getFaultPartsFromComplaint } from '@/components/customer-complaints/afterSalesConfig';

const OPERATION_TYPES = [
    'Saha Servisi',
    'Uzaktan Destek',
    'Garanti Onarımı',
    'Yedek Parça Teslimi',
    'Yerinde İnceleme',
    'Teknik Destek',
];

const OPERATION_STATUSES = ['Planlandı', 'Hazırlanıyor', 'Yolda', 'Sahada', 'Tamamlandı', 'İptal'];
const PLANNED_OPERATION_STATUSES = ['Planlandı', 'Hazırlanıyor'];
const ACTIVE_OPERATION_STATUSES = ['Yolda', 'Sahada'];
const COMPLETED_OPERATION_STATUSES = ['Tamamlandı', 'İptal'];
const CURRENT_LOCATION_OPTIONS = ['Merkezde', 'Hazırlıkta', 'Yolda', 'Müşteri Sahasında', 'Serviste', 'Parça Bekliyor', 'Dönüş Yolunda', 'Tamamlandı'];

const EMPTY_PART = {
    part_id: '',
    part_revision_id: '',
    part_code: '',
    part_name: '',
    quantity: '1',
    unit_cost: '0',
    total_cost: '0',
    notes: '',
};

const EMPTY_FORM = {
    complaint_id: '',
    operation_type: 'Saha Servisi',
    operation_title: '',
    operation_details: '',
    city: '',
    country: 'Türkiye',
    assigned_person_id: '',
    current_location: '',
    status: 'Planlandı',
    planned_start_date: '',
    planned_end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    lodging_days: '0',
    lodging_cost: '0',
    travel_km: '0',
    travel_cost: '0',
    labor_hours: '0',
    labor_cost: '0',
    completion_notes: '',
    parts: [EMPTY_PART],
};

const formatMoney = (value) =>
    Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
const formatNumber = (value) =>
    Number(value || 0).toLocaleString('tr-TR', {
        minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
        maximumFractionDigits: 2,
    });

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '-');
const formatHours = (value) => `${formatNumber(value || 0)} saat`;
const truncateLabel = (value, limit = 72) =>
    value && value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
const operationTitleForMovement = (value) => truncateLabel(value || 'Operasyon', 48);
const calculateServiceHours = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return diffDays * 8;
};

const getMissingColumnName = (error) => {
    const message = error?.message || '';
    const postgresMatch = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+of\s+relation/i);
    if (postgresMatch?.[1]) return postgresMatch[1];

    const missingMatch = message.match(/column\s+customer_complaints\.([a-zA-Z0-9_]+)\s+does not exist/i);
    if (missingMatch?.[1]) return missingMatch[1];

    const schemaCacheMatch = message.match(/Could not find the '([a-zA-Z0-9_]+)' column/i);
    if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

    return null;
};

const ServiceOperationsPlannerTab = ({ onOperationsChanged, panel = 'operations' }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { customerComplaints, personnel } = useData();

    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingOperation, setEditingOperation] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [dialogMode, setDialogMode] = useState('plan');
    const [operationViewTab, setOperationViewTab] = useState('planned');
    const [personnelPanelTab, setPersonnelPanelTab] = useState('assignments');
    const [depotParts, setDepotParts] = useState([]);
    const [partRevisions, setPartRevisions] = useState([]);
    const [inventoryLoadError, setInventoryLoadError] = useState(null);

    const loadOperations = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const { data: operationsData, error: operationsError } = await supabase
                .from('after_sales_service_operations')
                .select(`
                    *,
                    complaint:complaint_id(id, title, vehicle_serial_number, customer_id, customer:customer_id(name, customer_name, customer_code)),
                    assigned_person:assigned_person_id(id, full_name)
                `)
                .order('planned_start_date', { ascending: false });

            if (operationsError) throw operationsError;

            const operationIds = (operationsData || []).map((operation) => operation.id);
            let partsMap = new Map();

            if (operationIds.length > 0) {
                const { data: partsData, error: partsError } = await supabase
                    .from('after_sales_service_operation_parts')
                    .select('*')
                    .in('operation_id', operationIds)
                    .order('created_at', { ascending: true });

                if (partsError) throw partsError;

                partsMap = (partsData || []).reduce((map, part) => {
                    const current = map.get(part.operation_id) || [];
                    current.push(part);
                    map.set(part.operation_id, current);
                    return map;
                }, new Map());
            }

            setOperations(
                (operationsData || []).map((operation) => ({
                    ...operation,
                    parts: partsMap.get(operation.id) || [],
                }))
            );
        } catch (error) {
            console.error('After sales operations load error:', error);
            if (['42P01', 'PGRST205'].includes(error.code)) {
                setLoadError('Operasyon planlama tabloları henüz kurulmamış. Yeni migrasyon uygulandıktan sonra saha görevlendirme aktif olacaktır.');
            } else {
                setLoadError(error.message || 'Operasyon planlaması yüklenemedi.');
            }
            setOperations([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadDepotInventory = useCallback(async () => {
        try {
            const [partResult, revisionResult] = await Promise.all([
                supabase.from('after_sales_part_master').select('*').order('part_code', { ascending: true }),
                supabase.from('after_sales_part_revisions').select('*').order('revision_date', { ascending: false }),
            ]);

            if (partResult.error) throw partResult.error;
            if (revisionResult.error) throw revisionResult.error;

            setDepotParts(partResult.data || []);
            setPartRevisions(revisionResult.data || []);
            setInventoryLoadError(null);
        } catch (error) {
            console.error('After sales depot inventory load error:', error);
            if (['42P01', 'PGRST205'].includes(error.code)) {
                setInventoryLoadError('Satış Sonrası Hizmetler depo tabloları henüz kurulmamış. Stok ve termin uyarıları migrasyon sonrası aktif olacaktır.');
            } else {
                setInventoryLoadError(error.message || 'Satış Sonrası Hizmetler depo verileri yüklenemedi.');
            }
            setDepotParts([]);
            setPartRevisions([]);
        }
    }, []);

    const syncComplaintLifecycle = useCallback(
        async (complaintId) => {
            if (!complaintId) return;

            const { data: relatedOperations, error: operationsError } = await supabase
                    .from('after_sales_service_operations')
                    .select('status, actual_start_date, actual_end_date')
                    .eq('complaint_id', complaintId);

            if (operationsError) throw operationsError;

            const activeOrPlanned = (relatedOperations || []).filter(
                (operation) => !['Tamamlandı', 'İptal'].includes(operation.status)
            );
            const completedOperations = (relatedOperations || []).filter(
                (operation) => operation.status === 'Tamamlandı' && operation.actual_end_date
            );
            const startedDates = (relatedOperations || [])
                .map((operation) => operation.actual_start_date)
                .filter(Boolean)
                .sort();
            const completedDates = completedOperations
                .map((operation) => operation.actual_end_date)
                .filter(Boolean)
                .sort();

            const hasOpenOperations = activeOrPlanned.length > 0;
            const latestCompletionDate = completedDates[completedDates.length - 1] || null;

            const payload = {
                status: hasOpenOperations
                    ? 'Aksiyon Alınıyor'
                    : latestCompletionDate
                        ? 'Kapalı'
                        : 'Açık',
                first_response_date: startedDates[0] || null,
                service_start_date: startedDates[0] || null,
                service_completion_date: hasOpenOperations ? null : latestCompletionDate,
                actual_close_date: hasOpenOperations ? null : latestCompletionDate,
            };

            const safePayload = { ...payload };

            while (Object.keys(safePayload).length > 0) {
                const { error: updateError } = await supabase
                    .from('customer_complaints')
                    .update(safePayload)
                    .eq('id', complaintId);

                if (!updateError) {
                    return;
                }

                const missingColumn = getMissingColumnName(updateError);
                if (!missingColumn || !(missingColumn in safePayload)) {
                    throw updateError;
                }

                delete safePayload[missingColumn];
            }
        },
        []
    );

    useEffect(() => {
        loadOperations();
    }, [loadOperations]);

    useEffect(() => {
        loadDepotInventory();
    }, [loadDepotInventory]);

    const complaintOptions = useMemo(
        () =>
            (customerComplaints || []).map((record) => ({
                value: record.id,
                label: `${getAfterSalesCaseNumber(record)} • ${truncateLabel(record.title || '-', 48)}`,
            })),
        [customerComplaints]
    );

    const sshPersonnel = useMemo(
        () =>
            (personnel || []).filter(
                (person) => {
                    if (!person.is_active) return false;
                    const dept = person.department?.toLowerCase() || '';
                    return dept.includes('satış sonrası') || dept.includes('satis sonrasi') || dept.includes('ssh');
                }
            ),
        [personnel]
    );

    const personnelOptions = useMemo(
        () =>
            sshPersonnel
                .map((person) => ({
                    value: person.id,
                    label: person.full_name,
                })),
        [sshPersonnel]
    );

    const selectedComplaint = useMemo(
        () => customerComplaints.find((record) => record.id === formData.complaint_id),
        [customerComplaints, formData.complaint_id]
    );

    const revisionsByPartId = useMemo(() => {
        return partRevisions.reduce((map, revision) => {
            const current = map.get(revision.part_id) || [];
            current.push(revision);
            map.set(revision.part_id, current);
            return map;
        }, new Map());
    }, [partRevisions]);

    const depotPartCatalog = useMemo(() => {
        return depotParts.map((part) => {
            const revisionList = (revisionsByPartId.get(part.id) || []).sort((left, right) => {
                if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
                const leftDate = new Date(left.revision_date || left.created_at || 0).getTime();
                const rightDate = new Date(right.revision_date || right.created_at || 0).getTime();
                return rightDate - leftDate;
            });
            const activeRevision = revisionList[0] || null;
            const currentStock = Number(part.current_stock || 0);
            const criticalStock = Number(part.critical_stock_level || 0);

            return {
                ...part,
                revisions: revisionList,
                activeRevision,
                displayName: part.current_part_name || activeRevision?.part_name || '-',
                stockStatus:
                    currentStock <= 0 ? 'Tükendi' : currentStock <= criticalStock ? 'Kritik' : 'Yeterli',
            };
        });
    }, [depotParts, revisionsByPartId]);

    const depotPartMap = useMemo(
        () => new Map(depotPartCatalog.map((part) => [part.id, part])),
        [depotPartCatalog]
    );

    const findDepotPart = useCallback(
        ({ partId, partCode, partName }) => {
            if (partId && depotPartMap.has(partId)) return depotPartMap.get(partId);

            return depotPartCatalog.find((part) =>
                (partCode && String(part.part_code || '').trim().toLocaleLowerCase('tr-TR') === String(partCode || '').trim().toLocaleLowerCase('tr-TR')) ||
                (partName && (
                    String(part.displayName || '').trim().toLocaleLowerCase('tr-TR') === String(partName || '').trim().toLocaleLowerCase('tr-TR') ||
                    String(part.current_part_name || '').trim().toLocaleLowerCase('tr-TR') === String(partName || '').trim().toLocaleLowerCase('tr-TR')
                ))
            ) || null;
        },
        [depotPartCatalog, depotPartMap]
    );

    const partOptions = useMemo(
        () =>
            depotPartCatalog.map((part) => ({
                value: part.id,
                label: `${part.part_code} • ${part.displayName} • Stok ${formatNumber(part.current_stock)} ${part.base_unit || 'Adet'}`,
            })),
        [depotPartCatalog]
    );

    const activeAssignments = useMemo(
        () => operations.filter((operation) => !['Tamamlandı', 'İptal'].includes(operation.status)),
        [operations]
    );
    const plannedOperations = useMemo(
        () => operations.filter((operation) => PLANNED_OPERATION_STATUSES.includes(operation.status)),
        [operations]
    );
    const continuingOperations = useMemo(
        () => operations.filter((operation) => ACTIVE_OPERATION_STATUSES.includes(operation.status)),
        [operations]
    );
    const completedOperations = useMemo(
        () => operations.filter((operation) => COMPLETED_OPERATION_STATUSES.includes(operation.status)),
        [operations]
    );

    const availablePersonnelCount = useMemo(() => {
        const busyIds = new Set(activeAssignments.map((operation) => operation.assigned_person_id).filter(Boolean));
        return sshPersonnel.filter((person) => !busyIds.has(person.id)).length;
    }, [activeAssignments, sshPersonnel]);

    const completedThisMonth = useMemo(() => {
        const now = new Date();
        return operations.filter((operation) => {
            if (!operation.actual_end_date) return false;
            const completedAt = new Date(operation.actual_end_date);
            return completedAt.getFullYear() === now.getFullYear() && completedAt.getMonth() === now.getMonth();
        }).length;
    }, [operations]);

    const personnelBoard = useMemo(() => {
        return sshPersonnel
            .map((person) => {
                const activeOperation = activeAssignments.find((operation) => operation.assigned_person_id === person.id);
                const latestCompletedOperation = operations
                    .filter((operation) => operation.assigned_person_id === person.id && operation.actual_end_date)
                    .sort((left, right) => new Date(right.actual_end_date) - new Date(left.actual_end_date))[0];

                return {
                    id: person.id,
                    full_name: person.full_name,
                    department: person.department,
                    activeOperation,
                    latestCompletedOperation,
                };
            })
            .sort((left, right) => {
                if (left.activeOperation && !right.activeOperation) return -1;
                if (!left.activeOperation && right.activeOperation) return 1;
                return left.full_name.localeCompare(right.full_name, 'tr');
            });
    }, [activeAssignments, operations, sshPersonnel]);

    const performancePeople = useMemo(() => {
        const peopleMap = new Map();

        sshPersonnel.forEach((person) => {
            peopleMap.set(person.id, {
                id: person.id,
                full_name: person.full_name,
                department: person.department,
            });
        });

        operations.forEach((operation) => {
            if (!operation.assigned_person_id) return;
            if (!peopleMap.has(operation.assigned_person_id)) {
                peopleMap.set(operation.assigned_person_id, {
                    id: operation.assigned_person_id,
                    full_name: operation.assigned_person?.full_name || 'İsimsiz Personel',
                    department: 'Satış Sonrası Hizmetler',
                });
            }
        });

        return Array.from(peopleMap.values());
    }, [operations, sshPersonnel]);

    const personnelPerformanceRows = useMemo(() => {
        return performancePeople
            .map((person) => {
                const personOperations = operations.filter((operation) => operation.assigned_person_id === person.id);
                const completed = personOperations.filter((operation) => operation.status === 'Tamamlandı');
                const active = personOperations.filter((operation) => ACTIVE_OPERATION_STATUSES.includes(operation.status));
                const planned = personOperations.filter((operation) => PLANNED_OPERATION_STATUSES.includes(operation.status));
                const cancelled = personOperations.filter((operation) => operation.status === 'İptal');
                const fieldVisits = personOperations.filter(
                    (operation) =>
                        ACTIVE_OPERATION_STATUSES.includes(operation.status) ||
                        operation.status === 'Tamamlandı' ||
                        Boolean(operation.actual_start_date)
                );

                const totalHours = completed.reduce((sum, operation) => {
                    const actualHours = Number(operation.labor_hours || 0) || calculateServiceHours(operation.actual_start_date, operation.actual_end_date);
                    return sum + actualHours;
                }, 0);

                const totalCost = completed.reduce((sum, operation) => sum + Number(operation.total_cost || 0), 0);
                const totalTravelKm = completed.reduce((sum, operation) => sum + Number(operation.travel_km || 0), 0);
                const uniqueCities = new Set(personOperations.map((operation) => operation.city).filter(Boolean));
                const onTimeCount = completed.filter(
                    (operation) =>
                        operation.planned_end_date &&
                        operation.actual_end_date &&
                        new Date(operation.actual_end_date) <= new Date(operation.planned_end_date)
                ).length;
                const delayedCount = completed.filter(
                    (operation) =>
                        operation.planned_end_date &&
                        operation.actual_end_date &&
                        new Date(operation.actual_end_date) > new Date(operation.planned_end_date)
                ).length;
                const lastCompletedOperation = completed
                    .slice()
                    .sort((left, right) => new Date(right.actual_end_date || 0) - new Date(left.actual_end_date || 0))[0];

                return {
                    ...person,
                    totalAssignments: personOperations.length,
                    fieldVisitCount: fieldVisits.length,
                    completedCount: completed.length,
                    activeCount: active.length,
                    plannedCount: planned.length,
                    cancelledCount: cancelled.length,
                    totalHours,
                    avgHours: completed.length > 0 ? totalHours / completed.length : 0,
                    totalCost,
                    totalTravelKm,
                    cityCount: uniqueCities.size,
                    onTimeCount,
                    delayedCount,
                    onTimeRate: completed.length > 0 ? (onTimeCount / completed.length) * 100 : 0,
                    lastCompletedAt: lastCompletedOperation?.actual_end_date || '',
                    lastCompletedTitle: lastCompletedOperation?.operation_title || '',
                };
            })
            .sort((left, right) => {
                if (right.completedCount !== left.completedCount) return right.completedCount - left.completedCount;
                if (right.totalHours !== left.totalHours) return right.totalHours - left.totalHours;
                return left.full_name.localeCompare(right.full_name, 'tr');
            });
    }, [operations, performancePeople]);

    const personnelPerformanceSummary = useMemo(() => {
        const totalHours = personnelPerformanceRows.reduce((sum, row) => sum + row.totalHours, 0);
        const totalAssignments = personnelPerformanceRows.reduce((sum, row) => sum + row.totalAssignments, 0);
        const totalCompleted = personnelPerformanceRows.reduce((sum, row) => sum + row.completedCount, 0);
        const totalOnTime = personnelPerformanceRows.reduce((sum, row) => sum + row.onTimeCount, 0);
        const topAssignment = personnelPerformanceRows
            .slice()
            .sort((left, right) => right.totalAssignments - left.totalAssignments)[0];
        const topHours = personnelPerformanceRows
            .slice()
            .sort((left, right) => right.totalHours - left.totalHours)[0];

        return {
            totalHours,
            totalAssignments,
            totalCompleted,
            onTimeRate: totalCompleted > 0 ? (totalOnTime / totalCompleted) * 100 : 0,
            topAssignment,
            topHours,
        };
    }, [personnelPerformanceRows]);

    const currentLocationOptions = useMemo(
        () =>
            formData.current_location && !CURRENT_LOCATION_OPTIONS.includes(formData.current_location)
                ? [...CURRENT_LOCATION_OPTIONS, formData.current_location]
                : CURRENT_LOCATION_OPTIONS,
        [formData.current_location]
    );
    const selectedComplaintStockSummary = useMemo(() => {
        if (!selectedComplaint) return [];

        return getFaultPartsFromComplaint(selectedComplaint).map((part) => {
            const matchedPart = findDepotPart({ partCode: part.part_code, partName: part.part_name });
            return {
                ...part,
                matchedPart,
            };
        });
    }, [findDepotPart, selectedComplaint]);
    const isCompletionMode = dialogMode === 'complete';
    const showActualDateFields = isCompletionMode || (Boolean(editingOperation) && formData.status === 'Tamamlandı');
    const calculatedServiceHours = useMemo(
        () => calculateServiceHours(formData.actual_start_date, formData.actual_end_date),
        [formData.actual_end_date, formData.actual_start_date]
    );
    const servicePersonnelCount = formData.assigned_person_id ? 1 : 0;
    const dialogTitle = isCompletionMode
        ? editingOperation?.status === 'Tamamlandı'
            ? 'Tamamlanma Bilgilerini Düzenle'
            : 'Operasyonu Sonlandır'
        : editingOperation
            ? 'Operasyon Planını Düzenle'
            : 'Yeni Operasyon Planla';
    const dialogSubmitLabel = isCompletionMode
        ? editingOperation?.status === 'Tamamlandı'
            ? 'Tamamlanma Bilgilerini Güncelle'
            : 'Operasyonu Tamamla'
        : editingOperation
            ? 'Planı Güncelle'
            : 'Planı Oluştur';

    useEffect(() => {
        if (!selectedComplaint) return;

        setFormData((prev) => {
            const nextValues = {};
            const defaultTitle = `${getAfterSalesCaseNumber(selectedComplaint)} • ${truncateLabel(selectedComplaint.title || 'Saha Operasyonu', 56)}`;

            if (!prev.operation_title) nextValues.operation_title = defaultTitle;
            if (!prev.city && selectedComplaint.service_city) nextValues.city = selectedComplaint.service_city;
            if (!prev.country && selectedComplaint.service_country) nextValues.country = selectedComplaint.service_country;
            if (!prev.current_location) nextValues.current_location = 'Hazırlıkta';
            if (!prev.planned_start_date) nextValues.planned_start_date = new Date().toISOString().split('T')[0];

            return Object.keys(nextValues).length > 0
                ? { ...prev, ...nextValues }
                : prev;
        });
    }, [selectedComplaint]);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handlePartChange = (index, field, value) => {
        setFormData((prev) => {
            const nextParts = [...prev.parts];
            nextParts[index] = { ...nextParts[index], [field]: value };
            if (field === 'quantity' || field === 'unit_cost') {
                nextParts[index].total_cost = String(
                    (Number(nextParts[index].quantity || 0) * Number(nextParts[index].unit_cost || 0)).toFixed(2)
                );
            }
            return { ...prev, parts: nextParts };
        });
    };

    const handlePartSelection = (index, partId) => {
        const selectedPart = findDepotPart({ partId });
        const selectedRevision = selectedPart?.activeRevision || null;

        setFormData((prev) => {
            const nextParts = [...prev.parts];
            nextParts[index] = {
                ...nextParts[index],
                part_id: selectedPart?.id || '',
                part_revision_id: selectedRevision?.id || '',
                part_code: selectedPart?.part_code || '',
                part_name: selectedRevision?.part_name || selectedPart?.displayName || '',
            };
            return { ...prev, parts: nextParts };
        });
    };

    const handlePartRevisionSelection = (index, revisionId) => {
        const selectedRevision = partRevisions.find((revision) => revision.id === revisionId);
        const selectedPart = selectedRevision ? findDepotPart({ partId: selectedRevision.part_id }) : null;

        setFormData((prev) => {
            const nextParts = [...prev.parts];
            nextParts[index] = {
                ...nextParts[index],
                part_id: selectedPart?.id || nextParts[index].part_id,
                part_revision_id: selectedRevision?.id || '',
                part_code: selectedPart?.part_code || nextParts[index].part_code,
                part_name: selectedRevision?.part_name || selectedPart?.displayName || nextParts[index].part_name,
            };
            return { ...prev, parts: nextParts };
        });
    };

    const addPartRow = () => {
        setFormData((prev) => ({ ...prev, parts: [...prev.parts, EMPTY_PART] }));
    };

    const removePartRow = (index) => {
        setFormData((prev) => ({
            ...prev,
            parts: prev.parts.filter((_, rowIndex) => rowIndex !== index),
        }));
    };

    const openCreateDialog = () => {
        setEditingOperation(null);
        setFormData(EMPTY_FORM);
        setDialogMode('plan');
        setDialogOpen(true);
    };

    const openEditDialog = (operation, mode = 'plan') => {
        setEditingOperation(operation);
        setFormData({
            complaint_id: operation.complaint_id || '',
            operation_type: operation.operation_type || 'Saha Servisi',
            operation_title: operation.operation_title || '',
            operation_details: operation.operation_details || '',
            city: operation.city || '',
            country: operation.country || 'Türkiye',
            assigned_person_id: operation.assigned_person_id || '',
            current_location: operation.current_location || '',
            status: operation.status || 'Planlandı',
            planned_start_date: operation.planned_start_date || '',
            planned_end_date: operation.planned_end_date || '',
            actual_start_date: operation.actual_start_date || '',
            actual_end_date: operation.actual_end_date || '',
            lodging_days: String(operation.lodging_days || 0),
            lodging_cost: String(operation.lodging_cost || 0),
            travel_km: String(operation.travel_km || 0),
            travel_cost: String(operation.travel_cost || 0),
            labor_hours: String(operation.labor_hours || 0),
            labor_cost: String(operation.labor_cost || 0),
            completion_notes: operation.completion_notes || '',
            parts: operation.parts?.length
                ? operation.parts.map((part) => ({
                    part_id: part.part_id || '',
                    part_revision_id: part.part_revision_id || '',
                    part_code: part.part_code || '',
                    part_name: part.part_name || '',
                    quantity: String(part.quantity || 0),
                    unit_cost: String(part.unit_cost || 0),
                    total_cost: String(part.total_cost || 0),
                    notes: part.notes || '',
                }))
                : [EMPTY_PART],
        });
        setDialogMode(mode);
        if (mode === 'complete' && operation.status !== 'Tamamlandı') {
            setFormData((prev) => ({
                ...prev,
                status: 'Tamamlandı',
                current_location: prev.current_location || 'Tamamlandı',
                actual_start_date: prev.actual_start_date || new Date().toISOString().split('T')[0],
                actual_end_date: prev.actual_end_date || new Date().toISOString().split('T')[0],
            }));
        }
        setDialogOpen(true);
    };

    const calculatePartsCost = useCallback(
        () => formData.parts.reduce((sum, part) => sum + Number(part.total_cost || 0), 0),
        [formData.parts]
    );

    const totalOperationCost =
        Number(formData.lodging_cost || 0) +
        Number(formData.travel_cost || 0) +
        Number(formData.labor_cost || 0) +
        calculatePartsCost();

    const handleSave = async () => {
        if (!formData.complaint_id || !formData.operation_title || !formData.assigned_person_id) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Vaka, operasyon başlığı ve personel zorunludur.',
            });
            return;
        }

        if (isCompletionMode && (!formData.actual_start_date || !formData.actual_end_date)) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Operasyonu sonlandırmak için gerçek başlangıç ve bitiş tarihleri gereklidir.',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                complaint_id: formData.complaint_id,
                operation_type: formData.operation_type,
                operation_title: formData.operation_title,
                operation_details: formData.operation_details || null,
                city: formData.city || null,
                country: formData.country || null,
                assigned_person_id: formData.assigned_person_id,
                current_location: formData.current_location || null,
                status: formData.status,
                planned_start_date: formData.planned_start_date || null,
                planned_end_date: formData.planned_end_date || null,
                actual_start_date: isCompletionMode ? formData.actual_start_date || null : editingOperation?.actual_start_date || null,
                actual_end_date: isCompletionMode ? formData.actual_end_date || null : editingOperation?.actual_end_date || null,
                lodging_days: isCompletionMode ? Number(formData.lodging_days || 0) : Number(editingOperation?.lodging_days || 0),
                lodging_cost: isCompletionMode ? Number(formData.lodging_cost || 0) : Number(editingOperation?.lodging_cost || 0),
                travel_km: isCompletionMode ? Number(formData.travel_km || 0) : Number(editingOperation?.travel_km || 0),
                travel_cost: isCompletionMode ? Number(formData.travel_cost || 0) : Number(editingOperation?.travel_cost || 0),
                labor_hours: isCompletionMode ? calculatedServiceHours : Number(editingOperation?.labor_hours || 0),
                labor_cost: isCompletionMode ? Number(formData.labor_cost || 0) : Number(editingOperation?.labor_cost || 0),
                used_part_cost: isCompletionMode ? calculatePartsCost() : Number(editingOperation?.used_part_cost || 0),
                total_cost: isCompletionMode ? totalOperationCost : Number(editingOperation?.total_cost || 0),
                completion_notes: isCompletionMode ? formData.completion_notes || null : editingOperation?.completion_notes || null,
                created_by: user?.id || null,
            };

            let operationId = editingOperation?.id;

            if (editingOperation) {
                const { error } = await supabase
                    .from('after_sales_service_operations')
                    .update(payload)
                    .eq('id', editingOperation.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('after_sales_service_operations')
                    .insert([payload])
                    .select('id')
                    .single();
                if (error) throw error;
                operationId = data.id;
            }

            if (!operationId) {
                throw new Error('Operasyon kaydı oluşturulamadı.');
            }

            if (isCompletionMode) {
                await supabase.from('after_sales_service_operation_parts').delete().eq('operation_id', operationId);

                const validParts = formData.parts
                    .filter((part) => part.part_name?.trim() || part.part_code?.trim())
                    .map((part) => ({
                        operation_id: operationId,
                        part_id: part.part_id || null,
                        part_revision_id: part.part_revision_id || null,
                        part_code: part.part_code?.trim() || null,
                        part_name: part.part_name?.trim() || 'Parça',
                        quantity: Number(part.quantity || 0),
                        unit_cost: Number(part.unit_cost || 0),
                        total_cost: Number(part.total_cost || 0),
                        notes: part.notes?.trim() || null,
                    }));

                if (validParts.length > 0) {
                    const { error: partsError } = await supabase
                        .from('after_sales_service_operation_parts')
                        .insert(validParts);
                    if (partsError) throw partsError;
                }

                const getRevisionKey = (partId, partRevisionId) => `${partId || ''}::${partRevisionId || ''}`;

                const previousPartTotals = (editingOperation?.parts || []).reduce((map, part) => {
                    if (!part.part_id) return map;
                    const key = getRevisionKey(part.part_id, part.part_revision_id);
                    map.set(key, Number(map.get(key) || 0) + Number(part.quantity || 0));
                    return map;
                }, new Map());

                const nextPartTotals = validParts.reduce((map, part) => {
                    if (!part.part_id) return map;
                    const key = getRevisionKey(part.part_id, part.part_revision_id);
                    map.set(key, Number(map.get(key) || 0) + Number(part.quantity || 0));
                    return map;
                }, new Map());

                const deltaEntries = Array.from(new Set([...previousPartTotals.keys(), ...nextPartTotals.keys()]))
                    .map((key) => {
                        const [partId, partRevisionId = ''] = key.split('::');
                        const previousQuantity = Number(previousPartTotals.get(key) || 0);
                        const nextQuantity = Number(nextPartTotals.get(key) || 0);
                        return {
                            partId,
                            partRevisionId: partRevisionId || null,
                            deltaQuantity: nextQuantity - previousQuantity,
                        };
                    })
                    .filter((entry) => entry.deltaQuantity !== 0);

                const stockDeltaByPart = deltaEntries.reduce((map, entry) => {
                    map.set(entry.partId, Number(map.get(entry.partId) || 0) + Number(entry.deltaQuantity || 0));
                    return map;
                }, new Map());

                for (const [partId, totalDelta] of stockDeltaByPart.entries()) {
                    const inventoryPart = findDepotPart({ partId });
                    if (!inventoryPart) continue;

                    const nextStock = Number(inventoryPart.current_stock || 0) - Number(totalDelta || 0);

                    const { error: stockUpdateError } = await supabase
                        .from('after_sales_part_master')
                        .update({ current_stock: nextStock })
                        .eq('id', partId);

                    if (stockUpdateError) throw stockUpdateError;
                }

                for (const entry of deltaEntries) {
                    const movementType = entry.deltaQuantity > 0 ? 'Operasyon Tüketimi' : 'Operasyon İadesi';
                    const { error: movementError } = await supabase
                        .from('after_sales_part_stock_movements')
                        .insert([
                            {
                                part_id: entry.partId,
                                part_revision_id: entry.partRevisionId,
                                movement_type: movementType,
                                quantity: -Number(entry.deltaQuantity || 0),
                                reference_operation_id: operationId,
                                note: `${operationTitleForMovement(payload.operation_title || formData.operation_title)} • ${movementType}`,
                                created_by: user?.id || null,
                            },
                        ]);

                    if (movementError && !['42P01', 'PGRST205'].includes(movementError.code)) {
                        throw movementError;
                    }
                }

                await loadDepotInventory();
            }

            await syncComplaintLifecycle(formData.complaint_id);

            toast({
                title: 'Başarılı',
                description: isCompletionMode
                    ? 'Operasyon tamamlandı ve gerçekleşen bilgiler kaydedildi.'
                    : `Operasyon ${editingOperation ? 'güncellendi' : 'planlandı'}.`,
            });

            setDialogOpen(false);
            setFormData(EMPTY_FORM);
            setEditingOperation(null);
            setDialogMode('plan');
            await loadOperations();
            onOperationsChanged?.();
        } catch (error) {
            console.error('After sales operation save error:', error);
            toast({
                variant: 'destructive',
                title: 'Kayıt Hatası',
                description: error.message || 'Operasyon kaydedilemedi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (operation) => {
        const confirmed = window.confirm('Bu operasyon kaydını silmek istediğinize emin misiniz?');
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('after_sales_service_operations')
                .delete()
                .eq('id', operation.id);

            if (error) throw error;

            await syncComplaintLifecycle(operation.complaint_id);

            toast({
                title: 'Silindi',
                description: 'Operasyon kaydı kaldırıldı.',
            });
            await loadOperations();
            onOperationsChanged?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Silme Hatası',
                description: error.message || 'Operasyon silinemedi.',
            });
        }
    };

    const handleStartOperation = async (operation) => {
        try {
            const payload = {
                status: 'Yolda',
                current_location: operation.current_location || 'Yolda',
                actual_start_date: operation.actual_start_date || new Date().toISOString().split('T')[0],
            };

            const { error } = await supabase
                .from('after_sales_service_operations')
                .update(payload)
                .eq('id', operation.id);

            if (error) throw error;

            await syncComplaintLifecycle(operation.complaint_id);

            toast({
                title: 'Operasyon Başlatıldı',
                description: 'Operasyon devam eden işler sekmesine taşındı.',
            });
            setOperationViewTab('active');
            await loadOperations();
            onOperationsChanged?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Başlatma Hatası',
                description: error.message || 'Operasyon başlatılamadı.',
            });
        }
    };

    const renderOperationCard = (operation, stage) => (
        <div key={operation.id} className="rounded-xl border bg-background">
            <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_0.8fr_auto] gap-3 border-b bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <div>Operasyon</div>
                <div>Personel</div>
                <div>Lokasyon</div>
                <div>Plan / Gerçek</div>
                <div>Durum</div>
                <div className="text-right">İşlemler</div>
            </div>

            <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_0.8fr_auto] gap-3 px-4 py-4 text-sm">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{operation.operation_type}</Badge>
                        <Badge variant={operation.status === 'Tamamlandı' ? 'success' : 'secondary'}>
                            {operation.status}
                        </Badge>
                    </div>
                    <div className="font-semibold text-base">{operation.operation_title}</div>
                    <div className="text-muted-foreground">
                        {getAfterSalesCaseNumber(operation.complaint) || operation.complaint_id} - {operation.complaint?.title || 'Vaka'}
                    </div>
                </div>
                <div className="font-medium">{operation.assigned_person?.full_name || '-'}</div>
                <div className="font-medium">{operation.city || operation.current_location || '-'}</div>
                <div className="space-y-1 text-muted-foreground">
                    <div>{operation.planned_start_date || '-'} / {operation.planned_end_date || '-'}</div>
                    {stage === 'completed' && <div>{operation.actual_start_date || '-'} / {operation.actual_end_date || '-'}</div>}
                </div>
                <div className="space-y-1">
                    <div className="font-medium">
                        {operation.status === 'Tamamlandı'
                            ? `${operation.labor_hours || 0} saat`
                            : stage === 'active'
                                ? 'Devam ediyor'
                                : 'Plan aşamasında'}
                    </div>
                    <div className="text-muted-foreground">
                        {stage === 'completed' ? formatMoney(operation.total_cost) : formatMoney(0)}
                    </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    {stage === 'planned' && (
                        <Button size="sm" onClick={() => handleStartOperation(operation)}>
                            Operasyonu Başlat
                        </Button>
                    )}
                    {stage === 'active' && (
                        <Button size="sm" onClick={() => openEditDialog(operation, 'complete')}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Sonuçlandır
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(operation, stage === 'completed' ? 'complete' : 'plan')}
                    >
                        <Pencil className="w-4 h-4 mr-2" />
                        Düzenle
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(operation)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Sil
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-muted/30 px-3 py-3 text-sm">
                    <div className="text-muted-foreground">Konaklama</div>
                    <div className="mt-1 font-medium">{operation.lodging_days || 0} gün • {formatMoney(operation.lodging_cost)}</div>
                </div>
                <div className="rounded-lg bg-muted/30 px-3 py-3 text-sm">
                    <div className="text-muted-foreground">Yol</div>
                    <div className="mt-1 font-medium">{operation.travel_km || 0} km • {formatMoney(operation.travel_cost)}</div>
                </div>
                <div className="rounded-lg bg-muted/30 px-3 py-3 text-sm">
                    <div className="text-muted-foreground">Satış Sonrası Hizmetler</div>
                    <div className="mt-1 font-medium">{operation.assigned_person ? 1 : 0} personel • {operation.labor_hours || 0} saat</div>
                </div>
                <div className="rounded-lg bg-muted/30 px-3 py-3 text-sm">
                    <div className="text-muted-foreground">İşçilik + Parça</div>
                    <div className="mt-1 font-medium">{formatMoney(operation.labor_cost + operation.used_part_cost)}</div>
                </div>
            </div>

            {stage !== 'completed' && (
                <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                    {stage === 'planned'
                        ? 'Bu operasyon plan aşamasında. Başlatıldığında devam eden operasyonlar sekmesine geçer.'
                        : 'Bu operasyon devam ediyor. Maliyetler ve kullanılan parçalar sonuçlandırma ekranında işlenir.'}
                </div>
            )}

            {stage === 'completed' && operation.parts?.length > 0 && (
                <div className="border-t px-4 py-4">
                    <div className="mb-3 text-sm font-medium">Kullanılan / Arızaya Konu Parçalar</div>
                    <div className="space-y-2">
                        {operation.parts.map((part) => (
                            <div key={part.id} className="grid grid-cols-[1.2fr_0.7fr_0.7fr_auto] gap-3 rounded-lg border px-3 py-3 text-sm">
                                <div>
                                    <div className="font-medium">{part.part_name}</div>
                                    <div className="text-muted-foreground">{part.part_code || '-'}</div>
                                </div>
                                <div className="font-medium">{part.quantity} adet</div>
                                <div className="font-medium">{formatMoney(part.total_cost)}</div>
                                <div className="flex justify-end">
                                    {part.is_fault_source && <Badge variant="outline">Arızaya Konu</Badge>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const isOperationsPanel = panel === 'operations';

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{isOperationsPanel ? 'Operasyon Planlama' : 'Personel'}</h3>
                    <p className="text-sm text-muted-foreground">
                        {isOperationsPanel
                            ? 'Planlanan, devam eden ve sonuçlanan saha operasyonlarını ve maliyetleri vaka bazında yönetin.'
                            : 'Satış Sonrası personel atamaları, plan panosu ve performansı izleyin.'}
                    </p>
                </div>
                {isOperationsPanel && (
                    <Button onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni Operasyon
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Toplam Operasyon</div>
                        <div className="text-3xl font-bold mt-2">{operations.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Aktif Görevlendirme</div>
                        <div className="text-3xl font-bold mt-2 text-amber-600">{activeAssignments.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Personel ve Tamamlanan</div>
                        <div className="mt-2 text-3xl font-bold text-emerald-600">{availablePersonnelCount}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            Müsait personel • Bu ay tamamlanan {completedThisMonth}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{isOperationsPanel ? 'Operasyon Panelleri' : 'Personel Panelleri'}</CardTitle>
                    <CardDescription>
                        {isOperationsPanel
                            ? 'Planlanan, devam eden ve sonuçlanan operasyonları görüntüleyin.'
                            : 'Atamalar, plan panosu ve performans metrikleri.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isOperationsPanel ? (
                        <div className="space-y-4">
                            {loadError && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    {loadError}
                                </div>
                            )}

                            {loading ? (
                                <div className="py-10 text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Operasyonlar yükleniyor...
                                </div>
                            ) : (
                                <Tabs value={operationViewTab} onValueChange={setOperationViewTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
                                        <TabsTrigger value="planned">Planlanan ({plannedOperations.length})</TabsTrigger>
                                        <TabsTrigger value="active">Devam Eden ({continuingOperations.length})</TabsTrigger>
                                        <TabsTrigger value="completed">Sonuçlanan ({completedOperations.length})</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="planned" className="mt-4 space-y-4">
                                        {plannedOperations.length === 0
                                            ? <div className="text-sm text-muted-foreground">Planlanan operasyon bulunmuyor.</div>
                                            : plannedOperations.map((operation) => renderOperationCard(operation, 'planned'))}
                                    </TabsContent>

                                    <TabsContent value="active" className="mt-4 space-y-4">
                                        {continuingOperations.length === 0
                                            ? <div className="text-sm text-muted-foreground">Devam eden operasyon bulunmuyor.</div>
                                            : continuingOperations.map((operation) => renderOperationCard(operation, 'active'))}
                                    </TabsContent>

                                    <TabsContent value="completed" className="mt-4 space-y-4">
                                        {completedOperations.length === 0
                                            ? <div className="text-sm text-muted-foreground">Sonuçlanan operasyon bulunmuyor.</div>
                                            : completedOperations.map((operation) => renderOperationCard(operation, 'completed'))}
                                    </TabsContent>
                                </Tabs>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {loadError && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    {loadError}
                                </div>
                            )}
                            {loading ? (
                                <div className="py-10 text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Veriler yükleniyor...
                                </div>
                            ) : (
                                <Tabs value={personnelPanelTab} onValueChange={setPersonnelPanelTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
                                    <TabsTrigger value="assignments">
                                        <User className="mr-2 h-4 w-4" />
                                        Atamalar
                                    </TabsTrigger>
                                    <TabsTrigger value="board">
                                        <CarTaxiFront className="mr-2 h-4 w-4" />
                                        Plan Panosu
                                    </TabsTrigger>
                                    <TabsTrigger value="performance">
                                        <Clock3 className="mr-2 h-4 w-4" />
                                        Performans
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="assignments" className="mt-4">
                                    <div className="mb-4 text-sm text-muted-foreground">
                                        {availablePersonnelCount} Satış Sonrası Hizmetler personeli şu an boşta görünüyor.
                                    </div>
                                    <div className="space-y-3">
                                        {activeAssignments.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">Aktif saha ataması bulunmuyor.</div>
                                        ) : (
                                            activeAssignments.map((operation) => (
                                                <div key={operation.id} className="rounded-lg border p-3">
                                                    <div className="font-medium">{operation.assigned_person?.full_name || 'Atanmamış'}</div>
                                                    <div className="mt-1 text-sm text-muted-foreground">
                                                        {operation.city || operation.current_location || '-'} • {operation.status}
                                                    </div>
                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                        {getAfterSalesCaseNumber(operation.complaint) || operation.complaint_id} - {operation.operation_title}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Planlanan bitiş: {formatDate(operation.planned_end_date)}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="board" className="mt-4">
                                    <div className="mb-4 text-sm text-muted-foreground">
                                        Personelin şu an nerede olduğu, hangi işe atandığı ve en son ne zaman işi bitirdiği görünür.
                                    </div>
                                    <div className="space-y-3">
                                        {personnelBoard.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">Aktif personel bulunamadı.</div>
                                        ) : (
                                            personnelBoard.map((person) => (
                                                <div key={person.id} className="rounded-xl border p-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-semibold">{person.full_name}</div>
                                                                <Badge variant={person.activeOperation ? 'warning' : 'success'}>
                                                                    {person.activeOperation ? 'Sahada / Meşgul' : 'Müsait'}
                                                                </Badge>
                                                            </div>
                                                            <div className="mt-1 text-sm text-muted-foreground">{person.department || 'Departman belirtilmedi'}</div>
                                                        </div>

                                                        <div className="grid w-full grid-cols-1 gap-3 text-sm md:grid-cols-3 lg:w-auto lg:min-w-[520px]">
                                                            <div className="rounded-lg bg-muted/40 p-3">
                                                                <div className="text-muted-foreground">Mevcut Konum</div>
                                                                <div className="mt-1 font-medium">
                                                                    {person.activeOperation?.city || person.activeOperation?.current_location || 'Merkez / Müsait'}
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/40 p-3">
                                                                <div className="text-muted-foreground">Aktif İş</div>
                                                                <div className="mt-1 font-medium">
                                                                    {person.activeOperation?.operation_title || '-'}
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/40 p-3">
                                                                <div className="text-muted-foreground">İş Bitiş</div>
                                                                <div className="mt-1 font-medium">
                                                                    {person.activeOperation ? formatDate(person.activeOperation.planned_end_date) : formatDate(person.latestCompletedOperation?.actual_end_date)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(person.activeOperation || person.latestCompletedOperation) && (
                                                        <div className="mt-3 text-xs text-muted-foreground">
                                                            {person.activeOperation
                                                                ? `${getAfterSalesCaseNumber(person.activeOperation.complaint) || person.activeOperation.complaint_id} • ${person.activeOperation.status}`
                                                                : `Son tamamlanan iş: ${person.latestCompletedOperation?.operation_title || '-'} • ${formatDate(person.latestCompletedOperation?.actual_end_date)}`}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="performance" className="mt-4 space-y-4">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Toplam Görev</div>
                                                <div className="mt-2 text-3xl font-bold">{personnelPerformanceSummary.totalAssignments}</div>
                                                <div className="mt-2 text-xs text-muted-foreground">Satış Sonrası Hizmetler personellerine açılan toplam iş</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Toplam Hizmet Saati</div>
                                                <div className="mt-2 text-3xl font-bold text-blue-600">{formatNumber(personnelPerformanceSummary.totalHours)}</div>
                                                <div className="mt-2 text-xs text-muted-foreground">Tamamlanan operasyonlardan hesaplandı</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">Zamanında Tamamlama</div>
                                                <div className="mt-2 text-3xl font-bold text-emerald-600">%{formatNumber(personnelPerformanceSummary.onTimeRate)}</div>
                                                <div className="mt-2 text-xs text-muted-foreground">Planlanan bitiş tarihine göre</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-sm text-muted-foreground">En Yoğun Personel</div>
                                                <div className="mt-2 text-xl font-bold">
                                                    {personnelPerformanceSummary.topAssignment?.full_name || '-'}
                                                </div>
                                                <div className="mt-2 text-xs text-muted-foreground">
                                                    {personnelPerformanceSummary.topAssignment
                                                        ? `${personnelPerformanceSummary.topAssignment.totalAssignments} görev`
                                                        : 'Henüz görev kaydı yok'}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle>Personel Performans Listesi</CardTitle>
                                            <CardDescription>Görev adedi, saha çıkışı, saat, maliyet ve zaman uyumu metriklerini personel bazında izleyin.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {personnelPerformanceRows.length === 0 ? (
                                                <div className="px-6 py-10 text-sm text-muted-foreground">
                                                    Performans hesabı için personel veya operasyon kaydı bulunamadı.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full min-w-[1480px] table-fixed border-separate border-spacing-0">
                                                        <colgroup>
                                                            <col className="w-[16%]" />
                                                            <col className="w-[9%]" />
                                                            <col className="w-[9%]" />
                                                            <col className="w-[9%]" />
                                                            <col className="w-[9%]" />
                                                            <col className="w-[10%]" />
                                                            <col className="w-[10%]" />
                                                            <col className="w-[8%]" />
                                                            <col className="w-[8%]" />
                                                            <col className="w-[12%]" />
                                                        </colgroup>
                                                        <thead className="bg-muted/20">
                                                            <tr>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Personel</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Toplam Görev</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saha Çıkışı</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tamamlanan</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Aktif / Planlı</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Toplam Saat</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ort. Saat</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Şehir</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Zamanında</th>
                                                                <th className="border-b px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Toplam Maliyet</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {personnelPerformanceRows.map((row) => (
                                                                <tr key={row.id} className="align-top transition-colors hover:bg-muted/5">
                                                                    <td className="border-b px-6 py-4.5 text-sm">
                                                                        <div className="font-semibold text-foreground">{row.full_name}</div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">{row.department || 'Satış Sonrası Hizmetler'}</div>
                                                                        <div className="mt-2 text-xs text-muted-foreground">
                                                                            Son iş: {row.lastCompletedTitle ? truncateLabel(row.lastCompletedTitle, 48) : '-'}
                                                                        </div>
                                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                                            Son kapanış: {formatDate(row.lastCompletedAt)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{row.totalAssignments}</td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{row.fieldVisitCount}</td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{row.completedCount}</td>
                                                                    <td className="border-b px-6 py-4.5 text-sm">
                                                                        <div className="font-medium">{row.activeCount} aktif</div>
                                                                        <div className="text-xs text-muted-foreground">{row.plannedCount} planlı</div>
                                                                    </td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{formatHours(row.totalHours)}</td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{formatHours(row.avgHours)}</td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{row.cityCount}</td>
                                                                    <td className="border-b px-6 py-4.5 text-sm">
                                                                        <div className="font-medium text-emerald-700">%{formatNumber(row.onTimeRate)}</div>
                                                                        <div className="text-xs text-muted-foreground">{row.onTimeCount} zamanında / {row.delayedCount} geciken</div>
                                                                    </td>
                                                                    <td className="border-b px-6 py-4.5 text-sm font-medium">{formatMoney(row.totalCost)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="h-[94vh] max-h-[94vh] w-[99vw] max-w-none overflow-hidden overscroll-contain p-0 sm:w-[97vw] sm:max-w-[1850px]">
                    <div className="flex h-full min-h-0 flex-col">
                        <DialogHeader className="border-b px-8 py-6">
                            <DialogTitle className="text-2xl">{dialogTitle}</DialogTitle>
                        </DialogHeader>

                        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 [scrollbar-gutter:stable]">
                            <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {personnelOptions.length === 0 && (
                                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    Operasyon ataması için Ayarlar tarafında birimi «Satış Sonrası Hizmetler» olan aktif personel bulunamadı.
                                </div>
                            )}

                            <div>
                                <Label>Satış Sonrası Vaka</Label>
                                <SearchableSelectDialog
                                    options={complaintOptions}
                                    value={formData.complaint_id}
                                    onChange={(value) => handleInputChange('complaint_id', value)}
                                    triggerPlaceholder="Vaka seçin..."
                                    dialogTitle="Vaka Seç"
                                    searchPlaceholder="Vaka ara..."
                                    notFoundText="Vaka bulunamadı."
                                />
                            </div>
                            <div>
                                <Label>Operasyon Tipi</Label>
                                <Select value={formData.operation_type} onValueChange={(value) => handleInputChange('operation_type', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {OPERATION_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="operation_title">Operasyon Başlığı</Label>
                                <Input
                                    id="operation_title"
                                    value={formData.operation_title}
                                    onChange={(event) => handleInputChange('operation_title', event.target.value)}
                                    placeholder="Örn. Konya saha servis ziyareti"
                                />
                            </div>
                            <div>
                                <Label>Atanan Personel (Satış Sonrası Hizmetler)</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.assigned_person_id}
                                    onChange={(value) => handleInputChange('assigned_person_id', value)}
                                    triggerPlaceholder="Satış Sonrası Hizmetler personeli seçin..."
                                    dialogTitle="Personel Seç"
                                    searchPlaceholder="Personel ara..."
                                    notFoundText="Satış Sonrası Hizmetler biriminde personel bulunamadı."
                                />
                            </div>

                            <div>
                                <Label htmlFor="city">Şehir</Label>
                                <Input id="city" value={formData.city} onChange={(event) => handleInputChange('city', event.target.value)} placeholder="Şehir" />
                            </div>
                            <div>
                                <Label>Mevcut Durum</Label>
                                <Select value={formData.current_location || 'none'} onValueChange={(value) => handleInputChange('current_location', value === 'none' ? '' : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mevcut durum seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Belirtilmedi</SelectItem>
                                        {currentLocationOptions.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="country">Ülke</Label>
                                <Input id="country" value={formData.country} onChange={(event) => handleInputChange('country', event.target.value)} />
                            </div>

                            {!isCompletionMode && (
                                <>
                                    <div>
                                        <Label>Durum</Label>
                                        <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PLANNED_OPERATION_STATUSES.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="planned_start_date">Planlanan Başlangıç</Label>
                                        <Input id="planned_start_date" type="date" value={formData.planned_start_date} onChange={(event) => handleInputChange('planned_start_date', event.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="planned_end_date">Planlanan Bitiş</Label>
                                        <Input id="planned_end_date" type="date" value={formData.planned_end_date} onChange={(event) => handleInputChange('planned_end_date', event.target.value)} />
                                    </div>
                                </>
                            )}
                        </div>

                        {selectedComplaint && (
                            <div className="rounded-2xl border bg-muted/20 p-5">
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 text-sm">
                                    <div className="rounded-xl border bg-background p-4 xl:col-span-2">
                                        <div className="text-muted-foreground">Vaka</div>
                                        <div className="mt-2 break-words text-lg font-semibold leading-8">
                                            {getAfterSalesCaseNumber(selectedComplaint)} • {truncateLabel(selectedComplaint.title || '-', 88)}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Badge variant="outline">{getCustomerDisplayName(selectedComplaint.customer)}</Badge>
                                            <Badge variant="outline">{selectedComplaint.complaint_type || selectedComplaint.case_type || 'Satış sonrası vaka'}</Badge>
                                            {selectedComplaint.priority && <Badge variant="outline">{selectedComplaint.priority}</Badge>}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border bg-background p-4">
                                        <div className="text-muted-foreground">Araç</div>
                                        <div className="mt-2 break-words text-base font-medium leading-7">
                                            {selectedComplaint.vehicle_model_code || selectedComplaint.vehicle_model || '-'}
                                            {selectedComplaint.vehicle_serial_number ? ` • ${selectedComplaint.vehicle_serial_number}` : ''}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border bg-background p-4">
                                        <div className="text-muted-foreground">Müşteri</div>
                                        <div className="mt-2 text-lg font-semibold">{getCustomerDisplayName(selectedComplaint.customer)}</div>
                                    </div>
                                    <div className="rounded-xl border bg-background p-4 xl:col-span-2">
                                        <div className="text-muted-foreground">Arızalı Parça</div>
                                        <div className="mt-2 break-words text-base font-medium leading-7">{getFaultPartSummaryLabel(selectedComplaint)}</div>
                                    </div>
                                </div>

                                {(selectedComplaintStockSummary.length > 0 || inventoryLoadError) && (
                                    <div className="mt-4 space-y-3">
                                        {inventoryLoadError && (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                {inventoryLoadError}
                                            </div>
                                        )}
                                        {selectedComplaintStockSummary.length > 0 && (
                                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                                                {selectedComplaintStockSummary.map((part, index) => (
                                                    <div key={`${part.part_code || part.part_name}-${index}`} className="rounded-xl border bg-background px-4 py-4 text-sm">
                                                        <div className="text-base font-semibold leading-7">{part.part_name || part.part_code || 'Parça'}</div>
                                                        <div className="mt-1 text-muted-foreground">{part.part_code || 'Kod yok'}</div>
                                                        {part.matchedPart ? (
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                <Badge
                                                                    variant={
                                                                        part.matchedPart.stockStatus === 'Tükendi'
                                                                            ? 'destructive'
                                                                            : part.matchedPart.stockStatus === 'Kritik'
                                                                                ? 'warning'
                                                                                : 'secondary'
                                                                    }
                                                                >
                                                                    {part.matchedPart.stockStatus}
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    Stok {formatNumber(part.matchedPart.current_stock)} {part.matchedPart.base_unit || 'Adet'}
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    Termin {part.matchedPart.min_lead_time_days || 0} gün
                                                                </Badge>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 text-amber-700">
                                                                Kompeks stokta bu ürün bulunmuyor.
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <Label htmlFor="operation_details">{isCompletionMode ? 'Müdahale Detayı' : 'Operasyon Planı'}</Label>
                            <Textarea
                                id="operation_details"
                                rows={4}
                                value={formData.operation_details}
                                onChange={(event) => handleInputChange('operation_details', event.target.value)}
                                placeholder={isCompletionMode
                                    ? 'Yapılan işlemleri, tespitleri ve müdahale kapsamını yazın...'
                                    : 'Yapılacak işi, ziyaret kapsamını ve hazırlık notlarını yazın...'}
                            />
                        </div>

                        {!isCompletionMode ? (
                            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                Bu adım sadece plan kaydı oluşturur. Konaklama, yol, işçilik, kullanılan parçalar ve gerçekleşen maliyetler operasyon sonlandırılırken girilir.
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border bg-muted/20 p-4">
                                    <div className="font-medium">Tamamlama Özeti</div>
                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                                        <div className="rounded-lg bg-background p-3">
                                            <div className="text-muted-foreground">Planlanan Tarih</div>
                                            <div className="font-medium mt-1">{formData.planned_start_date || '-'} / {formData.planned_end_date || '-'}</div>
                                        </div>
                                        <div className="rounded-lg bg-background p-3">
                                            <div className="text-muted-foreground">Satış Sonrası Hizmetler Personeli</div>
                                            <div className="font-medium mt-1">{servicePersonnelCount} kişi</div>
                                        </div>
                                        <div className="rounded-lg bg-background p-3">
                                            <div className="text-muted-foreground">Otomatik Hizmet Süresi</div>
                                            <div className="font-medium mt-1">{calculatedServiceHours} saat</div>
                                        </div>
                                        <div className="rounded-lg bg-background p-3">
                                            <div className="text-muted-foreground">Durum</div>
                                            <div className="font-medium mt-1">Tamamlandı</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    {showActualDateFields && (
                                        <>
                                            <div>
                                                <Label htmlFor="actual_start_date">Gerçek Başlangıç</Label>
                                                <Input id="actual_start_date" type="date" value={formData.actual_start_date} onChange={(event) => handleInputChange('actual_start_date', event.target.value)} />
                                            </div>
                                            <div>
                                                <Label htmlFor="actual_end_date">Gerçek Bitiş</Label>
                                                <Input id="actual_end_date" type="date" value={formData.actual_end_date} onChange={(event) => handleInputChange('actual_end_date', event.target.value)} />
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <Label htmlFor="lodging_days">Konaklama Gün</Label>
                                        <Input id="lodging_days" type="number" min="0" value={formData.lodging_days} onChange={(event) => handleInputChange('lodging_days', event.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="lodging_cost">Konaklama Maliyeti</Label>
                                        <Input id="lodging_cost" type="number" min="0" step="0.01" value={formData.lodging_cost} onChange={(event) => handleInputChange('lodging_cost', event.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="travel_km">Yol (km)</Label>
                                        <Input id="travel_km" type="number" min="0" step="0.01" value={formData.travel_km} onChange={(event) => handleInputChange('travel_km', event.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="travel_cost">Yol Maliyeti</Label>
                                        <Input id="travel_cost" type="number" min="0" step="0.01" value={formData.travel_cost} onChange={(event) => handleInputChange('travel_cost', event.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Otomatik Hizmet Süresi</Label>
                                        <div className="rounded-lg border bg-muted/30 px-3 py-2 h-10 flex items-center font-medium">
                                            {calculatedServiceHours} saat
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="labor_cost">İşçilik Maliyeti</Label>
                                        <Input id="labor_cost" type="number" min="0" step="0.01" value={formData.labor_cost} onChange={(event) => handleInputChange('labor_cost', event.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>Toplam Gerçekleşen Maliyet</Label>
                                        <div className="rounded-lg border bg-muted/30 px-3 py-2 h-10 flex items-center font-medium">
                                            {formatMoney(totalOperationCost)}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">Kullanılan Parçalar</div>
                                            <div className="text-sm text-muted-foreground">Kullanılan ya da arızaya konu olan parçaları tamamlanma sırasında ekleyin.</div>
                                        </div>
                                        <Button type="button" variant="outline" onClick={addPartRow}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Parça Ekle
                                        </Button>
                                    </div>

                                    {formData.parts.map((part, index) => (
                                        <div key={`part-${index}`} className="rounded-lg border p-4 space-y-3">
                                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.95fr_0.7fr_1fr_0.55fr_0.7fr_0.7fr_auto]">
                                                <div>
                                                    <Label>Parça Kodu / Adı</Label>
                                                    <SearchableSelectDialog
                                                        options={partOptions}
                                                        value={part.part_id}
                                                        onChange={(value) => handlePartSelection(index, value)}
                                                        triggerPlaceholder="Parça kodu veya adı ile seçin..."
                                                        dialogTitle="Satış Sonrası Hizmetler Deposundan Parça Seç"
                                                        searchPlaceholder="Parça kodu veya adı ara..."
                                                        notFoundText="Eşleşen parça bulunamadı."
                                                        allowClear
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Revizyon</Label>
                                                    <Select
                                                        value={part.part_revision_id || 'none'}
                                                        onValueChange={(value) => handlePartRevisionSelection(index, value === 'none' ? '' : value)}
                                                        disabled={!part.part_id}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="İsteğe bağlı" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Belirtilmedi</SelectItem>
                                                            {(revisionsByPartId.get(part.part_id) || []).map((revision) => (
                                                                <SelectItem key={revision.id} value={revision.id}>
                                                                    {`Kontrol Rev. ${revision.revision_no} • ${revision.part_name}`}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Parça Kodu</Label>
                                                    <Input value={part.part_code} onChange={(event) => handlePartChange(index, 'part_code', event.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Parça Adı</Label>
                                                    <Input value={part.part_name} onChange={(event) => handlePartChange(index, 'part_name', event.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Adet</Label>
                                                    <Input type="number" min="0" step="0.01" value={part.quantity} onChange={(event) => handlePartChange(index, 'quantity', event.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Birim Maliyet</Label>
                                                    <Input type="number" min="0" step="0.01" value={part.unit_cost} onChange={(event) => handlePartChange(index, 'unit_cost', event.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Toplam</Label>
                                                    <Input value={part.total_cost} readOnly />
                                                </div>
                                                <div className="flex items-end">
                                                    {formData.parts.length > 1 && (
                                                        <Button type="button" variant="destructive" onClick={() => removePartRow(index)}>
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Sil
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div>
                                                    <Label>Not</Label>
                                                    <Input value={part.notes} onChange={(event) => handlePartChange(index, 'notes', event.target.value)} placeholder="Sevk veya kullanım notu" />
                                                </div>
                                            </div>
                                            {(() => {
                                                const matchedPart = findDepotPart({ partId: part.part_id, partCode: part.part_code, partName: part.part_name });
                                                if (!matchedPart) {
                                                    return (
                                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                            Parça kompeks stokta bulunmuyor. Stok ve termin uyarısı üretilemedi.
                                                        </div>
                                                    );
                                                }

                                                const requestedQty = Number(part.quantity || 0);
                                                const currentStock = Number(matchedPart.current_stock || 0);
                                                const criticalStock = Number(matchedPart.critical_stock_level || 0);
                                                const remainingStock = currentStock - requestedQty;
                                                const isInsufficient = requestedQty > currentStock;
                                                const isCriticalAfterUse = remainingStock <= criticalStock;

                                                return (
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                        <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Boxes className="h-4 w-4" />
                                                                Mevcut Stok
                                                            </div>
                                                            <div className="mt-1 font-medium">{formatNumber(currentStock)} {matchedPart.base_unit || 'Adet'}</div>
                                                        </div>
                                                        <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <Clock3 className="h-4 w-4" />
                                                                Min Termin
                                                            </div>
                                                            <div className="mt-1 font-medium">{matchedPart.min_lead_time_days || 0} gün</div>
                                                        </div>
                                                        <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <AlertTriangle className="h-4 w-4" />
                                                                Kullanım Sonrası
                                                            </div>
                                                            <div className={`mt-1 font-medium ${isInsufficient || isCriticalAfterUse ? 'text-amber-700' : ''}`}>
                                                                {formatNumber(remainingStock)} {matchedPart.base_unit || 'Adet'}
                                                            </div>
                                                        </div>
                                                        {(isInsufficient || isCriticalAfterUse) && (
                                                            <div className="md:col-span-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                                {isInsufficient
                                                                    ? `Talep edilen miktar stoktan fazla. Mevcut stok ${formatNumber(currentStock)} ${matchedPart.base_unit || 'Adet'} ve minimum termin ${matchedPart.min_lead_time_days || 0} gün.`
                                                                    : `Bu kullanım sonrası stok kritik seviyeye düşüyor. Kritik seviye ${formatNumber(criticalStock)} ${matchedPart.base_unit || 'Adet'}.`}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <Label htmlFor="completion_notes">Tamamlanma / Müdahale Notları</Label>
                                    <Textarea id="completion_notes" rows={4} value={formData.completion_notes} onChange={(event) => handleInputChange('completion_notes', event.target.value)} placeholder="Ne yapıldı, ne tespit edildi ve sonraki adım nedir?" />
                                </div>
                            </>
                        )}
                            </div>
                        </div>

                        <DialogFooter className="border-t px-8 py-5">
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                                İptal
                            </Button>
                            <Button onClick={handleSave} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    dialogSubmitLabel
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ServiceOperationsPlannerTab;
