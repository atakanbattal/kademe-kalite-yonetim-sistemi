import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Plus, Trash2, Edit, Search, FileText, X, MoreHorizontal, Eye, ExternalLink, Check, XCircle as CircleX } from 'lucide-react';
    import { motion } from 'framer-motion';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { useDropzone } from 'react-dropzone';
    import { v4 as uuidv4 } from 'uuid';
    import { useData } from '@/contexts/DataContext';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { Badge } from '@/components/ui/badge';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
    import { sanitizeFileName } from '@/lib/utils';
    import { materialStandards, materialQualityOptions, allStandardOptions } from './constants';
    import { openPrintableReport } from '@/lib/reportUtils';
    import SheetMetalDetailModal from '@/components/incoming-quality/SheetMetalDetailModal';

    const getInitialItemState = () => ({
      temp_id: uuidv4(),
      uzunluk: '',
      genislik: '',
      kalinlik: '',
      material_quality: '',
      malzeme_standarti: '',
      lot_number: '',
      quantity: '',
      weight: '',
      hardness: '',
      decision: 'Beklemede',
      certificates: [],
      new_certificates: [],
      heat_number: '',
      coil_no: '',
      sertifika_turu: '3.1'
    });
    
    const SheetMetalFormModal = ({ isOpen, setIsOpen, existingRecord, refreshData, isViewMode }) => {
        const { toast } = useToast();
        const { suppliers } = useData();
        const isEditMode = !!existingRecord;
        const [formData, setFormData] = useState({});
        const [items, setItems] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [signedUrls, setSignedUrls] = useState({});
    
        useEffect(() => {
            const generateSignedUrls = async (recordItems) => {
                if (!recordItems || recordItems.length === 0) return;
                const urls = {};
                for (const item of recordItems) {
                    if (item.certificates) {
                        for (const cert of item.certificates) {
                            if (cert.path && !urls[cert.path]) {
                                const { data, error } = await supabase.storage.from('incoming_control').createSignedUrl(cert.path, 3600);
                                if (!error) {
                                    urls[cert.path] = data.signedUrl;
                                }
                            }
                        }
                    }
                }
                setSignedUrls(urls);
            };
    
            if (isOpen) {
                if (isEditMode && existingRecord) {
                    setFormData({
                        supplier_id: existingRecord.supplier_id || '',
                        delivery_note_number: existingRecord.delivery_note_number,
                        entry_date: new Date(existingRecord.entry_date).toISOString().split('T')[0],
                    });
                    const recordItem = { ...existingRecord, temp_id: existingRecord.id, new_certificates: [] };
                    setItems([recordItem]);
                    generateSignedUrls([recordItem]);
                } else {
                    setFormData({
                        entry_date: new Date().toISOString().split('T')[0],
                        supplier_id: null,
                        delivery_note_number: ''
                    });
                    setItems([getInitialItemState()]);
                    setSignedUrls({});
                }
            }
        }, [isOpen, existingRecord, isEditMode]);
    
        const handleItemChange = (index, field, value) => {
            const newItems = [...items];
            newItems[index][field] = value;
            
            if (field === 'material_quality') {
                const standards = materialStandards[value];
                if (standards && standards.length > 0) {
                    newItems[index]['malzeme_standarti'] = standards[0];
                } else {
                     newItems[index]['malzeme_standarti'] = '';
                }
            }
            
            setItems(newItems);
        };
    
        const handleFileDrop = useCallback((acceptedFiles, index) => {
            setItems(prevItems => {
                const newItems = [...prevItems];
                const currentFiles = newItems[index].new_certificates || [];
                newItems[index].new_certificates = [...currentFiles, ...acceptedFiles];
                return newItems;
            });
        }, []);
    
        const removeNewFile = (itemIndex, fileIndex) => {
            setItems(prevItems => {
              const newItems = [...prevItems];
              newItems[itemIndex].new_certificates.splice(fileIndex, 1);
              return newItems;
            });
        };
        
        const removeExistingFile = async (itemIndex, fileIndex) => {
            setIsSubmitting(true);
            const item = items[itemIndex];
            const fileToRemove = item.certificates[fileIndex];
    
            const { error } = await supabase.storage.from('incoming_control').remove([fileToRemove.path]);
            if(error){
                toast({variant: 'destructive', title: 'Hata', description: 'Dosya silinemedi: '+error.message});
                setIsSubmitting(false);
                return;
            }
            
            const updatedCertificates = item.certificates.filter((_, idx) => idx !== fileIndex);
            
            const { error: dbError } = await supabase
                .from('sheet_metal_items')
                .update({ certificates: updatedCertificates })
                .eq('id', item.id);
    
            if(dbError){
                 toast({variant: 'destructive', title: 'Hata', description: 'Dosya veritabanından silinemedi: '+dbError.message});
            } else {
                setItems(prevItems => {
                    const newItems = [...prevItems];
                    newItems[itemIndex].certificates.splice(fileIndex, 1);
                    return newItems;
                });
                toast({title: 'Başarılı', description: 'Sertifika silindi.'});
            }
            setIsSubmitting(false);
        };
    
        const addItem = () => setItems([...items, getInitialItemState()]);
        const removeItem = (index) => setItems(items.filter((_, i) => i !== index));
    
        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
        
            const itemsToUpsert = [];
            
            for (const item of items) {
                let uploadedFilePaths = item.certificates || [];
                if (item.new_certificates && item.new_certificates.length > 0) {
                    const uploadPromises = item.new_certificates.map(file => {
                        const filePath = `sheet_metal_certs/${item.id || item.temp_id}/${uuidv4()}-${sanitizeFileName(file.name)}`;
                        return supabase.storage.from('incoming_control').upload(filePath, file);
                    });
                    const uploadResults = await Promise.all(uploadPromises);
                    
                    const uploadErrors = uploadResults.filter(res => res.error);
                    if (uploadErrors.length > 0) {
                        toast({variant: 'destructive', title: 'Hata', description: `Dosya yüklenemedi: ${uploadErrors[0].error.message}`});
                        setIsSubmitting(false);
                        return;
                    }
    
                    const newPaths = uploadResults.map((res, idx) => ({ name: item.new_certificates[idx].name, path: res.data?.path })).filter(f => f.path);
                    uploadedFilePaths = [...(item.certificates || []), ...newPaths];
                }
                
                const { temp_id, new_certificates, supplier, ...itemData } = item;
                
                const dbItem = {
                    ...itemData,
                    ...formData,
                    certificates: uploadedFilePaths,
                };
                itemsToUpsert.push(dbItem);
            }
        
            const { error: itemsError } = await supabase.from('sheet_metal_items').upsert(itemsToUpsert, { onConflict: 'id' });
        
            if (itemsError) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Sac kalemleri kaydedilemedi: ${itemsError.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Sac giriş kaydı başarıyla kaydedildi.' });
                refreshData();
                setIsOpen(false);
            }
            setIsSubmitting(false);
        };
        
        const FileUploadComponent = ({ item, index, isViewMode }) => {
            const onDrop = (files) => handleFileDrop(files, index);
            const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: isViewMode });
    
            return (<div className="col-span-full">
                <Label>Sertifikalar</Label>
                {!isViewMode && <div {...getRootProps()} className={`mt-1 p-4 border-2 border-dashed rounded-lg cursor-pointer text-center ${isDragActive ? 'border-primary' : 'border-border'}`}>
                    <input {...getInputProps()} />
                    <p className="text-sm text-muted-foreground">Dosyaları sürükleyin veya seçin</p>
                </div>}
                <div className="mt-2 space-y-1">
                    {(item.certificates || []).map((cert, fileIndex) => (
                        <div key={`cert-${fileIndex}`} className="flex items-center justify-between text-sm">
                            <a href={signedUrls[cert.path]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><FileText className="h-4 w-4" />{cert.name}<ExternalLink className="h-3 w-3" /></a>
                            {!isViewMode && <Button variant="ghost" size="icon" disabled={isSubmitting} onClick={() => removeExistingFile(index, fileIndex)}><X className="w-4 h-4 text-destructive" /></Button>}
                        </div>
                    ))}
                    {(item.new_certificates || []).map((file, fileIndex) => (
                        <div key={`new-${fileIndex}`} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><FileText className="h-4 w-4" />{file.name}</span>
                            {!isViewMode && <Button variant="ghost" size="icon" onClick={() => removeNewFile(index, fileIndex)}><X className="w-4 h-4" /></Button>}
                        </div>
                    ))}
                </div>
            </div>);
        };
    
        const title = isViewMode ? "Sac Kalemini Görüntüle" : isEditMode ? "Sac Kalemini Düzenle" : "Yeni Sac Malzeme Girişi";
    
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-7xl">
                    <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit}><ScrollArea className="h-[75vh] p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div><Label>Giriş Tarihi</Label><Input type="date" value={formData.entry_date || ''} onChange={(e) => setFormData(f => ({ ...f, entry_date: e.target.value }))} required disabled={isViewMode} /></div>
                            <div><Label>Tedarikçi</Label><Select value={formData.supplier_id || ''} onValueChange={(v) => setFormData(f => ({ ...f, supplier_id: v }))} disabled={isViewMode}><SelectTrigger><SelectValue placeholder="Tedarikçi seçin..." /></SelectTrigger><SelectContent>{(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>İrsaliye No</Label><Input value={formData.delivery_note_number || ''} onChange={(e) => setFormData(f => ({ ...f, delivery_note_number: e.target.value }))} disabled={isViewMode} /></div>
                        </div>
                        <div className="space-y-4">
                            {items.map((item, index) => {
                                const standardOptions = materialStandards[item.material_quality] || allStandardOptions;
                                return (
                                    <div key={item.temp_id} className="p-4 border rounded-lg space-y-2 relative">
                                        {!isViewMode && items.length > 1 && !isEditMode && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeItem(index)}><X className="h-4 w-4" /></Button>}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div><Label>Kalite</Label><Select value={item.material_quality || ''} onValueChange={(v) => handleItemChange(index, 'material_quality', v)} disabled={isViewMode}><SelectTrigger><SelectValue placeholder="Kalite seçin..."/></SelectTrigger><SelectContent><ScrollArea className="h-60">{materialQualityOptions.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                                            <div><Label>Standart</Label><Select value={item.malzeme_standarti || ''} onValueChange={(v) => handleItemChange(index, 'malzeme_standarti', v)} disabled={isViewMode}><SelectTrigger><SelectValue placeholder="Standart seçin..."/></SelectTrigger><SelectContent><ScrollArea className="h-60">{standardOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
                                            <div><Label>Uzunluk (mm)</Label><Input type="number" value={item.uzunluk || ''} onChange={(e) => handleItemChange(index, 'uzunluk', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Genişlik (mm)</Label><Input type="number" value={item.genislik || ''} onChange={(e) => handleItemChange(index, 'genislik', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Kalınlık (mm)</Label><Input type="number" value={item.kalinlik || ''} onChange={(e) => handleItemChange(index, 'kalinlik', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Sertifika Türü</Label><Select value={item.sertifika_turu || '3.1'} onValueChange={(v) => handleItemChange(index, 'sertifika_turu', v)} disabled={isViewMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="2.1">2.1</SelectItem><SelectItem value="2.2">2.2</SelectItem><SelectItem value="3.1">3.1</SelectItem><SelectItem value="3.2">3.2</SelectItem></SelectContent></Select></div>
                                            <div><Label>Heat No (Şarj)</Label><Input value={item.heat_number || ''} onChange={(e) => handleItemChange(index, 'heat_number', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Coil No (Bobin)</Label><Input value={item.coil_no || ''} onChange={(e) => handleItemChange(index, 'coil_no', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Adet</Label><Input type="number" value={item.quantity || ''} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Ağırlık (kg)</Label><Input type="number" value={item.weight || ''} onChange={(e) => handleItemChange(index, 'weight', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Sertlik (HRB/HRC)</Label><Input value={item.hardness || ''} onChange={(e) => handleItemChange(index, 'hardness', e.target.value)} disabled={isViewMode} /></div>
                                            <div><Label>Karar</Label><Select value={item.decision || 'Beklemede'} onValueChange={(v) => handleItemChange(index, 'decision', v)} disabled={isViewMode}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Beklemede">Beklemede</SelectItem><SelectItem value="Kabul">Kabul</SelectItem><SelectItem value="Şartlı Kabul">Şartlı Kabul</SelectItem><SelectItem value="Ret">Ret</SelectItem></SelectContent></Select></div>
                                            <FileUploadComponent item={item} index={index} isViewMode={isViewMode} />
                                        </div>
                                    </div>
                                )
                            })}
                             {!isViewMode && !isEditMode && <Button type="button" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-2" /> Kalem Ekle</Button>}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                        {!isViewMode && <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>}
                    </DialogFooter></form>
                </DialogContent>
            </Dialog>
        );
    };
    
    const SheetMetalManagement = () => {
        const { toast } = useToast();
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isFormModalOpen, setFormModalOpen] = useState(false);
        const [selectedRecord, setSelectedRecord] = useState(null);
        const [searchTerm, setSearchTerm] = useState('');
        const [isViewMode, setIsViewMode] = useState(false);
        const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

        const fetchRecords = useCallback(async () => {
            setLoading(true);
            try {
                // sheet_metal_items'ten TÜM kalemler al
                let query = supabase
                    .from('sheet_metal_items')
                    .select('*, supplier:suppliers(name)')
                    .order('entry_date', { ascending: false });
                
                if (searchTerm) {
                    const term = `%${searchTerm.toLowerCase()}%`;
                    query = query.or(`delivery_note_number.ilike.${term},supplier.name.ilike.${term},material_quality.ilike.${term},heat_number.ilike.${term},coil_no.ilike.${term}`);
                }
                
                let { data: allItems, error: itemsError } = await query;
                
                if (itemsError) throw itemsError;
                
                // Kalemler'i delivery_note_number'e göre GROUP'la (Her giriş bir entry)
                const entriesMap = new Map();
                (allItems || []).forEach(item => {
                    const key = `${item.delivery_note_number}|${item.entry_date}|${item.supplier_id}`;
                    if (!entriesMap.has(key)) {
                        entriesMap.set(key, {
                            id: item.id,
                            delivery_note_number: item.delivery_note_number,
                            entry_date: item.entry_date,
                            supplier_id: item.supplier_id,
                            supplier: item.supplier,
                            sheet_metal_items: []
                        });
                    }
                    entriesMap.get(key).sheet_metal_items.push(item);
                });
                
                const entries = Array.from(entriesMap.values());
                setItems(entries);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: 'Veri alınamadı: ' + error.message });
                setItems([]);
            }
            setLoading(false);
        }, [toast, searchTerm]);
    
        useEffect(() => {
            const delayDebounceFn = setTimeout(() => { fetchRecords(); }, 300);
            return () => clearTimeout(delayDebounceFn);
        }, [fetchRecords, searchTerm]);
    
        const handleView = (record) => { 
            setSelectedRecord(record); 
            setIsDetailModalOpen(true); 
        };
        const handleEdit = (record) => { setSelectedRecord(record); setIsViewMode(false); setFormModalOpen(true); };
        const handleNew = () => { setSelectedRecord(null); setIsViewMode(false); setFormModalOpen(true); };
        const handleDelete = async (id) => {
            const { error } = await supabase.from('sheet_metal_items').delete().eq('id', id);
            if (error) { toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt silinemedi: ${error.message}` }); } 
            else { toast({ title: 'Başarılı!', description: 'Sac kalemi silindi.' }); fetchRecords(); }
        };

        const getDecisionBadge = (decision) => {
            switch (decision) {
                case 'Kabul': return <Badge variant="success">Kabul</Badge>;
                case 'Şartlı Kabul': return <Badge variant="warning">Şartlı Kabul</Badge>;
                case 'Ret': return <Badge variant="destructive">Ret</Badge>;
                default: return <Badge variant="secondary">Beklemede</Badge>;
            }
        };
        
        const hasCertificates = (item) => item.certificates && item.certificates.length > 0;
        
        return (
            <div className="dashboard-widget">
                <SheetMetalFormModal isOpen={isFormModalOpen} setIsOpen={setFormModalOpen} existingRecord={selectedRecord} refreshData={fetchRecords} isViewMode={isViewMode} />
                <SheetMetalDetailModal isOpen={isDetailModalOpen} setIsOpen={setIsDetailModalOpen} record={selectedRecord} onDownloadPDF={(record) => {
                    openPrintableReport(record, 'sheet_metal_entry', true);
                }} />
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="İrsaliye, tedarikçi, kalite, heat/coil no ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" /> Yeni Giriş</Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table w-full">
                        <thead><tr><th>İrsaliye No</th><th>Tedarikçi</th><th>Giriş Tarihi</th><th>Kalite</th><th>Heat No</th><th>Coil No</th><th>Karar</th><th>Sertifika</th><th>İşlemler</th></tr></thead>
                        <tbody>
                            {loading ? (<tr><td colSpan="9" className="text-center py-8">Yükleniyor...</td></tr>) 
                            : items.length === 0 ? (<tr><td colSpan="9" className="text-center py-8">Kayıt bulunamadı.</td></tr>) 
                            : (items.flatMap((entry) => {
                                const kalemler = entry.sheet_metal_items || [];
                                return kalemler.map((item, itemIdx) => (
                                    <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => handleView(entry)} className="cursor-pointer">
                                        <td className="font-medium text-foreground">{itemIdx === 0 ? (entry.delivery_note_number || '-') : ''}</td>
                                        <td>{itemIdx === 0 ? (entry.supplier?.name || '-') : ''}</td>
                                        <td>{itemIdx === 0 ? new Date(entry.entry_date).toLocaleDateString('tr-TR') : ''}</td>
                                        <td>{item.material_quality || '-'}</td>
                                        <td>{item.heat_number || '-'}</td>
                                        <td>{item.coil_no || '-'}</td>
                                        <td>{getDecisionBadge(item.decision)}</td>
                                        <td className='text-center'>{hasCertificates(item) ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <CircleX className="h-5 w-5 text-red-500 mx-auto" />}</td>
                                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                            {itemIdx === 0 && (
                                                <AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleView(entry)}><Eye className="mr-2 h-4 w-4" /> Görüntüle</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEdit(entry)}><Edit className="mr-2 h-4 w-4" /> Düzenle</DropdownMenuItem>
                                                        <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Sil</DropdownMenuItem></AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Emin misiniz?</AlertDialogTitle><AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(entry.id)} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent></AlertDialog>
                                            )}
                                        </td>
                                    </motion.tr>
                                ));
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    export default SheetMetalManagement;