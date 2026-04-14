import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, Loader2 } from 'lucide-react';
import { sanitizeArchiveName } from '@/lib/qualityFolderDownloadUtils';
import { getPublishedAttachment, getSourceAttachments } from '@/lib/documentRevisionAttachments';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BUCKET_NAME = 'documents';

const getDocumentFolder = (documentType) => {
    const folderMap = {
        'Kalite Sertifikaları': 'Kalite-Sertifikalari',
        'Personel Sertifikaları': 'Personel-Sertifikalari',
        'Prosedürler': 'documents',
        'Talimatlar': 'documents',
        'Formlar': 'documents',
        'El Kitapları': 'documents',
        'Şemalar': 'documents',
        'Görev Tanımları': 'documents',
        'Süreçler': 'documents',
        'Planlar': 'documents',
        'Listeler': 'documents',
        'Şartnameler': 'documents',
        'Politikalar': 'documents',
        'Tablolar': 'documents',
        'Antetler': 'documents',
        'Sözleşmeler': 'documents',
        'Yönetmelikler': 'documents',
        'Kontrol Planları': 'documents',
        'FMEA Planları': 'documents',
        'Proses Kontrol Kartları': 'documents',
        'Görsel Yardımcılar': 'documents',
        'Diğer': 'documents',
    };
    return folderMap[documentType] || 'documents';
};

const normalizeDocumentPath = (path, documentType) => {
    if (!path) return null;
    if (path.includes('/') && !path.startsWith('documents/') && !path.includes('Kalite') && !path.includes('Personel')) {
        const folderName = getDocumentFolder(documentType);
        const parts = path.split('/');
        if (parts.length >= 2) {
            return `${folderName}/${parts.slice(1).join('/')}`;
        }
    }
    return path;
};

// Kategori isimlerini normalize etmek için mapping
const DOCUMENT_TYPE_MAPPING = {
    'Prosedürler': ['Prosedürler', 'Prosedür', 'Prosedurler', 'Prosedur'],
    'Talimatlar': ['Talimatlar', 'Talimat', 'Talimatlari', 'Talimati'],
    'Formlar': ['Formlar', 'Form'],
    'El Kitapları': ['El Kitapları', 'El Kitabı', 'El Kitaplari', 'El Kitabi'],
    'Şemalar': ['Şemalar', 'Şema', 'Semalar', 'Sema'],
    'Görev Tanımları': ['Görev Tanımları', 'Görev Tanımı', 'Gorev Tanimlari', 'Gorev Tanimi'],
    'Süreçler': ['Süreçler', 'Süreç', 'Surecler', 'Surec'],
    'Planlar': ['Planlar', 'Plan'],
    'Listeler': ['Listeler', 'Liste'],
    'Şartnameler': ['Şartnameler', 'Şartname', 'Sartnameler', 'Sartname'],
    'Politikalar': ['Politikalar', 'Politika'],
    'Tablolar': ['Tablolar', 'Tablo'],
    'Antetler': ['Antetler', 'Antet'],
    'Sözleşmeler': ['Sözleşmeler', 'Sözleşme', 'Sozlesmeler', 'Sozlesme'],
    'Yönetmelikler': ['Yönetmelikler', 'Yönetmelik', 'Yonetmelikler', 'Yonetmelik'],
    'Kontrol Planları': ['Kontrol Planları', 'Kontrol Planı', 'Kontrol Planlari', 'Kontrol Plani'],
    'FMEA Planları': ['FMEA Planları', 'FMEA Planı', 'FMEA Planlari', 'FMEA Plani'],
    'Proses Kontrol Kartları': ['Proses Kontrol Kartları', 'Proses Kontrol Kartı', 'Proses Kontrol Kartlari', 'Proses Kontrol Karti'],
    'Görsel Yardımcılar': ['Görsel Yardımcılar', 'Görsel Yardımcı', 'Gorsel Yardimcilar', 'Gorsel Yardimci'],
    'Kalite Sertifikaları': ['Kalite Sertifikaları', 'Kalite Sertifikası', 'Kalite Sertifikalari', 'Kalite Sertifikasi'],
    'Personel Sertifikaları': ['Personel Sertifikaları', 'Personel Sertifikası', 'Personel Sertifikalari', 'Personel Sertifikasi'],
    'Diğer': ['Diğer', 'Diger']
};

