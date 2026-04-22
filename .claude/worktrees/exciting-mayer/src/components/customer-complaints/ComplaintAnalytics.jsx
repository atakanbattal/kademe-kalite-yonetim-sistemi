import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BarChart3,
    ClipboardList,
    Globe,
    Hash,
    Repeat,
    ShieldCheck,
    Truck,
    Wrench,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import CreateNCFromComplaintModal from '@/components/customer-complaints/CreateNCFromComplaintModal';
import NCViewModal from '@/components/df-8d/NCViewModal';
import {
    calculateResolutionDays,
    getCaseTypeLabel,
    getComplaintIdsForNCRecord,
    getCustomerDisplayName,
    getFaultPartsFromComplaint,
    getIssueClusterKey,
    getIssueClusterLabel,
    getVehicleDisplayLabel,
    recommendWorkflowForComplaint,
} from '@/components/customer-complaints/afterSalesConfig';
import { supabase } from '@/lib/customSupabaseClient';

const PIE_COLORS = ['#0f766e', '#1d4ed8', '#f59e0b', '#dc2626', '#6d28d9'];
const AXIS_TICK_STYLE = { fontSize: 12, fill: '#64748b' };
const GRID_STROKE = '#e2e8f0';
const CHART_MARGIN = { top: 8, right: 18, bottom: 8, left: 28 };
const METHOD_BADGE_VARIANT = {
    DF: 'default',
    MDI: 'warning',
    '8D': 'destructive',
};
const AUDIT_COLORS = {
    blue: '#2563eb',
    teal: '#0f766e',
    amber: '#f59e0b',
    rose: '#e11d48',
    violet: '#7c3aed',
};

const LINKED_NC_SELECT = 'id, type, status, nc_number, mdi_no, title, description, created_at';

const StatCard = ({ title, value, description, icon: Icon }) => (
    <Card>
        <CardContent className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[13px] leading-5 text-muted-foreground">{title}</div>
                    <div className="mt-1.5 text-2xl font-bold leading-none">{value}</div>
                    {description && <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</div>}
                </div>
                <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
        </CardContent>
    </Card>
);

const EmptyState = ({ text }) => (
    <div className="text-sm text-muted-foreground py-12 text-center">{text}</div>
);

const getLinkedMethodLabel = (record) =>
    record?.type === 'MDI'
        ? record?.mdi_no || record?.nc_number || record?.title || 'MDI'
        : record?.nc_number || record?.title || record?.type || 'Kayıt';

const mergeUniqueMethodRecords = (records) =>
    Array.from(new Map((records || []).map((record) => [record.id, record])).values());

const formatRatio = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);
const formatCurrency = (value) =>
    Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const getHorizontalAxisWidth = (items, key = 'name') => {
    const maxLength = Math.max(...items.map((item) => String(item[key] || item.name || '').length), 0);
    return Math.min(320, Math.max(148, Math.ceil(maxLength * 5.6)));
};

const createAxisLabelLines = (label, maxCharsPerLine = 26, maxLines = 2) => {
    const text = String(label || '').trim();
    if (!text) return ['-'];
    if (text.length <= maxCharsPerLine) return [text];

    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;

        if (candidate.length <= maxCharsPerLine) {
            currentLine = candidate;
            return;
        }

        if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            lines.push(word.slice(0, maxCharsPerLine));
            currentLine = word.slice(maxCharsPerLine);
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    const visibleLines = lines.slice(0, maxLines);
    const hasOverflow = lines.length > maxLines || visibleLines.some((line) => line.length > maxCharsPerLine);

    if (hasOverflow) {
        const lastLine = visibleLines[visibleLines.length - 1] || '';
        visibleLines[visibleLines.length - 1] =
            lastLine.length > maxCharsPerLine - 1
                ? `${lastLine.slice(0, maxCharsPerLine - 1).trimEnd()}…`
                : `${lastLine.trimEnd()}…`;
    }

    return visibleLines;
};

const WrappedYAxisTick = ({ x, y, payload, width = 140 }) => {
    const lines = createAxisLabelLines(payload?.value, Math.max(18, Math.floor(width / 7)), 2);
    const xPosition = x + width - 12;

    return (
        <text
            x={xPosition}
            y={y}
            textAnchor="end"
            dominantBaseline="middle"
            fill={AXIS_TICK_STYLE.fill}
            fontSize={AXIS_TICK_STYLE.fontSize}
        >
            {lines.map((line, index) => (
                <tspan
                    key={`${payload?.value}-${index}`}
                    x={xPosition}
                    dy={index === 0 ? -((lines.length - 1) * 7) : 14}
                >
                    {line}
                </tspan>
            ))}
        </text>
    );
};

const AnalyticsMethodPanel = ({ item, onCreate, onOpenRecord }) => (
    <div className="min-w-[260px] rounded-xl border bg-slate-50/70 p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Bağlı Uygunsuzluklar
        </div>
        {item.linkedNCs?.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
                {item.linkedNCs.map((record) => (
                    <button
                        key={record.id}
                        type="button"
                        className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                        title={`${record.type} • ${getLinkedMethodLabel(record)} • ${record.status || 'Durum yok'}`}
                        onClick={() => onOpenRecord(record)}
                    >
                        {record.type} • {getLinkedMethodLabel(record)}
                    </button>
                ))}
            </div>
        ) : (
            <div className="mt-2 text-sm text-slate-500">
                Bu küme için bağlı DF / MDI / 8D kaydı bulunmuyor.
            </div>
        )}

        <div className="mt-3 text-xs text-slate-500">
            {item.linkedNCs?.length > 0
                ? 'Bağlı kayıt bulunduğu için mükerrer uygunsuzluk açılması engellendi.'
                : item.createComplaint
                    ? `Temsilci vaka: ${item.createComplaint.title || 'Satış sonrası vaka'}`
                    : 'Uygunsuzluk açılacak uygun vaka bulunamadı.'}
        </div>

        <Button
            type="button"
            variant={item.linkedNCs?.length > 0 ? 'outline' : 'default'}
            size="sm"
            className="mt-3 w-full"
            disabled={!item.createComplaint && !(item.linkedNCs?.length > 0)}
            onClick={() =>
                item.linkedNCs?.length > 0
                    ? onOpenRecord(item.linkedNCs[0])
                    : onCreate(item)
            }
        >
            {item.linkedNCs?.length > 0
                ? 'Bağlı Kaydı Aç'
                : `Uygunsuzluk Oluştur • ${item.suggestedType}`}
        </Button>
    </div>
);

