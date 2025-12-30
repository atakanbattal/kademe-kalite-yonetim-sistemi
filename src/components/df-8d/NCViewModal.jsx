import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Clock,
  User,
  Tag,
  Flag,
  Building,
  Type,
  FileText,
  CheckSquare,
  Box,
  Scan,
  Truck,
  DollarSign,
  CalendarDays,
  Package,
  Ruler,
  ClipboardType,
  MapPin,
  Hash,
  Weight,
  Timer,
  FileSearch,
  XCircle,
  Edit,
  CalendarCheck2,
  Paperclip,
  Printer,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Lightbox } from 'react-modal-image';
import { RejectModal } from '@/components/df-8d/modals/ActionModals';
import { getStatusBadge } from '@/lib/statusUtils';
import { openPrintableReport } from '@/lib/reportUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RevisionHistory from './RevisionHistory';
import { InfoCard } from '@/components/ui/InfoCard';
import { Card, CardContent } from '@/components/ui/card';
import { DialogClose } from '@/components/ui/dialog';
import PdfViewerModal from '@/components/document/PdfViewerModal';

const EightDStepView = ({ stepKey, step }) => {
  if (!step || typeof step !== 'object') {
    return null;
  }
  
  return (
  <div className="p-4 border-l-2 border-primary/50 bg-secondary/30 rounded-r-lg">
    <h4 className="font-bold text-primary">
        {stepKey}: {step.title || stepKey}
    </h4>
    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
      <p>
        <strong className="text-muted-foreground">Sorumlu:</strong>{' '}
        {step.responsible || '-'}
      </p>
    <p>
        <strong className="text-muted-foreground">Tarih:</strong>{' '}
        {step.completionDate || '-'}
      </p>
    </div>
    {step.description && (
      <p className="mt-2 text-sm bg-background/50 p-2 rounded-md">
        <strong className="text-muted-foreground">Açıklama:</strong>{' '}
        {step.description}
      </p>
    )}
  </div>
);
};

// Varsayılan 8D başlıkları - Component dışında tanımlanmalı
const getDefault8DTitle = (stepKey) => {
  const titles = {
    D1: "Ekip Oluşturma",
    D2: "Problemi Tanımlama",
    D3: "Geçici Önlemler Alma",
    D4: "Kök Neden Analizi",
    D5: "Kalıcı Düzeltici Faaliyetleri Belirleme",
    D6: "Kalıcı Düzeltici Faaliyetleri Uygulama",
    D7: "Tekrarlanmayı Önleme",
    D8: "Ekibi Takdir Etme"
  };
  return titles[stepKey] || stepKey;
};

