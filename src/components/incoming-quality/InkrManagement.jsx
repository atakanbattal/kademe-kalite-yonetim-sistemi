import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import InkrDetailModal from './InkrDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Search, FileText, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { useData } from '@/contexts/DataContext';
import { Combobox } from '@/components/ui/combobox';

const NON_DIMENSIONAL_EQUIPMENT_LABELS = [
    "Geçer/Geçmez Mastar", "Karşı Parça ile Deneme",
    "Fonksiyonel Test", "Manuel Kontrol", "Pürüzlülük Ölçüm Cihazı",
    "Sertlik Test Cihazı", "Vida Diş Ölçer (Pitch Gauge)", "Gözle Kontrol"
];

const ISO_2768_1_TOLERANCES = {
    linear: [
        { range: [0.5, 3], f: 0.05, m: 0.1, c: 0.2, v: null },
        { range: [3, 6], f: 0.05, m: 0.1, c: 0.3, v: 0.5 },
        { range: [6, 30], f: 0.1, m: 0.2, c: 0.5, v: 1.0 },
        { range: [30, 120], f: 0.15, m: 0.3, c: 0.8, v: 1.5 },
        { range: [120, 400], f: 0.2, m: 0.5, c: 1.2, v: 2.5 },
        { range: [400, 1000], f: 0.3, m: 0.8, c: 2.0, v: 4.0 },
        { range: [1000, 2000], f: 0.5, m: 1.2, c: 3.0, v: 6.0 },
        { range: [2000, 4000], f: 0.8, m: 2.0, c: 5.0, v: 8.0 }
    ]
};

const STANDARD_OPTIONS = [
    { value: 'ISO 2768-1_f', label: 'ISO 2768-1 f (Fine - İnce)' },
    { value: 'ISO 2768-1_m', label: 'ISO 2768-1 m (Medium - Orta)' },
    { value: 'ISO 2768-1_c', label: 'ISO 2768-1 c (Coarse - Kaba)' },
    { value: 'ISO 2768-1_v', label: 'ISO 2768-1 v (Very Coarse - Çok Kaba)' },
];

