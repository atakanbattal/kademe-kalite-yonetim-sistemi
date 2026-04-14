import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    BarChart3,
    Boxes,
    CheckCircle2,
    Clock,
    FileText,
    Filter,
    Globe,
    GitBranch,
    Headphones,
    PackageOpen,
    Repeat,
    Search,
    User,
    Wrench,
} from 'lucide-react';

import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ComplaintFormModal from '@/components/customer-complaints/ComplaintFormModal';
import ComplaintDetailModal from '@/components/customer-complaints/ComplaintDetailModal';
import ComplaintAnalytics from '@/components/customer-complaints/ComplaintAnalytics';
import ComplaintSLADashboard from '@/components/customer-complaints/ComplaintSLADashboard';
import ServiceOperationsPlannerTab from '@/components/customer-complaints/ServiceOperationsPlannerTab';
import AfterSalesMethodTrackingTab from '@/components/customer-complaints/AfterSalesMethodTrackingTab';
import VehicleFileArchiveTab from '@/components/customer-complaints/VehicleFileArchiveTab';
import ProductBomManagerTab from '@/components/customer-complaints/ProductBomManagerTab';
import SSHDepotTab from '@/components/customer-complaints/SSHDepotTab';
import HelpDeskTab from '@/components/customer-complaints/HelpDeskTab';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeTurkishForSearch } from '@/lib/utils';
import {
    CASE_TYPE_OPTIONS,
    calculateResolutionDays,
    getAssignedPersonName,
    getCaseTypeLabel,
    getComplaintIdsForNCRecord,
    getComplaintDisplayStatus,
    getCustomerDisplayName,
    getFaultPartsFromComplaint,
    getIssueLabel,
    getVehicleDisplayLabel,
    recommendWorkflowForComplaint,
} from '@/components/customer-complaints/afterSalesConfig';

const SEVERITY_COLORS = {
    Kritik: 'destructive',
    Yüksek: 'warning',
    Orta: 'default',
    Düşük: 'secondary',
};

const STATUS_COLORS = {
    Açık: 'destructive',
    'Analiz Aşamasında': 'warning',
    'Aksiyon Alınıyor': 'default',
    'Doğrulama Bekleniyor': 'secondary',
    Kapalı: 'success',
    İptal: 'outline',
};

const METHOD_COLORS = {
    DF: 'default',
    MDI: 'warning',
    '8D': 'destructive',
};

const LINKED_NC_SELECT = 'id, type, status, nc_number, mdi_no, title, description, created_at';

const STAT_THEME = {
    blue: {
        value: 'text-blue-600',
        icon: 'bg-blue-100 text-blue-600',
    },
    amber: {
        value: 'text-amber-600',
        icon: 'bg-amber-100 text-amber-600',
    },
    emerald: {
        value: 'text-emerald-600',
        icon: 'bg-emerald-100 text-emerald-600',
    },
    purple: {
        value: 'text-purple-600',
        icon: 'bg-purple-100 text-purple-600',
    },
    rose: {
        value: 'text-rose-600',
        icon: 'bg-rose-100 text-rose-600',
    },
};