const ExecutiveInsightCard = ({ title, value, helper, color = AUDIT_COLORS.blue }) => (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color }}>
            {title}
        </div>
        <div className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-6 text-slate-900">{value}</div>
        <div className="mt-2 line-clamp-2 text-sm text-slate-500">{helper}</div>
    </div>
);

const ReadinessScoreCard = ({ title, score, helper, color = AUDIT_COLORS.blue }) => (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-xs text-slate-500">{helper}</div>
            </div>
            <div
                className="rounded-full px-3 py-1 text-sm font-semibold"
                style={{ backgroundColor: `${color}14`, color }}
            >
                %{score}
            </div>
        </div>
        <div className="mt-3">
            <Progress value={score} className="h-2.5 bg-slate-100" indicatorStyle={{ backgroundColor: color }} />
        </div>
    </div>
);

const RankedBarList = ({
    items,
    valueKey = 'count',
    color = AUDIT_COLORS.blue,
    valueFormatter = (value) => value,
    helperFormatter,
}) => {
    const maxValue = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);

    return (
        <div className="space-y-3">
            {items.map((item, index) => {
                const value = Number(item[valueKey] || 0);
                const width = value > 0 ? Math.max((value / maxValue) * 100, 8) : 0;

                return (
                    <div key={`${item.fullName || item.name}-${index}`} className="rounded-xl border bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{item.fullName || item.name}</div>
                                {helperFormatter && (
                                    <div className="mt-1 text-xs text-slate-500">{helperFormatter(item)}</div>
                                )}
                            </div>
                            <div className="text-sm font-semibold" style={{ color }}>
                                {valueFormatter(value)}
                            </div>
                        </div>
                        <div className="mt-3 h-2.5 rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${width}%`, backgroundColor: color }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const AnalyticsActionList = ({
    items,
    color,
    emptyText,
    onCreate,
    onOpenRecord,
    valueAccessor = (item) => Number(item.count || 0),
    valueFormatter = (_, value) => value,
    helperFormatter,
    metaRenderer,
}) => {
    if (items.length === 0) {
        return <EmptyState text={emptyText} />;
    }

    const maxValue = Math.max(...items.map((item) => Number(valueAccessor(item) || 0)), 1);

    return (
        <div className="space-y-3">
            {items.map((item, index) => {
                const value = Number(valueAccessor(item) || 0);
                const width = value > 0 ? Math.max((value / maxValue) * 100, 8) : 0;

                return (
                    <div
                        key={`${item.fullName || item.name}-${index}`}
                        className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_280px]"
                    >
                        <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div
                                        className="truncate text-base font-semibold text-slate-900"
                                        title={item.fullName || item.name}
                                    >
                                        {index + 1}. {item.fullName || item.name}
                                    </div>
                                    {helperFormatter && (
                                        <div className="mt-1 text-sm text-slate-500">
                                            {helperFormatter(item)}
                                        </div>
                                    )}
                                </div>
                                <div
                                    className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold"
                                    style={{ backgroundColor: `${color}14`, color }}
                                >
                                    {valueFormatter(item, value)}
                                </div>
                            </div>

                            <div className="mt-3 h-2.5 rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${width}%`, backgroundColor: color }}
                                />
                            </div>

                            {metaRenderer && <div className="mt-3">{metaRenderer(item)}</div>}
                        </div>

                        <AnalyticsMethodPanel item={item} onCreate={onCreate} onOpenRecord={onOpenRecord} />
                    </div>
                );
            })}
        </div>
    );
};

const DistributionMetric = ({ label, value, total, color = AUDIT_COLORS.blue, helper }) => {
    const percent = formatRatio(value, total);

    return (
            <div className="rounded-xl border bg-white/90 p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium text-slate-700">{label}</div>
                    {helper && <div className="mt-1 text-xs text-slate-500">{helper}</div>}
                </div>
                <div
                    className="min-w-[44px] rounded-full px-2.5 py-1 text-right text-sm font-semibold"
                    style={{ backgroundColor: `${color}14`, color }}
                >
                    {value}
                </div>
            </div>
            <div className="mt-4">
                <Progress
                    value={value > 0 ? Math.max(percent, 8) : 0}
                    className="h-2.5 bg-slate-100"
                    indicatorStyle={{ backgroundColor: color }}
                />
                <div className="mt-2 text-xs text-slate-500">%{percent} kapsama</div>
            </div>
        </div>
    );
};

const CompactDistributionPanel = ({ title, description, items, total, color, emptyText }) => (
    <div className="rounded-2xl border bg-slate-50/70 p-4">
        <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{description}</div>
        </div>
        {items.length === 0 ? (
            <EmptyState text={emptyText} />
        ) : (
            <div className="space-y-3">
                {items.map((item) => (
                    <DistributionMetric
                        key={item.name}
                        label={item.name}
                        value={item.value}
                        total={total}
                        color={color}
                        helper={item.helper}
                    />
                ))}
            </div>
        )}
    </div>
);

const ComplaintAnalytics = ({ complaints, customers, periodLabel, onRefresh }) => {
    const [operationCostsByComplaint, setOperationCostsByComplaint] = useState({});
    const [linkedMethodTypesByComplaint, setLinkedMethodTypesByComplaint] = useState({});
    const [linkedNCRecordsByComplaint, setLinkedNCRecordsByComplaint] = useState({});
    const [ncCreateState, setNcCreateState] = useState({
        open: false,
        complaint: null,
        preferredType: 'MDI',
    });
    const [ncViewState, setNcViewState] = useState({
        open: false,
        record: null,
    });

    const loadSupplementaryAnalytics = useCallback(async () => {
        const complaintIds = (complaints || []).map((record) => record.id).filter(Boolean);
        const complaintIdsByRelatedNc = (complaints || []).reduce((acc, record) => {
            if (!record.related_nc_id) return acc;
            acc[record.related_nc_id] = [...(acc[record.related_nc_id] || []), record.id];
            return acc;
        }, {});

        if (complaintIds.length === 0) {
            setOperationCostsByComplaint({});
            setLinkedMethodTypesByComplaint({});
            setLinkedNCRecordsByComplaint({});
            return;
        }

        const [operationsResult, methodsResult] = await Promise.all([
            supabase
                .from('after_sales_service_operations')
                .select('complaint_id, total_cost')
                .in('complaint_id', complaintIds),
            supabase
                .from('non_conformities')
                .select(LINKED_NC_SELECT)
                .order('created_at', { ascending: false })
                .limit(1500),
        ]);

        if (methodsResult.error) {
            console.error('Bağlı uygunsuzluk kayıtları yüklenemedi:', methodsResult.error);
            setOperationCostsByComplaint({});
            setLinkedMethodTypesByComplaint({});
            setLinkedNCRecordsByComplaint({});
            return;
        }

        const costMap = {};
        (operationsResult.data || []).forEach((operation) => {
            if (!operation.complaint_id) return;
            costMap[operation.complaint_id] = Number(costMap[operation.complaint_id] || 0) + Number(operation.total_cost || 0);
        });

        const methodMap = {};
        const linkedRecordMap = {};
        mergeUniqueMethodRecords(methodsResult.data || []).forEach((method) => {
            const matchedComplaintIds = getComplaintIdsForNCRecord(method, complaints, complaintIdsByRelatedNc);
            if (matchedComplaintIds.length === 0) return;

            matchedComplaintIds.forEach((complaintId) => {
                const currentTypes = methodMap[complaintId] || [];
                if (method.type) {
                    methodMap[complaintId] = Array.from(new Set([...currentTypes, method.type]));
                }

                const currentRecords = linkedRecordMap[complaintId] || [];
                linkedRecordMap[complaintId] = mergeUniqueMethodRecords([
                    ...currentRecords,
                    {
                        ...method,
                        source_complaint_id: method.source_complaint_id || complaintId,
                    },
                ]);
            });
        });

        setOperationCostsByComplaint(costMap);
        setLinkedMethodTypesByComplaint(methodMap);
        setLinkedNCRecordsByComplaint(linkedRecordMap);
    }, [complaints]);

    useEffect(() => {
        loadSupplementaryAnalytics();
    }, [loadSupplementaryAnalytics]);

    const customerMap = useMemo(
        () => new Map((customers || []).map((customer) => [customer.id, customer])),
        [customers]
    );

    const complaintMap = useMemo(
        () =>
            new Map(
                (complaints || []).map((record) => [
                    record.id,
                    record.customer ? record : { ...record, customer: customerMap.get(record.customer_id) || null },
                ])
            ),
        [complaints, customerMap]
    );

    const handleAnalyticsNcCreate = useCallback((item) => {
        if (!item?.createComplaint) return;
        setNcCreateState({
            open: true,
            complaint: item.createComplaint,
            preferredType: item.suggestedType || 'MDI',
        });
    }, []);

    const handleNcModalOpenChange = useCallback((nextOpen) => {
        if (!nextOpen) {
            setNcCreateState({
                open: false,
                complaint: null,
                preferredType: 'MDI',
            });
        }
    }, []);

    const handleNcViewOpenChange = useCallback((nextOpen) => {
        if (!nextOpen) {
            setNcViewState({
                open: false,
                record: null,
            });
        }
    }, []);

    const handleOpenLinkedNC = useCallback(async (record) => {
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

        setNcViewState({
            open: true,
            record: data || record,
        });
    }, []);

    const applyOptimisticNCRecord = useCallback((createdRecord, sourceComplaint) => {
        if (!createdRecord?.id || !sourceComplaint?.id) return;

        const normalizedRecord = {
            ...createdRecord,
            source_complaint_id: createdRecord.source_complaint_id || sourceComplaint.id,
        };

        setLinkedMethodTypesByComplaint((prev) => ({
            ...prev,
            [sourceComplaint.id]: Array.from(new Set([...(prev[sourceComplaint.id] || []), normalizedRecord.type].filter(Boolean))),
        }));

        setLinkedNCRecordsByComplaint((prev) => ({
            ...prev,
            [sourceComplaint.id]: mergeUniqueMethodRecords([
                normalizedRecord,
                ...(prev[sourceComplaint.id] || []),
            ]),
        }));
    }, []);

    const handleNcCreateSuccess = useCallback(async (createdRecord, sourceComplaint) => {
        setNcCreateState({
            open: false,
            complaint: null,
            preferredType: 'MDI',
        });
        applyOptimisticNCRecord(createdRecord, sourceComplaint);
        await onRefresh?.();
    }, [applyOptimisticNCRecord, onRefresh]);

    const analytics = useMemo(() => {
        const total = complaints.length;

        const coverage = {
            domestic: 0,
            international: 0,
            remote: 0,
            helpdesk: 0,
            sparePartShipped: 0,
            recordedCalls: 0,
        };

        const documentation = {
            userManual: 0,
            maintenanceCatalog: 0,
            spareCatalog: 0,
            multilingual: 0,
            archivedByVehicle: 0,
        };

        const warrantyDistribution = {};
        const rootCauseMethods = {};
        const workflowDistribution = {};
        const caseTypeStats = {};
        const issueMap = new Map();
        const repeatedIssues = [];
        const topPartMap = new Map();
        const partCodeMap = new Map();
        const chassisMap = new Map();

        let surveySent = 0;
        let surveyScoreTotal = 0;
        let surveyScoreCount = 0;
        let totalWarrantyCases = 0;
        let closedCases = 0;
        let totalResolutionDays = 0;
        let serviceTraceabilityCount = 0;
        let documentationReadyCount = 0;
        let methodTraceabilityCount = 0;
        let warrantyVisibilityCount = 0;

        complaints.forEach((record) => {
            const totalCost = Number(record.financial_impact || operationCostsByComplaint[record.id] || 0);
            const linkedMethods = linkedMethodTypesByComplaint[record.id] || [];
            const derivedWorkflow = record.recommended_workflow || linkedMethods[0] || recommendWorkflowForComplaint(record).type;
            const derivedWarrantyStatus = record.warranty_status || 'Belirtilmedi';
            const derivedRootCauseMethod = record.root_cause_methodology || 'Belirtilmedi';
            const hasDocumentation =
                record.user_manual_available ||
                record.maintenance_catalog_available ||
                record.spare_parts_catalog_available ||
                record.multilingual_docs_available ||
                record.documents_archived_by_work_order;
            const hasServiceTrace =
                record.service_location_type ||
                record.service_channel ||
                record.service_partner_name ||
                record.service_city ||
                record.service_country;

            if (record.service_location_type === 'Yurt Dışı') coverage.international += 1;
            else if (record.service_location_type === 'Uzak Destek') coverage.remote += 1;
            else coverage.domestic += 1;

            if (record.helpdesk_supported) coverage.helpdesk += 1;
            if (record.spare_part_shipped_by_company) coverage.sparePartShipped += 1;
            if (record.conversation_recorded) coverage.recordedCalls += 1;

            if (record.user_manual_available) documentation.userManual += 1;
            if (record.maintenance_catalog_available) documentation.maintenanceCatalog += 1;
            if (record.spare_parts_catalog_available) documentation.spareCatalog += 1;
            if (record.multilingual_docs_available) documentation.multilingual += 1;
            if (record.documents_archived_by_work_order) documentation.archivedByVehicle += 1;
            if (hasDocumentation) documentationReadyCount += 1;
            if (hasServiceTrace) serviceTraceabilityCount += 1;

            warrantyDistribution[derivedWarrantyStatus] = (warrantyDistribution[derivedWarrantyStatus] || 0) + 1;
            if (derivedWarrantyStatus === 'Garanti İçinde') totalWarrantyCases += 1;
            if (record.warranty_status && record.warranty_status !== 'Belirtilmedi') warrantyVisibilityCount += 1;

            rootCauseMethods[derivedRootCauseMethod] = (rootCauseMethods[derivedRootCauseMethod] || 0) + 1;
            workflowDistribution[derivedWorkflow] = (workflowDistribution[derivedWorkflow] || 0) + 1;
            if (linkedMethods.length > 0 || record.root_cause_methodology) methodTraceabilityCount += 1;

            if (record.survey_sent) surveySent += 1;
            if (record.survey_score !== null && record.survey_score !== undefined && record.survey_score !== '') {
                surveyScoreTotal += Number(record.survey_score);
                surveyScoreCount += 1;
            }

            if (record.actual_close_date) {
                closedCases += 1;
                totalResolutionDays += calculateResolutionDays(record);
            }

            const caseType = getCaseTypeLabel(record);
            if (!caseTypeStats[caseType]) {
                caseTypeStats[caseType] = { total: 0, closed: 0, resolutionDays: 0 };
            }
            caseTypeStats[caseType].total += 1;
            if (record.actual_close_date) {
                caseTypeStats[caseType].closed += 1;
                caseTypeStats[caseType].resolutionDays += calculateResolutionDays(record);
            }

            const issueKey = getIssueClusterKey(record);
            const currentIssue = issueMap.get(issueKey) || {
                label: getIssueClusterLabel(record),
                count: 0,
                totalCost: 0,
                totalRepeat: 0,
                vehicles: new Set(),
                caseTypes: new Set(),
                complaintIds: new Set(),
            };
            currentIssue.count += 1;
            currentIssue.totalCost += totalCost;
            currentIssue.totalRepeat += Number(record.repeat_failure_count || 0);
            if (record.vehicle_serial_number) currentIssue.vehicles.add(record.vehicle_serial_number);
            currentIssue.caseTypes.add(caseType);
            currentIssue.complaintIds.add(record.id);
            issueMap.set(issueKey, currentIssue);

            const faultParts = getFaultPartsFromComplaint(record);
            const partsToTrack = faultParts.length > 0
                ? faultParts
                : [{ part_code: '', part_name: 'Parça belirtilmedi' }];

            partsToTrack.forEach((part) => {
                const partLabel = part.part_name || 'Parça belirtilmedi';
                const partCode = part.part_code || 'Kodsuz';
                const key = `${partCode}__${partLabel}`;
                const currentPart = topPartMap.get(key) || {
                    label: `${partLabel} (${partCode})`,
                    partCode,
                    partName: partLabel,
                    count: 0,
                    totalCost: 0,
                    repeatCount: 0,
                    complaintIds: new Set(),
                };
                currentPart.count += 1;
                currentPart.totalCost += totalCost;
                currentPart.repeatCount += Number(record.repeat_failure_count || 0);
                currentPart.complaintIds.add(record.id);
                topPartMap.set(key, currentPart);

                const currentCode = partCodeMap.get(partCode) || {
                    code: partCode,
                    count: 0,
                    totalCost: 0,
                    repeatCount: 0,
                    names: new Set(),
                    complaintIds: new Set(),
                };
                currentCode.count += 1;
                currentCode.totalCost += totalCost;
                currentCode.repeatCount += Number(record.repeat_failure_count || 0);
                if (part.part_name) currentCode.names.add(part.part_name);
                currentCode.complaintIds.add(record.id);
                partCodeMap.set(partCode, currentCode);
            });

            const chassisLabel = getVehicleDisplayLabel(record) !== '-'
                ? getVehicleDisplayLabel(record)
                : [record.vehicle_model_code || record.vehicle_model || record.vehicle_type, record.chassis_brand, record.chassis_model, record.product_name]
                    .filter(Boolean)
                    .join(' / ');
            if (chassisLabel) {
                const currentChassis = chassisMap.get(chassisLabel) || { label: chassisLabel, count: 0, repeats: 0 };
                currentChassis.count += 1;
                currentChassis.repeats += Number(record.repeat_failure_count || 0);
                chassisMap.set(chassisLabel, currentChassis);
            }
        });

        issueMap.forEach((value) => {
            if (value.totalRepeat > 0 || value.count > 1) {
                repeatedIssues.push({
                    label: value.label,
                    count: value.count,
                    repeatCount: value.totalRepeat,
                    vehicles: value.vehicles.size,
                    caseTypes: Array.from(value.caseTypes).join(', '),
                    complaintIds: value.complaintIds,
                });
            }
        });

        if (repeatedIssues.length === 0) {
            Array.from(issueMap.values())
                .sort((left, right) => right.count - left.count)
                .slice(0, 5)
                .forEach((value) => {
                    repeatedIssues.push({
                        label: value.label,
                        count: value.count,
                        repeatCount: value.totalRepeat,
                        vehicles: value.vehicles.size,
                        caseTypes: Array.from(value.caseTypes).join(', '),
                        isCandidate: true,
                        complaintIds: value.complaintIds,
                    });
                });
        }

        const attachNcContext = (item) => {
            const complaintIds = Array.from(item.complaintIds || []).filter(Boolean);
            const linkedRecordMap = new Map();

            complaintIds.forEach((complaintId) => {
                (linkedNCRecordsByComplaint[complaintId] || []).forEach((record) => {
                    linkedRecordMap.set(record.id, record);
                });
            });

            const candidateComplaints = complaintIds
                .map((complaintId) => complaintMap.get(complaintId))
                .filter(Boolean);

            const baseComplaint =
                candidateComplaints.find(
                    (record) => (linkedNCRecordsByComplaint[record.id] || []).length === 0
                ) ||
                candidateComplaints[0] ||
                null;

            const createComplaint = baseComplaint
                ? {
                    ...baseComplaint,
                    repeat_failure_count: Math.max(
                        Number(baseComplaint.repeat_failure_count || 0),
                        Number(item.repeatCount || 0),
                        complaintIds.length > 1 ? complaintIds.length - 1 : 0
                    ),
                    financial_impact: Math.max(
                        Number(baseComplaint.financial_impact || 0),
                        Number(item.cost || item.totalCost || 0)
                    ),
                    fault_part_code: baseComplaint.fault_part_code || item.primaryPartCode || null,
                    fault_part_name: baseComplaint.fault_part_name || item.primaryPartName || item.fullName || null,
                }
                : null;

            const recommendation = createComplaint
                ? recommendWorkflowForComplaint(createComplaint)
                : { type: 'MDI', reason: '' };

            return {
                ...item,
                complaintIds,
                linkedNCs: Array.from(linkedRecordMap.values()),
                createComplaint,
                suggestedType: recommendation.type,
                suggestedReason: recommendation.reason,
            };
        };

        const topIssuesByFrequency = Array.from(issueMap.values())
            .sort((left, right) => right.count - left.count)
            .slice(0, 10)
            .map((item) => attachNcContext({
                name: item.label.length > 40 ? `${item.label.slice(0, 40)}...` : item.label,
                fullName: item.label,
                count: item.count,
                cost: item.totalCost,
                repeatCount: item.totalRepeat,
                complaintIds: item.complaintIds,
            }));

        const topIssuesByCost = Array.from(issueMap.values())
            .filter((item) => item.totalCost > 0)
            .sort((left, right) => right.totalCost - left.totalCost)
            .slice(0, 10)
            .map((item) => attachNcContext({
                name: item.label.length > 40 ? `${item.label.slice(0, 40)}...` : item.label,
                fullName: item.label,
                cost: item.totalCost,
                count: item.count,
                repeatCount: item.totalRepeat,
                complaintIds: item.complaintIds,
            }));

        const topParts = Array.from(topPartMap.values())
            .sort((left, right) => right.count - left.count)
            .slice(0, 5)
            .map((item) => attachNcContext({
                name: item.label.length > 46 ? `${item.label.slice(0, 46)}...` : item.label,
                fullName: item.label,
                count: item.count,
                cost: item.totalCost,
                repeatCount: item.repeatCount,
                primaryPartCode: item.partCode,
                primaryPartName: item.partName,
                complaintIds: item.complaintIds,
            }));

        const topPartCodes = Array.from(partCodeMap.values())
            .sort((left, right) => {
                if (right.count !== left.count) return right.count - left.count;
                if (right.repeatCount !== left.repeatCount) return right.repeatCount - left.repeatCount;
                return right.totalCost - left.totalCost;
            })
            .slice(0, 10)
            .map((item) => attachNcContext({
                name: item.code,
                fullName: item.code,
                count: item.count,
                cost: item.totalCost,
                repeatCount: item.repeatCount,
                partNames: Array.from(item.names).slice(0, 3).join(', ') || 'Parça adı girilmedi',
                primaryPartCode: item.code,
                primaryPartName: Array.from(item.names)[0] || null,
                complaintIds: item.complaintIds,
            }));

        const chassisBreakdown = Array.from(chassisMap.values())
            .sort((left, right) => right.count - left.count)
            .slice(0, 10)
            .map((item) => ({
                name: item.label.length > 44 ? `${item.label.slice(0, 44)}...` : item.label,
                fullName: item.label,
                count: item.count,
                repeats: item.repeats,
            }));

        const caseTypeResolution = Object.entries(caseTypeStats)
            .filter(([, stats]) => stats.closed > 0)
            .map(([name, stats]) => ({
                name,
                total: stats.total,
                avgResolutionDays: stats.closed > 0 ? Number((stats.resolutionDays / stats.closed).toFixed(1)) : 0,
            }))
            .sort((left, right) => right.total - left.total);

        const documentationReadiness = [
            { name: 'Kullanıcı Kitapçığı', value: documentation.userManual },
            { name: 'Bakım / Tamir Kataloğu', value: documentation.maintenanceCatalog },
            { name: 'Yedek Parça Kataloğu', value: documentation.spareCatalog },
            { name: 'Yabancı Dil Dokümanları', value: documentation.multilingual },
            { name: 'İş Emri / Şasi Bazlı Arşiv', value: documentation.archivedByVehicle },
        ];

        const topCustomers = (customers || [])
            .map((customer) => {
                const customerRecords = complaints.filter((record) => record.customer_id === customer.id);
                return {
                    name: getCustomerDisplayName(customer),
                    total: customerRecords.length,
                    repeated: customerRecords.filter((record) => Number(record.repeat_failure_count) > 0).length,
                    avgResolution:
                        customerRecords.filter((record) => record.actual_close_date).length > 0
                            ? Number(
                                (
                                    customerRecords
                                        .filter((record) => record.actual_close_date)
                                        .reduce((sum, record) => sum + calculateResolutionDays(record), 0) /
                                    customerRecords.filter((record) => record.actual_close_date).length
                                ).toFixed(1)
                            )
                            : 0,
                };
            })
            .filter((customer) => customer.total > 0)
            .sort((left, right) => right.total - left.total)
            .slice(0, 8);

        const totalOperationCost = Object.values(operationCostsByComplaint).reduce(
            (sum, value) => sum + Number(value || 0),
            0
        );
        const linkedMethodCaseCount = complaints.filter(
            (record) => (linkedMethodTypesByComplaint[record.id] || []).length > 0
        ).length;
        const pendingMethodCount = complaints.filter(
            (record) =>
                !record.actual_close_date &&
                !record.service_completion_date &&
                (linkedMethodTypesByComplaint[record.id] || []).length === 0
        ).length;
        const archiveLinkedCount = complaints.filter(
            (record) => record.vehicle_serial_number || record.vehicle_chassis_number || record.vehicle_model_code
        ).length;

        return {
            total,
            coverage,
            documentationReadiness,
            topIssuesByFrequency,
            topIssuesByCost,
            chassisBreakdown,
            caseTypeResolution,
            repeatedIssues: repeatedIssues
                .sort((left, right) => (right.repeatCount + right.count) - (left.repeatCount + left.count))
                .slice(0, 10)
                .map((item) =>
                    attachNcContext({
                        ...item,
                        fullName: item.label,
                        name: item.label.length > 42 ? `${item.label.slice(0, 42)}...` : item.label,
                    })
                ),
            warrantyPieData: Object.entries(warrantyDistribution).map(([name, value]) => ({ name, value })),
            rootCauseMethods: Object.entries(rootCauseMethods).map(([name, value]) => ({ name, value })).sort((left, right) => right.value - left.value),
            workflowDistribution: Object.entries(workflowDistribution).map(([name, value]) => ({ name, value })).sort((left, right) => right.value - left.value),
            surveySent,
            avgSurveyScore: surveyScoreCount > 0 ? Number((surveyScoreTotal / surveyScoreCount).toFixed(2)) : 0,
            totalWarrantyCases,
            avgResolutionDays: closedCases > 0 ? Number((totalResolutionDays / closedCases).toFixed(1)) : 0,
            topCustomers,
            topParts,
            topPartCodes,
            totalOperationCost,
            linkedMethodCaseCount,
            pendingMethodCount,
            archiveLinkedCount,
            readinessScores: [
                {
                    name: 'Servis İzlenebilirliği',
                    score: formatRatio(serviceTraceabilityCount, total),
                    helper: `${serviceTraceabilityCount}/${total || 0} vaka servis kanalı veya lokasyon bilgisi içeriyor`,
                    color: AUDIT_COLORS.blue,
                },
                {
                    name: 'Dokümantasyon Hazırlığı',
                    score: formatRatio(documentationReadyCount, total),
                    helper: `${documentationReadyCount}/${total || 0} vakada kitapçık, katalog veya arşiv izi var`,
                    color: AUDIT_COLORS.teal,
                },
                {
                    name: 'Yöntem İzlenebilirliği',
                    score: formatRatio(methodTraceabilityCount, total),
                    helper: `${methodTraceabilityCount}/${total || 0} vakada kök neden veya yöntem bağlantısı mevcut`,
                    color: AUDIT_COLORS.violet,
                },
                {
                    name: 'Garanti Görünürlüğü',
                    score: formatRatio(warrantyVisibilityCount, total),
                    helper: `${warrantyVisibilityCount}/${total || 0} vakada garanti statüsü açıkça işlenmiş`,
                    color: AUDIT_COLORS.amber,
                },
            ],
            coverageMetrics: [
                { name: 'Yurt içi servis kayıtları', value: coverage.domestic, helper: 'Toplam servis vakaları içindeki pay' },
                { name: 'Yurt dışı servis kayıtları', value: coverage.international, helper: 'Saha desteği verilen dış lokasyonlar' },
                { name: 'Uzak destek / help desk', value: coverage.remote + coverage.helpdesk, helper: 'Telefon, uzaktan erişim ve help desk' },
                { name: 'Kayıt altına alınan görüşmeler', value: coverage.recordedCalls, helper: 'Değerlendirilebilir çağrı ve görüşmeler' },
                { name: 'Firma sevki ile yedek parça', value: coverage.sparePartShipped, helper: 'Şirket üzerinden sevk edilen parçalar' },
            ],
            documentationMetrics: documentationReadiness.map((item) => ({
                name: item.name,
                value: item.value,
                helper: 'Toplam vaka havuzu içindeki hazırlık oranı',
            })),
        };
    }, [
        complaintMap,
        complaints,
        customers,
        linkedMethodTypesByComplaint,
        linkedNCRecordsByComplaint,
        operationCostsByComplaint,
    ]);

    const warrantyLegend = analytics.warrantyPieData.map((item, index) => ({
        ...item,
        color: PIE_COLORS[index % PIE_COLORS.length],
        percent: formatRatio(item.value, analytics.total),
    }));
    const chassisAxisWidth = getHorizontalAxisWidth(analytics.chassisBreakdown);
    const caseTypeAxisWidth = getHorizontalAxisWidth(analytics.caseTypeResolution, 'name');

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Satış Sonrası Analiz</h3>
                <p className="text-sm text-muted-foreground">
                    {periodLabel
                        ? `${periodLabel} için operasyon, problem, parça, araç ve yöntem performansını tek ekranda izleyin.`
                        : 'Satış sonrası hizmetlerin operasyon, parça, araç ve yöntem performansını tek ekranda izleyin.'}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <StatCard title="Toplam Vaka" value={analytics.total} description="Tüm satış sonrası kayıtlar" icon={ClipboardList} />
                <StatCard title="Ort. Çözüm Süresi" value={analytics.avgResolutionDays > 0 ? `${analytics.avgResolutionDays} gün` : '-'} description="Kapanan vakalar üzerinden" icon={Wrench} />
                <StatCard title="Toplam Operasyon Maliyeti" value={formatCurrency(analytics.totalOperationCost)} description="Operasyon kayıtlarından toplanır" icon={AlertTriangle} />
                <StatCard title="Bağlı Yöntem" value={analytics.linkedMethodCaseCount} description={`${analytics.pendingMethodCount} vaka yöntem açılmayı bekliyor`} icon={ShieldCheck} />
                <StatCard title="Yurt Dışı Destek" value={analytics.coverage.international} description="Yurt dışı servis kayıtları" icon={Globe} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ExecutiveInsightCard
                    title="En Sık Problem Kümesi"
                    value={analytics.topIssuesByFrequency[0]?.fullName || 'Veri yok'}
                    helper={analytics.topIssuesByFrequency[0] ? `${analytics.topIssuesByFrequency[0].count} vaka ile ilk sırada, benzer başlıklar ve parçalar birlikte kümelendi` : 'Seçili dönemde problem frekansı oluşmadı'}
                    color={AUDIT_COLORS.blue}
                />
                <ExecutiveInsightCard
                    title="En Maliyetli Problem Kümesi"
                    value={analytics.topIssuesByCost[0]?.fullName || 'Veri yok'}
                    helper={analytics.topIssuesByCost[0] ? `${formatCurrency(analytics.topIssuesByCost[0].cost)} toplam etki, benzer kayıtlar tek başlıkta toplandı` : 'Maliyet girilmiş kayıt henüz yok'}
                    color={AUDIT_COLORS.teal}
                />
                <ExecutiveInsightCard
                    title="En Çok Tekrarlanan Parça"
                    value={analytics.topParts[0]?.fullName || 'Veri yok'}
                    helper={analytics.topParts[0] ? `${analytics.topParts[0].repeatCount} tekrar • ${analytics.topParts[0].count} vaka` : 'Parça bazlı tekrar sinyali henüz yok'}
                    color={AUDIT_COLORS.rose}
                />
                <ExecutiveInsightCard
                    title="Yöntem Bekleyen Açık Vaka"
                    value={`${analytics.pendingMethodCount} kayıt`}
                    helper={`${analytics.archiveLinkedCount} vaka araç izi ile ilişkilendirildi`}
                    color={AUDIT_COLORS.violet}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Parça Bazlı Top 5 Listesi
                    </CardTitle>
                    <CardDescription>
                        {(periodLabel || 'Seçili dönem')} içindeki vakalardan arızalı parça bazında oluşturuldu.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AnalyticsActionList
                        items={analytics.topParts}
                        color="#dc2626"
                        emptyText="Seçili dönemde parça bazlı analiz yapılabilecek kayıt bulunmuyor."
                        onCreate={handleAnalyticsNcCreate}
                        onOpenRecord={handleOpenLinkedNC}
                        valueAccessor={(item) => item.count}
                        valueFormatter={(_, value) => `${value} vaka`}
                        helperFormatter={(item) => `${item.primaryPartCode || 'Kodsuz'} • ${item.repeatCount} tekrar`}
                        metaRenderer={(item) => (
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                                    {item.repeatCount} tekrar
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                    {formatCurrency(item.cost)}
                                </span>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Hash className="w-5 h-5" />
                        Parça Kodu Bazlı Analiz
                    </CardTitle>
                    <CardDescription>
                        Arızalı parça kodlarına göre vaka yoğunluğu, tekrar baskısı ve maliyet etkisi.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AnalyticsActionList
                        items={analytics.topPartCodes}
                        color={AUDIT_COLORS.rose}
                        emptyText="Parça kodu bazlı analiz yapılabilecek kayıt bulunmuyor."
                        onCreate={handleAnalyticsNcCreate}
                        onOpenRecord={handleOpenLinkedNC}
                        valueAccessor={(item) => item.count}
                        valueFormatter={(item, value) => `${value} vaka`}
                        helperFormatter={(item) => `${item.partNames} • ${item.repeatCount} tekrar`}
                        metaRenderer={(item) => (
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                                    Kod: {item.fullName}
                                </span>
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                    {item.repeatCount} tekrar
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                    {formatCurrency(item.cost)}
                                </span>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        En Sık Görülen Problemler
                    </CardTitle>
                    <CardDescription>İlk 10 problem, vaka adedine göre sıralanır.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AnalyticsActionList
                        items={analytics.topIssuesByFrequency}
                        color={AUDIT_COLORS.blue}
                        emptyText="Henüz analiz edilecek problem kaydı yok."
                        onCreate={handleAnalyticsNcCreate}
                        onOpenRecord={handleOpenLinkedNC}
                        valueAccessor={(item) => item.count}
                        valueFormatter={(_, value) => `${value} vaka`}
                        helperFormatter={(item) => `${item.repeatCount} tekrar • ${formatCurrency(item.cost)}`}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        En Yüksek Maliyetli Problemler
                    </CardTitle>
                    <CardDescription>İlk 10 problem, toplam finansal etkiye göre sıralanır.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AnalyticsActionList
                        items={analytics.topIssuesByCost}
                        color={AUDIT_COLORS.teal}
                        emptyText="Finansal etki girilen kayıt bulunmuyor."
                        onCreate={handleAnalyticsNcCreate}
                        onOpenRecord={handleOpenLinkedNC}
                        valueAccessor={(item) => item.cost}
                        valueFormatter={(item) => formatCurrency(item.cost)}
                        helperFormatter={(item) => `${item.count || 0} vaka • ${item.repeatCount || 0} tekrar`}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        Şase / Model Bazlı Problem Yoğunluğu
                    </CardTitle>
                    <CardDescription>Özellikle araç üstü süpürge ve çöp araçlarında hangi şase kombinasyonlarında daha çok kayıt oluştuğunu gösterir.</CardDescription>
                </CardHeader>
                <CardContent>
                    {analytics.chassisBreakdown.length === 0 ? (
                        <EmptyState text="Şase veya model bilgisi girilmiş yeterli kayıt yok." />
                    ) : analytics.chassisBreakdown.length <= 2 ? (
                        <RankedBarList
                            items={analytics.chassisBreakdown}
                            valueKey="count"
                            color={AUDIT_COLORS.violet}
                            helperFormatter={(item) => `${item.count} vaka • ${item.repeats} tekrar`}
                        />
                    ) : (
                        <div className="h-[320px] pr-2 sm:pr-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.chassisBreakdown} layout="vertical" barCategoryGap={16} margin={CHART_MARGIN}>
                                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal vertical={false} />
                                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK_STYLE} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={chassisAxisWidth}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={<WrappedYAxisTick width={chassisAxisWidth} />}
                                        interval={0}
                                    />
                                    <Tooltip formatter={(value, name, item) => [value, name === 'repeats' ? 'Tekrar Sayısı' : item?.payload?.fullName || 'Şase / Model']} />
                                    <Bar dataKey="count" name="Vaka" fill="#7c3aed" radius={[0, 8, 8, 0]} maxBarSize={20} />
                                    <Bar dataKey="repeats" name="Tekrar" fill="#f59e0b" radius={[0, 8, 8, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Vaka Tipine Göre Ortalama Çözüm Süresi</CardTitle>
                    <CardDescription>Servis, garanti, teknik destek ve diğer satış sonrası tiplerde ortalama kapanma süresi</CardDescription>
                </CardHeader>
                <CardContent>
                    {analytics.caseTypeResolution.length === 0 ? (
                        <EmptyState text="Çözüm süresi hesaplanabilecek yeterli veri yok." />
                    ) : analytics.caseTypeResolution.length <= 2 ? (
                        <RankedBarList
                            items={analytics.caseTypeResolution}
                            valueKey="avgResolutionDays"
                            color={AUDIT_COLORS.blue}
                            valueFormatter={(value) => `${value} gün`}
                            helperFormatter={(item) => `${item.total} vaka üzerinden hesaplandı`}
                        />
                    ) : (
                        <div className="h-[300px] pr-2 sm:pr-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.caseTypeResolution} layout="vertical" barCategoryGap={18} margin={CHART_MARGIN}>
                                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal vertical={false} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={AXIS_TICK_STYLE} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={caseTypeAxisWidth}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={<WrappedYAxisTick width={caseTypeAxisWidth} />}
                                        interval={0}
                                    />
                                    <Tooltip formatter={(value) => [`${value} gün`, 'Ort. Çözüm Süresi']} />
                                    <Bar dataKey="avgResolutionDays" fill="#2563eb" radius={[0, 10, 10, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Repeat className="w-5 h-5" />
                        Tekrarlayan Problemler
                    </CardTitle>
                    <CardDescription>Tekrar sayısı yüksek veya yakın takibe alınması gereken başlıklar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <AnalyticsActionList
                        items={analytics.repeatedIssues}
                        color={AUDIT_COLORS.amber}
                        emptyText="Tekrarlı problem kaydı tespit edilmedi."
                        onCreate={handleAnalyticsNcCreate}
                        onOpenRecord={handleOpenLinkedNC}
                        valueAccessor={(item) => item.repeatCount + item.count}
                        valueFormatter={(item) => `${item.repeatCount} tekrar`}
                        helperFormatter={(item) => `${item.count} vaka • ${item.vehicles} araç`}
                        metaRenderer={(item) => (
                            <div className="flex flex-wrap gap-2 text-xs">
                                {item.isCandidate && (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                        Yakın Takip
                                    </span>
                                )}
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                    {item.caseTypes}
                                </span>
                            </div>
                        )}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Operasyonel Hazırlık Göstergeleri</CardTitle>
                    <CardDescription>Servis kapsamı, garanti görünürlüğü, dokümantasyon ve kullanılan yöntemler süreç olgunluğunu gösterir.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {analytics.readinessScores.map((item) => (
                            <ReadinessScoreCard
                                key={item.name}
                                title={item.name}
                                score={item.score}
                                helper={item.helper}
                                color={item.color}
                            />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <CompactDistributionPanel
                            title="Servis Kapsaması"
                            description="Saha desteği, help desk ve parça sevki görünürlüğü"
                            items={analytics.coverageMetrics}
                            total={analytics.total}
                            color={AUDIT_COLORS.blue}
                            emptyText="Servis kapsamı göstergesi üretilemedi."
                        />

                        <CompactDistributionPanel
                            title="Dokümantasyon Hazırlığı"
                            description="Teslim, katalog, kitapçık ve arşiv hazırlık seviyesi"
                            items={analytics.documentationMetrics}
                            total={analytics.total}
                            color={AUDIT_COLORS.teal}
                            emptyText="Dokümantasyon hazırlık verisi bulunmuyor."
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <CompactDistributionPanel
                            title="Kök Neden ve Metot Kullanımı"
                            description="Kök neden disiplinlerinin dağılımı"
                            items={analytics.rootCauseMethods}
                            total={analytics.total}
                            color={AUDIT_COLORS.violet}
                            emptyText="Kök neden metodu girilmiş kayıt yok."
                        />

                        <CompactDistributionPanel
                            title="Önerilen DF / MDI / 8D"
                            description="Vakalara önerilen yönetim yöntemlerinin dağılımı"
                            items={analytics.workflowDistribution}
                            total={analytics.total}
                            color={AUDIT_COLORS.amber}
                            emptyText="Henüz yöntem önerisi üretilen kayıt yok."
                        />
                    </div>

                    <div className="rounded-2xl border bg-slate-50/70 p-5">
                        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Garanti Dağılımı</div>
                                <div className="mt-1 text-xs text-slate-500">Garanti görünürlüğünü hem oran hem adet bazında izleyin.</div>
                            </div>
                            <div className="text-xs text-slate-500">Toplam {analytics.total} vaka</div>
                        </div>
                        {analytics.warrantyPieData.length === 0 ? (
                            <EmptyState text="Garanti bilgisi işlenmiş kayıt yok." />
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6 items-center">
                                <div className="h-[260px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={analytics.warrantyPieData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={62}
                                                outerRadius={94}
                                                paddingAngle={3}
                                                stroke="none"
                                            >
                                                {analytics.warrantyPieData.map((entry, index) => (
                                                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value, name) => [`${value} vaka`, name]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-3">
                                    {warrantyLegend.map((item) => (
                                        <div key={item.name} className="rounded-xl border bg-white p-4 shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className="h-3.5 w-3.5 rounded-full"
                                                        style={{ backgroundColor: item.color }}
                                                    />
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-800">{item.name}</div>
                                                        <div className="text-xs text-slate-500">%{item.percent} oran</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                                            </div>
                                            <div className="mt-3">
                                                <Progress
                                                    value={item.value > 0 ? Math.max(item.percent, 8) : 0}
                                                    className="h-2.5 bg-slate-100"
                                                    indicatorStyle={{ backgroundColor: item.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>En Yoğun Müşteriler</CardTitle>
                    <CardDescription>Müşteri bazında satış sonrası yük, tekrar oranı ve ortalama çözüm süresi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {analytics.topCustomers.length === 0 ? (
                        <EmptyState text="Müşteri verisi bulunmuyor." />
                    ) : (
                        analytics.topCustomers.map((customer) => (
                            <div key={customer.name} className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                    <div className="font-medium">{customer.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {customer.repeated} tekrarlı vaka • Ort. {customer.avgResolution} gün
                                    </div>
                                </div>
                                <Badge variant="outline">{customer.total}</Badge>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {ncCreateState.complaint && (
                <CreateNCFromComplaintModal
                    open={ncCreateState.open}
                    setOpen={handleNcModalOpenChange}
                    complaint={ncCreateState.complaint}
                    preferredType={ncCreateState.preferredType}
                    onSuccess={handleNcCreateSuccess}
                />
            )}

            <NCViewModal
                isOpen={ncViewState.open}
                setIsOpen={handleNcViewOpenChange}
                record={ncViewState.record}
                onEdit={() => {}}
                onDownloadPDF={() => {}}
            />
        </div>
    );
};

export default ComplaintAnalytics;
