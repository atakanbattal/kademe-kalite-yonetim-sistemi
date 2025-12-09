import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import InkrDetailModal from './InkrDetailModal';
import { openPrintableReport } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Search, Upload, FileText, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { useData } from '@/contexts/DataContext';
import { sanitizeFileName } from '@/lib/utils';

const InkrFormModal = ({ isOpen, setIsOpen, existingReport, refreshReports }) => {
    const { toast } = useToast();
    const isEditMode = !!existingReport;
    const [formData, setFormData] = useState({});
    const [suppliers, setSuppliers] = useState([]);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (existingReport && existingReport.id) {
                // Mevcut raporu düzenleme modu
                setFormData({ ...existingReport, report_date: existingReport.report_date ? new Date(existingReport.report_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] });
            } else {
                // Yeni rapor oluşturma modu (part_code ve part_name varsa önceden doldur)
                setFormData({
                    part_code: existingReport?.part_code || '', 
                    part_name: existingReport?.part_name || '', 
                    supplier_id: null,
                    report_date: new Date().toISOString().split('T')[0],
                    status: 'Beklemede', 
                    notes: '', 
                    items: []
                });
            }
            setFile(null);
        }
    }, [isOpen, existingReport]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
            if (!error) setSuppliers(data);
        };
        fetchSuppliers();
    }, []);

    const onDrop = useCallback(acceptedFiles => { setFile(acceptedFiles[0]); }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsUploading(true);

        let filePath = formData.file_path;
        let fileName = formData.file_name;

        if (file) {
            const sanitizedFileName = sanitizeFileName(file.name);
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 9);
            const safePartCode = String(formData.part_code || 'unknown').replace(/[^a-zA-Z0-9\-_]/g, '-');
            const newFilePath = `inkr_reports/${safePartCode}_${timestamp}_${randomStr}_${sanitizedFileName}`;
            const { error: uploadError } = await supabase.storage.from('incoming_control').upload(newFilePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'application/octet-stream'
            });
            if (uploadError) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Dosya yüklenemedi: ${uploadError.message}` });
                setIsUploading(false); return;
            }
            filePath = newFilePath;
            fileName = file.name;
        }

        const reportData = { ...formData, file_path: filePath, file_name: fileName };
        if (reportData.supplier_id === '') reportData.supplier_id = null;
        
        delete reportData.id; delete reportData.created_at; delete reportData.updated_at; delete reportData.supplier;

        const { error } = await supabase.from('inkr_reports').upsert(reportData, { onConflict: 'part_code' });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `INKR Raporu kaydedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `INKR Raporu başarıyla kaydedildi.` });
            refreshReports();
            setIsOpen(false);
        }
        setIsUploading(false);
    };
    
    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value === '' ? null : value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'INKR Raporu Düzenle' : 'Yeni INKR Raporu Oluştur'}</DialogTitle>
                    <DialogDescription>İlk numune kontrol raporu bilgilerini girin ve dosyayı yükleyin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <ScrollArea className="h-[70vh] p-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Parça Kodu</Label><Input value={formData.part_code || ''} onChange={(e) => setFormData(f => ({ ...f, part_code: e.target.value }))} required disabled={isEditMode} /></div>
                                <div><Label>Parça Adı</Label><Input value={formData.part_name || ''} onChange={(e) => setFormData(f => ({ ...f, part_name: e.target.value }))} required /></div>
                                <div className="col-span-2"><Label>Tedarikçi</Label><Select value={formData.supplier_id || ''} onValueChange={(v) => handleSelectChange('supplier_id', v)}><SelectTrigger><SelectValue placeholder="Tedarikçi seçin..." /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                                <div><Label>Rapor Tarihi</Label><Input type="date" value={formData.report_date || ''} onChange={(e) => setFormData(f => ({ ...f, report_date: e.target.value }))} required /></div>
                                <div><Label>Durum</Label><Select value={formData.status || ''} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Beklemede">Beklemede</SelectItem><SelectItem value="Onaylandı">Onaylandı</SelectItem><SelectItem value="Reddedildi">Reddedildi</SelectItem></SelectContent></Select></div>
                            </div>
                             <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragActive ? 'border-primary' : 'border-border'}`}>
                                <input {...getInputProps()} />
                                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                                {file ? <p className="mt-2 text-sm">{file.name}</p> : <p className="mt-2 text-sm text-muted-foreground">Rapor dosyasını buraya sürükleyin veya seçmek için tıklayın</p>}
                            </div>
                            {formData.file_name && !file && <p className="text-sm text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Mevcut dosya: {formData.file_name}</p>}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                        <Button type="submit" disabled={isUploading}>{isUploading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const InkrManagement = ({ onViewPdf }) => {
    const { toast } = useToast();
    const { inkrReports, loading, refreshData } = useData();
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedInkrDetail, setSelectedInkrDetail] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [allParts, setAllParts] = useState([]);
    const [partsLoading, setPartsLoading] = useState(true);
    const [inkrStatusFilter, setInkrStatusFilter] = useState('all'); // 'all', 'Mevcut', 'Mevcut Değil'

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
            refreshData();
        }
    };
    
    const handleViewRecord = (report) => {
        console.log('📋 INKR handleViewRecord called with:', report);
        setSelectedInkrDetail(report);
        setIsDetailModalOpen(true);
        console.log('📋 Modal state should now be true');
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

    // Tüm parçaları ve INKR durumlarını çek
    useEffect(() => {
        const fetchAllParts = async () => {
            setPartsLoading(true);
            try {
                // Tüm unique parça kodlarını ve adlarını al
                const { data: inspections, error } = await supabase
                    .from('incoming_inspections_with_supplier')
                    .select('part_code, part_name')
                    .not('part_code', 'is', null)
                    .not('part_code', 'eq', '')
                    .order('part_code');

                if (error) throw error;

                // Unique parçaları al (part_code bazında)
                const uniquePartsMap = new Map();
                inspections.forEach(inspection => {
                    if (inspection.part_code && !uniquePartsMap.has(inspection.part_code)) {
                        uniquePartsMap.set(inspection.part_code, {
                            part_code: inspection.part_code,
                            part_name: inspection.part_name || '-',
                        });
                    }
                });

                // INKR raporları ile eşleştir
                const inkrMap = new Map((inkrReports || []).map(r => [r.part_code, r]));
                const partsWithInkrStatus = Array.from(uniquePartsMap.values()).map(part => {
                    const inkrReport = inkrMap.get(part.part_code);
                    return {
                        ...part,
                        hasInkr: !!inkrReport,
                        inkrReport: inkrReport || null,
                    };
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

        fetchAllParts();
    }, [inkrReports, toast]);

    // Filtrelenmiş parçalar
    const filteredParts = useMemo(() => {
        let filtered = allParts;

        // Arama filtresi
        if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(part =>
                part.part_code.toLowerCase().includes(normalizedSearch) ||
                (part.part_name && part.part_name.toLowerCase().includes(normalizedSearch))
            );
        }

        // INKR durumu filtresi
        if (inkrStatusFilter === 'Mevcut') {
            filtered = filtered.filter(part => part.hasInkr);
        } else if (inkrStatusFilter === 'Mevcut Değil') {
            filtered = filtered.filter(part => !part.hasInkr);
        }

        return filtered;
    }, [allParts, searchTerm, inkrStatusFilter]);

    return (
        <div className="dashboard-widget">
            <InkrFormModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} existingReport={selectedReport} refreshReports={refreshData} />
            <InkrDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                report={selectedInkrDetail}
                onDownloadPDF={handleDownloadDetailPDF}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="relative w-full sm:w-auto sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Parça kodu veya adı ile ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                        {partsLoading || loading ? (
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
                                                {part.inkrReport.file_path && (
                                                    <Button variant="ghost" size="icon" onClick={() => onViewPdf(part.inkrReport.file_path)}><Eye className="h-4 w-4" /></Button>
                                                )}
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