const StatCard = ({ title, value, icon: Icon, color = 'blue', helper }) => {
    const theme = STAT_THEME[color] || STAT_THEME.blue;

    return (
        <Card className="overflow-hidden">
            <CardContent className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                        <p className="text-[13px] font-medium leading-5 text-muted-foreground">{title}</p>
                        <div className={`text-2xl font-bold leading-none ${theme.value}`}>{value}</div>
                        {helper && <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{helper}</p>}
                    </div>
                    <div className={`rounded-full p-2.5 ${theme.icon}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const ActionInsightCard = ({ title, value, helper, badgeLabel, badgeVariant = 'outline' }) => (
    <Card className="border-dashed">
        <CardContent className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-5 text-muted-foreground">{title}</div>
                    <div className="mt-1.5 text-2xl font-bold leading-none text-foreground">{value}</div>
                    <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{helper}</div>
                </div>
                {badgeLabel && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
            </div>
        </CardContent>
    </Card>
);

const AfterSalesFilters = ({
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filterSeverity,
    setFilterSeverity,
    filterCustomer,
    setFilterCustomer,
    filterCaseType,
    setFilterCaseType,
    filterDateStart,
    setFilterDateStart,
    filterDateEnd,
    setFilterDateEnd,
    customers,
    onReset,
}) => {
    const hasActiveFilters =
        searchTerm ||
        filterStatus !== 'all' ||
        filterSeverity !== 'all' ||
        filterCustomer !== 'all' ||
        filterCaseType !== 'all' ||
        filterDateStart ||
        filterDateEnd;

    return (
        <Card className="mb-5">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        <CardTitle className="text-lg">Filtreler</CardTitle>
                    </div>

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={onReset}>
                            Filtreleri Temizle
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-[1.35fr_0.95fr_0.95fr]">
                    <div>
                        <div className="relative flex h-11 items-center rounded-xl border bg-background">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="h-full w-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Müşteri, araç, parça..."
                            />
                        </div>
                    </div>

                    <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm Müşteriler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Müşteriler</SelectItem>
                            {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {getCustomerDisplayName(customer)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm Durumlar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            {Object.keys(STATUS_COLORS).map((status) => (
                                <SelectItem key={status} value={status}>
                                    {status}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Accordion type="single" collapsible className="mt-4 rounded-xl border px-4">
                    <AccordionItem value="advanced" className="border-b-0">
                        <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                            Detay Filtreler
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <Select value={filterCaseType} onValueChange={setFilterCaseType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm Vaka Tipleri" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Vaka Tipleri</SelectItem>
                                        {CASE_TYPE_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm Öncelikler" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tüm Öncelikler</SelectItem>
                                        {Object.keys(SEVERITY_COLORS).map((severity) => (
                                            <SelectItem key={severity} value={severity}>
                                                {severity}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Input
                                    type="date"
                                    value={filterDateStart}
                                    onChange={(event) => setFilterDateStart(event.target.value)}
                                />

                                <Input
                                    type="date"
                                    value={filterDateEnd}
                                    onChange={(event) => setFilterDateEnd(event.target.value)}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};

const AfterSalesCaseList = ({
    complaints,
    loading,
    onViewComplaint,
    hasActiveFilters,
    linkedMethodsByComplaint,
}) => {
    const filteredComplaints = complaints;

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Satış sonrası kayıtlar yükleniyor...
                </CardContent>
            </Card>
        );
    }

    if (filteredComplaints.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    {hasActiveFilters
                        ? 'Filtrelere uygun satış sonrası vaka bulunamadı.'
                        : 'Henüz satış sonrası vaka kaydı bulunmuyor.'}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="data-table document-module-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Vaka No</th>
                                <th>Müşteri</th>
                                <th>Problem / Vaka</th>
                                <th>Araç</th>
                                <th>Parça Kodu</th>
                                <th>Tip</th>
                                <th>Garanti</th>
                                <th>Tekrar Durumu</th>
                                <th>Yöntem / Entegrasyon</th>
                                <th>Durum</th>
                                <th>Açık Süre</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredComplaints.map((record, index) => {
                                const displayStatus = getComplaintDisplayStatus(record);
                                const faultParts = getFaultPartsFromComplaint(record);
                                const partCodes = faultParts
                                    .map((part) => part.part_code)
                                    .filter(Boolean)
                                    .join(', ');
                                const repeatCount = Number(record.repeat_failure_count || 0);
                                const repeatLabel = repeatCount >= 2 ? 'Tekrarlı' : repeatCount === 1 ? 'İkinci Kayıt' : 'İlk Kayıt';
                                const linkedMethods = linkedMethodsByComplaint[record.id] || [];
                                const suggestedMethod = recommendWorkflowForComplaint(record).type;

                                return (
                                    <tr
                                        key={record.id}
                                        onClick={() => onViewComplaint(record)}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                        <td>{index + 1}</td>
                                        <td className="font-mono text-sm font-medium">
                                            {record.complaint_number || record.id.slice(0, 8)}
                                        </td>
                                        <td>
                                            <div className="space-y-0.5">
                                                <div className="font-medium">{getCustomerDisplayName(record.customer)}</div>
                                                {record.customer?.customer_code && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {record.customer.customer_code}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="max-w-sm">
                                                <div className="font-medium truncate">{getIssueLabel(record)}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {record.complaint_category || record.complaint_source || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-0.5 text-sm">
                                                <div>{getVehicleDisplayLabel(record) !== '-' ? getVehicleDisplayLabel(record) : (record.product_name || '-')}</div>
                                                <div className="text-xs text-muted-foreground font-mono">
                                                    {record.vehicle_serial_number || record.vehicle_chassis_number || record.product_code || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="max-w-[160px] space-y-1">
                                                <div className="font-mono text-xs font-medium truncate" title={partCodes || '-'}>
                                                    {partCodes || '-'}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate" title={faultParts.map((part) => part.part_name).filter(Boolean).join(', ') || '-'}>
                                                    {faultParts.map((part) => part.part_name).filter(Boolean).join(', ') || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                <Badge variant="outline">{getCaseTypeLabel(record)}</Badge>
                                                {record.service_location_type && (
                                                    <div className="text-xs text-muted-foreground">{record.service_location_type}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={record.warranty_status === 'Garanti İçinde' ? 'default' : 'secondary'}>
                                                {record.warranty_status || '-'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                <Badge variant={repeatCount >= 2 ? 'destructive' : repeatCount === 1 ? 'warning' : 'secondary'}>
                                                    {repeatLabel}
                                                </Badge>
                                                <div className="text-xs text-muted-foreground">
                                                    {repeatCount > 0 ? `${repeatCount} tekrar` : 'Tekrar yok'}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                {linkedMethods.length > 0 ? (
                                                    linkedMethods.slice(0, 2).map((method) => (
                                                        <div key={method.id}>
                                                            <Badge variant={METHOD_COLORS[method.type] || 'outline'}>
                                                                {method.type} • {method.status || 'Açık'}
                                                            </Badge>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {method.nc_number || method.mdi_no || method.id?.slice(0, 8)}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <>
                                                        <Badge variant={METHOD_COLORS[suggestedMethod] || 'outline'}>
                                                            Öneri: {suggestedMethod}
                                                        </Badge>
                                                        <div className="text-xs text-muted-foreground">
                                                            DF / MDI / 8D yönetimine hazır
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                <Badge variant={STATUS_COLORS[displayStatus] || 'default'}>
                                                    {displayStatus}
                                                </Badge>
                                                {record.severity && (
                                                    <div>
                                                        <Badge variant={SEVERITY_COLORS[record.severity] || 'outline'}>
                                                            {record.severity}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`text-sm ${calculateResolutionDays(record) > 30 ? 'text-red-600 font-semibold' : ''}`}>
                                                {calculateResolutionDays(record)} gün
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t bg-muted/50 text-sm text-muted-foreground">
                    Toplam {filteredComplaints.length} satış sonrası vaka gösteriliyor.
                </div>
            </CardContent>
        </Card>
    );
};

const CustomerComplaintsModule = () => {
    const { customerComplaints, customers, loading, refreshCustomerComplaints, refreshCustomers } = useData();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [editingComplaint, setEditingComplaint] = useState(null);
    const [viewingComplaint, setViewingComplaint] = useState(null);
    const [helpDeskPrefill, setHelpDeskPrefill] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [filterCustomer, setFilterCustomer] = useState('all');
    const [filterCaseType, setFilterCaseType] = useState('all');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [activeTab, setActiveTab] = useState('helpdesk');
    const [resourceTab, setResourceTab] = useState('archive');
    const [linkedMethodsByComplaint, setLinkedMethodsByComplaint] = useState({});

    useEffect(() => {
        let isMounted = true;

        const loadLinkedMethods = async () => {
            const complaintIds = (customerComplaints || []).map((record) => record.id).filter(Boolean);
            const complaintIdsByRelatedNc = (customerComplaints || []).reduce((acc, record) => {
                if (!record.related_nc_id) return acc;
                acc[record.related_nc_id] = [...(acc[record.related_nc_id] || []), record.id];
                return acc;
            }, {});
            if (complaintIds.length === 0) {
                if (isMounted) setLinkedMethodsByComplaint({});
                return;
            }

            const sourceMethodsResult = await supabase
                .from('non_conformities')
                .select(LINKED_NC_SELECT)
                .order('created_at', { ascending: false })
                .limit(1500);

            if (sourceMethodsResult.error) {
                console.error('Linked methods load error:', sourceMethodsResult.error);
                if (isMounted) setLinkedMethodsByComplaint({});
                return;
            }

            const grouped = (sourceMethodsResult.data || []).reduce((acc, method) => {
                const matchedComplaintIds = getComplaintIdsForNCRecord(
                    method,
                    customerComplaints || [],
                    complaintIdsByRelatedNc
                );
                if (matchedComplaintIds.length === 0) return acc;

                matchedComplaintIds.forEach((complaintId) => {
                    acc[complaintId] = [
                        ...(acc[complaintId] || []),
                        {
                            ...method,
                            source_complaint_id: method.source_complaint_id || complaintId,
                        },
                    ];
                });

                return acc;
            }, {});

            Object.keys(grouped).forEach((complaintId) => {
                grouped[complaintId] = Array.from(
                    new Map((grouped[complaintId] || []).map((method) => [method.id, method])).values()
                );
            });

            if (isMounted) {
                setLinkedMethodsByComplaint(grouped);
            }
        };

        loadLinkedMethods();

        return () => {
            isMounted = false;
        };
    }, [customerComplaints]);

    const filteredComplaints = useMemo(() => {
        return customerComplaints.filter((record) => {
            if (filterCustomer !== 'all' && record.customer_id !== filterCustomer) {
                return false;
            }

            if (filterStatus !== 'all' && getComplaintDisplayStatus(record) !== filterStatus) {
                return false;
            }

            if (filterSeverity !== 'all' && record.severity !== filterSeverity) {
                return false;
            }

            if (filterCaseType !== 'all' && getCaseTypeLabel(record) !== filterCaseType) {
                return false;
            }

            if (filterDateStart) {
                const complaintDate = record.complaint_date ? new Date(record.complaint_date) : null;
                const startDate = new Date(`${filterDateStart}T00:00:00`);
                if (!complaintDate || complaintDate < startDate) {
                    return false;
                }
            }

            if (filterDateEnd) {
                const complaintDate = record.complaint_date ? new Date(record.complaint_date) : null;
                const endDate = new Date(`${filterDateEnd}T23:59:59`);
                if (!complaintDate || complaintDate > endDate) {
                    return false;
                }
            }

            if (!searchTerm) {
                return true;
            }

            const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm);
            return [
                record.complaint_number,
                record.title,
                record.description,
                record.product_name,
                record.product_code,
                record.batch_number,
                record.vehicle_type,
                record.vehicle_category,
                record.vehicle_model_code,
                record.vehicle_model,
                record.chassis_brand,
                record.chassis_model,
                record.vehicle_serial_number,
                record.vehicle_chassis_number,
                record.vehicle_plate_number,
                record.fault_part_code,
                record.fault_part_name,
                record.root_cause,
                record.solution,
                record.case_type,
                record.warranty_status,
                getCustomerDisplayName(record.customer),
                getAssignedPersonName(record),
            ].some((value) => normalizeTurkishForSearch(value).includes(normalizedSearchTerm));
        });
    }, [
        customerComplaints,
        filterCaseType,
        filterCustomer,
        filterDateEnd,
        filterDateStart,
        filterSeverity,
        filterStatus,
        searchTerm,
    ]);

    const hasActiveFilters = useMemo(
        () =>
            Boolean(
                searchTerm ||
                filterStatus !== 'all' ||
                filterSeverity !== 'all' ||
                filterCustomer !== 'all' ||
                filterCaseType !== 'all' ||
                filterDateStart ||
                filterDateEnd
            ),
        [filterCaseType, filterCustomer, filterDateEnd, filterDateStart, filterSeverity, filterStatus, searchTerm]
    );

    const periodLabel = useMemo(() => {
        const format = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('tr-TR');
        if (filterDateStart && filterDateEnd) {
            return `${format(filterDateStart)} - ${format(filterDateEnd)}`;
        }
        if (filterDateStart) {
            return `${format(filterDateStart)} sonrası`;
        }
        if (filterDateEnd) {
            return `${format(filterDateEnd)} öncesi`;
        }
        return hasActiveFilters ? 'Seçili filtreler' : '';
    }, [filterDateEnd, filterDateStart, hasActiveFilters]);

    const stats = useMemo(() => {
        const total = filteredComplaints.length;
        const open = filteredComplaints.filter((record) => !['Kapalı', 'İptal'].includes(getComplaintDisplayStatus(record))).length;
        const overseas = filteredComplaints.filter((record) => record.service_location_type === 'Yurt Dışı').length;
        const repeated = filteredComplaints.filter((record) => Number(record.repeat_failure_count) > 0).length;
        const warranty = filteredComplaints.filter((record) => record.warranty_status === 'Garanti İçinde').length;

        const closedCases = filteredComplaints.filter((record) => record.actual_close_date || record.service_completion_date);
        const avgResolutionDays =
            closedCases.length > 0
                ? Math.round(
                    closedCases.reduce((sum, record) => sum + calculateResolutionDays(record), 0) /
                      closedCases.length
                )
                : 0;

        return { total, open, overseas, repeated, warranty, avgResolutionDays };
    }, [filteredComplaints]);

    const listInsights = useMemo(() => {
        const openRecords = filteredComplaints.filter((record) => !['Kapalı', 'İptal'].includes(getComplaintDisplayStatus(record)));
        const pendingMethodCount = openRecords.filter((record) => (linkedMethodsByComplaint[record.id] || []).length === 0).length;
        const highRepeatRiskCount = openRecords.filter((record) => Number(record.repeat_failure_count || 0) >= 2).length;
        const vehicleArchiveLinkedCount = filteredComplaints.filter(
            (record) => record.vehicle_serial_number || record.vehicle_chassis_number || record.vehicle_model_code
        ).length;
        const openWarrantyCount = openRecords.filter((record) => record.warranty_status === 'Garanti İçinde').length;

        return {
            pendingMethodCount,
            highRepeatRiskCount,
            vehicleArchiveLinkedCount,
            openWarrantyCount,
        };
    }, [filteredComplaints, linkedMethodsByComplaint]);

    const openFormModal = useCallback((complaint = null) => {
        setEditingComplaint(complaint);
        setFormModalOpen(true);
    }, []);

    const closeFormModal = useCallback(() => {
        setEditingComplaint(null);
        setFormModalOpen(false);
    }, []);

    const openDetailModal = useCallback((complaint) => {
        setViewingComplaint(complaint);
        setDetailModalOpen(true);
    }, []);

    const closeDetailModal = useCallback(() => {
        setViewingComplaint(null);
        setDetailModalOpen(false);
    }, []);

    const refreshComplaintsModule = useCallback(async () => {
        await Promise.all([refreshCustomerComplaints(), refreshCustomers()]);
    }, [refreshCustomerComplaints, refreshCustomers]);

    const handleFormSuccess = useCallback(async () => {
        await refreshComplaintsModule();
        closeFormModal();
    }, [refreshComplaintsModule, closeFormModal]);

    const handleEditFromDetail = useCallback((complaint) => {
        closeDetailModal();
        openFormModal(complaint);
    }, [closeDetailModal, openFormModal]);

    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setFilterStatus('all');
        setFilterSeverity('all');
        setFilterCustomer('all');
        setFilterCaseType('all');
        setFilterDateStart('');
        setFilterDateEnd('');
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Toplam Vaka" value={stats.total} icon={PackageOpen} color="blue" helper="Toplam kayıt" />
                <StatCard title="Açık Vaka" value={stats.open} icon={AlertCircle} color="amber" helper="Aktif takip" />
                <StatCard title="Tekrar Riski" value={listInsights.highRepeatRiskCount} icon={Repeat} color="rose" helper="Öncelikli takip" />
                <StatCard title="Ort. Çözüm" value={stats.avgResolutionDays ? `${stats.avgResolutionDays} gün` : '-'} icon={Clock} color="emerald" helper="Kapanan vakalar" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    <TabsTrigger value="helpdesk">
                        <Headphones className="w-4 h-4 mr-2" />
                        Help Desk
                    </TabsTrigger>
                    <TabsTrigger value="list">
                        <PackageOpen className="w-4 h-4 mr-2" />
                        Vakalar
                    </TabsTrigger>
                    <TabsTrigger value="operations">
                        <Wrench className="w-4 h-4 mr-2" />
                        Operasyon
                    </TabsTrigger>
                    <TabsTrigger value="personnel">
                        <User className="w-4 h-4 mr-2" />
                        Personel
                    </TabsTrigger>
                    <TabsTrigger value="sla">
                        <Clock className="w-4 h-4 mr-2" />
                        Süreler
                    </TabsTrigger>
                    <TabsTrigger value="analytics">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analiz
                    </TabsTrigger>
                    <TabsTrigger value="methods">
                        <GitBranch className="w-4 h-4 mr-2" />
                        Uygunsuzluk Takibi
                    </TabsTrigger>
                    <TabsTrigger value="resources">
                        <FileText className="w-4 h-4 mr-2" />
                        Kaynaklar
                    </TabsTrigger>
                </TabsList>

                {['list', 'sla', 'analytics', 'methods'].includes(activeTab) && (
                    <AfterSalesFilters
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filterStatus={filterStatus}
                        setFilterStatus={setFilterStatus}
                        filterSeverity={filterSeverity}
                        setFilterSeverity={setFilterSeverity}
                        filterCustomer={filterCustomer}
                        setFilterCustomer={setFilterCustomer}
                        filterCaseType={filterCaseType}
                        setFilterCaseType={setFilterCaseType}
                        filterDateStart={filterDateStart}
                        setFilterDateStart={setFilterDateStart}
                        filterDateEnd={filterDateEnd}
                        setFilterDateEnd={setFilterDateEnd}
                        customers={customers}
                        onReset={resetFilters}
                    />
                )}

                <TabsContent value="helpdesk" className="mt-6">
                    <HelpDeskTab
                        onConvertToCase={(helpDeskRecord) => {
                            setHelpDeskPrefill(helpDeskRecord);
                            openFormModal(null);
                        }}
                    />
                </TabsContent>

                <TabsContent value="list" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <ActionInsightCard
                            title="Yöntem Açılmayı Bekleyen"
                            value={listInsights.pendingMethodCount}
                            helper="DF / MDI / 8D bağlantısı olmayan açık vakalar"
                            badgeLabel="Takip"
                            badgeVariant="warning"
                        />
                        <ActionInsightCard
                            title="Tekrar Riski Yüksek"
                            value={listInsights.highRepeatRiskCount}
                            helper="Tekrar sayısı kritik seviyeye yaklaşan açık kayıtlar"
                            badgeLabel="Öncelikli"
                            badgeVariant="destructive"
                        />
                        <ActionInsightCard
                            title="Arşiv ve Garanti"
                            value={listInsights.openWarrantyCount}
                            helper={`${listInsights.vehicleArchiveLinkedCount} vaka araç arşiviyle eşleşiyor`}
                            badgeLabel="Garanti"
                            badgeVariant="default"
                        />
                    </div>

                    <AfterSalesCaseList
                        complaints={filteredComplaints}
                        loading={loading}
                        onViewComplaint={openDetailModal}
                        hasActiveFilters={hasActiveFilters}
                        linkedMethodsByComplaint={linkedMethodsByComplaint}
                    />
                </TabsContent>

                <TabsContent value="operations" className="mt-6">
                    <ServiceOperationsPlannerTab panel="operations" onOperationsChanged={refreshComplaintsModule} />
                </TabsContent>

                <TabsContent value="personnel" className="mt-6">
                    <ServiceOperationsPlannerTab panel="personnel" onOperationsChanged={refreshComplaintsModule} />
                </TabsContent>

                <TabsContent value="sla" className="mt-6">
                    <ComplaintSLADashboard complaints={filteredComplaints} periodLabel={periodLabel} />
                </TabsContent>

                <TabsContent value="analytics" className="mt-6">
                    <ComplaintAnalytics
                        complaints={filteredComplaints}
                        customers={customers}
                        periodLabel={periodLabel}
                        onRefresh={refreshComplaintsModule}
                    />
                </TabsContent>

                <TabsContent value="methods" className="mt-6">
                    <AfterSalesMethodTrackingTab
                        complaints={filteredComplaints}
                        customers={customers}
                        onRefresh={refreshComplaintsModule}
                    />
                </TabsContent>

                <TabsContent value="resources" className="mt-6">
                    <Tabs value={resourceTab} onValueChange={setResourceTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-1 gap-2 md:grid-cols-3">
                            <TabsTrigger value="archive">
                                <FileText className="mr-2 h-4 w-4" />
                                Araç Arşivi
                            </TabsTrigger>
                            <TabsTrigger value="bom">
                                <Boxes className="mr-2 h-4 w-4" />
                                Ürün Ağacı
                            </TabsTrigger>
                            <TabsTrigger value="depot">
                                <PackageOpen className="mr-2 h-4 w-4" />
                                Satış Sonrası Depo
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="archive" className="mt-6">
                            <VehicleFileArchiveTab />
                        </TabsContent>

                        <TabsContent value="bom" className="mt-6">
                            <ProductBomManagerTab />
                        </TabsContent>

                        <TabsContent value="depot" className="mt-6">
                            <SSHDepotTab onDepotChanged={refreshComplaintsModule} />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>

            {isFormModalOpen && (
                <ComplaintFormModal
                    open={isFormModalOpen}
                    setOpen={(open) => {
                        setFormModalOpen(open);
                        if (!open) setHelpDeskPrefill(null);
                    }}
                    existingComplaint={editingComplaint}
                    onSuccess={async () => {
                        if (helpDeskPrefill?.id) {
                            await supabase.from('after_sales_help_desk')
                                .update({ status: 'Vakaya Dönüştürüldü' })
                                .eq('id', helpDeskPrefill.id);
                        }
                        setHelpDeskPrefill(null);
                        handleFormSuccess();
                    }}
                    helpDeskPrefill={helpDeskPrefill}
                />
            )}

            {isDetailModalOpen && viewingComplaint && (
                <ComplaintDetailModal
                    open={isDetailModalOpen}
                    setOpen={setDetailModalOpen}
                    complaint={viewingComplaint}
                    onEdit={handleEditFromDetail}
                    onRefresh={refreshComplaintsModule}
                />
            )}
        </motion.div>
    );
};

export default CustomerComplaintsModule;
