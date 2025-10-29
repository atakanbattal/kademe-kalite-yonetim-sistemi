import React, { useState, useEffect, useCallback } from 'react';
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

const InkrFormModal = ({ isOpen, setIsOpen, existingReport, refreshReports }) => {
    const { toast } = useToast();
    const isEditMode = !!existingReport;
    const [formData, setFormData] = useState({});
    const [suppliers, setSuppliers] = useState([]);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (existingReport) {
                setFormData({ ...existingReport, report_date: new Date(existingReport.report_date).toISOString().split('T')[0] });
            } else {
                setFormData({
                    part_code: '', part_name: '', supplier_id: null,
                    report_date: new Date().toISOString().split('T')[0],
                    status: 'Beklemede', notes: '', items: []
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
            const newFilePath = `inkr_reports/${formData.part_code}_${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('incoming_control').upload(newFilePath, file);
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
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedInkrDetail, setSelectedInkrDetail] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchReports = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('inkr_reports').select('*, supplier:suppliers(name)').order('report_date', { ascending: false });
        if (searchTerm) {
            query = query.or(`part_code.ilike.%${searchTerm}%,part_name.ilike.%${searchTerm}%`);
        }
        const { data, error } = await query;
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'INKR raporları alınamadı.' });
        } else {
            setReports(data);
        }
        setLoading(false);
    }, [toast, searchTerm]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

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
            fetchReports();
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

    return (
        <div className="dashboard-widget">
            <InkrFormModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} existingReport={selectedReport} refreshReports={fetchReports} />
            <InkrDetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
                report={selectedInkrDetail}
                onDownloadPDF={handleDownloadDetailPDF}
            />
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Parça kodu veya adı ile ara..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" /> Yeni INKR Raporu</Button>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Parça Kodu</th>
                            <th>Parça Adı</th>
                            <th>Tedarikçi</th>
                            <th>Rapor Tarihi</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8">Yükleniyor...</td></tr>
                        ) : reports.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8">INKR raporu bulunamadı.</td></tr>
                        ) : (
                            reports.map((report, index) => (
                                <tr 
                                    key={report.id} 
                                    onClick={() => handleViewRecord(report)}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    style={{
                                        opacity: 0,
                                        animation: `fadeIn 0.3s ease-in forwards ${index * 0.05}s`
                                    }}
                                >
                                    <td className="font-medium text-foreground">{report.part_code}</td>
                                    <td className="text-foreground">{report.part_name}</td>
                                    <td className="text-muted-foreground">{report.supplier?.name || '-'}</td>
                                    <td className="text-muted-foreground">{new Date(report.report_date).toLocaleDateString('tr-TR')}</td>
                                    <td><Badge variant={getStatusVariant(report.status)}>{report.status}</Badge></td>
                                    <td className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        {report.file_path && (
                                            <Button variant="ghost" size="icon" onClick={() => onViewPdf(report.file_path)}><Eye className="h-4 w-4" /></Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(report)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleViewRecord(report)}><FileText className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(report.id)}><Trash2 className="h-4 w-4" /></Button>
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