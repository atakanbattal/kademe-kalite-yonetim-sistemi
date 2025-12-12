import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Save, X, Plus, Trash2 } from 'lucide-react';
import { generateWPSRecommendation } from '@/lib/wpsEngine';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Checkbox } from '@/components/ui/checkbox';

const initialPassPlan = { pass: 1, technique: '', torch_angle: '', min_current_a: '', max_current_a: '', min_voltage_v: '', max_voltage_v: '', current_polarity: 'DC+', travel_speed: '', heat_input: '' };

const WPSFormModal = ({ isOpen, setIsOpen, onSuccess, existingWPS, isViewMode, library }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [materialOptions, setMaterialOptions] = useState([]);

    useEffect(() => {
        if (library.materials.length > 0) {
            setMaterialOptions(library.materials.map(m => ({
                value: m.id,
                label: `${m.name} (${m.standard}) - Grup ${m.iso_15608_group}`
            })));
        }
    }, [library.materials]);

    const resetForm = useCallback(() => {
        const initialData = {
            wps_date: new Date().toISOString().split('T')[0],
            base_material_1_id: null,
            thickness_1: '',
            diameter_1: '',
            thickness_2: '',
            diameter_2: '',
            weld_type: 'Plate-Plate',
            joint_type: 'Butt',
            joint_detail: 'V',
            joint_angle: 60,
            root_gap: 2,
            welding_position: 'PA',
            welding_process_code: null,
            pass_plan: [initialPassPlan],
            status: 'Aktif',
            revision: 0,
            efficiency: 0.85,
            back_gouging: false,
            backing: false,
            prep_method: 'İşleme/Taşlama',
            tungsten_type: null,
            tungsten_size: null,
        };
        setFormData(existingWPS ? { ...initialData, ...existingWPS } : initialData);
    }, [existingWPS]);

    useEffect(() => {
        if (isOpen) {
            resetForm();
        }
    }, [isOpen, resetForm]);

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const newState = { ...prev, [field]: value };
            if (field === 'joint_detail' && value === 'I') {
                newState.joint_angle = null;
            }
            return newState;
        });
    };

    const calculateHeatInput = (pass) => {
        const minA = parseFloat(pass.min_current_a);
        const maxA = parseFloat(pass.max_current_a);
        const minV = parseFloat(pass.min_voltage_v);
        const maxV = parseFloat(pass.max_voltage_v);
        const speed = parseFloat(pass.travel_speed);
        const efficiency = parseFloat(formData.efficiency);

        if (isNaN(minA) || isNaN(maxA) || isNaN(minV) || isNaN(maxV) || isNaN(speed) || isNaN(efficiency) || speed === 0) {
            return '';
        }

        const avgA = (minA + maxA) / 2;
        const avgV = (minV + maxV) / 2;

        const heatInput = ((avgV * avgA * 60 * efficiency) / (1000 * speed));
        return heatInput.toFixed(2);
    };

    const handlePassPlanChange = (index, field, value) => {
        const newPassPlan = [...(formData.pass_plan || [])];
        const updatedPass = { ...newPassPlan[index], [field]: value };
        
        updatedPass.heat_input = calculateHeatInput(updatedPass);

        newPassPlan[index] = updatedPass;
        setFormData(prev => ({ ...prev, pass_plan: newPassPlan }));
    };

    const addPass = () => {
        setFormData(prev => ({
            ...prev,
            pass_plan: [...(prev.pass_plan || []), { ...initialPassPlan, pass: (prev.pass_plan?.length || 0) + 1 }]
        }));
    };

    const removePass = (index) => {
        setFormData(prev => ({
            ...prev,
            pass_plan: prev.pass_plan.filter((_, i) => i !== index)
        }));
    };

    const updateRecommendations = useCallback(() => {
        const material1 = library.materials.find(m => m.id === formData.base_material_1_id);
        if (material1 && formData.thickness_1 && formData.welding_position && formData.joint_type) {
            const recs = generateWPSRecommendation({
                material1,
                thickness: parseFloat(formData.thickness_1),
                position: formData.welding_position,
                jointType: formData.joint_type,
                jointDetail: formData.joint_detail,
                jointAngle: formData.joint_angle,
                rootGap: formData.root_gap,
                processCode: formData.welding_process_code, 
            }, library);
            
            setFormData(prev => ({
                ...prev,
                ...recs,
                welder_notes: recs.notes.join('\n'),
                reasoning_notes: recs.reasoning.join('\n'),
            }));
        }
    }, [formData.base_material_1_id, formData.thickness_1, formData.welding_position, formData.joint_type, formData.joint_detail, formData.joint_angle, formData.root_gap, formData.welding_process_code, library]);

    useEffect(() => {
        if (formData.base_material_1_id && formData.thickness_1) {
            const debounce = setTimeout(() => {
                updateRecommendations();
            }, 300);
            return () => clearTimeout(debounce);
        }
    }, [formData.base_material_1_id, formData.thickness_1, formData.welding_position, formData.joint_type, formData.joint_detail, formData.joint_angle, formData.root_gap, updateRecommendations]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const dbData = { ...formData };
        delete dbData.base_material_1;
        delete dbData.base_material_2;
        delete dbData.filler_material;
        delete dbData.shielding_gas;
        delete dbData.created_by;
        delete dbData.process;
        delete dbData.filler;
        delete dbData.gas;
        delete dbData.temperatures;
        delete dbData.notes;
        delete dbData.reasoning;
        
        const numericFields = ['thickness_1', 'diameter_1', 'thickness_2', 'diameter_2', 'filler_diameter', 'efficiency', 'joint_angle', 'root_gap', 'tungsten_size'];
        numericFields.forEach(field => {
            if (dbData[field] === '' || dbData[field] === undefined) {
                dbData[field] = null;
            }
        });

        if (!dbData.created_by_id) {
            if (user?.email) {
                const { data: personnelData, error: personnelError } = await supabase
                    .from('personnel')
                    .select('id')
                    .eq('email', user.email)
                    .single();

                if (personnelError || !personnelData) {
                    toast({ variant: 'destructive', title: 'Hata!', description: 'Personel kaydı bulunamadı. Lütfen yöneticinize başvurun.' });
                    setLoading(false);
                    return;
                }
                dbData.created_by_id = personnelData.id;
            } else {
                toast({ variant: 'destructive', title: 'Hata!', description: 'Kullanıcı kimliği bulunamadı. Lütfen tekrar giriş yapmayı deneyin.' });
                setLoading(false);
                return;
            }
        }

        // Undefined key'leri ve geçersiz kolonları temizle
        const cleanData = (data) => {
            const cleaned = {};
            for (const key in data) {
                if (data[key] !== undefined && key !== 'undefined') {
                    cleaned[key] = data[key];
                }
            }
            return cleaned;
        };

        let result;
        if (existingWPS?.id) {
            const { id, created_at, wps_no, ...updateData } = dbData;
            const cleanedUpdateData = cleanData(updateData);
            result = await supabase.from('wps_procedures').update(cleanedUpdateData).eq('id', id);
        } else {
            const { id, ...insertData } = dbData;
            const cleanedInsertData = cleanData(insertData);
            result = await supabase.from('wps_procedures').insert(cleanedInsertData);
        }

        if (result.error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `WPS kaydedilemedi: ${result.error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'WPS başarıyla kaydedildi.' });
            onSuccess();
        }
        setLoading(false);
    };

    const renderField = (label, field, component, className = "") => (
        <div className={`grid grid-cols-1 sm:grid-cols-3 items-start sm:items-center gap-2 sm:gap-4 ${className}`}>
            <Label htmlFor={field} className="text-left sm:text-right pt-2 sm:pt-0">{label}</Label>
            <div className="col-span-2">{component}</div>
        </div>
    );
    
    const weldType = formData.weld_type || 'Plate-Plate';
    const showThickness1 = true;
    const showDiameter1 = weldType === 'Pipe-Pipe' || weldType === 'Plate-Pipe';
    const showThickness2 = true;
    const showDiameter2 = weldType === 'Pipe-Pipe';
    const isButtJoint = formData.joint_type === 'Butt';
    const showJointAngle = isButtJoint && !['I'].includes(formData.joint_detail);
    const showRootGap = isButtJoint;
    const isTigProcess = formData.welding_process_code === '141';

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-6xl">
                <DialogHeader>
                    <DialogTitle>{isViewMode ? 'WPS Görüntüle' : (existingWPS ? 'WPS Düzenle' : 'Yeni WPS Oluştur')}</DialogTitle>
                    <DialogDescription>
                        {isViewMode ? `WPS No: ${formData.wps_no}` : 'Malzeme ve kalınlık seçerek otomatik öneriler alın.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <ScrollArea className="max-h-[75vh] p-1">
                        <div className="p-4 space-y-6">
                            <div className="p-4 border rounded-lg bg-slate-50/50">
                                <h3 className="text-lg font-medium text-primary mb-4">Temel Bilgiler</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                                    {renderField('Ana Malzeme', 'base_material_1_id', 
                                        <SearchableSelectDialog
                                            options={materialOptions}
                                            value={formData.base_material_1_id}
                                            onChange={(value) => handleInputChange('base_material_1_id', value)}
                                            triggerPlaceholder="Malzeme seçin..."
                                            dialogTitle="Malzeme Seç"
                                            disabled={isViewMode}
                                        />
                                    )}
                                    {renderField('Kaynak Tipi', 'weld_type', 
                                        <Select value={formData.weld_type} onValueChange={(v) => handleInputChange('weld_type', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Plate-Plate">Plaka-Plaka</SelectItem>
                                                <SelectItem value="Pipe-Pipe">Boru-Boru</SelectItem>
                                                <SelectItem value="Plate-Pipe">Plaka-Boru</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {showThickness1 && renderField(weldType === 'Plate-Pipe' ? 'Plaka Kalınlık (mm)' : 'Malzeme 1 Kalınlık (mm)', 'thickness_1', <Input id="thickness_1" type="number" value={formData.thickness_1 || ''} onChange={(e) => handleInputChange('thickness_1', e.target.value)} disabled={isViewMode} />)}
                                    {showDiameter1 && renderField(weldType === 'Plate-Pipe' ? 'Boru Çap (mm)' : 'Malzeme 1 Çap (mm)', 'diameter_1', <Input id="diameter_1" type="number" value={formData.diameter_1 || ''} onChange={(e) => handleInputChange('diameter_1', e.target.value)} disabled={isViewMode} />)}
                                    {showThickness2 && renderField(weldType === 'Plate-Pipe' ? 'Boru Kalınlık (mm)' : 'Malzeme 2 Kalınlık (mm)', 'thickness_2', <Input id="thickness_2" type="number" value={formData.thickness_2 || ''} onChange={(e) => handleInputChange('thickness_2', e.target.value)} disabled={isViewMode} />)}
                                    {showDiameter2 && renderField('Malzeme 2 Çap (mm)', 'diameter_2', <Input id="diameter_2" type="number" value={formData.diameter_2 || ''} onChange={(e) => handleInputChange('diameter_2', e.target.value)} disabled={isViewMode} />)}
                                    {renderField('Birleşim Tipi', 'joint_type', 
                                        <Select value={formData.joint_type} onValueChange={(v) => handleInputChange('joint_type', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Butt">Alın (Butt)</SelectItem>
                                                <SelectItem value="Fillet">Köşe (Fillet)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {isButtJoint && renderField('Kaynak Ağzı', 'joint_detail', 
                                        <Select value={formData.joint_detail} onValueChange={(v) => handleInputChange('joint_detail', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="I">I Ağzı</SelectItem>
                                                <SelectItem value="V">V Ağzı</SelectItem>
                                                <SelectItem value="X">X Ağzı</SelectItem>
                                                <SelectItem value="U">U Ağzı</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {showJointAngle && renderField('Kaynak Ağzı Açısı (°)', 'joint_angle', <Input id="joint_angle" type="number" value={formData.joint_angle || ''} onChange={(e) => handleInputChange('joint_angle', e.target.value)} disabled={isViewMode} />)}
                                    {showRootGap && renderField('Kök Aralığı (c)', 'root_gap', <Input id="root_gap" type="number" step="0.5" value={formData.root_gap || ''} onChange={(e) => handleInputChange('root_gap', e.target.value)} disabled={isViewMode} />)}
                                    {renderField('Kaynak Pozisyonu', 'welding_position', 
                                        <Select value={formData.welding_position} onValueChange={(v) => handleInputChange('welding_position', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PA">PA (Düz)</SelectItem>
                                                <SelectItem value="PB">PB (Yatay Köşe)</SelectItem>
                                                <SelectItem value="PC">PC (Yatay)</SelectItem>
                                                <SelectItem value="PD">PD (Tavan Köşe)</SelectItem>
                                                <SelectItem value="PE">PE (Tavan)</SelectItem>
                                                <SelectItem value="PF">PF (Aşağıdan Yukarı)</SelectItem>
                                                <SelectItem value="PG">PG (Yukarıdan Aşağı)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {renderField('WPS Tarihi', 'wps_date', <Input id="wps_date" type="date" value={formData.wps_date || ''} onChange={(e) => handleInputChange('wps_date', e.target.value)} disabled={isViewMode} />)}
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-slate-50/50">
                                <h3 className="text-lg font-medium text-primary mb-4">Parametreler ve Hazırlık</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                                    {renderField('Kaynak Prosesi', 'welding_process_code', 
                                        <Select value={formData.welding_process_code || ''} onValueChange={(v) => handleInputChange('welding_process_code', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue placeholder="Otomatik öneri..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="135">135 (MAG)</SelectItem>
                                                <SelectItem value="131">131 (MIG)</SelectItem>
                                                <SelectItem value="141">141 (TIG)</SelectItem>
                                                <SelectItem value="111">111 (MMA)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {renderField('Verim (η)', 'efficiency', <Input type="number" step="0.01" value={formData.efficiency || ''} onChange={(e) => handleInputChange('efficiency', e.target.value)} disabled={isViewMode} />)}
                                    {renderField('Dolgu Teli', 'filler_material_id', 
                                        <Select value={formData.filler_material_id} onValueChange={(v) => handleInputChange('filler_material_id', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                                            <SelectContent>{library.fillerMaterials.map(f => <SelectItem key={f.id} value={f.id}>{f.classification}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )}
                                    {renderField('Tel Çapı (mm)', 'filler_diameter', <Input type="number" step="0.1" value={formData.filler_diameter || ''} onChange={(e) => handleInputChange('filler_diameter', e.target.value)} disabled={isViewMode} />)}
                                    {isTigProcess && renderField('Tungsten Tipi/Ebatı', 'tungsten_type',
                                        <div className="flex gap-2">
                                            <Input placeholder="Tip (örn. WT20)" value={formData.tungsten_type || ''} onChange={(e) => handleInputChange('tungsten_type', e.target.value)} disabled={isViewMode} />
                                            <Input placeholder="Ebat (mm)" type="number" step="0.1" value={formData.tungsten_size || ''} onChange={(e) => handleInputChange('tungsten_size', e.target.value)} disabled={isViewMode} />
                                        </div>
                                    )}
                                    {renderField('Koruyucu Gaz', 'shielding_gas_id', 
                                        <Select value={formData.shielding_gas_id} onValueChange={(v) => handleInputChange('shielding_gas_id', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                                            <SelectContent>{library.shieldingGases.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )}
                                    {renderField('Gaz Debisi (L/dk)', 'gas_flow_rate', <Input value={formData.gas_flow_rate || ''} onChange={(e) => handleInputChange('gas_flow_rate', e.target.value)} disabled={isViewMode} />)}
                                    {renderField('Ön Tav (°C)', 'preheat_temperature', <Input value={formData.preheat_temperature || ''} onChange={(e) => handleInputChange('preheat_temperature', e.target.value)} disabled={isViewMode} />)}
                                    {renderField('Pasolar Arası Sıcaklık (°C)', 'interpass_temperature', <Input value={formData.interpass_temperature || ''} onChange={(e) => handleInputChange('interpass_temperature', e.target.value)} disabled={isViewMode} />)}
                                    {renderField('Arkadan Yarma', 'back_gouging', <Checkbox id="back_gouging" checked={formData.back_gouging} onCheckedChange={(c) => handleInputChange('back_gouging', c)} disabled={isViewMode} />)}
                                    {renderField('Kök Destek Parçası', 'backing', <Checkbox id="backing" checked={formData.backing} onCheckedChange={(c) => handleInputChange('backing', c)} disabled={isViewMode} />)}
                                    {renderField('Hazırlık Yöntemi', 'prep_method', 
                                        <Select value={formData.prep_method} onValueChange={(v) => handleInputChange('prep_method', v)} disabled={isViewMode}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="İşleme/Taşlama">İşleme/Taşlama</SelectItem>
                                                <SelectItem value="Fırçalama">Fırçalama</SelectItem>
                                                <SelectItem value="Kimyasal Temizleme">Kimyasal Temizleme</SelectItem>
                                                <SelectItem value="Gereksiz">Gereksiz</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-slate-50/50">
                                <h3 className="text-lg font-medium text-primary mb-4">Paso Planı</h3>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Paso</TableHead>
                                                <TableHead>Teknik</TableHead>
                                                <TableHead>Akım Türü</TableHead>
                                                <TableHead>Akım (A)</TableHead>
                                                <TableHead>Voltaj (V)</TableHead>
                                                <TableHead>İlerleme (mm/dk)</TableHead>
                                                <TableHead>Isı Girdisi (kJ/mm)</TableHead>
                                                {!isViewMode && <TableHead className="w-[50px]"></TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {formData.pass_plan?.map((pass, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">{pass.pass}</TableCell>
                                                    <TableCell><Input value={pass.technique || ''} onChange={(e) => handlePassPlanChange(index, 'technique', e.target.value)} disabled={isViewMode} /></TableCell>
                                                    <TableCell>
                                                        <Select value={pass.current_polarity} onValueChange={(v) => handlePassPlanChange(index, 'current_polarity', v)} disabled={isViewMode}>
                                                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="DC+">DC+</SelectItem>
                                                                <SelectItem value="DC-">DC-</SelectItem>
                                                                <SelectItem value="AC">AC</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Input placeholder="Min" className="w-16" value={pass.min_current_a || ''} onChange={(e) => handlePassPlanChange(index, 'min_current_a', e.target.value)} disabled={isViewMode} />
                                                            <span>-</span>
                                                            <Input placeholder="Max" className="w-16" value={pass.max_current_a || ''} onChange={(e) => handlePassPlanChange(index, 'max_current_a', e.target.value)} disabled={isViewMode} />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Input placeholder="Min" className="w-16" value={pass.min_voltage_v || ''} onChange={(e) => handlePassPlanChange(index, 'min_voltage_v', e.target.value)} disabled={isViewMode} />
                                                            <span>-</span>
                                                            <Input placeholder="Max" className="w-16" value={pass.max_voltage_v || ''} onChange={(e) => handlePassPlanChange(index, 'max_voltage_v', e.target.value)} disabled={isViewMode} />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell><Input value={pass.travel_speed || ''} onChange={(e) => handlePassPlanChange(index, 'travel_speed', e.target.value)} disabled={isViewMode} /></TableCell>
                                                    <TableCell><Input value={pass.heat_input || ''} disabled /></TableCell>
                                                    {!isViewMode && <TableCell><Button type="button" variant="destructive" size="icon" onClick={() => removePass(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {!isViewMode && <Button type="button" variant="outline" size="sm" onClick={addPass} className="mt-4"><Plus className="mr-2 h-4 w-4" />Paso Ekle</Button>}
                            </div>

                            {(formData.welder_notes || formData.reasoning_notes) && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-primary">Notlar ve İpuçları</h3>
                                    {formData.welder_notes && (
                                        <Alert>
                                            <Lightbulb className="h-4 w-4" />
                                            <AlertTitle>Kaynakçı Notları</AlertTitle>
                                            <AlertDescription>
                                                <pre className="whitespace-pre-wrap font-sans text-sm">{formData.welder_notes}</pre>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {formData.reasoning_notes && (
                                        <Alert variant="success">
                                            <Lightbulb className="h-4 w-4" />
                                            <AlertTitle>Neden Bu Öneri?</AlertTitle>
                                            <AlertDescription>
                                                <pre className="whitespace-pre-wrap font-sans text-sm">{formData.reasoning_notes}</pre>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    {!isViewMode && (
                        <DialogFooter className="pt-4 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button type="submit" disabled={loading}>
                                <Save className="mr-2 h-4 w-4" /> {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                        </DialogFooter>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default WPSFormModal;