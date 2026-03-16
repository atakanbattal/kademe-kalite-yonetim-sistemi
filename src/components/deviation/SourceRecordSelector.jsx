import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertTriangle,
    Car,
    CheckCircle2,
    DollarSign,
    Droplets,
    Fan,
    FileCheck,
    MessageSquare,
    Package,
    Ruler,
    Search,
} from 'lucide-react';
import { formatCurrency, normalizeTurkishForSearch } from '@/lib/utils';
import {
    getSourceTypeDefaultDeviationType,
    getSourceTypeLabel,
} from './sourceRecordUtils';

const SOURCE_TYPES = [
    {
        id: 'incoming_inspection',
        label: 'Girdi Kontrol',
        searchPlaceholder: 'Parça kodu, parça adı, kayıt no veya tedarikçi ile ara...',
        emptyText: 'Şartlı kabul veya red edilmiş girdi kontrol kaydı bulunamadı.',
        icon: Package,
    },
    {
        id: 'quarantine',
        label: 'Karantina',
        searchPlaceholder: 'Parça kodu, lot no, departman veya açıklama ile ara...',
        emptyText: 'Karantinada bekleyen kayıt bulunamadı.',
        icon: AlertTriangle,
    },
    {
        id: 'quality_cost',
        label: 'Kalite Maliyeti',
        searchPlaceholder: 'Parça kodu, maliyet türü, birim veya tedarikçi ile ara...',
        emptyText: 'Kalite maliyeti kaydı bulunamadı.',
        icon: DollarSign,
    },
    {
        id: 'leak_test',
        label: 'Sızdırmazlık',
        searchPlaceholder: 'Kayıt no, araç tipi, seri no, sızdırmazlık parçası veya personel ile ara...',
        emptyText: 'Sapmaya aday kaçaklı sızdırmazlık kaydı bulunamadı.',
        icon: Droplets,
    },
    {
        id: 'dynamic_balance',
        label: 'Dinamik Balans',
        searchPlaceholder: 'Seri no, ürün, tedarikçi veya operatör ile ara...',
        emptyText: 'Sapmaya aday başarısız dinamik balans kaydı bulunamadı.',
        icon: Fan,
    },
    {
        id: 'produced_vehicle_fault',
        label: 'Araç Hataları',
        searchPlaceholder: 'Araç tipi, seri no, şasi, departman veya hata açıklaması ile ara...',
        emptyText: 'Açık araç kalite hatası bulunamadı.',
        icon: Car,
    },
    {
        id: 'customer_complaint',
        label: 'Müşteri Şikayetleri',
        searchPlaceholder: 'Şikayet no, müşteri, başlık, ürün veya durum ile ara...',
        emptyText: 'Açık müşteri şikayeti kaydı bulunamadı.',
        icon: MessageSquare,
    },
    {
        id: 'fixture_nonconformity',
        label: 'Fikstür Uygunsuzlukları',
        searchPlaceholder: 'Fikstür no, parça, departman veya durum ile ara...',
        emptyText: 'Açık fikstür uygunsuzluğu bulunamadı.',
        icon: Ruler,
    },
];

const SOURCE_TYPE_IDS = SOURCE_TYPES.map((source) => source.id);

const getSupportedSourceType = (sourceType) =>
    SOURCE_TYPE_IDS.includes(sourceType) ? sourceType : SOURCE_TYPES[0].id;

const normalizeValue = (value) => normalizeTurkishForSearch(String(value || ''));

const formatDateOnly = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString('tr-TR');
};