const InkrItem = ({ item, index, onUpdate, characteristics, equipment, standards }) => {
    const isDimensional = useMemo(() => {
        if (!equipment) return false;
        const selectedEquipment = equipment.find(e => e.value === item.equipment_id);
        return selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
    }, [item.equipment_id, equipment]);

    const autoCalculateTolerance = useCallback((currentItem) => {
        const { nominal_value, tolerance_class, tolerance_direction } = currentItem;

        if (!isDimensional || !tolerance_class || !nominal_value) {
            return { ...currentItem };
        }

        const nominal = parseFloat(String(nominal_value).replace(',', '.'));
        if (isNaN(nominal)) {
            return { ...currentItem };
        }

        const toleranceRule = ISO_2768_1_TOLERANCES.linear.find(
            rule => nominal > rule.range[0] && nominal <= rule.range[1]
        );

        if (toleranceRule && toleranceRule[tolerance_class] !== null) {
            const tolerance = toleranceRule[tolerance_class];
            let min, max;

            switch (tolerance_direction) {
                case '+':
                    min = nominal;
                    max = nominal + tolerance;
                    break;
                case '-':
                    min = nominal - tolerance;
                    max = nominal;
                    break;
                case '±':
                default:
                    min = nominal - tolerance;
                    max = nominal + tolerance;
                    break;
            }
            return {
                ...currentItem,
                min_value: parseFloat(min.toPrecision(10)).toString(),
                max_value: parseFloat(max.toPrecision(10)).toString()
            };
        }
        return currentItem;
    }, [isDimensional]);

    const handleFieldChange = (field, value) => {
        let newItem = { ...item, [field]: value };

        if (field === 'standard_class') {
            if (value && standards) {
                const [standardName, toleranceClass] = value.split('_');
                const standard = standards.find(s => s.label.startsWith(standardName));
                newItem = { ...newItem, standard_id: standard ? standard.value : null, tolerance_class: toleranceClass };

                const calculatedItem = autoCalculateTolerance(newItem);
                onUpdate(index, calculatedItem);
                return;
            } else {
                newItem = { ...newItem, standard_id: null, tolerance_class: null };
            }
        }

        if (field === 'equipment_id' && equipment) {
            const selectedEquipment = equipment.find(e => e.value === value);
            const isNowDimensional = selectedEquipment && !NON_DIMENSIONAL_EQUIPMENT_LABELS.includes(selectedEquipment.label);
            if (!isNowDimensional) {
                newItem = { ...newItem, standard_id: null, tolerance_class: null, standard_class: null, tolerance_direction: '±', min_value: null, max_value: null };
            }
        }

        if (field === 'characteristic_id' && characteristics) {
            const selectedCharacteristic = characteristics.find(c => c.value === value);
            if (selectedCharacteristic) {
                newItem.characteristic_type = selectedCharacteristic.type;
            }
        }

        if (['nominal_value', 'tolerance_direction'].includes(field)) {
            const calculatedItem = autoCalculateTolerance(newItem);
            onUpdate(index, calculatedItem);
        } else {
            onUpdate(index, newItem);
        }
    };

    const selectedCharacteristic = characteristics?.find(c => c.value === item.characteristic_id);

    const standardClassValue = useMemo(() => {
        if (!standards) return item.standard_class || '';
        const standard = standards.find(s => s.value === item.standard_id);
        if (standard && item.tolerance_class) {
            const standardBaseName = standard.label.split(' ')[0];
            return `${standardBaseName}_${item.tolerance_class}`;
        }
        return item.standard_class || '';
    }, [item.standard_id, item.tolerance_class, standards, item.standard_class]);

    return (
        <tr className="border-b transition-colors hover:bg-muted/50 text-sm">
            <td className="p-2 align-top text-center font-medium">{index + 1}</td>
            <td className="p-2 align-top min-w-[200px]">
                <Combobox options={characteristics || []} value={item.characteristic_id} onChange={(v) => handleFieldChange('characteristic_id', v)} placeholder="Karakteristik seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." />
            </td>
            <td className="p-2 align-top min-w-[200px]"><Combobox options={equipment || []} value={item.equipment_id} onChange={(v) => handleFieldChange('equipment_id', v)} placeholder="Ekipman seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." /></td>
            <td className="p-2 align-top min-w-[220px]"><Combobox options={STANDARD_OPTIONS} value={standardClassValue} onChange={(v) => handleFieldChange('standard_class', v)} placeholder="Standart ve Sınıf seçin..." searchPlaceholder="Ara..." notFoundText="Bulunamadı." disabled={!isDimensional} /></td>
            <td className="p-2 align-top min-w-[130px]">
                <Input
                    type="text"
                    placeholder="Örn: M8, 15.5, OK"
                    value={item.nominal_value || ''}
                    onChange={(e) => handleFieldChange('nominal_value', e.target.value)}
                    maxLength="50"
                    className="w-full"
                />
            </td>
            <td className="p-2 align-top min-w-[100px]">
                <Combobox
                    options={[{ value: '±', label: '±' }, { value: '+', label: '+' }, { value: '-', label: '-' }]}
                    value={item.tolerance_direction}
                    onChange={(v) => handleFieldChange('tolerance_direction', v)}
                    placeholder="Yön"
                    disabled={!isDimensional}
                />
            </td>
            <td className="p-2 align-top min-w-[110px]"><Input type="text" inputMode="decimal" placeholder="Min" value={item.min_value ?? ''} onChange={(e) => handleFieldChange('min_value', e.target.value)} disabled={!isDimensional} className="w-full" /></td>
            <td className="p-2 align-top min-w-[110px]"><Input type="text" inputMode="decimal" placeholder="Max" value={item.max_value ?? ''} onChange={(e) => handleFieldChange('max_value', e.target.value)} disabled={!isDimensional} className="w-full" /></td>
            <td className="p-2 align-top min-w-[140px]"><Input type="text" inputMode="decimal" placeholder="Ölçülen Değer" value={item.measured_value ?? ''} onChange={(e) => handleFieldChange('measured_value', e.target.value)} className="w-full" /></td>
            <td className="p-2 align-top text-center min-w-[120px]">
                {(() => {
                    const measured = parseFloat(String(item.measured_value || '').replace(',', '.'));
                    const min = parseFloat(String(item.min_value || '').replace(',', '.'));
                    const max = parseFloat(String(item.max_value || '').replace(',', '.'));

                    if (!item.measured_value || item.measured_value === '') {
                        return <span className="text-xs text-muted-foreground">-</span>;
                    }

                    if (isNaN(measured) || isNaN(min) || isNaN(max) || min === 0 && max === 0) {
                        return <span className="text-xs text-muted-foreground">-</span>;
                    }

                    const isInRange = measured >= min && measured <= max;
                    return isInRange ? (
                        <Badge variant="success" className="bg-green-500 text-white">Kabul</Badge>
                    ) : (
                        <Badge variant="destructive" className="bg-red-500 text-white">Ret</Badge>
                    );
                })()}
            </td>
            <td className="p-2 align-top text-center"><Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => onUpdate(index, null)}><Trash2 className="h-4 w-4" /></Button></td>
        </tr>
    );
};

