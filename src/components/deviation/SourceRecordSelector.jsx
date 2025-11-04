import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, AlertTriangle, DollarSign, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

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

    // Veri yükleme
    useEffect(() => {
        loadRecords();
    }, [activeTab]);

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
            let query, table;
            
            switch (sourceType) {
                case 'incoming_inspection':
                    table = 'incoming_inspections';
                    query = supabase.from(table).select('*, supplier:suppliers(name)').eq('id', sourceId).single();
                    break;
                case 'quarantine':
                    table = 'quarantine_records';
                    query = supabase.from(table).select('*, supplier:suppliers(name)').eq('id', sourceId).single();
                    break;
                case 'quality_cost':
                    table = 'quality_costs';
                    query = supabase.from(table).select('*, supplier:suppliers!supplier_id(name)').eq('id', sourceId).single();
                    break;
                default:
                    return;
            }

            const { data, error } = await query;
            if (!error && data) {
                setSelectedRecord({ ...data, _source_type: sourceType });
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
            .select('*, supplier:suppliers(name)')
            .in('decision', ['Şartlı Kabul', 'Red'])
            .order('inspection_date', { ascending: false })
            .limit(100);

        if (error) throw error;
        setIncomingInspections(data || []);
    };

    const loadQuarantineRecords = async () => {
        const { data, error } = await supabase
            .from('quarantine_records')
            .select('*, supplier:suppliers(name)')
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
        const search = searchTerm.toLowerCase();
        return incomingInspections.filter(r => 
            r.part_code?.toLowerCase().includes(search) ||
            r.supplier_name?.toLowerCase().includes(search) ||
            r.inspection_number?.toLowerCase().includes(search)
        );
    }, [incomingInspections, searchTerm]);

    const filteredQuarantine = useMemo(() => {
        if (!searchTerm) return quarantineRecords;
        const search = searchTerm.toLowerCase();
        return quarantineRecords.filter(r => 
            r.part_code?.toLowerCase().includes(search) ||
            r.quarantine_number?.toLowerCase().includes(search) ||
            r.reason?.toLowerCase().includes(search)
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
                quantity: record.quantity || record.non_conforming_qty || record.affected_quantity,
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
                    inspection_number: record.inspection_number,
                    status: record.status,
                    defect_type: record.defect_type
                };
            case 'quarantine':
                return {
                    quarantine_number: record.quarantine_number,
                    reason: record.reason,
                    location: record.location
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
            'Beklemede': { variant: 'secondary', icon: Package }
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

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <Label>Kaynak Kayıt Ara</Label>
                    <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Parça kodu, tedarikçi, kayıt no..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
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
                            <div><strong>Parça Kodu:</strong> {selectedRecord.part_code}</div>
                            <div><strong>Miktar:</strong> {selectedRecord.quantity || selectedRecord.non_conforming_qty || selectedRecord.affected_quantity}</div>
                            {selectedRecord.supplier_name && <div><strong>Tedarikçi:</strong> {selectedRecord.supplier_name}</div>}
                            {selectedRecord.supplier?.name && <div><strong>Tedarikçi:</strong> {selectedRecord.supplier.name}</div>}
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
                                        <div>
                                            <div className="font-semibold">{record.part_code}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {record.inspection_number} • {record.supplier_name}
                                            </div>
                                        </div>
                                        {getStatusBadge(record.status)}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div><strong>Hatalı:</strong> {record.non_conforming_qty}</div>
                                        <div><strong>Hata Tipi:</strong> {record.defect_type || '-'}</div>
                                        <div><strong>Tarih:</strong> {new Date(record.inspection_date).toLocaleDateString('tr-TR')}</div>
                                    </div>
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
                                        <div>
                                            <div className="font-semibold">{record.part_code}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {record.quarantine_number}
                                            </div>
                                        </div>
                                        {getStatusBadge(record.status)}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div><strong>Miktar:</strong> {record.quantity}</div>
                                        <div><strong>Sebep:</strong> {record.reason || '-'}</div>
                                        <div><strong>Konum:</strong> {record.location || '-'}</div>
                                    </div>
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
                            Kalitesizlik maliyeti kaydı bulunamadı.
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
                                        <div>
                                            <div className="font-semibold">{record.part_code || 'Genel Maliyet'}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {record.cost_type}
                                            </div>
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

