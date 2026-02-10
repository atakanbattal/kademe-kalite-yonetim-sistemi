import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, AlertTriangle, DollarSign, CheckCircle2, FileCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, normalizeTurkishForSearch } from '@/lib/utils';

const SourceRecordSelector = ({ onSelect, initialSourceType, initialSourceId }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState(initialSourceType || 'incoming_inspection');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    
    // Kayıt listeleri
    const [incomingInspections, setIncomingInspections] = useState([]);
    const [quarantineRecords, setQuarantineRecords] = useState([]);
    const [qualityCosts, setQualityCosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deviationMap, setDeviationMap] = useState({}); // source_record_id -> deviation bilgisi

    // Veri yükleme
    useEffect(() => {
        loadRecords();
        loadDeviationMap();
    }, [activeTab]);

    // Sapma oluşturulan kayıtları yükle
    const loadDeviationMap = async () => {
        try {
            const { data, error } = await supabase
                .from('deviations')
                .select('id, request_no, source_type, source_record_id')
                .not('source_record_id', 'is', null);

            if (error) throw error;

            // source_type ve source_record_id kombinasyonuna göre map oluştur
            const map = {};
            (data || []).forEach(dev => {
                if (dev.source_type && dev.source_record_id) {
                    const key = `${dev.source_type}_${dev.source_record_id}`;
                    map[key] = {
                        id: dev.id,
                        request_no: dev.request_no
                    };
                }
            });
            setDeviationMap(map);
        } catch (error) {
            console.error('Sapma kayıtları yüklenemedi:', error);
        }
    };

    // İlk seçili kayıt varsa yükle
    useEffect(() => {
        if (initialSourceType && initialSourceId) {
            setActiveTab(initialSourceType);
            // Kayıt detayını yükle
            loadInitialRecord(initialSourceType, initialSourceId);
        }
    }, [initialSourceType, initialSourceId]);

    const loadInitialRecord = async (sourceType, sourceId) => {
        try {
            let query;
            
            switch (sourceType) {
                case 'incoming_inspection':
                    query = supabase
                        .from('incoming_inspections')
                        .select('*, supplier:suppliers(name), defects:incoming_inspection_defects(defect_description, quantity, part_code, part_name), results:incoming_inspection_results(*)')
                        .eq('id', sourceId)
                        .single();
                    break;
                case 'quarantine':
                    query = supabase
                        .from('quarantine_records')
                        .select('*')
                        .eq('id', sourceId)
                        .single();
                    break;
                case 'quality_cost':
                    query = supabase
                        .from('quality_costs')
                        .select('*, supplier:suppliers!supplier_id(name)')
                        .eq('id', sourceId)
                        .single();
                    break;
                default:
                    return;
            }

            const { data, error } = await query;
            if (!error && data) {
                setSelectedRecord({ ...data, _source_type: sourceType });
                // Otomatik seçim yap
                handleSelectRecord(data, sourceType);
            }
        } catch (error) {
            console.error('İlk kayıt yüklenemedi:', error);
        }
    };

    const loadRecords = async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'incoming_inspection':
                    await loadIncomingInspections();
                    break;
                case 'quarantine':
                    await loadQuarantineRecords();
                    break;
                case 'quality_cost':
                    await loadQualityCosts();
                    break;
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kayıtlar yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const loadIncomingInspections = async () => {
        const { data, error } = await supabase
            .from('incoming_inspections')
            .select(`
                *,
                supplier:suppliers(name),
                defects:incoming_inspection_defects(defect_description, quantity, part_code, part_name),
                results:incoming_inspection_results(*)
            `)
            .in('decision', ['Şartlı Kabul', 'Red'])
            .order('inspection_date', { ascending: false })
            .limit(100);

        if (error) throw error;
        setIncomingInspections(data || []);
    };

    const loadQuarantineRecords = async () => {
        const { data, error } = await supabase
            .from('quarantine_records')
            .select('*')
            .in('status', ['Karantinada', 'Beklemede'])
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        setQuarantineRecords(data || []);
    };

    const loadQualityCosts = async () => {
        const { data, error } = await supabase
            .from('quality_costs')
            .select('*, responsible_personnel:personnel!responsible_personnel_id(full_name), supplier:suppliers!supplier_id(name)')
            .order('cost_date', { ascending: false })
            .limit(100);

        if (error) throw error;
        setQualityCosts(data || []);
    };

    // Filtreleme
    const filteredIncoming = useMemo(() => {
        if (!searchTerm) return incomingInspections;
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);
        return incomingInspections.filter(r => 
            normalizeTurkishForSearch(r.part_code).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.part_name).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.supplier_name).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.supplier?.name).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.record_no).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.delivery_note_number).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.description).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.notes).includes(normalizedSearch)
        );
    }, [incomingInspections, searchTerm]);

    const filteredQuarantine = useMemo(() => {
        if (!searchTerm) return quarantineRecords;
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);
        return quarantineRecords.filter(r => 
            normalizeTurkishForSearch(r.part_code).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.part_name).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.lot_no).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.description).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.source_department).includes(normalizedSearch) ||
            normalizeTurkishForSearch(r.requesting_department).includes(normalizedSearch)
        );
    }, [quarantineRecords, searchTerm]);

    const filteredQualityCosts = useMemo(() => {
        if (!searchTerm) return qualityCosts;
        const search = searchTerm.toLowerCase();
        return qualityCosts.filter(r => 
            r.part_code?.toLowerCase().includes(search) ||
            r.unit?.toLowerCase().includes(search) ||
            r.cost_type?.toLowerCase().includes(search)
        );
    }, [qualityCosts, searchTerm]);

    // Kayıt seçimi
    const handleSelectRecord = (record, sourceType) => {
        const enrichedRecord = { ...record, _source_type: sourceType };
        setSelectedRecord(enrichedRecord);
        
        // Otomatik doldurulacak veriler
        const autoFillData = {
            source_type: sourceType,
            source_record_id: record.id,
            part_code: record.part_code || '',
            source_record_details: {
                part_code: record.part_code,
                part_name: record.part_name,
                quantity: record.quantity || record.quantity_rejected || record.affected_quantity || record.non_conforming_qty,
                supplier: record.supplier_name || record.supplier?.name,
                ...getAdditionalDetails(record, sourceType)
            }
        };

        if (onSelect) {
            onSelect(autoFillData, enrichedRecord);
        }
    };

    const getAdditionalDetails = (record, sourceType) => {
        switch (sourceType) {
            case 'incoming_inspection':
                return {
                    record_no: record.record_no,
                    inspection_number: record.record_no,
                    decision: record.decision,
                    part_name: record.part_name,
                    quantity_rejected: record.quantity_rejected,
                    quantity_conditional: record.quantity_conditional,
                    defects: record.defects || [],
                    results: record.results || [],
                    description: record.description,
                    notes: record.notes,
                    delivery_note_number: record.delivery_note_number,
                    inspection_date: record.inspection_date,
                    quantity_received: record.quantity_received,
                    quantity_inspected: record.quantity_inspected
                };
            case 'quarantine':
                return {
                    lot_no: record.lot_no,
                    quarantine_number: record.lot_no,
                    part_name: record.part_name,
                    description: record.description,
                    source_department: record.source_department,
                    requesting_department: record.requesting_department,
                    requesting_person_name: record.requesting_person_name,
                    decision: record.decision
                };
            case 'quality_cost':
                return {
                    cost_type: record.cost_type,
                    amount: record.amount,
                    unit: record.unit
                };
            default:
                return {};
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'Şartlı Kabul': { variant: 'warning', icon: AlertTriangle },
            'Red': { variant: 'destructive', icon: AlertTriangle },
            'Karantinada': { variant: 'warning', icon: Package },
            'Beklemede': { variant: 'secondary', icon: Package },
            'Kabul': { variant: 'success', icon: CheckCircle2 },
            'İade': { variant: 'destructive', icon: AlertTriangle }
        };

        const config = statusConfig[status] || { variant: 'default', icon: Package };
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {status}
            </Badge>
        );
    };

    // Kayıt için sapma oluşturulup oluşturulmadığını kontrol et
    const hasDeviation = (record, sourceType) => {
        if (!record?.id || !sourceType) return null;
        const key = `${sourceType}_${record.id}`;
        return deviationMap[key] || null;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <Label>Kaynak Kayıt Ara</Label>
                    <div className="search-box mt-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Parça kodu, tedarikçi, kayıt no..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
            </div>

            {selectedRecord && (
                <Card className="border-2 border-primary">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
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
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><strong>Parça Kodu:</strong> {selectedRecord.part_code || '-'}</div>
                            <div><strong>Parça Adı:</strong> {selectedRecord.part_name || '-'}</div>
                            <div><strong>Miktar:</strong> {selectedRecord.quantity || selectedRecord.quantity_rejected || selectedRecord.affected_quantity || '-'}</div>
                            {selectedRecord.supplier_name && <div><strong>Tedarikçi:</strong> {selectedRecord.supplier_name}</div>}
                            {selectedRecord.supplier?.name && <div><strong>Tedarikçi:</strong> {selectedRecord.supplier.name}</div>}
                            {selectedRecord._source_type === 'incoming_inspection' && (
                                <>
                                    <div><strong>Kayıt No:</strong> {selectedRecord.record_no || '-'}</div>
                                    <div><strong>Karar:</strong> {selectedRecord.decision || '-'}</div>
                                    {selectedRecord.defects && selectedRecord.defects.length > 0 && (
                                        <div className="col-span-2">
                                            <strong>Hatalar:</strong>
                                            <ul className="list-disc list-inside mt-1">
                                                {selectedRecord.defects.map((defect, idx) => (
                                                    <li key={idx} className="text-xs">
                                                        {defect.defect_description} (Miktar: {defect.quantity})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {selectedRecord.description && (
                                        <div className="col-span-2"><strong>Açıklama:</strong> {selectedRecord.description}</div>
                                    )}
                                </>
                            )}
                            {selectedRecord._source_type === 'quarantine' && (
                                <>
                                    <div><strong>Lot No:</strong> {selectedRecord.lot_no || '-'}</div>
                                    <div><strong>Durum:</strong> {selectedRecord.status || '-'}</div>
                                    {selectedRecord.description && (
                                        <div className="col-span-2"><strong>Açıklama/Sebep:</strong> {selectedRecord.description}</div>
                                    )}
                                    {selectedRecord.source_department && (
                                        <div><strong>Kaynak Birim:</strong> {selectedRecord.source_department}</div>
                                    )}
                                    {selectedRecord.requesting_department && (
                                        <div><strong>Talep Eden Birim:</strong> {selectedRecord.requesting_department}</div>
                                    )}
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="incoming_inspection">
                        <Package className="mr-2 h-4 w-4" />
                        Girdi Kontrol
                    </TabsTrigger>
                    <TabsTrigger value="quarantine">
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Karantina
                    </TabsTrigger>
                    <TabsTrigger value="quality_cost">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Kalite Maliyeti
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="incoming_inspection" className="space-y-2 max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                    ) : filteredIncoming.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Şartlı kabul veya red edilmiş girdi kontrol kaydı bulunamadı.
                        </div>
                    ) : (
                        filteredIncoming.map(record => (
                            <Card 
                                key={record.id}
                                className={`cursor-pointer hover:border-primary transition-colors ${
                                    selectedRecord?.id === record.id ? 'border-primary' : ''
                                }`}
                                onClick={() => handleSelectRecord(record, 'incoming_inspection')}
                            >
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                            <div className="font-semibold">{record.part_code || '-'}</div>
                                                {hasDeviation(record, 'incoming_inspection') && (
                                                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border-blue-300">
                                                        <FileCheck className="h-3 w-3" />
                                                        Sapma Oluşturuldu
                                                    </Badge>
                                                )}
                                            </div>
                                            {record.part_name && (
                                                <div className="text-xs text-muted-foreground mt-0.5">{record.part_name}</div>
                                            )}
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {record.record_no || '-'} • {record.supplier_name || record.supplier?.name || 'Tedarikçi yok'}
                                            </div>
                                            {hasDeviation(record, 'incoming_inspection') && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Sapma No: {hasDeviation(record, 'incoming_inspection').request_no}
                                                </div>
                                            )}
                                        </div>
                                        {getStatusBadge(record.decision)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                        <div><strong>Red Edilen:</strong> {record.quantity_rejected || 0}</div>
                                        <div><strong>Şartlı Kabul:</strong> {record.quantity_conditional || 0}</div>
                                        <div><strong>Tarih:</strong> {new Date(record.inspection_date).toLocaleDateString('tr-TR')}</div>
                                        {record.delivery_note_number && (
                                            <div><strong>Teslimat No:</strong> {record.delivery_note_number}</div>
                                        )}
                                    </div>
                                    {record.defects && record.defects.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                            <div className="text-xs font-semibold mb-1">Hata Detayları:</div>
                                            <div className="space-y-1">
                                                {record.defects.slice(0, 2).map((defect, idx) => (
                                                    <div key={idx} className="text-xs text-muted-foreground">
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
                                        <div className="mt-2 pt-2 border-t border-border">
                                            <div className="text-xs">
                                                {record.description && (
                                                    <div><strong>Açıklama:</strong> {record.description.substring(0, 100)}{record.description.length > 100 ? '...' : ''}</div>
                                                )}
                                                {record.notes && (
                                                    <div className="mt-1"><strong>Notlar:</strong> {record.notes.substring(0, 100)}{record.notes.length > 100 ? '...' : ''}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="quarantine" className="space-y-2 max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                    ) : filteredQuarantine.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Karantinada bekleyen kayıt bulunamadı.
                        </div>
                    ) : (
                        filteredQuarantine.map(record => (
                            <Card 
                                key={record.id}
                                className={`cursor-pointer hover:border-primary transition-colors ${
                                    selectedRecord?.id === record.id ? 'border-primary' : ''
                                }`}
                                onClick={() => handleSelectRecord(record, 'quarantine')}
                            >
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                            <div className="font-semibold">{record.part_code || '-'}</div>
                                                {hasDeviation(record, 'quarantine') && (
                                                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border-blue-300">
                                                        <FileCheck className="h-3 w-3" />
                                                        Sapma Oluşturuldu
                                                    </Badge>
                                                )}
                                            </div>
                                            {record.part_name && (
                                                <div className="text-xs text-muted-foreground mt-0.5">{record.part_name}</div>
                                            )}
                                            <div className="text-sm text-muted-foreground mt-1">
                                                Lot No: {record.lot_no || '-'}
                                            </div>
                                            {hasDeviation(record, 'quarantine') && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Sapma No: {hasDeviation(record, 'quarantine').request_no}
                                                </div>
                                            )}
                                        </div>
                                        {getStatusBadge(record.status)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                        <div><strong>Miktar:</strong> {record.quantity || 0} {record.unit || 'Adet'}</div>
                                        <div><strong>Tarih:</strong> {new Date(record.quarantine_date || record.created_at).toLocaleDateString('tr-TR')}</div>
                                        {record.source_department && (
                                            <div><strong>Kaynak Birim:</strong> {record.source_department}</div>
                                        )}
                                        {record.requesting_department && (
                                            <div><strong>Talep Eden:</strong> {record.requesting_department}</div>
                                        )}
                                        {record.requesting_person_name && (
                                            <div className="col-span-2"><strong>Talep Eden Kişi:</strong> {record.requesting_person_name}</div>
                                        )}
                                    </div>
                                    {record.description && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                            <div className="text-xs">
                                                <div><strong>Sebep/Açıklama:</strong></div>
                                                <div className="text-muted-foreground mt-1">
                                                    {record.description.substring(0, 150)}{record.description.length > 150 ? '...' : ''}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {record.decision && (
                                        <div className="mt-1 text-xs">
                                            <strong>Karar:</strong> {record.decision}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="quality_cost" className="space-y-2 max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                    ) : filteredQualityCosts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Kalite maliyeti kaydı bulunamadı.
                        </div>
                    ) : (
                        filteredQualityCosts.map(record => (
                            <Card 
                                key={record.id}
                                className={`cursor-pointer hover:border-primary transition-colors ${
                                    selectedRecord?.id === record.id ? 'border-primary' : ''
                                }`}
                                onClick={() => handleSelectRecord(record, 'quality_cost')}
                            >
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                            <div className="font-semibold">{record.part_code || 'Genel Maliyet'}</div>
                                                {hasDeviation(record, 'quality_cost') && (
                                                    <Badge variant="outline" className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border-blue-300">
                                                        <FileCheck className="h-3 w-3" />
                                                        Sapma Oluşturuldu
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {record.cost_type}
                                            </div>
                                            {hasDeviation(record, 'quality_cost') && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Sapma No: {hasDeviation(record, 'quality_cost').request_no}
                                                </div>
                                            )}
                                        </div>
                                        <Badge variant="default">
                                            {formatCurrency(record.amount)}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div><strong>Birim:</strong> {record.unit}</div>
                                        {record.is_supplier_nc && record.supplier?.name && (
                                            <div><strong>Tedarikçi:</strong> {record.supplier.name}</div>
                                        )}
                                        <div><strong>Tarih:</strong> {new Date(record.cost_date).toLocaleDateString('tr-TR')}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SourceRecordSelector;