const loadSourceRecords = async (sourceType, sourceId = null) => {
    switch (sourceType) {
        case 'incoming_inspection': {
            let query = supabase
                .from('incoming_inspections')
                .select(`
                    *,
                    supplier:suppliers(name),
                    defects:incoming_inspection_defects(defect_description, quantity, part_code, part_name),
                    results:incoming_inspection_results(*)
                `);

            if (sourceId) {
                return query.eq('id', sourceId).single();
            }

            return query
                .in('decision', ['Şartlı Kabul', 'Red'])
                .order('inspection_date', { ascending: false })
                .limit(100);
        }
        case 'quarantine': {
            let query = supabase.from('quarantine_records').select('*');
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .in('status', ['Karantinada', 'Beklemede'])
                .order('created_at', { ascending: false })
                .limit(100);
        }
        case 'quality_cost': {
            let query = supabase
                .from('quality_costs')
                .select('*, responsible_personnel:personnel!responsible_personnel_id(full_name), supplier:suppliers!supplier_id(name)');
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .order('cost_date', { ascending: false })
                .limit(100);
        }
        case 'leak_test': {
            let query = supabase.from('leak_test_records').select('*');
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .eq('test_result', 'Kaçak Var')
                .order('test_date', { ascending: false })
                .limit(100);
        }
        case 'dynamic_balance': {
            let query = supabase
                .from('fan_balance_records')
                .select('*, fan_products(product_code, product_name)');
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .eq('overall_result', 'FAIL')
                .order('test_date', { ascending: false })
                .limit(100);
        }
        case 'produced_vehicle_fault': {
            let query = supabase
                .from('quality_inspection_faults')
                .select(`
                    *,
                    department:production_departments(name),
                    category:fault_categories(name),
                    inspection:quality_inspections(vehicle_type, serial_no, chassis_no, customer_name)
                `);
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .or('is_resolved.is.null,is_resolved.eq.false')
                .order('fault_date', { ascending: false })
                .limit(100);
        }
        case 'customer_complaint': {
            let query = supabase
                .from('customer_complaints')
                .select(`
                    *,
                    customer:customers(customer_name, customer_code),
                    responsible_person:personnel!responsible_personnel_id(full_name)
                `);
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .in('status', ['Açık', 'İnceleniyor', 'Analiz Aşamasında', 'Aksiyon Alınıyor', 'Doğrulama Bekleniyor'])
                .order('complaint_date', { ascending: false })
                .limit(100);
        }
        case 'fixture_nonconformity': {
            let query = supabase
                .from('fixture_nonconformities')
                .select(`
                    *,
                    fixture:fixtures(fixture_no, part_code, part_name, responsible_department)
                `);
            if (sourceId) {
                return query.eq('id', sourceId).single();
            }
            return query
                .in('correction_status', ['Beklemede', 'İşlemde'])
                .order('detection_date', { ascending: false })
                .limit(100);
        }
        default:
            return { data: sourceId ? null : [], error: null };
    }
};

