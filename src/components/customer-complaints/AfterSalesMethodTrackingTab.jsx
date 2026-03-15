import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ClipboardList,
    FileWarning,
    GitBranch,
    Search,
    ShieldAlert,
} from 'lucide-react';

import CreateNCFromComplaintModal from '@/components/customer-complaints/CreateNCFromComplaintModal';
import NCViewModal from '@/components/df-8d/NCViewModal';
import {
    getComplaintIdsForNCRecord,
    getCustomerDisplayName,
    getFaultPartsFromComplaint,
    getIssueClusterKey,
    getIssueClusterLabel,
    getVehicleDisplayLabel,
    recommendWorkflowForComplaint,
} from '@/components/customer-complaints/afterSalesConfig';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeTurkishForSearch } from '@/lib/utils';

const METHOD_VARIANT = {
    DF: 'default',
    MDI: 'warning',
    '8D': 'destructive',
};

const getMethodRecordLabel = (record) =>
    record?.type === 'MDI'
        ? record?.mdi_no || record?.nc_number || record?.title || 'MDI'
        : record?.nc_number || record?.title || record?.type || 'Kayıt';

const mergeUniqueMethodRecords = (records) =>
    Array.from(new Map((records || []).map((record) => [record.id, record])).values());

const LINKED_NC_SELECT = 'id, type, status, nc_number, mdi_no, title, description, created_at';