const FolderDownloadModal = ({ isOpen, setIsOpen, documents = [], categories = [], unitCostSettings = [] }) => {
    const { toast } = useToast();
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('');

    const documentsInScope = useMemo(() => {
        if (departmentFilter === 'all') return documents;
        if (departmentFilter === 'none') return documents.filter((d) => !d.department_id);
        return documents.filter((d) => d.department_id === departmentFilter);
    }, [documents, departmentFilter]);

    useEffect(() => {
        if (!isOpen) {
            setDepartmentFilter('all');
            setSelectedCategories([]);
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedCategories([]);
    }, [departmentFilter]);

    // Sadece içinde doküman bulunan kategorileri listele ve Tümü hariç
    const availableCategories = categories
        .filter(cat => cat !== 'Tümü' && cat !== 'Tumu')
        .map(cat => {
            const docCount = documentsInScope.filter(d => 
                d.document_type === cat || 
                (DOCUMENT_TYPE_MAPPING[cat] && DOCUMENT_TYPE_MAPPING[cat].includes(d.document_type))
            ).length;
            return { name: cat, count: docCount };
        })
        .filter(cat => cat.count > 0);

    const handleCategoryToggle = (category) => {
        if (selectedCategories.includes(category)) {
            setSelectedCategories(selectedCategories.filter(c => c !== category));
        } else {
            setSelectedCategories([...selectedCategories, category]);
        }
    };

    const handleSelectAll = () => {
        if (selectedCategories.length === availableCategories.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories(availableCategories.map(c => c.name));
        }
    };

    const handleDownload = async () => {
        if (selectedCategories.length === 0) {
            toast({ variant: 'destructive', title: 'Uyarı', description: 'Lütfen en az bir doküman tipi seçin.' });
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setDownloadStatus('Dokümanlar hazırlanıyor...');
        const zip = new JSZip();

        try {
            const docsToDownload = documentsInScope.filter(doc => {
                const isSelected = selectedCategories.some(cat => {
                    const validTypes = DOCUMENT_TYPE_MAPPING[cat] || [cat];
                    return validTypes.includes(doc.document_type);
                });
                return isSelected;
            });

            if (docsToDownload.length === 0) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Seçilen kategorilerde indirilecek doküman bulunamadı.' });
                setIsDownloading(false);
                return;
            }

            let downloadedCount = 0;

            const countTotalFiles = () =>
                docsToDownload.reduce((acc, doc) => {
                    const revision = doc.document_revisions;
                    const pub = getPublishedAttachment(revision?.attachments);
                    const n = (pub?.path ? 1 : 0) + getSourceAttachments(revision?.attachments).length;
                    return acc + n;
                }, 0);

            const totalFiles = countTotalFiles();

            const bumpProgress = () => {
                downloadedCount++;
                const pct = totalFiles > 0 ? Math.round((downloadedCount / totalFiles) * 100) : 100;
                setProgress(pct);
                setDownloadStatus(`İndiriliyor: %${pct} (${downloadedCount}/${totalFiles})`);
            };

            // Dosyaları kategorilerine göre Zip içinde klasörlere yerleştir (sıralı: ilerleme sayacı tutarlı)
            for (const doc of docsToDownload) {
                const revision = doc.document_revisions;
                const published = getPublishedAttachment(revision?.attachments);
                const sources = getSourceAttachments(revision?.attachments);

                let categoryFolder = 'Diğer';
                for (const [catName, catVariants] of Object.entries(DOCUMENT_TYPE_MAPPING)) {
                    if (catVariants.includes(doc.document_type)) {
                        categoryFolder = catName;
                        break;
                    }
                }

                const deptName = doc.department?.unit_name
                    ? sanitizeArchiveName(doc.department.unit_name, 'Birim')
                    : 'Genel';
                const baseFolder = zip.folder(`${deptName}/${categoryFolder}`);

                const downloadOne = async (filePath, zipPath, labelForLog) => {
                    if (!filePath) return;
                    const normalized = normalizeDocumentPath(filePath, doc.document_type);
                    try {
                        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(normalized);
                        if (error) {
                            console.error(`Error downloading ${labelForLog}:`, error.message);
                            return;
                        }
                        baseFolder.file(zipPath, data);
                        bumpProgress();
                    } catch (err) {
                        console.error(`Failed to fetch ${labelForLog}:`, err);
                    }
                };

                if (published?.path) {
                    const pubName = published.name || `${sanitizeArchiveName(doc.title || 'dokuman', 'Dosya')}.pdf`;
                    await downloadOne(published.path, pubName, pubName);
                }

                for (let i = 0; i < sources.length; i++) {
                    const s = sources[i];
                    const safeName = sanitizeArchiveName(s.name || `kaynak-${i + 1}`, 'Dosya');
                    const zipPath = `kaynak/${i + 1}-${safeName}`;
                    await downloadOne(s.path, zipPath, s.name);
                }
            }

            if (downloadedCount === 0) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Seçili dokümanların hiçbiri indirilemedi. Bağlantınızı kontrol edin veya dosyaların var olduğundan emin olun.' });
                setIsDownloading(false);
                return;
            }

            setDownloadStatus('Zip dosyası oluşturuluyor...');
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'KademeQMS_Dokumanlar.zip');

            toast({ title: 'Başarılı', description: `${downloadedCount} dosya başarıyla indirilerek arşivlendi.` });
            setIsOpen(false);
            setSelectedCategories([]);
        } catch (error) {
            console.error('Zip creation error:', error);
            toast({ variant: 'destructive', title: 'Hata', description: 'Zipleme işlemi sırasında bir hata oluştu.' });
        } finally {
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={isDownloading ? undefined : setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Klasör Olarak İndir</DialogTitle>
                    <DialogDescription>
                        İndirmek istediğiniz doküman tiplerini seçin. Arşivde yapı: <strong>Birim / Kategori / dosya</strong> (birimsiz kayıtlar <strong>Genel</strong> altında).
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Departman (birim)</Label>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isDownloading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tüm birimler" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm birimler</SelectItem>
                                <SelectItem value="none">Birimsiz dokümanlar</SelectItem>
                                {(unitCostSettings || []).map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.unit_name || u.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <Label className="text-sm font-semibold text-muted-foreground">Doküman Kategorileri</Label>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleSelectAll}
                            disabled={isDownloading || availableCategories.length === 0}
                            className="text-primary hover:text-primary/80 h-8 px-2"
                        >
                            {selectedCategories.length === availableCategories.length ? 'Tüm seçimi kaldır' : 'Tümünü Seç'}
                        </Button>
                    </div>

                    <ScrollArea className="h-[280px] pr-4 border rounded-md p-4">
                        {availableCategories.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">İndirilebilecek doküman bulunmuyor.</div>
                        ) : (
                            <div className="space-y-4">
                                {availableCategories.map((cat) => (
                                    <div key={cat.name} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`cat-${cat.name}`} 
                                            checked={selectedCategories.includes(cat.name)}
                                            onCheckedChange={() => handleCategoryToggle(cat.name)}
                                            disabled={isDownloading}
                                        />
                                        <Label 
                                            htmlFor={`cat-${cat.name}`} 
                                            className="flex-1 flex justify-between items-center cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            <span className={selectedCategories.includes(cat.name) ? 'text-primary font-semibold' : ''}>{cat.name}</span>
                                            <Badge variant={selectedCategories.includes(cat.name) ? 'default' : 'secondary'} className="ml-2 font-mono">
                                                {cat.count}
                                            </Badge>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {isDownloading && (
                        <div className="mt-4 space-y-2 p-3 bg-secondary/50 rounded-md border">
                            <div className="flex justify-between text-sm font-medium">
                                <span>{downloadStatus}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-primary h-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDownloading} className="w-full sm:w-auto">
                        İptal
                    </Button>
                    <Button onClick={handleDownload} disabled={isDownloading || selectedCategories.length === 0 || availableCategories.length === 0} className="w-full sm:w-auto">
                        {isDownloading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> İndiriliyor...</>
                        ) : (
                            <><Download className="w-4 h-4 mr-2" /> Toplu İndir</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FolderDownloadModal;