const filterRecordBySearch = (record, sourceType, searchTerm) => {
    if (!searchTerm) return true;

    const normalizedSearch = normalizeValue(searchTerm);

    switch (sourceType) {
        case 'incoming_inspection':
            return [
                record.part_code,
                record.part_name,
                record.supplier_name,
                record.supplier?.name,
                record.record_no,
                record.delivery_note_number,
                record.description,
                record.notes,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'quarantine':
            return [
                record.part_code,
                record.part_name,
                record.lot_no,
                record.description,
                record.source_department,
                record.requesting_department,
                record.requesting_person_name,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'quality_cost':
            return [
                record.part_code,
                record.cost_type,
                record.unit,
                record.supplier?.name,
                record.responsible_personnel?.full_name,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'leak_test':
            return [
                record.record_number,
                record.vehicle_type_label,
                record.vehicle_serial_number,
                record.tank_type,
                record.tester_name,
                record.welder_name,
                record.notes,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'dynamic_balance':
            return [
                record.serial_number,
                record.supplier_name,
                record.test_operator,
                record.overall_result,
                record.fan_products?.product_code,
                record.fan_products?.product_name,
                record.notes,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'produced_vehicle_fault':
            return [
                record.description,
                record.department?.name,
                record.category?.name,
                record.inspection?.vehicle_type,
                record.inspection?.serial_no,
                record.inspection?.chassis_no,
                record.inspection?.customer_name,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'customer_complaint':
            return [
                record.complaint_number,
                record.title,
                record.description,
                record.customer?.customer_name,
                record.product_name,
                record.status,
                record.severity,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        case 'fixture_nonconformity':
            return [
                record.fixture?.fixture_no,
                record.fixture?.part_code,
                record.fixture?.part_name,
                record.fixture?.responsible_department,
                record.correction_status,
                record.correction_description,
            ].some((value) => normalizeValue(value).includes(normalizedSearch));
        default:
            return true;
    }
};

const getRecordStatusBadge = (record, sourceType) => {
    const getBadge = (status, variant = 'default', Icon = Package) => (
        <Badge variant={variant} className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {status}
        </Badge>
    );

    switch (sourceType) {
        case 'incoming_inspection':
            return getBadge(record.decision, record.decision === 'Red' ? 'destructive' : 'warning', AlertTriangle);
        case 'quarantine':
            return getBadge(record.status, record.status === 'Karantinada' ? 'warning' : 'secondary', AlertTriangle);
        case 'quality_cost':
            return <Badge variant="default">{formatCurrency(record.amount)}</Badge>;
        case 'leak_test':
            return getBadge(record.test_result || 'Kaçak Var', 'destructive', Droplets);
        case 'dynamic_balance':
            return getBadge(record.overall_result || 'FAIL', record.overall_result === 'PASS' ? 'success' : 'destructive', record.overall_result === 'PASS' ? CheckCircle2 : AlertTriangle);
        case 'produced_vehicle_fault':
            return getBadge(record.is_resolved ? 'Çözüldü' : 'Açık Hata', record.is_resolved ? 'success' : 'destructive', record.is_resolved ? CheckCircle2 : AlertTriangle);
        case 'customer_complaint':
            return getBadge(record.status || 'Açık', ['Açık', 'İnceleniyor'].includes(record.status) ? 'destructive' : 'warning', MessageSquare);
        case 'fixture_nonconformity':
            return getBadge(record.correction_status || 'Beklemede', record.correction_status === 'İşlemde' ? 'default' : 'warning', Ruler);
        default:
            return null;
    }
};

const getRecordTitle = (record, sourceType) => {
    switch (sourceType) {
        case 'incoming_inspection':
            return record.part_code || '-';
        case 'quarantine':
            return record.part_code || '-';
        case 'quality_cost':
            return record.part_code || 'Genel Maliyet';
        case 'leak_test':
            return record.record_number || '-';
        case 'dynamic_balance':
            return record.serial_number || '-';
        case 'produced_vehicle_fault':
            return record.inspection?.serial_no || record.inspection?.chassis_no || 'Araç Hatası';
        case 'customer_complaint':
            return record.complaint_number || '-';
        case 'fixture_nonconformity':
            return record.fixture?.fixture_no || '-';
        default:
            return '-';
    }
};

const getRecordSubtitle = (record, sourceType) => {
    switch (sourceType) {
        case 'incoming_inspection':
            return record.part_name || '-';
        case 'quarantine':
            return record.part_name || '-';
        case 'quality_cost':
            return record.cost_type || '-';
        case 'leak_test':
            return [record.vehicle_type_label, record.vehicle_serial_number].filter(Boolean).join(' • ') || '-';
        case 'dynamic_balance':
            return record.fan_products?.product_name || record.fan_products?.product_code || '-';
        case 'produced_vehicle_fault':
            return record.description || '-';
        case 'customer_complaint':
            return record.title || '-';
        case 'fixture_nonconformity':
            return record.fixture?.part_name || '-';
        default:
            return '-';
    }
};

const getRecordMetaFields = (record, sourceType) => {
    switch (sourceType) {
        case 'incoming_inspection':
            return [
                { label: 'Kayıt No', value: record.record_no || '-' },
                { label: 'Tedarikçi', value: record.supplier_name || record.supplier?.name || 'Tedarikçi yok' },
                { label: 'Red Edilen', value: record.quantity_rejected || 0 },
                { label: 'Tarih', value: formatDateOnly(record.inspection_date) },
            ];
        case 'quarantine':
            return [
                { label: 'Lot No', value: record.lot_no || '-' },
                { label: 'Miktar', value: `${record.quantity || 0} ${record.unit || 'Adet'}` },
                { label: 'Kaynak Birim', value: record.source_department || '-' },
                { label: 'Tarih', value: formatDateOnly(record.quarantine_date || record.created_at) },
            ];
        case 'quality_cost':
            return [
                { label: 'Maliyet Türü', value: record.cost_type || '-' },
                { label: 'Birim', value: record.unit || '-' },
                { label: 'Tedarikçi', value: record.supplier?.name || '-' },
                { label: 'Tarih', value: formatDateOnly(record.cost_date) },
            ];
        case 'leak_test':
            return [
                { label: 'Araç Tipi', value: record.vehicle_type_label || '-' },
                { label: 'Seri No', value: record.vehicle_serial_number || '-' },
                { label: 'Sızdırmazlık Parçası', value: record.tank_type || '-' },
                { label: 'Kaçak', value: `${record.leak_count || 0} adet` },
            ];
        case 'dynamic_balance':
            return [
                { label: 'Ürün', value: record.fan_products?.product_name || record.fan_products?.product_code || '-' },
                { label: 'Tedarikçi', value: record.supplier_name || '-' },
                { label: 'Operatör', value: record.test_operator || '-' },
                { label: 'Test Tarihi', value: formatDateOnly(record.test_date) },
            ];
        case 'produced_vehicle_fault':
            return [
                { label: 'Araç Tipi', value: record.inspection?.vehicle_type || '-' },
                { label: 'Şasi No', value: record.inspection?.chassis_no || '-' },
                { label: 'Departman', value: record.department?.name || '-' },
                { label: 'Miktar', value: `${record.quantity || 1} adet` },
            ];
        case 'customer_complaint':
            return [
                { label: 'Müşteri', value: record.customer?.customer_name || '-' },
                { label: 'Ürün', value: record.product_name || '-' },
                { label: 'Önem', value: record.severity || '-' },
                { label: 'Tarih', value: formatDateOnly(record.complaint_date) },
            ];
        case 'fixture_nonconformity':
            return [
                { label: 'Parça Kodu', value: record.fixture?.part_code || '-' },
                { label: 'Parça Adı', value: record.fixture?.part_name || '-' },
                { label: 'Departman', value: record.fixture?.responsible_department || '-' },
                { label: 'Tespit', value: formatDateOnly(record.detection_date) },
            ];
        default:
            return [];
    }
};

const buildAutoFillData = (record, sourceType) => {
    switch (sourceType) {
        case 'incoming_inspection':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                part_code: record.part_code || '',
                source_record_details: {
                    source_type: sourceType,
                    part_code: record.part_code,
                    part_name: record.part_name,
                    quantity: record.quantity || record.quantity_rejected || record.affected_quantity || record.non_conforming_qty,
                    supplier: record.supplier_name || record.supplier?.name,
                    record_no: record.record_no,
                    inspection_number: record.record_no,
                    decision: record.decision,
                    quantity_rejected: record.quantity_rejected,
                    quantity_conditional: record.quantity_conditional,
                    defects: record.defects || [],
                    results: record.results || [],
                    description: record.description,
                    notes: record.notes,
                    delivery_note_number: record.delivery_note_number,
                    inspection_date: record.inspection_date,
                    quantity_received: record.quantity_received,
                    quantity_inspected: record.quantity_inspected,
                },
            };
        case 'quarantine':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                part_code: record.part_code || '',
                source_record_details: {
                    source_type: sourceType,
                    part_code: record.part_code,
                    part_name: record.part_name,
                    quantity: record.quantity || record.affected_quantity,
                    supplier: record.supplier_name || record.supplier?.name,
                    lot_no: record.lot_no,
                    quarantine_number: record.lot_no,
                    description: record.description,
                    source_department: record.source_department,
                    requesting_department: record.requesting_department,
                    requesting_person_name: record.requesting_person_name,
                    decision: record.decision,
                },
            };
        case 'quality_cost':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                part_code: record.part_code || '',
                source_record_details: {
                    source_type: sourceType,
                    part_code: record.part_code,
                    quantity: record.quantity || record.non_conforming_qty,
                    supplier: record.supplier?.name,
                    cost_type: record.cost_type,
                    amount: record.amount,
                    unit: record.unit,
                },
            };
        case 'leak_test':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                vehicle_type: record.vehicle_type_label || '',
                part_code: record.record_number || '',
                source_record_details: {
                    source_type: sourceType,
                    record_number: record.record_number,
                    vehicle_type_label: record.vehicle_type_label,
                    vehicle_serial_number: record.vehicle_serial_number,
                    tank_type: record.tank_type,
                    test_date: record.test_date,
                    test_start_time: record.test_start_time,
                    test_duration_minutes: record.test_duration_minutes,
                    test_result: record.test_result,
                    leak_count: record.leak_count,
                    tester_name: record.tester_name,
                    welder_name: record.welder_name,
                    notes: record.notes,
                },
            };
        case 'dynamic_balance':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                part_code: record.fan_products?.product_name || record.fan_products?.product_code || '',
                source_record_details: {
                    source_type: sourceType,
                    serial_number: record.serial_number,
                    product_code: record.fan_products?.product_code,
                    product_name: record.fan_products?.product_name,
                    test_date: record.test_date,
                    supplier_name: record.supplier_name,
                    test_operator: record.test_operator,
                    overall_result: record.overall_result,
                    left_plane_result: record.left_plane_result,
                    right_plane_result: record.right_plane_result,
                    balancing_grade: record.balancing_grade,
                    fan_weight_kg: record.fan_weight_kg,
                    operating_rpm: record.operating_rpm,
                    notes: record.notes,
                },
            };
        case 'produced_vehicle_fault':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                vehicle_type: record.inspection?.vehicle_type || '',
                part_code: record.category?.name || '',
                source_record_details: {
                    source_type: sourceType,
                    vehicle_type: record.inspection?.vehicle_type,
                    vehicle_serial_number: record.inspection?.serial_no,
                    chassis_no: record.inspection?.chassis_no,
                    customer_name: record.inspection?.customer_name,
                    department_name: record.department?.name,
                    category_name: record.category?.name,
                    fault_description: record.description,
                    fault_quantity: record.quantity,
                    fault_date: record.fault_date || record.created_at,
                    arge_approved: record.arge_approved,
                    created_at: record.created_at,
                },
            };
        case 'customer_complaint':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                part_code: record.product_name || '',
                source_record_details: {
                    source_type: sourceType,
                    complaint_number: record.complaint_number,
                    customer_name: record.customer?.customer_name,
                    title: record.title,
                    description: record.description,
                    product_name: record.product_name,
                    quantity_affected: record.quantity_affected,
                    complaint_date: record.complaint_date,
                    severity: record.severity,
                    status: record.status,
                },
            };
        case 'fixture_nonconformity':
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source: getSourceTypeLabel(sourceType),
                deviation_type: getSourceTypeDefaultDeviationType(sourceType),
                part_code: record.fixture?.part_code || '',
                source_record_details: {
                    source_type: sourceType,
                    fixture_no: record.fixture?.fixture_no,
                    part_code: record.fixture?.part_code,
                    part_name: record.fixture?.part_name,
                    responsible_department: record.fixture?.responsible_department,
                    detection_date: record.detection_date,
                    correction_status: record.correction_status,
                    deviation_details: record.deviation_details || [],
                    correction_description: record.correction_description,
                },
            };
        default:
            return {
                source_type: sourceType,
                source_record_id: record.id,
                source_record_details: {
                    source_type: sourceType,
                },
            };
    }
};