const StatTile = ({ title, value, helper, icon: Icon }) => (
    <Card>
        <CardContent className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[13px] text-muted-foreground">{title}</div>
                    <div className="mt-1.5 text-2xl font-bold leading-none">{value}</div>
                    {helper && <div className="mt-2 text-xs text-muted-foreground">{helper}</div>}
                </div>
                <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const EmptyState = ({ text }) => (
    <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
);

const RecommendationCard = ({ item, onCreate, onOpenRecord }) => (
    <div className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {item.category}
                    </div>
                    <div className="mt-1 truncate text-base font-semibold text-slate-900" title={item.title}>
                        {item.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{item.helper}</div>
                </div>
                <Badge variant={METHOD_VARIANT[item.suggestedType] || 'outline'}>
                    Öneri: {item.suggestedType}
                </Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {item.chips.map((chip) => (
                    <span
                        key={`${item.category}-${chip}`}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700"
                    >
                        {chip}
                    </span>
                ))}
            </div>
        </div>

        <div className="rounded-xl border bg-slate-50/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Bağlı Uygunsuzluklar
            </div>
            {item.linkedRecords.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                    {item.linkedRecords.map((record) => (
                        <button
                            key={record.id}
                            type="button"
                            className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                            title={`${record.type} • ${getMethodRecordLabel(record)} • ${record.status || 'Durum yok'}`}
                            onClick={() => onOpenRecord(record)}
                        >
                            {record.type} • {getMethodRecordLabel(record)}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="mt-2 text-sm text-slate-500">
                    Bu analiz kümesi için bağlı uygunsuzluk kaydı bulunmuyor.
                </div>
            )}

            <Button
                type="button"
                className="mt-4 w-full"
                variant={item.linkedRecords.length > 0 ? 'outline' : 'default'}
                disabled={item.linkedRecords.length === 0 && !item.complaint}
                onClick={() =>
                    item.linkedRecords.length > 0
                        ? onOpenRecord(item.linkedRecords[0])
                        : onCreate(item.complaint, item.suggestedType)
                }
            >
                {item.linkedRecords.length > 0
                    ? 'Bağlı Kaydı Aç'
                    : `Uygunsuzluk Oluştur • ${item.suggestedType}`}
            </Button>
        </div>
    </div>
);

const AfterSalesMethodTrackingTab = ({ complaints, customers, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [methodRecordsByComplaint, setMethodRecordsByComplaint] = useState({});
    const [methodRecords, setMethodRecords] = useState([]);
    const [operationCostsByComplaint, setOperationCostsByComplaint] = useState({});
    const [createState, setCreateState] = useState({
        open: false,
        complaint: null,
        preferredType: 'MDI',
    });
    const [viewState, setViewState] = useState({
        open: false,
        record: null,
    });

    const loadMethodRecords = useCallback(async () => {
        const complaintIds = (complaints || []).map((record) => record.id).filter(Boolean);
        const complaintIdsByRelatedNc = (complaints || []).reduce((acc, record) => {
            if (!record.related_nc_id) return acc;
            acc[record.related_nc_id] = [...(acc[record.related_nc_id] || []), record.id];
            return acc;
        }, {});

        if (complaintIds.length === 0) {
            setMethodRecordsByComplaint({});
            setMethodRecords([]);
            setOperationCostsByComplaint({});
            return;
        }

        const [methodsResult, operationsResult] = await Promise.all([
            supabase
                .from('non_conformities')
                .select(LINKED_NC_SELECT)
                .order('created_at', { ascending: false })
                .limit(1500),
            supabase
                .from('after_sales_service_operations')
                .select('complaint_id, total_cost')
                .in('complaint_id', complaintIds),
        ]);

        if (methodsResult.error) {
            console.error('Bağlı uygunsuzluk kayıtları yüklenemedi:', methodsResult.error);
            setMethodRecordsByComplaint({});
            setMethodRecords([]);
            setOperationCostsByComplaint({});
            return;
        }

        const records = mergeUniqueMethodRecords(methodsResult.data || []);
        const byComplaint = {};
        const costMap = {};
        const matchedRecords = [];

        records.forEach((record) => {
            const matchedComplaintIds = getComplaintIdsForNCRecord(record, complaints, complaintIdsByRelatedNc);
            if (matchedComplaintIds.length === 0) return;

            matchedRecords.push(record);
            matchedComplaintIds.forEach((complaintId) => {
                byComplaint[complaintId] = mergeUniqueMethodRecords([
                    ...(byComplaint[complaintId] || []),
                    {
                        ...record,
                        source_complaint_id: record.source_complaint_id || complaintId,
                    },
                ]);
            });
        });

        (operationsResult.data || []).forEach((record) => {
            if (!record.complaint_id) return;
            costMap[record.complaint_id] = Number(costMap[record.complaint_id] || 0) + Number(record.total_cost || 0);
        });

        setMethodRecordsByComplaint(byComplaint);
        setMethodRecords(mergeUniqueMethodRecords(matchedRecords));
        setOperationCostsByComplaint(costMap);
    }, [complaints]);

    const applyOptimisticMethodRecord = useCallback((createdRecord, sourceComplaint) => {
        if (!createdRecord?.id || !sourceComplaint?.id) return;

        const normalizedRecord = {
            ...createdRecord,
            source_complaint_id: createdRecord.source_complaint_id || sourceComplaint.id,
        };

        setMethodRecords((prev) => mergeUniqueMethodRecords([normalizedRecord, ...prev]));
        setMethodRecordsByComplaint((prev) => ({
            ...prev,
            [sourceComplaint.id]: mergeUniqueMethodRecords([
                normalizedRecord,
                ...(prev[sourceComplaint.id] || []),
            ]),
        }));
    }, []);

    useEffect(() => {
        loadMethodRecords();
    }, [loadMethodRecords]);

    const customerMap = useMemo(
        () => new Map((customers || []).map((customer) => [customer.id, customer])),
        [customers]
    );

    const complaintRows = useMemo(() => {
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);

        return (complaints || [])
            .map((complaint) => {
                const linkedRecords = methodRecordsByComplaint[complaint.id] || [];
                const recommendation = recommendWorkflowForComplaint(complaint);
                const faultParts = getFaultPartsFromComplaint(complaint);
                const customer = complaint.customer || customerMap.get(complaint.customer_id) || null;

                return {
                    ...complaint,
                    customerName: getCustomerDisplayName(customer),
                    vehicleLabel: getVehicleDisplayLabel(complaint),
                    faultPartLabel:
                        faultParts
                            .map((part) => [part.part_name, part.part_code].filter(Boolean).join(' (') + (part.part_code ? ')' : ''))
                            .filter(Boolean)
                            .join(', ') || 'Parça girilmedi',
                    linkedRecords,
                    recommendation,
                };
            })
            .filter((item) => {
                if (!normalizedSearch) return true;
                const haystack = normalizeTurkishForSearch(
                    [
                        item.title,
                        item.complaint_number,
                        item.customerName,
                        item.vehicleLabel,
                        item.faultPartLabel,
                        item.recommendation.type,
                    ]
                        .filter(Boolean)
                        .join(' ')
                );
                return haystack.includes(normalizedSearch);
            })
            .sort((left, right) => {
                if (left.linkedRecords.length === 0 && right.linkedRecords.length > 0) return -1;
                if (left.linkedRecords.length > 0 && right.linkedRecords.length === 0) return 1;
                return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
            });
    }, [complaints, customerMap, methodRecordsByComplaint, searchTerm]);

    const summary = useMemo(() => {
        const counts = { DF: 0, MDI: 0, '8D': 0 };

        methodRecords.forEach((record) => {
            if (counts[record.type] !== undefined) counts[record.type] += 1;
        });

        return {
            totalLinked: methodRecords.length,
            pending: complaintRows.filter((row) => row.linkedRecords.length === 0).length,
            df: counts.DF,
            mdi: counts.MDI,
            eightD: counts['8D'],
        };
    }, [complaintRows, methodRecords]);

    const recommendationRows = useMemo(() => {
        const issueMap = new Map();
        const partMap = new Map();
        const partCodeMap = new Map();

        complaints.forEach((complaint) => {
            const totalCost = Number(complaint.financial_impact || operationCostsByComplaint[complaint.id] || 0);
            const issueKey = getIssueClusterKey(complaint);
            const issueEntry = issueMap.get(issueKey) || {
                title: getIssueClusterLabel(complaint),
                count: 0,
                cost: 0,
                repeatCount: 0,
                complaintIds: new Set(),
            };
            issueEntry.count += 1;
            issueEntry.cost += totalCost;
            issueEntry.repeatCount += Number(complaint.repeat_failure_count || 0);
            issueEntry.complaintIds.add(complaint.id);
            issueMap.set(issueKey, issueEntry);

            const parts = getFaultPartsFromComplaint(complaint);
            parts.forEach((part) => {
                const partName = part.part_name || 'Parça belirtilmedi';
                const partCode = part.part_code || 'Kodsuz';
                const partKey = `${partCode}__${partName}`;
                const partEntry = partMap.get(partKey) || {
                    title: `${partName} (${partCode})`,
                    partCode,
                    partName,
                    count: 0,
                    cost: 0,
                    repeatCount: 0,
                    complaintIds: new Set(),
                };
                partEntry.count += 1;
                partEntry.cost += totalCost;
                partEntry.repeatCount += Number(complaint.repeat_failure_count || 0);
                partEntry.complaintIds.add(complaint.id);
                partMap.set(partKey, partEntry);

                const codeEntry = partCodeMap.get(partCode) || {
                    title: partCode,
                    partCode,
                    count: 0,
                    cost: 0,
                    repeatCount: 0,
                    partNames: new Set(),
                    complaintIds: new Set(),
                };
                codeEntry.count += 1;
                codeEntry.cost += totalCost;
                codeEntry.repeatCount += Number(complaint.repeat_failure_count || 0);
                if (part.part_name) codeEntry.partNames.add(part.part_name);
                codeEntry.complaintIds.add(complaint.id);
                partCodeMap.set(partCode, codeEntry);
            });
        });

        const attachRecommendation = (item) => {
            const complaintIds = Array.from(item.complaintIds || []);
            const linkedRecords = complaintIds.flatMap((complaintId) => methodRecordsByComplaint[complaintId] || []);
            const linkedUnique = Array.from(new Map(linkedRecords.map((record) => [record.id, record])).values());
            const baseComplaint =
                complaintIds
                    .map((complaintId) => complaints.find((record) => record.id === complaintId))
                    .filter(Boolean)
                    .find((record) => (methodRecordsByComplaint[record.id] || []).length === 0) ||
                complaintIds
                    .map((complaintId) => complaints.find((record) => record.id === complaintId))
                    .filter(Boolean)[0] ||
                null;

            const complaint = baseComplaint
                ? {
                    ...baseComplaint,
                    repeat_failure_count: Math.max(
                        Number(baseComplaint.repeat_failure_count || 0),
                        Number(item.repeatCount || 0),
                        complaintIds.length > 1 ? complaintIds.length - 1 : 0
                    ),
                    financial_impact: Math.max(
                        Number(baseComplaint.financial_impact || 0),
                        Number(item.cost || 0)
                    ),
                    fault_part_code: baseComplaint.fault_part_code || item.partCode || null,
                    fault_part_name: baseComplaint.fault_part_name || item.partName || item.title || null,
                }
                : null;

            return {
                ...item,
                complaint,
                linkedRecords: linkedUnique,
                suggestedType: complaint ? recommendWorkflowForComplaint(complaint).type : 'MDI',
            };
        };

        const topFrequentIssue = Array.from(issueMap.values()).sort((a, b) => b.count - a.count)[0];
        const topCostIssue = Array.from(issueMap.values()).sort((a, b) => b.cost - a.cost)[0];
        const topPart = Array.from(partMap.values()).sort((a, b) => b.count - a.count)[0];
        const topPartCode = Array.from(partCodeMap.values()).sort((a, b) => b.count - a.count)[0];
        const repeatedIssue = Array.from(issueMap.values()).sort((a, b) => b.repeatCount - a.repeatCount || b.count - a.count)[0];

        const rawRows = [
            topFrequentIssue && attachRecommendation({
                ...topFrequentIssue,
                category: 'En Sık Problem',
                helper: `${topFrequentIssue.count} vaka ile en çok görülen problem kümesi`,
                chips: [`${topFrequentIssue.count} vaka`, `${topFrequentIssue.repeatCount} tekrar`],
            }),
            topCostIssue && attachRecommendation({
                ...topCostIssue,
                category: 'En Maliyetli Problem',
                helper: `${Number(topCostIssue.cost || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })} toplam etki`,
                chips: [`${topCostIssue.count} vaka`, `${topCostIssue.repeatCount} tekrar`],
            }),
            topPart && attachRecommendation({
                ...topPart,
                category: 'Parça Bazlı Top Kayıt',
                helper: `${topPart.count} vaka • ${topPart.repeatCount} tekrar`,
                chips: [topPart.partCode || 'Kodsuz', Number(topPart.cost || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })],
            }),
            topPartCode && attachRecommendation({
                ...topPartCode,
                category: 'Parça Kodu Bazlı Top Kayıt',
                helper: `${Array.from(topPartCode.partNames).slice(0, 3).join(', ') || 'Parça adı yok'}`,
                chips: [`${topPartCode.count} vaka`, `${topPartCode.repeatCount} tekrar`],
            }),
            repeatedIssue && attachRecommendation({
                ...repeatedIssue,
                category: 'Tekrarlayan Problem',
                helper: `${repeatedIssue.repeatCount} tekrar baskısı ile öne çıkıyor`,
                chips: [`${repeatedIssue.count} vaka`, `${repeatedIssue.repeatCount} tekrar`],
            }),
        ].filter(Boolean);

        // Aynı şikayet kümesini gösteren satırları tek karta birleştir
        const mergedMap = new Map();
        rawRows.forEach((row) => {
            const baseId = row.complaint?.id || row.title || row.category;
            const existing = mergedMap.get(baseId);
            if (existing) {
                existing.category = `${existing.category} / ${row.category}`;
            } else {
                mergedMap.set(baseId, { ...row });
            }
        });

        return Array.from(mergedMap.values());
    }, [complaints, methodRecordsByComplaint, operationCostsByComplaint]);

    const handleCreate = useCallback((complaint, preferredType) => {
        setCreateState({
            open: true,
            complaint,
            preferredType,
        });
    }, []);

    const handleModalOpenChange = useCallback((nextOpen) => {
        if (!nextOpen) {
            setCreateState({
                open: false,
                complaint: null,
                preferredType: 'MDI',
            });
        }
    }, []);

    const handleViewOpenChange = useCallback((nextOpen) => {
        if (!nextOpen) {
            setViewState({
                open: false,
                record: null,
            });
        }
    }, []);

    const handleOpenRecord = useCallback(async (record) => {
        if (!record?.id) return;

        const { data, error } = await supabase
            .from('non_conformities')
            .select('*')
            .eq('id', record.id)
            .single();

        if (error) {
            console.error('Bağlı uygunsuzluk detayı yüklenemedi:', error);
            return;
        }

        setViewState({
            open: true,
            record: data || record,
        });
    }, []);

    const handleCreateSuccess = useCallback(async (createdRecord, sourceComplaint) => {
        setCreateState({
            open: false,
            complaint: null,
            preferredType: 'MDI',
        });
        applyOptimisticMethodRecord(createdRecord, sourceComplaint);
        await onRefresh?.();
    }, [applyOptimisticMethodRecord, onRefresh]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <StatTile title="Bağlı Uygunsuzluk" value={summary.totalLinked} helper="Toplam DF / MDI / 8D kaydı" icon={GitBranch} />
                <StatTile title="Bekleyen Vaka" value={summary.pending} helper="Henüz uygunsuzluk açılmayan kayıtlar" icon={FileWarning} />
                <StatTile title="DF" value={summary.df} helper="Bağlı DF kayıtları" icon={ClipboardList} />
                <StatTile title="MDI" value={summary.mdi} helper="Bağlı MDI kayıtları" icon={ShieldAlert} />
                <StatTile title="8D" value={summary.eightD} helper="Bağlı 8D kayıtları" icon={GitBranch} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Analiz Bazlı Uygunsuzluk Tavsiyeleri</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Analizde öne çıkan maliyet, adet, parça kodu ve tekrar kümeleri için doğrudan DF / MDI / 8D önerisi üretin.
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {recommendationRows.length === 0 ? (
                        <EmptyState text="Analiz bazlı uygunsuzluk tavsiyesi üretilecek kayıt bulunmuyor." />
                    ) : (
                        recommendationRows.map((item) => (
                            <RecommendationCard
                                key={`${item.category}-${item.title}`}
                                item={item}
                                onCreate={handleCreate}
                                onOpenRecord={handleOpenRecord}
                            />
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="space-y-4">
                    <div>
                        <CardTitle>Vaka Bazlı Uygunsuzluk Takibi</CardTitle>
                        <div className="mt-1 text-sm text-muted-foreground">
                            Aynı vaka için mükerrer DF / MDI / 8D açılmasını önleyin, bağlı kayıtları tek yerden görün.
                        </div>
                    </div>
                    <div className="relative max-w-xl">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Vaka, müşteri, araç, parça veya yöntem ara..."
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {complaintRows.length === 0 ? (
                        <EmptyState text="Yöntem takibi gösterecek satış sonrası vaka bulunmuyor." />
                    ) : (
                        complaintRows.map((row) => (
                            <div
                                key={row.id}
                                className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-base font-semibold text-slate-900" title={row.title}>
                                                {row.complaint_number || '-'} • {row.title}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-500">
                                                {row.customerName} • {row.vehicleLabel || '-'}
                                            </div>
                                        </div>
                                        <Badge variant={METHOD_VARIANT[row.recommendation.type] || 'outline'}>
                                            Öneri: {row.recommendation.type}
                                        </Badge>
                                    </div>

                                    <div className="mt-3 rounded-xl border bg-slate-50/80 p-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            Arızalı Parça
                                        </div>
                                        <div className="mt-1 text-sm text-slate-700">{row.faultPartLabel}</div>
                                    </div>

                                    <div className="mt-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            Bağlı Kayıtlar
                                        </div>
                                        {row.linkedRecords.length > 0 ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {row.linkedRecords.map((record) => (
                                                    <button
                                                        key={record.id}
                                                        type="button"
                                                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                                                        title={`${record.type} • ${getMethodRecordLabel(record)} • ${record.status || 'Durum yok'}`}
                                                        onClick={() => handleOpenRecord(record)}
                                                    >
                                                        {record.type} • {getMethodRecordLabel(record)}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-2 text-sm text-slate-500">
                                                Bu vaka için henüz yöntem kaydı açılmadı.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-slate-50/70 p-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        Uygunsuzluk Aksiyonu
                                    </div>
                                    <div className="mt-2 text-sm text-slate-600">
                                        {row.linkedRecords.length > 0
                                            ? 'Bağlı kayıt bulunduğu için mükerrer oluşturma kapatıldı.'
                                            : row.recommendation.reason}
                                    </div>
                                    <Button
                                        type="button"
                                        className="mt-4 w-full"
                                        variant={row.linkedRecords.length > 0 ? 'outline' : 'default'}
                                        onClick={() =>
                                            row.linkedRecords.length > 0
                                                ? handleOpenRecord(row.linkedRecords[0])
                                                : handleCreate(row, row.recommendation.type)
                                        }
                                    >
                                        {row.linkedRecords.length > 0
                                            ? 'Bağlı Kaydı Aç'
                                            : `Uygunsuzluk Oluştur • ${row.recommendation.type}`}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Oluşturulan Uygunsuzluk Kayıtları</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        SSH modülü içinden açılan tüm DF / MDI / 8D kayıtlarını durumlarıyla birlikte izleyin.
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {methodRecords.length === 0 ? (
                        <EmptyState text="Satış sonrası vakalara bağlı yöntem kaydı bulunmuyor." />
                    ) : (
                        methodRecords.map((record) => {
                            const complaint =
                                complaintRows.find((item) =>
                                    (item.linkedRecords || []).some((linkedRecord) => linkedRecord.id === record.id)
                                ) || null;
                            return (
                                <div
                                    key={record.id}
                                    className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={METHOD_VARIANT[record.type] || 'outline'}>
                                                {record.type}
                                            </Badge>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {getMethodRecordLabel(record)}
                                            </div>
                                            {record.status && (
                                                <Badge variant="outline">{record.status}</Badge>
                                            )}
                                        </div>
                                    <div className="mt-2 text-sm text-slate-500">
                                        {(complaint?.complaint_number || '-') + ' • ' + (complaint?.title || 'Bağlı satış sonrası vaka')}
                                    </div>
                                </div>
                                    <div className="flex items-center gap-3">
                                        <Button type="button" variant="outline" size="sm" onClick={() => handleOpenRecord(record)}>
                                            Kaydı Aç
                                        </Button>
                                        <div className="text-xs text-slate-500">
                                            {record.created_at
                                                ? new Date(record.created_at).toLocaleString('tr-TR')
                                                : 'Tarih yok'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {createState.complaint && (
                <CreateNCFromComplaintModal
                    open={createState.open}
                    setOpen={handleModalOpenChange}
                    complaint={createState.complaint}
                    preferredType={createState.preferredType}
                    onSuccess={handleCreateSuccess}
                />
            )}

            <NCViewModal
                isOpen={viewState.open}
                setIsOpen={handleViewOpenChange}
                record={viewState.record}
                onEdit={() => {}}
                onDownloadPDF={() => {}}
            />
        </div>
    );
};

export default AfterSalesMethodTrackingTab;