const AttachmentItem = ({ path, onPreview }) => {
    const [signedUrl, setSignedUrl] = React.useState(null);
    const [pdfViewerState, setPdfViewerState] = React.useState({ isOpen: false, url: null, title: null });
    const [isLoading, setIsLoading] = React.useState(false);
    
    React.useEffect(() => {
        const fetchSignedUrl = async () => {
            try {
                const { data, error } = await supabase.storage.from('df_attachments').createSignedUrl(path, 3600);
                if (!error && data?.signedUrl) {
                    setSignedUrl(data.signedUrl);
                }
            } catch (err) {
                console.error('Signed URL fetch error:', err);
            }
        };
        
        if (path) {
            fetchSignedUrl();
        }
    }, [path]);

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
    const isPdf = /\.pdf$/i.test(path);
    const fileName = path.split('/').pop();

    const handlePdfClick = async (e) => {
        e.preventDefault();
        if (!path) return;
        
        setIsLoading(true);
        try {
            // PDF'i blob olarak indir ve blob URL oluştur
            const { data, error } = await supabase.storage.from('df_attachments').download(path);
            if (error) {
                console.error('PDF indirme hatası:', error);
                // Hata durumunda signed URL'i kullan
                if (signedUrl) {
                    setPdfViewerState({ isOpen: true, url: signedUrl, title: fileName });
                }
                return;
            }
            
            const blob = new Blob([data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfViewerState({ isOpen: true, url: blobUrl, title: fileName });
        } catch (err) {
            console.error('PDF açılırken hata:', err);
            // Hata durumunda signed URL'i kullan
            if (signedUrl) {
                setPdfViewerState({ isOpen: true, url: signedUrl, title: fileName });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Modal kapandığında blob URL'i temizle
    const handlePdfViewerClose = () => {
        if (pdfViewerState.url && pdfViewerState.url.startsWith('blob:')) {
            window.URL.revokeObjectURL(pdfViewerState.url);
        }
        setPdfViewerState({ isOpen: false, url: null, title: null });
    };

    if (!signedUrl && !isLoading) return null;

    if (isImage) {
        return (
            <div className="group cursor-pointer" onClick={() => onPreview(signedUrl)}>
                <img
                    src={signedUrl}
                    alt="Ek"
                    className="rounded-lg object-cover w-full h-32 transition-transform duration-300 group-hover:scale-105"
                />
            </div>
        );
    }
    
    if (isPdf) {
        return (
            <>
                <div 
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all cursor-pointer hover:bg-secondary transition-colors"
                    onClick={handlePdfClick}
                >
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                    ) : (
                        <>
                            <FileText className="w-6 h-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
                        </>
                    )}
                </div>
                {pdfViewerState.isOpen && (
                    <PdfViewerModal
                        isOpen={pdfViewerState.isOpen}
                        setIsOpen={handlePdfViewerClose}
                        pdfUrl={pdfViewerState.url}
                        title={pdfViewerState.title}
                    />
                )}
            </>
        );
    }
    
    return (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all hover:bg-secondary transition-colors">
            <Paperclip className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
        </a>
    );
};

const NCViewModal = ({ isOpen, setIsOpen, record, onReject, onDownloadPDF, onEdit }) => {
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [isRejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [supplierName, setSupplierName] = useState(null);

  // Tedarikçi adını fetch et
  useEffect(() => {
    const fetchSupplierName = async () => {
      if (record?.supplier_id) {
        const { data, error } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', record.supplier_id)
          .single();
        
        if (!error && data) {
          setSupplierName(data.name);
        }
      } else {
        setSupplierName(null);
      }
    };
    
    if (isOpen && record) {
      fetchSupplierName();
    }
  }, [isOpen, record]);

  if (!record) return null;

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '-';
  
  const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Kritik': return <Badge variant="destructive">{priority}</Badge>;
      case 'Yüksek': return <Badge className="bg-orange-500 text-white">{priority}</Badge>;
      case 'Orta': return <Badge className="bg-yellow-500 text-white">{priority}</Badge>;
      default: return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const handleRejectConfirm = () => {
    if (onReject) onReject(record, rejectionNotes);
    setRejectModalOpen(false);
  }
  
  const allAttachments = [
    ...(record.attachments || []),
    ...(record.closing_attachments || [])
  ].filter(Boolean);

  // eight_d_progress varsa onu kullan, yoksa eight_d_steps'i kullan
  const getDisplayEightDSteps = () => {
    if (!record || record.type !== '8D') {
      return null;
    }
    
    // eight_d_steps varsa onu kullan (öncelikli)
    if (record.eight_d_steps && typeof record.eight_d_steps === 'object' && !Array.isArray(record.eight_d_steps)) {
      return record.eight_d_steps;
    }
    
    // eight_d_progress varsa onu kullanarak eight_d_steps oluştur
    if (record.eight_d_progress && typeof record.eight_d_progress === 'object' && !Array.isArray(record.eight_d_progress)) {
      const steps = {};
      const progressKeys = Object.keys(record.eight_d_progress);
      
      for (const key of progressKeys) {
        const progress = record.eight_d_progress[key];
        if (progress && typeof progress === 'object' && !Array.isArray(progress)) {
          steps[key] = {
            title: getDefault8DTitle(key),
            completed: Boolean(progress.completed),
            responsible: progress.responsible || null,
            completionDate: progress.completionDate || null,
            description: progress.description || null,
            evidenceFiles: Array.isArray(progress.evidenceFiles) ? progress.evidenceFiles : []
          };
        }
      }
      
      if (Object.keys(steps).length > 0) {
        return steps;
      }
    }
    
    return null;
  };
  
  const displayEightDSteps = getDisplayEightDSteps();

  const handlePrint = (e) => {
    // Event'i engelle - sayfa yenilenmesini önle
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsPrinting(true);
    try {
      // Attachments'ları URL'den çıkar (çok uzun URL oluşturuyorlar)
      // PDF sayfası bunları zaten record.id ile fetch edecek
      const { attachments, closing_attachments, ...recordWithoutAttachments } = record;
      const lightweightRecord = {
        ...recordWithoutAttachments,
        supplier_name: supplierName || record.supplier_name
      };
      
      if (onDownloadPDF) {
        onDownloadPDF(lightweightRecord, 'nonconformity');
      } else {
         openPrintableReport(lightweightRecord, 'nonconformity');
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setTimeout(() => setIsPrinting(false), 1000);
    }
  };

  return (
    <>
    {lightboxUrl && (
        <Lightbox
          large={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
          hideDownload={true}
          hideZoom={true}
        />
      )}
      <RejectModal
        isOpen={isRejectModalOpen}
        setIsOpen={setRejectModalOpen}
        rejectionNotes={rejectionNotes}
        setRejectionNotes={setRejectionNotes}
        onConfirm={handleRejectConfirm}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6" />
                  Uygunsuzluk Detayı
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {record.nc_number || record.mdi_no} - {record.title}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(record)}
                {record.is_major && (
                  <Badge variant="destructive" className="text-sm">MAJOR</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6" style={{ maxHeight: 'calc(95vh - 200px)' }}>
            <div className="py-4">
            <Tabs defaultValue="general" className="w-full">
              <TabsList>
                <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                {record.type === '8D' && <TabsTrigger value="revisions">Revizyon Geçmişi</TabsTrigger>}
              </TabsList>
              
              <TabsContent value="general" className="space-y-6">
              {/* Önemli Bilgiler */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Önemli Bilgiler
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoCard icon={Tag} label="Uygunsuzluk No" value={record.nc_number || record.mdi_no} variant="primary" />
                  <InfoCard icon={Type} label="Tip" value={record.type} />
                  <InfoCard 
                    icon={Flag} 
                    label="Öncelik" 
                    value={record.priority} 
                    variant={record.priority === 'Kritik' ? 'danger' : record.priority === 'Yüksek' ? 'warning' : 'default'}
                  />
                  {record.status !== 'Reddedildi' && (
                    <InfoCard
                      icon={Clock}
                      label="Termin Tarihi"
                      value={formatDate(record.due_at || record.due_date)}
                      variant="warning"
                    />
                  )}
                  <InfoCard
                    icon={Building}
                    label="İlgili Birim"
                    value={supplierName || record.department}
                  />
                  <InfoCard
                    icon={User}
                    label="Sorumlu Kişi"
                    value={record.responsible_person}
                  />
                </div>
              </div>

              <Separator />

              {/* Genel Bilgiler */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Genel Bilgiler
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoCard icon={Tag} label="MDI No" value={record.mdi_no} />
                  <InfoCard
                    icon={Building}
                    label="Talep Eden Birim"
                    value={record.requesting_unit}
                  />
                  <InfoCard
                    icon={User}
                    label="Talep Eden Kişi"
                    value={record.requesting_person}
                  />
                  <InfoCard
                    icon={CalendarCheck2}
                    label="Açılış Tarihi"
                    value={formatDate(record.df_opened_at)}
                  />
                  {record.audit_title && <InfoCard icon={FileSearch} label="Tetkik Başlığı" value={record.audit_title} />}
                  {record.vehicle_type && <InfoCard icon={Truck} label="Araç Tipi" value={record.vehicle_type} />}
                  {record.part_name && <InfoCard icon={Box} label="Parça Adı" value={record.part_name} />}
                  {record.part_code && <InfoCard icon={Scan} label="Parça Kodu" value={record.part_code} />}
                  {record.part_location && <InfoCard icon={MapPin} label="Parça Konumu" value={record.part_location} />}
                  {record.amount != null && <InfoCard icon={DollarSign} label="Maliyet Tutarı" value={formatCurrency(record.amount)} variant="warning" />}
                  {record.cost_date && <InfoCard icon={CalendarDays} label="Maliyet Tarihi" value={formatDate(record.cost_date)} />}
                  {record.cost_type && <InfoCard icon={ClipboardType} label="Maliyet Türü" value={record.cost_type} />}
                  {record.material_type && <InfoCard icon={Package} label="Malzeme Türü" value={record.material_type} />}
                  {record.measurement_unit && <InfoCard icon={Ruler} label="Ölçü Birimi" value={record.measurement_unit} />}
                  {record.quantity != null && <InfoCard icon={Hash} label="Miktar" value={record.quantity} />}
                  {record.scrap_weight != null && <InfoCard icon={Weight} label="Hurda Ağırlığı (kg)" value={record.scrap_weight} />}
                  {record.rework_duration != null && <InfoCard icon={Timer} label="Yeniden İşlem Süresi (dk)" value={record.rework_duration} />}
                  {record.quality_control_duration != null && <InfoCard icon={Timer} label="Kalite Kontrol Süresi (dk)" value={record.quality_control_duration} />}
                </div>
              </div>

              <Separator />

              <Separator />

              {/* Problem Tanımı */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Problem Tanımı
                </h3>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{record.description || 'Açıklama girilmemiş.'}</p>
                  </CardContent>
                </Card>
              </div>
              
              {record.closing_notes && (
                <>
                 <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      İlerleme Notları / Yapılan Çalışmalar
                    </h3>
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-6">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{record.closing_notes}</p>
                        {record.status === 'İşlemde' && (
                          <p className="text-xs text-muted-foreground mt-4">
                            💡 İpucu: Bu notları düzenlemek için "Düzenle" butonuna tıklayın veya uygunsuzluğu "İşlemde" olarak güncelleyin.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}


              {allAttachments && allAttachments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      Kanıt Dokümanları
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {allAttachments.map((path, index) => (
                        <AttachmentItem key={index} path={path} onPreview={setLightboxUrl} />
                      ))}
                    </div>
                  </div>
                </>
              )}


              {/* Kök Neden Analizleri */}
              {(() => {
                const hasAnalysis = (record.five_why_analysis && Object.values(record.five_why_analysis).some(v => v && v.toString().trim() !== '')) ||
                  (record.five_n1k_analysis && Object.values(record.five_n1k_analysis).some(v => v && v.toString().trim() !== '')) ||
                  (record.ishikawa_analysis && Object.values(record.ishikawa_analysis).some(v => {
                    if (Array.isArray(v)) return v.length > 0 && v.some(item => item && item.toString().trim() !== '');
                    return v && v.toString().trim() !== '';
                  })) ||
                  (record.fta_analysis && Object.values(record.fta_analysis).some(v => {
                    if (Array.isArray(v)) return v.length > 0;
                    return v && v.toString().trim() !== '';
                  }));
                
                if (!hasAnalysis) return null;
                
                return (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Kök Neden Analizleri
                      </h3>
                      <div className="space-y-4">
                        {/* 5N1K Analizi */}
                        {record.five_n1k_analysis && Object.values(record.five_n1k_analysis).some(v => v && v.toString().trim() !== '') && (
                          <Card>
                            <CardContent className="p-6">
                              <h4 className="font-semibold mb-4 text-primary">5N1K Analizi</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(record.five_n1k_analysis.what || record.five_n1k_analysis.ne) && (
                                  <InfoCard label="Ne" value={record.five_n1k_analysis.what || record.five_n1k_analysis.ne} />
                                )}
                                {(record.five_n1k_analysis.where || record.five_n1k_analysis.nerede) && (
                                  <InfoCard label="Nerede" value={record.five_n1k_analysis.where || record.five_n1k_analysis.nerede} />
                                )}
                                {(record.five_n1k_analysis.when || record.five_n1k_analysis.neZaman) && (
                                  <InfoCard label="Ne Zaman" value={record.five_n1k_analysis.when || record.five_n1k_analysis.neZaman} />
                                )}
                                {(record.five_n1k_analysis.who || record.five_n1k_analysis.kim) && (
                                  <InfoCard label="Kim" value={record.five_n1k_analysis.who || record.five_n1k_analysis.kim} />
                                )}
                                {(record.five_n1k_analysis.how || record.five_n1k_analysis.nasil) && (
                                  <InfoCard label="Nasıl" value={record.five_n1k_analysis.how || record.five_n1k_analysis.nasil} />
                                )}
                                {(record.five_n1k_analysis.why || record.five_n1k_analysis.neden) && (
                                  <InfoCard label="Neden Önemli" value={record.five_n1k_analysis.why || record.five_n1k_analysis.neden} />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* 5 Neden Analizi */}
                        {record.five_why_analysis && Object.values(record.five_why_analysis).some(v => v && v.toString().trim() !== '') && (
                          <Card>
                            <CardContent className="p-6">
                              <h4 className="font-semibold mb-4 text-primary">5 Neden Analizi</h4>
                              <div className="space-y-3">
                                {record.five_why_analysis.why1 && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">1. Neden:</strong> {record.five_why_analysis.why1}
                                  </div>
                                )}
                                {record.five_why_analysis.why2 && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">2. Neden:</strong> {record.five_why_analysis.why2}
                                  </div>
                                )}
                                {record.five_why_analysis.why3 && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">3. Neden:</strong> {record.five_why_analysis.why3}
                                  </div>
                                )}
                                {record.five_why_analysis.why4 && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">4. Neden:</strong> {record.five_why_analysis.why4}
                                  </div>
                                )}
                                {record.five_why_analysis.why5 && (
                                  <div className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-md">
                                    <strong className="text-destructive">5. Neden (Kök Neden):</strong> {record.five_why_analysis.why5}
                                  </div>
                                )}
                                {record.five_why_analysis.rootCause && (
                                  <div className="p-3 bg-primary/10 border-l-4 border-primary rounded-md mt-4">
                                    <strong className="text-primary">Kök Neden Özeti:</strong> {record.five_why_analysis.rootCause}
                                  </div>
                                )}
                                {record.five_why_analysis.immediateAction && (
                                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 rounded-md mt-4">
                                    <strong className="text-yellow-700 dark:text-yellow-400">Anlık Aksiyon:</strong> {record.five_why_analysis.immediateAction}
                                  </div>
                                )}
                                {record.five_why_analysis.preventiveAction && (
                                  <div className="p-3 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-md mt-4">
                                    <strong className="text-green-700 dark:text-green-400">Önleyici Aksiyon:</strong> {record.five_why_analysis.preventiveAction}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Ishikawa Analizi */}
                        {record.ishikawa_analysis && Object.values(record.ishikawa_analysis).some(v => {
                          if (Array.isArray(v)) return v.length > 0 && v.some(item => item && item.toString().trim() !== '');
                          return v && v.toString().trim() !== '';
                        }) && (
                          <Card>
                            <CardContent className="p-6">
                              <h4 className="font-semibold mb-4 text-primary">Ishikawa (Balık Kılçığı) Analizi</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(() => {
                                  const analysis = record.ishikawa_analysis;
                                  const items = [];
                                  
                                  if (analysis.man) {
                                    const manValue = Array.isArray(analysis.man) ? analysis.man.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.man;
                                    if (manValue) items.push(<InfoCard key="man" label="İnsan" value={manValue} />);
                                  }
                                  if (analysis.machine) {
                                    const machineValue = Array.isArray(analysis.machine) ? analysis.machine.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.machine;
                                    if (machineValue) items.push(<InfoCard key="machine" label="Makine" value={machineValue} />);
                                  }
                                  if (analysis.method) {
                                    const methodValue = Array.isArray(analysis.method) ? analysis.method.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.method;
                                    if (methodValue) items.push(<InfoCard key="method" label="Metot" value={methodValue} />);
                                  }
                                  if (analysis.material) {
                                    const materialValue = Array.isArray(analysis.material) ? analysis.material.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.material;
                                    if (materialValue) items.push(<InfoCard key="material" label="Malzeme" value={materialValue} />);
                                  }
                                  if (analysis.environment) {
                                    const envValue = Array.isArray(analysis.environment) ? analysis.environment.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.environment;
                                    if (envValue) items.push(<InfoCard key="environment" label="Çevre" value={envValue} />);
                                  }
                                  if (analysis.measurement) {
                                    const measValue = Array.isArray(analysis.measurement) ? analysis.measurement.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.measurement;
                                    if (measValue) items.push(<InfoCard key="measurement" label="Ölçüm" value={measValue} />);
                                  }
                                  if (analysis.management) {
                                    const mgmtValue = Array.isArray(analysis.management) ? analysis.management.filter(v => v && v.toString().trim() !== '').join(', ') : analysis.management;
                                    if (mgmtValue) items.push(<InfoCard key="management" label="Yönetim" value={mgmtValue} />);
                                  }
                                  
                                  return items.length > 0 ? items : null;
                                })()}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* FTA Analizi */}
                        {record.fta_analysis && Object.values(record.fta_analysis).some(v => {
                          if (Array.isArray(v)) return v.length > 0;
                          return v && v.toString().trim() !== '';
                        }) && (
                          <Card>
                            <CardContent className="p-6">
                              <h4 className="font-semibold mb-4 text-primary">FTA (Hata Ağacı) Analizi</h4>
                              <div className="space-y-3">
                                {record.fta_analysis.topEvent && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">Üst Olay:</strong> {record.fta_analysis.topEvent}
                                  </div>
                                )}
                                {record.fta_analysis.events && Array.isArray(record.fta_analysis.events) && record.fta_analysis.events.length > 0 && (
                                  <div className="space-y-2">
                                    <strong className="text-muted-foreground block mb-2">Olaylar:</strong>
                                    {record.fta_analysis.events.map((event, idx) => (
                                      <div key={idx} className="p-3 bg-secondary/50 rounded-md">
                                        <div><strong>Tip:</strong> {event.type || '-'}</div>
                                        <div><strong>Açıklama:</strong> {event.description || '-'}</div>
                                        {event.gate && <div><strong>Kapı:</strong> {event.gate}</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {record.fta_analysis.intermediateEvents && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">Ara Olaylar:</strong> {record.fta_analysis.intermediateEvents}
                                  </div>
                                )}
                                {record.fta_analysis.basicEvents && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">Temel Olaylar:</strong> {record.fta_analysis.basicEvents}
                                  </div>
                                )}
                                {record.fta_analysis.gates && (
                                  <div className="p-3 bg-secondary/50 rounded-md">
                                    <strong className="text-muted-foreground">Kapılar:</strong> {record.fta_analysis.gates}
                                  </div>
                                )}
                                {record.fta_analysis.rootCauses && (
                                  <div className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-md">
                                    <strong className="text-destructive">Kök Nedenler:</strong> {record.fta_analysis.rootCauses}
                                  </div>
                                )}
                                {record.fta_analysis.summary && (
                                  <div className="p-3 bg-primary/10 border-l-4 border-primary rounded-md mt-4">
                                    <strong className="text-primary">Özet:</strong> {record.fta_analysis.summary}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {record.type === '8D' && displayEightDSteps && Object.keys(displayEightDSteps).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      8D Adımları
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(displayEightDSteps).map(([key, step]) => {
                        if (!step || typeof step !== 'object') return null;
                        return <EightDStepView key={key} stepKey={key} step={step} />;
                      })}
                    </div>
                  </div>
                </>
              )}

              {record.status === 'Reddedildi' && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      Reddetme Detayları
                    </h3>
                    <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                      <CardContent className="p-6">
                        <InfoCard
                            icon={XCircle}
                            label="Reddetme Gerekçesi"
                            value={record.rejection_reason}
                            variant="danger"
                        />
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {record.status === 'Kapatıldı' && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-600">
                      <CheckSquare className="h-5 w-5" />
                      Kapanış Bilgileri
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoCard
                        icon={CheckSquare}
                        label="Kapatma Tarihi"
                        value={formatDate(record.closed_at)}
                        variant="success"
                      />
                    </div>
                  </div>
                </>
              )}
              </TabsContent>
              
              {record.type === '8D' && (
                <TabsContent value="revisions" className="mt-4">
                  <RevisionHistory ncId={record.id} />
                </TabsContent>
              )}
            </Tabs>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4 border-t">
            <div className="flex gap-2">
                 {onReject && <Button variant="destructive" onClick={() => setRejectModalOpen(true)}>
                    <XCircle className="mr-2 h-4 w-4" /> Reddet
                </Button>}
                {onEdit && <Button variant="secondary" onClick={() => onEdit(record)}>
                    <Edit className="mr-2 h-4 w-4" /> Düzenle
                </Button>}
            </div>
            <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline" disabled={isPrinting}>
                  {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Yazdır / PDF
                </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="lg">Kapat</Button>
              </DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NCViewModal;