const SourceRecordSelector = ({ onSelect, initialSourceType, initialSourceId }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState(getSupportedSourceType(initialSourceType));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const tabsScrollRef = useRef(null);
    const [recordsBySource, setRecordsBySource] = useState(() =>
        Object.fromEntries(SOURCE_TYPE_IDS.map((sourceType) => [sourceType, []]))
    );
    const [deviationMap, setDeviationMap] = useState({});

    const activeSourceConfig = SOURCE_TYPES.find((source) => source.id === activeTab) || SOURCE_TYPES[0];

    useEffect(() => {
        loadDeviationMap();
    }, []);

    useEffect(() => {
        loadRecords(activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (initialSourceType && initialSourceId) {
            const sourceType = getSupportedSourceType(initialSourceType);
            setActiveTab(sourceType);
            loadInitialRecord(sourceType, initialSourceId);
        }
    }, [initialSourceType, initialSourceId]);

    const loadDeviationMap = async () => {
        try {
            const { data, error } = await supabase
                .from('deviations')
                .select('id, request_no, source_type, source_record_id')
                .not('source_record_id', 'is', null);

            if (error) throw error;

            const map = {};
            (data || []).forEach((deviation) => {
                if (deviation.source_type && deviation.source_record_id) {
                    map[`${deviation.source_type}_${deviation.source_record_id}`] = {
                        id: deviation.id,
                        request_no: deviation.request_no,
                    };
                }
            });

            setDeviationMap(map);
        } catch (error) {
            console.error('Sapma kayıtları yüklenemedi:', error);
        }
    };

    const loadInitialRecord = async (sourceType, sourceId) => {
        try {
            const { data, error } = await loadSourceRecords(sourceType, sourceId);
            if (error) throw error;

            if (data) {
                handleSelectRecord(data, sourceType);
            }
        } catch (error) {
            console.error('İlk kaynak kayıt yüklenemedi:', error);
        }
    };

    const loadRecords = async (sourceType) => {
        setLoading(true);
        try {
            const { data, error } = await loadSourceRecords(sourceType);
            if (error) throw error;

            setRecordsBySource((prev) => ({
                ...prev,
                [sourceType]: data || [],
            }));
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Kayıtlar yüklenemedi: ${error.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = useMemo(() => {
        const records = recordsBySource[activeTab] || [];
        return records.filter((record) => filterRecordBySearch(record, activeTab, searchTerm));
    }, [activeTab, recordsBySource, searchTerm]);

    const hasDeviation = (record, sourceType) => {
        if (!record?.id || !sourceType) return null;
        return deviationMap[`${sourceType}_${record.id}`] || null;
    };

    const handleSelectRecord = (record, sourceType) => {
        const enrichedRecord = { ...record, _source_type: sourceType };
        const autoFillData = buildAutoFillData(record, sourceType);
        setSelectedRecord(enrichedRecord);

        if (onSelect) {
            onSelect(autoFillData, enrichedRecord);
        }
    };

    const renderSelectedSummary = (record) => {
        const sourceType = record?._source_type;
        const summaryFields = getRecordMetaFields(record, sourceType);

        return (
            <div className="grid min-w-0 grid-cols-1 gap-2 text-sm md:grid-cols-2">
                <div className="min-w-0 break-words"><strong>Kaynak:</strong> {getSourceTypeLabel(sourceType)}</div>
                <div className="min-w-0 break-words"><strong>Ana Referans:</strong> {getRecordTitle(record, sourceType)}</div>
                {summaryFields.map((field) => (
                    <div key={`${field.label}-${field.value}`} className="min-w-0 break-words">
                        <strong>{field.label}:</strong> {field.value || '-'}
                    </div>
                ))}

                {sourceType === 'incoming_inspection' && Array.isArray(record.defects) && record.defects.length > 0 && (
                    <div className="min-w-0 break-words md:col-span-2">
                        <strong>Hatalar:</strong>
                        <ul className="list-disc list-inside mt-1">
                            {record.defects.map((defect, idx) => (
                                <li key={`${defect.defect_description}-${idx}`} className="text-xs">
                                    {defect.defect_description} (Miktar: {defect.quantity})
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {sourceType === 'fixture_nonconformity' && Array.isArray(record.deviation_details) && record.deviation_details.length > 0 && (
                    <div className="min-w-0 break-words md:col-span-2">
                        <strong>Uygunsuzluk Detayları:</strong>
                        <ul className="list-disc list-inside mt-1">
                            {record.deviation_details.slice(0, 4).map((detail, idx) => (
                                <li key={`${detail.characteristic}-${idx}`} className="text-xs">
                                    {detail.characteristic}: {detail.deviation}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {sourceType === 'customer_complaint' && record.description && (
                    <div className="min-w-0 break-words md:col-span-2">
                        <strong>Açıklama:</strong> {record.description}
                    </div>
                )}
            </div>
        );
    };

    const renderRecordFooter = (record, sourceType) => {
        if (sourceType === 'incoming_inspection') {
            return (
                <>
                    {Array.isArray(record.defects) && record.defects.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                            <div className="text-xs font-semibold mb-1">Hata Detayları:</div>
                            <div className="space-y-1">
                                {record.defects.slice(0, 2).map((defect, idx) => (
                                    <div key={`${defect.defect_description}-${idx}`} className="text-xs text-muted-foreground">
                                        • {defect.defect_description} ({defect.quantity} adet)
                                    </div>
                                ))}
                                {record.defects.length > 2 && (
                                    <div className="text-xs text-muted-foreground">
                                        +{record.defects.length - 2} hata daha...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {(record.description || record.notes) && (
                        <div className="mt-2 pt-2 border-t border-border text-xs">
                            {record.description && (
                                <div>
                                    <strong>Açıklama:</strong> {record.description.slice(0, 120)}
                                    {record.description.length > 120 ? '...' : ''}
                                </div>
                            )}
                            {record.notes && (
                                <div className="mt-1">
                                    <strong>Notlar:</strong> {record.notes.slice(0, 120)}
                                    {record.notes.length > 120 ? '...' : ''}
                                </div>
                            )}
                        </div>
                    )}
                </>
            );
        }

        if (sourceType === 'quarantine' && record.description) {
            return (
                <div className="mt-2 pt-2 border-t border-border text-xs">
                    <strong>Sebep/Açıklama:</strong> {record.description.slice(0, 150)}
                    {record.description.length > 150 ? '...' : ''}
                </div>
            );
        }

        if (sourceType === 'leak_test' && record.notes) {
            return (
                <div className="mt-2 pt-2 border-t border-border text-xs">
                    <strong>Notlar:</strong> {record.notes.slice(0, 150)}
                    {record.notes.length > 150 ? '...' : ''}
                </div>
            );
        }

        if (sourceType === 'dynamic_balance' && record.notes) {
            return (
                <div className="mt-2 pt-2 border-t border-border text-xs">
                    <strong>Notlar:</strong> {record.notes.slice(0, 150)}
                    {record.notes.length > 150 ? '...' : ''}
                </div>
            );
        }

        if (sourceType === 'produced_vehicle_fault') {
            return (
                <div className="mt-2 pt-2 border-t border-border text-xs">
                    <div><strong>Kategori:</strong> {record.category?.name || '-'}</div>
                    <div className="mt-1"><strong>Ar-Ge Onayı:</strong> {record.arge_approved ? 'Var' : 'Yok'}</div>
                </div>
            );
        }

        if (sourceType === 'customer_complaint' && record.description) {
            return (
                <div className="mt-2 pt-2 border-t border-border text-xs">
                    <strong>Şikayet:</strong> {record.description.slice(0, 150)}
                    {record.description.length > 150 ? '...' : ''}
                </div>
            );
        }

        if (sourceType === 'fixture_nonconformity' && Array.isArray(record.deviation_details) && record.deviation_details.length > 0) {
            return (
                <div className="mt-2 pt-2 border-t border-border text-xs space-y-1">
                    <div className="font-semibold">Uygunsuzluk Detayları:</div>
                    {record.deviation_details.slice(0, 2).map((detail, idx) => (
                        <div key={`${detail.characteristic}-${idx}`} className="text-muted-foreground">
                            • {detail.characteristic}: {detail.deviation}
                        </div>
                    ))}
                    {record.deviation_details.length > 2 && (
                        <div className="text-muted-foreground">
                            +{record.deviation_details.length - 2} detay daha...
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    const handleTabsWheel = (event) => {
        const container = tabsScrollRef.current;
        if (!container) return;

        const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
        if (!horizontalDelta) return;

        event.preventDefault();
        container.scrollBy({
            left: horizontalDelta,
            behavior: 'smooth',
        });
    };

    return (
        <div className="w-full min-w-0 max-w-full space-y-4 overflow-hidden">
            <div className="min-w-0 space-y-2">
                <Label>Kaynak Kayıt Ara</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                    <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={activeSourceConfig.searchPlaceholder}
                        className="!pl-10"
                    />
                </div>
            </div>

            {selectedRecord && (
                <Card className="max-w-full overflow-hidden border-2 border-primary">
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                <span className="font-semibold">Seçili Kayıt</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedRecord(null);
                                    if (onSelect) onSelect(null, null);
                                }}
                            >
                                Temizle
                            </Button>
                        </div>
                        {renderSelectedSummary(selectedRecord)}
                    </CardContent>
                </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
                <div
                    ref={tabsScrollRef}
                    onWheel={handleTabsWheel}
                    className="max-w-full overflow-x-auto overflow-y-hidden pb-2"
                >
                    <TabsList className="inline-flex h-auto min-w-max flex-nowrap gap-1 whitespace-nowrap rounded-xl">
                        {SOURCE_TYPES.map((source) => {
                            const Icon = source.icon;
                            return (
                                <TabsTrigger
                                    key={source.id}
                                    value={source.id}
                                    className="min-w-[140px] gap-2 px-4 py-2 text-sm"
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span>{source.label}</span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>

                {SOURCE_TYPES.map((source) => (
                    <TabsContent key={source.id} value={source.id} className="min-w-0 space-y-2 max-h-96 overflow-x-hidden overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {source.emptyText}
                            </div>
                        ) : (
                            filteredRecords.map((record) => {
                                const deviation = hasDeviation(record, source.id);
                                const metaFields = getRecordMetaFields(record, source.id);

                                return (
                                    <Card
                                        key={record.id}
                                        className={`cursor-pointer hover:border-primary transition-colors ${
                                            selectedRecord?.id === record.id ? 'border-primary' : ''
                                        }`}
                                        onClick={() => handleSelectRecord(record, source.id)}
                                    >
                                        <CardContent className="p-3">
                                            <div className="mb-2 flex flex-wrap justify-between items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="font-semibold break-words">{getRecordTitle(record, source.id)}</div>
                                                        {deviation && (
                                                            <Badge variant="outline" className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border-blue-300">
                                                                <FileCheck className="h-3 w-3" />
                                                                Sapma Oluşturuldu
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 break-words">
                                                        {getRecordSubtitle(record, source.id)}
                                                    </div>
                                                    {deviation && (
                                                        <div className="text-xs text-blue-600 mt-1">
                                                            Sapma No: {deviation.request_no}
                                                        </div>
                                                    )}
                                                </div>
                                                {getRecordStatusBadge(record, source.id)}
                                            </div>

                                            <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 text-xs md:grid-cols-2">
                                                {metaFields.map((field) => (
                                                    <div key={`${field.label}-${field.value}`} className="min-w-0 break-words">
                                                        <strong>{field.label}:</strong> {field.value || '-'}
                                                    </div>
                                                ))}
                                            </div>

                                            {renderRecordFooter(record, source.id)}
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

export default SourceRecordSelector;
