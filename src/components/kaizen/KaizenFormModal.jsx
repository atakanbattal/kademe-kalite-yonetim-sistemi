import React, { useState, useEffect, useCallback } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
    import { Checkbox } from '@/components/ui/checkbox';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { v4 as uuidv4 } from 'uuid';
    import { useDropzone } from 'react-dropzone';
    import { UploadCloud, File as FileIcon, Trash2, BrainCircuit, Fish, HelpCircle, Sigma, Calendar as CalendarIcon } from 'lucide-react';
    import { sanitizeFileName } from '@/lib/utils';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import KaizenA3Template from './KaizenA3Template';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { format } from 'date-fns';
    import { MultiSelectPopover } from '@/components/ui/multi-select-popover';

    const KAIZEN_STATUSES = ['Taslak', 'İncelemede', 'Onaylandı', 'Uygulamada', 'Standartlaştırıldı', 'Kapandı', 'Reddedildi', 'Askıda'];
    const KAIZEN_PRIORITIES = ['Düşük', 'Orta', 'Yüksek'];
    const KAIZEN_TOPICS = [
        { value: 'İSG', label: 'İSG' },
        { value: 'Maliyet', label: 'Maliyet' },
        { value: 'Verim', label: 'Verim' },
        { value: 'Kalite', label: 'Kalite' },
        { value: 'İK', label: 'İK' },
        { value: 'Çevre', label: 'Çevre' },
        { value: 'Eğitim', label: 'Eğitim' },
        { value: 'Süreç', label: 'Süreç' },
        { value: 'Diğer', label: 'Diğer' },
    ];
    const FAULT_TYPES = ['Kaynak', 'Boya', 'Montaj', 'Elektrik', 'Etiket', 'Lojistik', 'Diğer'];
    const ISG_EFFECTS = [
        { value: 'Risk Azaldı', label: 'Risk Azaldı' },
        { value: 'Ergonomi İyileşti', label: 'Ergonomi İyileşti' },
        { value: 'Kaza Riski Ortadan Kalktı', label: 'Kaza Riski Ortadan Kalktı' },
        { value: 'Etkisi Yok', label: 'Etkisi Yok' },
    ];
    const ENV_EFFECTS = [
        { value: 'Atık Azaltıldı', label: 'Atık Azaltıldı' },
        { value: 'Enerji Tasarrufu', label: 'Enerji Tasarrufu' },
        { value: 'Kimyasal Kullanımı Azaldı', label: 'Kimyasal Kullanımı Azaldı' },
        { value: 'Karbon Ayak İzi Azaltıldı', label: 'Karbon Ayak İzi Azaltıldı' },
        { value: 'Etkisi Yok', label: 'Etkisi Yok' },
    ];

    const FileUploader = ({ files, onFilesChange, title }) => {
        const onDrop = useCallback(acceptedFiles => {
            const newFiles = acceptedFiles.map(file => Object.assign(file, {
                preview: URL.createObjectURL(file),
                id: uuidv4()
            }));
            onFilesChange([...files, ...newFiles]);
        }, [files, onFilesChange]);

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            onDrop,
            accept: {
                'image/jpeg': ['.jpeg', '.jpg'],
                'image/png': ['.png'],
                'image/gif': ['.gif'],
                'image/webp': ['.webp'],
                'application/pdf': ['.pdf'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            }
        });

        const removeFile = (fileId) => {
            const newFiles = files.filter(f => f.id !== fileId);
            onFilesChange(newFiles);
        };

        return (
            <div className="space-y-2">
                <Label>{title}</Label>
                <div {...getRootProps()} className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <input {...getInputProps()} />
                    <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Dosyaları buraya sürükleyin veya seçmek için tıklayın</p>
                </div>
                {files && files.length > 0 && (
                    <div className="mt-2 space-y-2">
                        {files.map(file => (
                            <div key={file.id || file.name} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                <div className="flex items-center gap-2">
                                    <FileIcon className="h-5 w-5" />
                                    <span className="text-sm truncate">{file.name}</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeFile(file.id || file.name)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const getInitialData = (kaizenType) => ({
        kaizen_type: kaizenType, title: '', description: '', status: 'Taslak', priority: 'Orta',
        proposer_id: null, responsible_person_id: null, department_id: null, vehicle_type: '',
        affected_area: '', is_supplier_kaizen: false, supplier_id: null, fault_type: '',
        part_cost: 0, monthly_production_quantity: 0, defective_parts_before: 0, defective_parts_after: 0,
        labor_time_saving_minutes: 0, minute_cost: 0,
        isg_effect: [], environmental_effect: [],
        attachments_before: [], attachments_after: [],
        total_monthly_gain: 0, total_yearly_gain: 0,
        kaizen_topic: [],
        analysis_5n1k: { what: '', where: '', when: '', who: '', why: '', how: '' },
        analysis_5_whys: { why1: '', why2: '', why3: '', why4: '', why5: '', answer1: '', answer2: '', answer3: '', answer4: '', answer5: '' },
        analysis_fishbone: { man: '', machine: '', method: '', material: '', environment: '', measurement: '' },
        solution_description: '',
        start_date: null, end_date: null, team_members: [],
        cost_benefit_score: 5, // 1-10 arası
        difficulty_score: 5, // 1-10 arası (tersine - kolay = 10, zor = 1)
        employee_participation_score: 5, // 1-10 arası
        kaizen_score: 0, // Otomatik hesaplanacak
        a3_format: {
            problem_definition: '',
            current_state: '',
            target_state: '',
            root_cause_analysis: '',
            solution_plan: '',
            implementation_plan: '',
            results_and_followup: '',
            team_members: '',
            start_date: '',
            end_date: ''
        }
    });

    const KaizenFormModal = ({ isOpen, setIsOpen, onSuccess, existingKaizen, kaizenType, personnel, units, suppliers }) => {
        const { toast } = useToast();
        const isEditMode = !!existingKaizen;
        const [formData, setFormData] = useState(getInitialData(kaizenType));
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [attachmentsBefore, setAttachmentsBefore] = useState([]);
        const [attachmentsAfter, setAttachmentsAfter] = useState([]);
        const [activeTab, setActiveTab] = useState("general");

        const calculateGains = useCallback((data) => {
            const defectiveReduction = (parseFloat(data.defective_parts_before) || 0) - (parseFloat(data.defective_parts_after) || 0);
            const partCost = parseFloat(data.part_cost) || 0;
            const scrapGain = defectiveReduction * partCost;

            const laborSavingPerPiece = parseFloat(data.labor_time_saving_minutes) || 0;
            const minuteCost = parseFloat(data.department?.cost_per_minute) || parseFloat(data.minute_cost) || 0;
            const laborGain = defectiveReduction * laborSavingPerPiece * minuteCost;

            const otherGains = (parseFloat(data.energy_saving) || 0) + (parseFloat(data.other_saving) || 0);
            
            const totalMonthlyGain = scrapGain + laborGain + otherGains;
            const totalYearlyGain = totalMonthlyGain * 12;
            
            // ROI hesaplama (basit yaklaşım: yıllık kazanç / başlangıç yatırımı × 100)
            // Başlangıç yatırımı için part_cost ve labor maliyetlerini kullanabiliriz
            const initialInvestment = (parseFloat(data.part_cost) || 0) * (parseFloat(data.defective_parts_before) || 0);
            const roi = initialInvestment > 0 ? (totalYearlyGain / initialInvestment) * 100 : 0;

            return { 
                total_monthly_gain: totalMonthlyGain, 
                total_yearly_gain: totalYearlyGain,
                roi: roi
            };
        }, []);

        const calculateKaizenScore = useCallback((data) => {
            const costBenefit = parseFloat(data.cost_benefit_score) || 5;
            const difficulty = parseFloat(data.difficulty_score) || 5; // Tersine: kolay = 10, zor = 1
            const participation = parseFloat(data.employee_participation_score) || 5;
            
            // Skor = (Maliyet Faydası × 0.4) + (Zorluk Derecesi × 0.3) + (Çalışan Katılımı × 0.3)
            const score = (costBenefit * 0.4) + (difficulty * 0.3) + (participation * 0.3);
            
            return Math.round(score * 10) / 10; // 1 ondalık basamak
        }, []);

        const normalizeMultiSelect = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    return [];
                }
            }
            return [];
        };

        // ÖNEMLİ: Modal verilerini koru - sadece existingKaizen değiştiğinde yükle
        useEffect(() => {
            if (!isOpen) {
                // Modal kapalıyken hiçbir şey yapma - veriler korunmalı
                return;
            }

            if (isEditMode) {
                // Düzenleme modu: Mevcut kaizen verilerini yükle
                console.log('📝 Kaizen düzenleme modu:', existingKaizen.id);
                const gains = calculateGains(existingKaizen);
                setFormData({
                    ...getInitialData(existingKaizen.kaizen_type),
                    ...existingKaizen,
                    analysis_5n1k: existingKaizen.analysis_5n1k || getInitialData().analysis_5n1k,
                    analysis_5_whys: existingKaizen.analysis_5_whys || getInitialData().analysis_5_whys,
                    analysis_fishbone: existingKaizen.analysis_fishbone || getInitialData().analysis_fishbone,
                    a3_format: existingKaizen.a3_format || getInitialData().a3_format,
                    kaizen_topic: normalizeMultiSelect(existingKaizen.kaizen_topic),
                    isg_effect: normalizeMultiSelect(existingKaizen.isg_effect),
                    environmental_effect: normalizeMultiSelect(existingKaizen.environmental_effect),
                    team_members: normalizeMultiSelect(existingKaizen.team_members),
                    ...gains
                });
                setAttachmentsBefore(existingKaizen.attachments_before || []);
                setAttachmentsAfter(existingKaizen.attachments_after || []);
                console.log('✅ Kaizen verileri yüklendi');
            } else if (isOpen) {
                // Yeni kaizen modu: Sadece modal YENİ açıldığında sıfırla
                console.log('➕ Yeni kaizen modu');
                setFormData(getInitialData(kaizenType));
                setAttachmentsBefore([]);
                setAttachmentsAfter([]);
            }
        }, [existingKaizen, isEditMode, isOpen, kaizenType, calculateGains]);

        // Skor değişikliklerini izle ve otomatik hesapla
        useEffect(() => {
            const score = calculateKaizenScore(formData);
            if (Math.abs(score - (formData.kaizen_score || 0)) > 0.01) {
                setFormData(prev => ({ ...prev, kaizen_score: score }));
            }
        }, [formData.cost_benefit_score, formData.difficulty_score, formData.employee_participation_score, calculateKaizenScore]);

        // Maliyet kazancı değişikliklerini izle ve otomatik hesapla
        useEffect(() => {
            const gains = calculateGains(formData);
            setFormData(prev => ({
                ...prev,
                total_monthly_gain: gains.total_monthly_gain,
                total_yearly_gain: gains.total_yearly_gain,
                roi: gains.roi
            }));
        }, [
            formData.part_cost,
            formData.monthly_production_quantity,
            formData.defective_parts_before,
            formData.defective_parts_after,
            formData.labor_time_saving_minutes,
            formData.minute_cost,
            formData.energy_saving,
            formData.other_saving,
            formData.department,
            calculateGains
        ]);

        const updateFormData = useCallback((newData) => {
            const gains = calculateGains(newData);
            setFormData({ ...newData, ...gains });
        }, [calculateGains]);
        
        const handleChange = (e) => {
            const { id, value, type } = e.target;
            const val = type === 'number' && value === '' ? null : value;
            updateFormData({ ...formData, [id]: val });
        };

        const handleAnalysisChange = (analysisType, field, value) => {
            updateFormData({
                ...formData,
                [analysisType]: {
                    ...formData[analysisType],
                    [field]: value,
                },
            });
        };

        const handleSelectChange = (id, value) => {
            let newFormData = { ...formData, [id]: value };
            if (id === 'department_id') {
                const selectedUnit = units.find(u => u.id === value);
                newFormData.minute_cost = selectedUnit?.cost_per_minute || 0;
            }
            updateFormData(newFormData);
        };
        
        const handleCheckboxChange = (id, checked) => {
            updateFormData({...formData, [id]: checked });
        };

        const uploadFiles = async (files, bucket) => {
            const uploadedFileObjects = [];
            const filesToUpload = files.filter(file => file instanceof File);
            const existingFiles = files.filter(file => !(file instanceof File));

            for (const file of filesToUpload) {
                const fileName = `${uuidv4()}-${sanitizeFileName(file.name)}`;
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(fileName, file, { contentType: file.type || 'application/octet-stream' });
                if (error) throw error;
                uploadedFileObjects.push({ name: file.name, path: data.path });
            }
            return [...existingFiles, ...uploadedFileObjects];
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);

            try {
                const attachments_before_objects = await uploadFiles(attachmentsBefore, 'kaizen_attachments');
                const attachments_after_objects = await uploadFiles(attachmentsAfter, 'kaizen_attachments');

                const { id, created_at, updated_at, kaizen_no, proposer, department, supplier, responsible_person, ...rest } = formData;
                
                const numericFields = ['part_cost', 'monthly_production_quantity', 'defective_parts_before', 'defective_parts_after', 'labor_time_saving_minutes', 'minute_cost', 'total_monthly_gain', 'total_yearly_gain', 'energy_saving', 'other_saving', 'roi'];

                const dataToSubmit = { ...rest, kaizen_score: formData.kaizen_score || calculateKaizenScore(formData) };
                numericFields.forEach(field => {
                    if (dataToSubmit[field] === '' || dataToSubmit[field] === null || dataToSubmit[field] === undefined) {
                        dataToSubmit[field] = 0;
                    } else {
                        dataToSubmit[field] = parseFloat(dataToSubmit[field]);
                    }
                });

                dataToSubmit.attachments_before = attachments_before_objects;
                dataToSubmit.attachments_after = attachments_after_objects;

                let error;
                if (isEditMode) {
                    const { error: updateError } = await supabase.from('kaizen_entries').update(dataToSubmit).eq('id', id);
                    error = updateError;
                } else {
                    const { error: insertError } = await supabase.from('kaizen_entries').insert([dataToSubmit]);
                    error = insertError;
                }

                if (error) throw error;

                toast({ title: 'Başarılı!', description: `Kaizen başarıyla ${isEditMode ? 'kaydedildi' : 'oluşturuldu'}.` });
                onSuccess();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `İşlem başarısız: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };
        
        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
        const unitOptions = units.map(u => ({ value: u.id, label: u.unit_name }));
        const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? 'Kaizen Düzenle' : 'Yeni Kaizen Ekle'}</DialogTitle>
                        <DialogDescription>Sürekli iyileştirme önerinizi analiz metodolojileri ile birlikte girin.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-7">
                                <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                                <TabsTrigger value="5n1k">5N1K</TabsTrigger>
                                <TabsTrigger value="5whys">5 Neden</TabsTrigger>
                                <TabsTrigger value="fishbone">Balık Kılçığı</TabsTrigger>
                                <TabsTrigger value="solution">Çözüm & Kanıt</TabsTrigger>
                                <TabsTrigger value="cost">Maliyet Analizi</TabsTrigger>
                                <TabsTrigger value="a3">A3 Formatı</TabsTrigger>
                            </TabsList>
                            <ScrollArea className="h-[65vh]">
                              <div className="p-4">
                                <TabsContent value="general">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-4"><Label htmlFor="title">Başlık / Kısa Tanım <span className="text-red-500">*</span></Label><Input id="title" value={formData.title || ''} onChange={handleChange} required /></div>
                                        <div className="md:col-span-4"><Label htmlFor="description">Genel Açıklama</Label><Textarea id="description" value={formData.description || ''} onChange={handleChange} rows={3} /></div>
                                        <div><Label>Durum</Label><Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KAIZEN_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                        <div><Label>Öncelik</Label><Select value={formData.priority} onValueChange={(v) => handleSelectChange('priority', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KAIZEN_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="md:col-span-2"><Label>Kaizen Konusu</Label><MultiSelectPopover options={KAIZEN_TOPICS} value={formData.kaizen_topic} onChange={(v) => handleSelectChange('kaizen_topic', v)} placeholder="Konu seçin..." /></div>
                                        
                                        <div className="md:col-span-2"><Label>Öneri Sahibi</Label><SearchableSelectDialog options={personnelOptions} value={formData.proposer_id} onChange={(v) => handleSelectChange('proposer_id', v)} triggerPlaceholder="Personel Seçin" /></div>
                                        <div className="md:col-span-2"><Label>Sorumlu Kişi</Label><SearchableSelectDialog options={personnelOptions} value={formData.responsible_person_id} onChange={(v) => handleSelectChange('responsible_person_id', v)} triggerPlaceholder="Personel Seçin" /></div>
                                        
                                        <div className="md:col-span-4"><Label>Kaizen Ekibi</Label><MultiSelectPopover options={personnelOptions} value={formData.team_members} onChange={(v) => handleSelectChange('team_members', v)} placeholder="Ekip üyesi seçin..." /></div>

                                        <div><Label>Başlangıç Tarihi</Label>
                                            <Popover><PopoverTrigger asChild>
                                                <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.start_date ? format(new Date(formData.start_date), "PPP") : <span>Tarih seçin</span>}
                                                </Button>
                                            </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.start_date ? new Date(formData.start_date) : null} onSelect={(d) => handleSelectChange('start_date', d)} initialFocus /></PopoverContent></Popover>
                                        </div>
                                        <div><Label>Bitiş Tarihi</Label>
                                            <Popover><PopoverTrigger asChild>
                                                <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.end_date ? format(new Date(formData.end_date), "PPP") : <span>Tarih seçin</span>}
                                                </Button>
                                            </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.end_date ? new Date(formData.end_date) : null} onSelect={(d) => handleSelectChange('end_date', d)} initialFocus /></PopoverContent></Popover>
                                        </div>

                                        <div className="md:col-span-2"><Label>Departman</Label><SearchableSelectDialog options={unitOptions} value={formData.department_id} onChange={(v) => handleSelectChange('department_id', v)} triggerPlaceholder="Departman Seçin" /></div>
                                        
                                        {kaizenType === 'vehicle_based' && (<>
                                            <div><Label>Araç Türü</Label><Input id="vehicle_type" value={formData.vehicle_type || ''} onChange={handleChange} /></div>
                                            <div><Label>Hata Türü</Label><Select value={formData.fault_type || ''} onValueChange={(v) => handleSelectChange('fault_type', v)}><SelectTrigger><SelectValue placeholder="Hata türü seçin..." /></SelectTrigger><SelectContent>{FAULT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                        </>)}
                                        {kaizenType === 'general' && (<>
                                            <div className="md:col-span-2"><Label>Etkilenen Hat/İstasyon/Bölge</Label><Input id="affected_area" value={formData.affected_area || ''} onChange={handleChange} /></div>
                                            <div className="flex items-center space-x-2 pt-6"><Checkbox id="is_supplier_kaizen" checked={!!formData.is_supplier_kaizen} onCheckedChange={(c) => handleCheckboxChange('is_supplier_kaizen', c)} /><Label htmlFor="is_supplier_kaizen">Tedarikçi Kaizen'i</Label></div>
                                            {formData.is_supplier_kaizen && (<div><Label>Tedarikçi</Label><SearchableSelectDialog options={supplierOptions} value={formData.supplier_id} onChange={(v) => handleSelectChange('supplier_id', v)} triggerPlaceholder="Tedarikçi Seçin" /></div>)}
                                        </>)}
                                    </div>
                                </TabsContent>
                                <TabsContent value="5n1k">
                                    <div className="space-y-4">
                                        <h4 className="font-semibold flex items-center gap-2"><HelpCircle className="w-5 h-5 text-primary" />5N1K - Problemin Tanımı</h4>
                                        <div><Label>Ne? (Problem ne?)</Label><Textarea value={formData.analysis_5n1k.what} onChange={(e) => handleAnalysisChange('analysis_5n1k', 'what', e.target.value)} /></div>
                                        <div><Label>Nerede? (Problem nerede ortaya çıkıyor?)</Label><Textarea value={formData.analysis_5n1k.where} onChange={(e) => handleAnalysisChange('analysis_5n1k', 'where', e.target.value)} /></div>
                                        <div><Label>Ne Zaman? (Problem ne zaman ortaya çıkıyor?)</Label><Textarea value={formData.analysis_5n1k.when} onChange={(e) => handleAnalysisChange('analysis_5n1k', 'when', e.target.value)} /></div>
                                        <div><Label>Kim? (Problemden kim/kimler etkileniyor?)</Label><Textarea value={formData.analysis_5n1k.who} onChange={(e) => handleAnalysisChange('analysis_5n1k', 'who', e.target.value)} /></div>
                                        <div><Label>Nasıl? (Problem nasıl ortaya çıkıyor?)</Label><Textarea value={formData.analysis_5n1k.how} onChange={(e) => handleAnalysisChange('analysis_5n1k', 'how', e.target.value)} /></div>
                                        <div><Label>Neden? (Bu problemin çözülmesi neden önemli?)</Label><Textarea value={formData.analysis_5n1k.why} onChange={(e) => handleAnalysisChange('analysis_5n1k', 'why', e.target.value)} /></div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="5whys">
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        <h4 className="font-semibold flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-primary" />5 Neden Analizi</h4>
                                        <div className="space-y-1"><Label>1. Neden?</Label><Textarea value={formData.analysis_5_whys.answer1 || ''} onChange={(e) => handleAnalysisChange('analysis_5_whys', 'answer1', e.target.value)} /></div>
                                        <div className="space-y-1"><Label>2. Neden?</Label><Textarea value={formData.analysis_5_whys.answer2 || ''} onChange={(e) => handleAnalysisChange('analysis_5_whys', 'answer2', e.target.value)} /></div>
                                        <div className="space-y-1"><Label>3. Neden?</Label><Textarea value={formData.analysis_5_whys.answer3 || ''} onChange={(e) => handleAnalysisChange('analysis_5_whys', 'answer3', e.target.value)} /></div>
                                        <div className="space-y-1"><Label>4. Neden?</Label><Textarea value={formData.analysis_5_whys.answer4 || ''} onChange={(e) => handleAnalysisChange('analysis_5_whys', 'answer4', e.target.value)} /></div>
                                        <div className="space-y-1"><Label>5. Neden? (Kök Neden)</Label><Textarea value={formData.analysis_5_whys.answer5 || ''} onChange={(e) => handleAnalysisChange('analysis_5_whys', 'answer5', e.target.value)} /></div>
                                    </div>
                                </TabsContent>
                                 <TabsContent value="fishbone">
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        <h4 className="font-semibold flex items-center gap-2"><Fish className="w-5 h-5 text-primary" />Balık Kılçığı Analizi</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div><Label>İnsan</Label><Textarea value={formData.analysis_fishbone.man} onChange={(e) => handleAnalysisChange('analysis_fishbone', 'man', e.target.value)} /></div>
                                            <div><Label>Makine</Label><Textarea value={formData.analysis_fishbone.machine} onChange={(e) => handleAnalysisChange('analysis_fishbone', 'machine', e.target.value)} /></div>
                                            <div><Label>Metot</Label><Textarea value={formData.analysis_fishbone.method} onChange={(e) => handleAnalysisChange('analysis_fishbone', 'method', e.target.value)} /></div>
                                            <div><Label>Malzeme</Label><Textarea value={formData.analysis_fishbone.material} onChange={(e) => handleAnalysisChange('analysis_fishbone', 'material', e.target.value)} /></div>
                                            <div><Label>Çevre</Label><Textarea value={formData.analysis_fishbone.environment} onChange={(e) => handleAnalysisChange('analysis_fishbone', 'environment', e.target.value)} /></div>
                                            <div><Label>Ölçüm</Label><Textarea value={formData.analysis_fishbone.measurement} onChange={(e) => handleAnalysisChange('analysis_fishbone', 'measurement', e.target.value)} /></div>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="solution">
                                    <div className="space-y-4">
                                        <h4 className="font-semibold flex items-center gap-2"><Sigma className="w-5 h-5 text-primary" />Çözüm ve Kanıtlar</h4>
                                        <div><Label>Uygulanan Çözüm</Label><Textarea id="solution_description" value={formData.solution_description || ''} onChange={handleChange} rows={5} /></div>
                                        <div className="md:col-span-4 border-t pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FileUploader files={attachmentsBefore} onFilesChange={setAttachmentsBefore} title="Öncesi Görselleri/Dokümanları" />
                                            <FileUploader files={attachmentsAfter} onFilesChange={setAttachmentsAfter} title="Sonrası Görselleri/Dokümanları" />
                                        </div>
                                    </div>
                                </TabsContent>
                                 <TabsContent value="cost">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <h4 className="md:col-span-4 font-semibold text-primary">Maliyet & Verimlilik Analizi</h4>
                                        <div><Label>Parça Maliyeti (₺)</Label><Input id="part_cost" type="number" step="0.01" value={formData.part_cost ?? ''} onChange={handleChange} /></div>
                                        <div><Label>Aylık Üretim Miktarı</Label><Input id="monthly_production_quantity" type="number" value={formData.monthly_production_quantity ?? ''} onChange={handleChange} /></div>
                                        <div><Label>Hatalı Parça Adedi (Önce)</Label><Input id="defective_parts_before" type="number" value={formData.defective_parts_before ?? ''} onChange={handleChange} /></div>
                                        <div><Label>Hatalı Parça Adedi (Sonra)</Label><Input id="defective_parts_after" type="number" value={formData.defective_parts_after ?? ''} onChange={handleChange} /></div>
                                        <div><Label>İşçilik Tasarrufu (dk/adet)</Label><Input id="labor_time_saving_minutes" type="number" step="0.01" value={formData.labor_time_saving_minutes ?? ''} onChange={handleChange} /></div>
                                        <div><Label>Dakika Maliyeti (₺)</Label><Input id="minute_cost" type="number" step="0.01" value={formData.minute_cost ?? ''} onChange={handleChange} disabled /></div>
                                        
                                        {/* Kaizen Skor Sistemi */}
                                        <div className="md:col-span-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                                            <h4 className="font-semibold text-primary mb-4 flex items-center gap-2">
                                                <BrainCircuit className="h-5 w-5" />
                                                Kaizen Skor Sistemi
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <Label htmlFor="cost_benefit_score">
                                                        Maliyet Faydası (1-10) <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="cost_benefit_score"
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={formData.cost_benefit_score ?? 5}
                                                        onChange={handleChange}
                                                        className="mt-1"
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Ağırlık: %40
                                                    </p>
                                                </div>
                                                <div>
                                                    <Label htmlFor="difficulty_score">
                                                        Zorluk Derecesi (1-10) <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="difficulty_score"
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={formData.difficulty_score ?? 5}
                                                        onChange={handleChange}
                                                        className="mt-1"
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Kolay=10, Zor=1 (Ağırlık: %30)
                                                    </p>
                                                </div>
                                                <div>
                                                    <Label htmlFor="employee_participation_score">
                                                        Çalışan Katılımı (1-10) <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="employee_participation_score"
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={formData.employee_participation_score ?? 5}
                                                        onChange={handleChange}
                                                        className="mt-1"
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Ağırlık: %30
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-primary/10 rounded-lg">
                                                    <Label className="text-sm text-muted-foreground">Kaizen Skoru</Label>
                                                    <p className="text-2xl font-bold text-primary mt-1">
                                                        {formData.kaizen_score?.toFixed(1) || '0.0'} / 10
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Otomatik hesaplanır
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="p-2 bg-green-50 rounded-lg md:col-span-1">
                                            <Label className="text-green-800">Aylık Kazanç</Label>
                                            <p className="font-bold text-lg text-green-700">{(formData.total_monthly_gain || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</p>
                                        </div>
                                        <div className="p-2 bg-blue-50 rounded-lg md:col-span-1">
                                            <Label className="text-blue-800">Yıllık Kazanç</Label>
                                            <p className="font-bold text-lg text-blue-700">{(formData.total_yearly_gain || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</p>
                                        </div>

                                        <div className="md:col-span-4 border-t pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <h4 className="md:col-span-2 font-semibold text-primary">İSG & Çevre Etkileri</h4>
                                          <div><Label>İSG Etkisi</Label><MultiSelectPopover options={ISG_EFFECTS} value={formData.isg_effect} onChange={(v) => handleSelectChange('isg_effect', v)} placeholder="Etki seçin..." /></div>
                                          <div><Label>Çevresel Etki</Label><MultiSelectPopover options={ENV_EFFECTS} value={formData.environmental_effect} onChange={(v) => handleSelectChange('environmental_effect', v)} placeholder="Etki seçin..." /></div>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="a3">
                                    <KaizenA3Template
                                        kaizenData={formData.a3_format || {}}
                                        onA3Change={(a3Data) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                a3_format: a3Data
                                            }));
                                        }}
                                    />
                                </TabsContent>
                              </div>
                            </ScrollArea>
                        </Tabs>
                        <DialogFooter className="p-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default KaizenFormModal;