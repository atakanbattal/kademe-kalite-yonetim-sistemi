import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbox } from 'react-modal-image';
import { RejectModal } from '@/components/df-8d/modals/ActionModals';
import { getStatusBadge } from '@/lib/statusUtils';
import { openPrintableReport } from '@/lib/reportUtils';

const InfoItem = ({ icon: Icon, label, value, className }) => (
  <div
    className={`flex flex-col gap-1 p-3 bg-secondary/50 rounded-lg ${className}`}
  >
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
    <p className="text-md font-semibold text-foreground">{value || '-'}</p>
  </div>
);

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
    const { data } = supabase.storage.from('df_attachments').getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) return null;

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

    if (isImage) {
        return (
            <div className="group cursor-pointer" onClick={() => onPreview(publicUrl)}>
                <img
                    src={publicUrl}
                    alt="Ek"
                    className="rounded-lg object-cover w-full h-32 transition-transform duration-300 group-hover:scale-105"
                />
            </div>
        );
    }
    
    return (
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all">
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
      if (onDownloadPDF) {
        onDownloadPDF(record, 'nonconformity');
      } else {
         openPrintableReport(record, 'nonconformity');
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
        <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
              {record.nc_number || record.mdi_no}
              {getStatusBadge(record)}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {record.title}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-grow pr-4">
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Genel Bilgiler
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoItem icon={Type} label="Tip" value={record.type} />
                  <InfoItem
                    icon={Flag}
                    label="Öncelik"
                    value={<div className="flex">{getPriorityBadge(record.priority)}</div>}
                  />
                  <InfoItem
                    icon={Clock}
                    label="Termin Tarihi"
                    value={formatDate(record.due_at || record.due_date)}
                  />
                  <InfoItem
                    icon={Building}
                    label="İlgili Birim"
                    value={record.department}
                  />
                  <InfoItem
                    icon={User}
                    label="Sorumlu Kişi"
                    value={record.responsible_person}
                  />
                  <InfoItem icon={Tag} label="MDI No" value={record.mdi_no} />
                  <InfoItem
                    icon={Building}
                    label="Talep Eden Birim"
                    value={record.requesting_unit}
                  />
                  <InfoItem
                    icon={User}
                    label="Talep Eden Kişi"
                    value={record.requesting_person}
                  />
                  <InfoItem
                    icon={CalendarCheck2}
                    label="Açılış Tarihi"
                    value={formatDate(record.df_opened_at)}
                  />
                  {record.audit_title && <InfoItem icon={FileSearch} label="Tetkik Başlığı" value={record.audit_title} />}
                   {record.vehicle_type && <InfoItem icon={Truck} label="Araç Tipi" value={record.vehicle_type} />}
                  {record.part_name && <InfoItem icon={Box} label="Parça Adı" value={record.part_name} />}
                  {record.part_code && <InfoItem icon={Scan} label="Parça Kodu" value={record.part_code} />}
                  {record.part_location && <InfoItem icon={MapPin} label="Parça Konumu" value={record.part_location} />}
                  {record.amount != null && <InfoItem icon={DollarSign} label="Maliyet Tutarı" value={formatCurrency(record.amount)} />}
                  {record.cost_date && <InfoItem icon={CalendarDays} label="Maliyet Tarihi" value={formatDate(record.cost_date)} />}
                  {record.cost_type && <InfoItem icon={ClipboardType} label="Maliyet Türü" value={record.cost_type} />}
                  {record.material_type && <InfoItem icon={Package} label="Malzeme Türü" value={record.material_type} />}
                  {record.measurement_unit && <InfoItem icon={Ruler} label="Ölçü Birimi" value={record.measurement_unit} />}
                  {record.quantity != null && <InfoItem icon={Hash} label="Miktar" value={record.quantity} />}
                  {record.scrap_weight != null && <InfoItem icon={Weight} label="Hurda Ağırlığı (kg)" value={record.scrap_weight} />}
                  {record.rework_duration != null && <InfoItem icon={Timer} label="Yeniden İşlem Süresi (dk)" value={record.rework_duration} />}
                  {record.quality_control_duration != null && <InfoItem icon={Timer} label="Kalite Kontrol Süresi (dk)" value={record.quality_control_duration} />}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Problem Tanımı
                </h3>
                <div className="p-4 bg-secondary/50 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap">
                  {record.description || 'Açıklama girilmemiş.'}
                </div>
              </div>
              
              {record.closing_notes && (record.status === 'İşlemde' || record.status === 'Kapatıldı') && (
                <>
                 <Separator />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      Yapılan Çalışmalar / Kapatma Notları
                    </h3>
                    <div className="p-4 bg-secondary/50 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap">
                      {record.closing_notes}
                    </div>
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
                    <h3 className="text-lg font-semibold text-destructive mb-3">Reddetme Detayları</h3>
                    <InfoItem
                        icon={XCircle}
                        label="Reddetme Gerekçesi"
                        value={record.rejection_reason}
                        className="col-span-full"
                    />
                  </div>
                </>
              )}

              {record.status === 'Kapatıldı' && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold text-green-600 mb-3">
                      Kapanış Bilgileri
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoItem
                        icon={CheckSquare}
                        label="Kapatma Tarihi"
                        value={formatDate(record.closed_at)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t flex-shrink-0 justify-between">
            <div>
                 {onReject && <Button variant="destructive" onClick={() => setRejectModalOpen(true)} className="mr-2">
                    <XCircle className="mr-2 h-4 w-4" /> Reddet
                </Button>}
                {onEdit && <Button variant="secondary" onClick={() => onEdit(record)}>
                    <Edit className="mr-2 h-4 w-4" /> Düzenle
                </Button>}
            </div>
            <div>
                <Button onClick={handlePrint} variant="outline" className="mr-2" disabled={isPrinting}>
                  {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Yazdır / PDF
                </Button>
              <Button onClick={() => setIsOpen(false)}>
                Kapat
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NCViewModal;