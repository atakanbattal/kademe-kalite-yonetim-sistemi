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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbox } from 'react-modal-image';
import { RejectModal } from '@/components/df-8d/modals/ActionModals';
import { getStatusBadge } from '@/lib/statusUtils';
import { openPrintableReport } from '@/lib/reportUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RevisionHistory from './RevisionHistory';
import { InfoCard } from '@/components/ui/InfoCard';
import { Card, CardContent } from '@/components/ui/card';
import { DialogClose } from '@/components/ui/dialog';

const EightDStepView = ({ stepKey, step }) => (
  <div className="p-4 border-l-2 border-primary/50 bg-secondary/30 rounded-r-lg">
    <h4 className="font-bold text-primary">
      {stepKey}: {step.title}
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

const AttachmentItem = ({ path, onPreview }) => {
    const [signedUrl, setSignedUrl] = React.useState(null);
    
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

    if (!signedUrl) return null;

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

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
    
    return (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all">
            <Paperclip className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate w-full">{path.split('/').pop()}</span>
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

  const handlePrint = () => {
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
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
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

          <ScrollArea className="flex-grow pr-4">
            <Tabs defaultValue="general" className="w-full py-4">
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


              {record.type === '8D' && record.eight_d_steps && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      8D Adımları
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(record.eight_d_steps).map(([key, step]) => (
                        <EightDStepView key={key} stepKey={key} step={step} />
                      ))}
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
          </ScrollArea>

          <DialogFooter className="mt-6">
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