const InkrFormModal = ({ isOpen, setIsOpen, existingReport, refreshReports, onReportSaved }) => {
    const { toast } = useToast();
    const isEditMode = !!(existingReport && existingReport.id);
    const [formData, setFormData] = useState({});
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { characteristics, equipment, standards, loading: dataLoading } = useData();

    const initialItemState = { id: uuidv4(), characteristic_id: '', characteristic_type: '', equipment_id: '', standard_id: null, tolerance_class: null, nominal_value: '', min_value: null, max_value: null, tolerance_direction: '±', standard_class: '', measured_value: '' };

    useEffect(() => {
        const initializeForm = async () => {
            if (existingReport && existingReport.id) {
                // Mevcut raporu düzenleme modu
                setFormData({
                    ...existingReport,
                    report_date: existingReport.report_date ? new Date(existingReport.report_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                });
                const reportItems = existingReport.items || [];
                const loadedItems = reportItems.map((item) => ({
                    id: item.id || uuidv4(),
                    characteristic_id: item.characteristic_id || '',
                    characteristic_type: item.characteristic_type || '',
                    equipment_id: item.equipment_id || '',
                    standard_id: item.standard_id || null,
                    tolerance_class: item.tolerance_class || null,
                    standard_class: item.standard_class || '',
                    nominal_value: item.nominal_value !== undefined && item.nominal_value !== null ? item.nominal_value : '',
                    min_value: item.min_value !== undefined && item.min_value !== null ? item.min_value : null,
                    max_value: item.max_value !== undefined && item.max_value !== null ? item.max_value : null,
                    tolerance_direction: item.tolerance_direction || '±',
                    measured_value: item.measured_value || ''
                }));
                setItems(loadedItems);
            } else {
                // Yeni rapor oluşturma modu
                let initialReportDate = new Date().toISOString().split('T')[0];
                let initialSupplierId = null;

                // Eğer parça kodu varsa, bu parçanın ilk girdi muayene tarihini ve tedarikçisini bul
                if (existingReport?.part_code) {
                    try {
                        const { data: firstInspection, error } = await supabase
                            .from('incoming_inspections')
                            .select('inspection_date, supplier_id')
                            .eq('part_code', existingReport.part_code)
                            .order('inspection_date', { ascending: true })
                            .limit(1)
                            .maybeSingle();

                        if (!error && firstInspection) {
                            // Ürünün firmamıza ilk geldiği tarihi kullan
                            if (firstInspection.inspection_date) {
                                initialReportDate = new Date(firstInspection.inspection_date).toISOString().split('T')[0];
                            }
                            // İlk gelen tedarikçiyi kullan
                            if (firstInspection.supplier_id) {
                                initialSupplierId = firstInspection.supplier_id;
                            }
                        }
                    } catch (err) {
                        console.error('İlk muayene bilgileri alınamadı:', err);
                    }
                }

                setFormData({
                    part_code: existingReport?.part_code || '',
                    part_name: existingReport?.part_name || '',
                    supplier_id: initialSupplierId,
                    report_date: initialReportDate,
                    status: 'Beklemede',
                    notes: '',
                    items: []
                });
                setItems([]);
            }
        };

        if (isOpen) {
            initializeForm();
        }
    }, [isOpen, existingReport]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
            if (!error) setSuppliers(data);
        };
        fetchSuppliers();
    }, []);

    const handleItemUpdate = (index, updatedItem) => {
        if (updatedItem === null) {
            setItems(prev => prev.filter((_, i) => i !== index));
        } else {
            setItems(prev => {
                const newItems = [...prev];
                newItems[index] = updatedItem;
                return newItems;
            });
        }
    };

    const handleAddItem = () => {
        setItems(prev => [...prev, { ...initialItemState, id: uuidv4() }]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const reportData = {
            ...formData,
            items: items.filter(item => item.characteristic_id && item.equipment_id)
        };
        if (reportData.supplier_id === '' || reportData.supplier_id === 'none') reportData.supplier_id = null;

        // INKR numarası oluştur - parça numarası ile ilişkili: INKR-parça_kodu
        if (!reportData.inkr_number || !reportData.inkr_number.startsWith('INKR-')) {
            if (reportData.part_code) {
                // Parça kodundan INKR numarası oluştur: INKR-parça_kodu
                // Özel karakterleri temizle ve sadece alfanumerik karakterleri kullan
                const cleanPartCode = reportData.part_code.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                reportData.inkr_number = `INKR-${cleanPartCode}`;
            } else {
                // Parça kodu yoksa yıl bazlı sıralı numara kullan
                const currentYear = new Date().getFullYear();
                const { data: lastReport } = await supabase
                    .from('inkr_reports')
                    .select('inkr_number')
                    .like('inkr_number', `INKR-${currentYear}-%`)
                    .not('inkr_number', 'like', `INKR-${currentYear}-%-%`) // Parça kodlu olanları hariç tut
                    .order('inkr_number', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let sequence = 1;
                if (lastReport?.inkr_number) {
                    const match = lastReport.inkr_number.match(new RegExp(`INKR-${currentYear}-(\\d+)`));
                    if (match && match[1]) {
                        sequence = parseInt(match[1], 10) + 1;
                    }
                }
                reportData.inkr_number = `INKR-${currentYear}-${String(sequence).padStart(4, '0')}`;
            }
        }

        delete reportData.id;
        delete reportData.created_at;
        delete reportData.updated_at;
        delete reportData.supplier;

        const { error } = await supabase.from('inkr_reports').upsert(reportData, { onConflict: 'part_code' });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `INKR Raporu kaydedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `INKR Raporu başarıyla kaydedildi.` });
            if (refreshReports) refreshReports();
            if (onReportSaved) {
                const { data, error: fetchError } = await supabase
                    .from('inkr_reports')
                    .select('*, supplier:supplier_id(name)')
                    .order('created_at', { ascending: false });
                if (!fetchError) {
                    onReportSaved(data || []);
                }
            }
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value === '' || value === 'none' ? null : value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-[95vw] w-full max-h-[95vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>{isEditMode ? 'INKR Raporu Düzenle' : 'Yeni INKR Raporu Oluştur'}</DialogTitle>
                    <DialogDescription>İlk numune kontrol raporu bilgilerini girin ve ölçümleri kaydedin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <ScrollArea className="flex-1 p-4 min-h-0">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Parça Kodu</Label><Input value={formData.part_code || ''} onChange={(e) => setFormData(f => ({ ...f, part_code: e.target.value }))} required disabled={isEditMode || !!(existingReport && existingReport.part_code && !existingReport.id)} /></div>
                                <div><Label>Parça Adı</Label><Input value={formData.part_name || ''} onChange={(e) => setFormData(f => ({ ...f, part_name: e.target.value }))} required /></div>
                                <div className="col-span-2">
                                    <Label>Tedarikçi <span className="text-muted-foreground text-xs font-normal">(Opsiyonel - Fabrika içi üretim için boş bırakın)</span></Label>
                                    <Select value={formData.supplier_id || 'none'} onValueChange={(v) => handleSelectChange('supplier_id', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tedarikçi seçin (fabrika içi üretim için boş bırakın)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Tedarikçi Yok (Fabrika İçi Üretim)</SelectItem>
                                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Rapor Tarihi</Label><Input type="date" value={formData.report_date || ''} onChange={(e) => setFormData(f => ({ ...f, report_date: e.target.value }))} required /></div>
                                <div><Label>Durum</Label><Select value={formData.status || ''} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Beklemede">Beklemede</SelectItem><SelectItem value="Onaylandı">Onaylandı</SelectItem><SelectItem value="Reddedildi">Reddedildi</SelectItem></SelectContent></Select></div>
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <Label className="text-lg font-semibold">Ölçüm Özellikleri</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} disabled={dataLoading}>
                                        <Plus className="w-4 h-4 mr-2" /> Özellik Ekle
                                    </Button>
                                </div>
                                {dataLoading ? (
                                    <div className="text-center py-8 text-muted-foreground">Veriler yükleniyor...</div>
                                ) : items.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                        <p>Henüz özellik eklenmedi.</p>
                                        <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="mt-4">
                                            <Plus className="w-4 h-4 mr-2" /> İlk Özelliği Ekle
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse" style={{ minWidth: '1350px' }}>
                                            <thead>
                                                <tr className="border-b bg-muted/50">
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground w-12">#</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">Karakteristik</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">Ekipman</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[220px]">Standart/Sınıf</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[130px]">Nominal</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[100px]">Yön</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[110px]">Min</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[110px]">Max</th>
                                                    <th className="p-2 text-left text-xs font-semibold text-muted-foreground min-w-[140px]">Ölçülen Değer</th>
                                                    <th className="p-2 text-center text-xs font-semibold text-muted-foreground min-w-[120px]">Sonuç</th>
                                                    <th className="p-2 text-center text-xs font-semibold text-muted-foreground w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item, index) => (
                                                    <InkrItem
                                                        key={item.id}
                                                        item={item}
                                                        index={index}
                                                        onUpdate={handleItemUpdate}
                                                        characteristics={characteristics}
                                                        equipment={equipment}
                                                        standards={standards}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-4 border-t pt-4 flex-shrink-0">
                        <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const InkrManagement = ({ onViewPdf }) => {
    const { toast } = useToast();
    const { loading: globalLoading, refreshData } = useData();
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedInkrDetail, setSelectedInkrDetail] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [allParts, setAllParts] = useState([]);
    const [partsLoading, setPartsLoading] = useState(true);
    const [inkrStatusFilter, setInkrStatusFilter] = useState('all');
    const [inkrReports, setInkrReports] = useState([]);
    const [inkrReportsLoading, setInkrReportsLoading] = useState(true);

    const handleEdit = (report) => {
        setSelectedReport(report);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedReport(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('inkr_reports').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Rapor silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'INKR raporu silindi.' });
            const { data, error: fetchError } = await supabase
                .from('inkr_reports')
                .select('*, supplier:supplier_id(name)')
                .order('created_at', { ascending: false });
            if (!fetchError) {
                setInkrReports(data || []);
            }
            refreshData();
        }
    };

    const handleViewRecord = (report) => {
        setSelectedInkrDetail(report);
        setIsDetailModalOpen(true);
    };

    const handleDownloadDetailPDF = (enrichedData) => {
        openPrintableReport(enrichedData, 'inkr_management', true);
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'destructive';
            default: return 'secondary';
        }
    };

    useEffect(() => {
        const fetchInkrReports = async () => {
            setInkrReportsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('inkr_reports')
                    .select('*, supplier:supplier_id(name)')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setInkrReports(data || []);
            } catch (error) {
                console.error('INKR raporları alınamadı:', error);
                toast({ variant: 'destructive', title: 'Hata', description: `INKR raporları alınamadı: ${error.message}` });
                setInkrReports([]);
            } finally {
                setInkrReportsLoading(false);
            }
        };

        fetchInkrReports();
    }, [toast]);

    useEffect(() => {
        const fetchAllParts = async () => {
            setPartsLoading(true);
            try {
                const { data: inspections, error: inspectionsError } = await supabase
                    .from('incoming_inspections_with_supplier')
                    .select('part_code, part_name')
                    .not('part_code', 'is', null)
                    .not('part_code', 'eq', '')
                    .order('part_code');

                if (inspectionsError) throw inspectionsError;

                const uniquePartsMap = new Map();
                (inspections || []).forEach(inspection => {
                    if (inspection.part_code && !uniquePartsMap.has(inspection.part_code)) {
                        uniquePartsMap.set(inspection.part_code, {
                            part_code: inspection.part_code,
                            part_name: inspection.part_name || '-',
                        });
                    }
                });

                const inkrMap = new Map((inkrReports || []).map(r => [r.part_code, r]));

                const partsWithInkrStatus = Array.from(uniquePartsMap.values()).map(part => {
                    const inkrReport = inkrMap.get(part.part_code);
                    return {
                        ...part,
                        hasInkr: !!inkrReport,
                        inkrReport: inkrReport || null,
                    };
                });

                (inkrReports || []).forEach(inkrReport => {
                    if (inkrReport.part_code && !uniquePartsMap.has(inkrReport.part_code)) {
                        partsWithInkrStatus.push({
                            part_code: inkrReport.part_code,
                            part_name: inkrReport.part_name || '-',
                            hasInkr: true,
                            inkrReport: inkrReport,
                        });
                    }
                });

                partsWithInkrStatus.sort((a, b) => {
                    if (a.part_code < b.part_code) return -1;
                    if (a.part_code > b.part_code) return 1;
                    return 0;
                });

                setAllParts(partsWithInkrStatus);
            } catch (error) {
                console.error('Parça listesi alınamadı:', error);
                toast({ variant: 'destructive', title: 'Hata', description: 'Parça listesi alınamadı.' });
                setAllParts([]);
            } finally {
                setPartsLoading(false);
            }
        };

        if (!inkrReportsLoading) {
            fetchAllParts();
        }
    }, [inkrReports, inkrReportsLoading, toast]);

    const filteredParts = useMemo(() => {
        let filtered = allParts;

        if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(part =>
                part.part_code.toLowerCase().includes(normalizedSearch) ||
                (part.part_name && part.part_name.toLowerCase().includes(normalizedSearch))
            );
        }

        if (inkrStatusFilter === 'Mevcut') {
            filtered = filtered.filter(part => part.hasInkr);
        } else if (inkrStatusFilter === 'Mevcut Değil') {
            filtered = filtered.filter(part => !part.hasInkr);
        }

        return filtered;
    }, [allParts, searchTerm, inkrStatusFilter]);

    return (
        <div className="dashboard-widget">
            <InkrFormModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} existingReport={selectedReport} refreshReports={refreshData} onReportSaved={setInkrReports} />
            <InkrDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                report={selectedInkrDetail}
                onDownloadPDF={handleDownloadDetailPDF}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="search-box w-full sm:w-auto sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Parça kodu veya adı ile ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={inkrStatusFilter} onValueChange={setInkrStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="INKR Durumu" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tümü</SelectItem>
                            <SelectItem value="Mevcut">INKR Mevcut</SelectItem>
                            <SelectItem value="Mevcut Değil">INKR Eksik</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" /> Yeni INKR Raporu</Button>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Parça Kodu</th>
                            <th>Parça Adı</th>
                            <th>INKR Durumu</th>
                            <th>Tedarikçi</th>
                            <th>Rapor Tarihi</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partsLoading || inkrReportsLoading || globalLoading ? (
                            <tr><td colSpan="7" className="text-center py-8">Yükleniyor...</td></tr>
                        ) : filteredParts.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-8">Parça bulunamadı.</td></tr>
                        ) : (
                            filteredParts.map((part, index) => (
                                <tr
                                    key={part.part_code}
                                    onClick={() => part.inkrReport && handleViewRecord(part.inkrReport)}
                                    className={`transition-colors ${part.inkrReport ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                                    style={{
                                        opacity: 0,
                                        animation: `fadeIn 0.3s ease-in forwards ${index * 0.05}s`
                                    }}
                                >
                                    <td className="font-medium text-foreground">{part.part_code}</td>
                                    <td className="text-foreground">{part.part_name}</td>
                                    <td>
                                        {part.hasInkr ? (
                                            <Badge variant="success" className="bg-green-500">Mevcut</Badge>
                                        ) : (
                                            <Badge variant="destructive" className="bg-red-500">Eksik</Badge>
                                        )}
                                    </td>
                                    <td className="text-muted-foreground">{part.inkrReport?.supplier?.name || '-'}</td>
                                    <td className="text-muted-foreground">
                                        {part.inkrReport?.report_date ? new Date(part.inkrReport.report_date).toLocaleDateString('tr-TR') : '-'}
                                    </td>
                                    <td>
                                        {part.inkrReport ? (
                                            <Badge variant={getStatusVariant(part.inkrReport.status)}>{part.inkrReport.status}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        {part.inkrReport ? (
                                            <>
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(part.inkrReport)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleViewRecord(part.inkrReport)}><FileText className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(part.inkrReport.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setSelectedReport({ part_code: part.part_code, part_name: part.part_name });
                                                setIsModalOpen(true);
                                            }}>
                                                <Plus className="h-4 w-4 mr-1" /> Ekle
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InkrManagement;
