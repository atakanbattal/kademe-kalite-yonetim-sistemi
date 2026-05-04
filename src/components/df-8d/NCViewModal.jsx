import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
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
  X,
  Edit,
  CalendarCheck2,
  Paperclip,
  Printer,
  Loader2,
  AlertTriangle,
  Image,
  Layers,
  CircleDot,
} from 'lucide-react';
import Df8dImageLightbox from '@/components/df-8d/Df8dImageLightbox';
import { EditRejectionDetailsModal } from '@/components/df-8d/modals/ActionModals';
import { openPrintableReport } from '@/lib/reportUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RevisionHistory from './RevisionHistory';
import { InfoCard } from '@/components/ui/InfoCard';
import { Card, CardContent } from '@/components/ui/card';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import EightDStepView from '@/components/df-8d/EightDStepView';
import {
  StructuredProblemDescription,
  looksLikeStructuredProblemDescription,
} from '@/components/df-8d/StructuredProblemDescription';
import { Df8dProblemDescriptionSections } from '@/components/df-8d/Df8dProblemDescriptionSections';
import {
  stripSquareBullets,
  shouldRenderDf8dProblemDescriptionAsPlain,
  hasStructuredRootCauseData,
  stripDuplicateRootCauseFromProblemDescription,
  getNonConformityListTitle,
  shouldReplaceGrupOzetiBlobIn5n1kNe,
  inferMeaningful5n1kNe,
} from '@/lib/df8dTextUtils';
import {
  normalizeNcAttachmentPath,
  normalizeNcAttachmentPathsList,
  fetchNcAttachmentAsBlob,
  prepareNcAttachmentPreviewBlob,
  getBucketForNcAttachmentPath,
} from '@/lib/df8dAttachmentUtils';

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
  const [displayUrl, setDisplayUrl] = React.useState(null);
  const [pdfViewerState, setPdfViewerState] = React.useState({ isOpen: false, url: null, title: null });
  const [isLoading, setIsLoading] = React.useState(true);
  const [pdfOpening, setPdfOpening] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [blobLooksImage, setBlobLooksImage] = React.useState(false);
  const [noInlineImgPreview, setNoInlineImgPreview] = React.useState(false);
  // fallbackAttempted: public URL başarısız olunca blob indirme denendi mi
  const [fallbackAttempted, setFallbackAttempted] = React.useState(false);
  const blobPreviewRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    const revokeBlob = () => {
      if (blobPreviewRef.current) {
        URL.revokeObjectURL(blobPreviewRef.current);
        blobPreviewRef.current = null;
      }
    };

    const loadPreview = async () => {
      revokeBlob();
      setDisplayUrl(null);
      setImageError(false);
      setFallbackAttempted(false);
      setIsLoading(true);
      setBlobLooksImage(false);
      setNoInlineImgPreview(false);

      const storagePath = normalizeNcAttachmentPath(path) || '';
      if (!storagePath) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const bucket = getBucketForNcAttachmentPath(storagePath);
      const isImgPath = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif|heic|heif|avif)$/i.test(storagePath);
      const isHeicFamily = /\.(heic|heif|tif|tiff)$/i.test(storagePath);
      const isPdfPath = /\.pdf$/i.test(storagePath);

      // Resimler için: getPublicUrl anında URL üretir (ağ isteği yok), public bucket'ta direkt çalışır.
      // Eğer bucket private ise img onError → blob fallback tetiklenir.
      if (isImgPath && !isPdfPath) {
        try {
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          if (!cancelled && publicUrl) {
            setBlobLooksImage(!isHeicFamily);
            setNoInlineImgPreview(isHeicFamily);
            setDisplayUrl(publicUrl);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          // getPublicUrl hata verirse blob yoluna geç
        }
      }

      // PDF ve diğer dosyalar (veya getPublicUrl başarısız olduysa): blob indir
      try {
        const { blob, error } = await fetchNcAttachmentAsBlob(supabase, path);
        if (cancelled) return;
        if (blob && blob.size > 0) {
          const prep = await prepareNcAttachmentPreviewBlob(blob, storagePath);
          if (cancelled) return;
          const url = URL.createObjectURL(prep.outBlob);
          blobPreviewRef.current = url;
          setBlobLooksImage(prep.blobLooksImage);
          setNoInlineImgPreview(prep.noInlineImgPreview);
          setDisplayUrl(url);
        } else {
          // Blob da başarısız — PDF için public URL'i son çare olarak dene
          if (isPdfPath) {
            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath);
            if (!cancelled && publicUrl) setDisplayUrl(publicUrl);
          }
          if (error) console.error('Ek önizleme:', storagePath, error.message);
        }
      } catch (err) {
        console.error('Ek önizleme yüklenemedi:', storagePath, err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (path) {
      loadPreview();
    } else {
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [path]);

  const pathStr = normalizeNcAttachmentPath(path) || (typeof path === 'string' ? path : '');
  const pathSuggestsImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif|heic|heif|avif)$/i.test(pathStr);
  const isPdf = /\.pdf$/i.test(pathStr);
  const fileName = pathStr.split('/').pop() || 'ek';

  const handlePdfClick = async (e) => {
    e.preventDefault();
    if (!path) return;

    setPdfOpening(true);
    try {
      const { blob, error } = await fetchNcAttachmentAsBlob(supabase, path);
      if (blob && blob.size > 0) {
        const pdfBlob = String(blob.type || '').includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        setPdfViewerState({ isOpen: true, url: blobUrl, title: fileName });
        return;
      }
      console.error('PDF indirme hatası:', error);
      if (displayUrl) {
        setPdfViewerState({ isOpen: true, url: displayUrl, title: fileName });
      }
    } catch (err) {
      console.error('PDF açılırken hata:', err);
      if (displayUrl) {
        setPdfViewerState({ isOpen: true, url: displayUrl, title: fileName });
      }
    } finally {
      setPdfOpening(false);
    }
  };

  // Modal kapandığında blob URL'i temizle
  const handlePdfViewerClose = () => {
    if (pdfViewerState.url && pdfViewerState.url.startsWith('blob:')) {
      window.URL.revokeObjectURL(pdfViewerState.url);
    }
    setPdfViewerState({ isOpen: false, url: null, title: null });
  };

  // Public URL yüklenemedi → blob indirmeyi dene, o da başarısız olursa hata göster
  const handleImageError = async () => {
    if (fallbackAttempted) { setImageError(true); return; }
    setFallbackAttempted(true);
    const storagePath = normalizeNcAttachmentPath(path) || '';
    try {
      const { blob } = await fetchNcAttachmentAsBlob(supabase, path);
      if (blob && blob.size > 0) {
        const prep = await prepareNcAttachmentPreviewBlob(blob, storagePath);
        const url = URL.createObjectURL(prep.outBlob);
        blobPreviewRef.current = url;
        setBlobLooksImage(prep.blobLooksImage);
        setNoInlineImgPreview(prep.noInlineImgPreview);
        setDisplayUrl(url);
      } else {
        setImageError(true);
      }
    } catch {
      setImageError(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 bg-muted/30 rounded-lg h-32">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin shrink-0" aria-hidden />
        <span className="text-xs text-muted-foreground truncate w-full text-center">{fileName}</span>
      </div>
    );
  }

  if (!displayUrl && isPdf) {
    return (
      <>
        <div
          className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all cursor-pointer hover:bg-secondary transition-colors"
          onClick={handlePdfClick}
        >
          {pdfOpening ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin shrink-0" aria-hidden />
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

  if (!displayUrl && pathSuggestsImage && !isPdf) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all">
        <Image className="w-6 h-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
        <span className="text-xs text-orange-500">Önizleme yüklenemedi</span>
      </div>
    );
  }

  if (!displayUrl) return null;

  if (displayUrl && noInlineImgPreview) {
    return (
      <a
        href={displayUrl}
        download={fileName}
        className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all hover:bg-secondary transition-colors"
      >
        <Image className="w-6 h-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
        <span className="text-xs text-primary font-medium">HEIC / önizleme yok — indirmek için tıklayın</span>
      </a>
    );
  }

  if (blobLooksImage && !imageError) {
    return (
      <div className="group cursor-pointer" onClick={() => onPreview(displayUrl)}>
        <img
          src={displayUrl}
          alt="Ek"
          className="rounded-lg object-cover w-full h-32 transition-transform duration-300 group-hover:scale-105"
          onError={handleImageError}
        />
      </div>
    );
  }

  // Resim yükleme hatası veya desteklenmeyen format durumunda dosya ikonu göster
  if (blobLooksImage && imageError) {
    return (
      <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all hover:bg-secondary transition-colors">
        <Image className="w-6 h-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
        <span className="text-xs text-orange-500">Önizleme yüklenemedi</span>
      </a>
    );
  }

  if (isPdf) {
    return (
      <>
        <div
          className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all cursor-pointer hover:bg-secondary transition-colors"
          onClick={handlePdfClick}
        >
          {pdfOpening ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin shrink-0" aria-hidden />
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
    <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 bg-background rounded-lg h-32 text-center break-all hover:bg-secondary transition-colors">
      <Paperclip className="w-6 h-6 text-muted-foreground" />
      <span className="text-xs text-muted-foreground truncate w-full">{fileName}</span>
    </a>
  );
};

/** Başlık satırında uzun/şablon metinleri kısalt; normal yazı (uppercase yok) */
function getHeaderTitleParts(record) {
  if (!record) {
    return { line1: '—', line2: null, isGroup: false, badge: null };
  }

  const fromList = getNonConformityListTitle(record, '');
  const raw = (fromList && fromList.trim()) || stripSquareBullets((record.title || '').trim());
  const nc = record.nc_number || record.mdi_no || '';

  if (!raw) {
    return { line1: nc || '—', line2: null, isGroup: false, badge: null };
  }

  if (/^\[UYG-GRUP\]/i.test(raw)) {
    const rest = raw.replace(/^\[UYG-GRUP\]\s*/i, '').trim();
    return {
      line1: nc || '—',
      line2: rest,
      isGroup: true,
      badge: 'Grup özeti',
    };
  }

  if (/^Grup:/i.test(raw)) {
    return {
      line1: nc || '—',
      line2: raw,
      isGroup: true,
      badge: 'Grup özeti',
    };
  }

  if (raw.includes('GRUP ÖZETİ') || (raw.length > 200 && /\bKategori\s*:/i.test(raw))) {
    const firstLine = raw.split('\n')[0].trim();
    return {
      line1: nc || '—',
      line2: firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine,
      isGroup: true,
      badge: 'Grup özeti',
    };
  }

  if (raw.length > 160) {
    return {
      line1: nc || '—',
      line2: `${raw.slice(0, 157)}…`,
      isGroup: false,
      badge: null,
    };
  }

  return {
    line1: nc || '—',
    line2: raw,
    isGroup: false,
    badge: null,
  };
}

const NCViewModal = ({ isOpen, setIsOpen, record, onDownloadPDF, onEdit, onNcRecordUpdated }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [isEditRejectionOpen, setIsEditRejectionOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [supplierName, setSupplierName] = useState(null);

  const recordId = record?.id || null;
  const recordSupplierId = record?.supplier_id || null;

  // Kayıt değiştiği anda önceki kayda ait tedarikçi adını SENKRON olarak temizle.
  // Aksi halde yeni modal, eski kaydın supplierName'ini "İlgili Birim" alanında gösterebiliyor.
  React.useLayoutEffect(() => {
    setSupplierName(null);
  }, [recordId]);

  // Tedarikçi adını fetch et — kayıt değişince yeniden çek
  useEffect(() => {
    if (!isOpen || !recordId) return;
    if (!recordSupplierId) {
      setSupplierName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', recordSupplierId)
        .single();
      if (!cancelled && !error && data) {
        setSupplierName(data.name);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, recordId, recordSupplierId]);

  React.useLayoutEffect(() => {
    setLightboxUrl(null);
  }, [recordId]);

  useEffect(() => {
    if (isOpen && record) {
      // Teşhis: hangi kaydın modala aktarıldığını doğrulamak için.
      console.debug('[NCViewModal] render', {
        id: record.id,
        nc_number: record.nc_number || record.mdi_no,
        title: record.title,
        attachments: Array.isArray(record.attachments) ? record.attachments.length : 0,
        closing_attachments: Array.isArray(record.closing_attachments) ? record.closing_attachments.length : 0,
      });
    }
  }, [isOpen, record]);

  const headerParts = useMemo(() => getHeaderTitleParts(record), [record]);

  const openingAttachmentPaths = useMemo(
    () => normalizeNcAttachmentPathsList(record?.attachments),
    [record?.attachments]
  );
  const closingAttachmentPaths = useMemo(
    () => normalizeNcAttachmentPathsList(record?.closing_attachments),
    [record?.closing_attachments]
  );
  const hasAnyAttachmentGallery =
    openingAttachmentPaths.length > 0 || closingAttachmentPaths.length > 0;

  /** Kök neden analizleri ayrı alanlardaysa açıklamadaki mükerrer blokları gösterme */
  const problemDescriptionForView = useMemo(() => {
    if (!record) return '';
    const raw = record.description;
    if (!raw || typeof raw !== 'string') return '';
    if (!hasStructuredRootCauseData(record)) return raw;
    return stripDuplicateRootCauseFromProblemDescription(raw);
  }, [record]);

  /** «Kapatma / ilerleme» alanı problem tanımıyla birebir aynıysa ayrı kart gereksiz/tekrarlı */
  const showClosingNotesCard = useMemo(() => {
    const cn = record?.closing_notes?.trim();
    if (!cn) return false;
    const pd = problemDescriptionForView?.trim();
    if (pd && cn === pd) return false;
    return true;
  }, [record?.closing_notes, problemDescriptionForView]);

  if (!record) return null;

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
      : '-';

  const formatDateTime = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleString('tr-TR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
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

  const closingNotesViewTitle =
    record.status === 'Kapatıldı'
      ? 'Kapatma notları'
      : 'İlerleme notları / yapılan çalışmalar';

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

  /** Yeni sekme engellendiğinde yazdırma rotası aynı sekmede açılır (Safari / sıkı popup kuralları). */
  const openPrintInSameTab = () => {
    navigate(`/print/report/nonconformity/${record.id}?autoprint=true`);
    setIsOpen(false);
    toast({
      title: 'Rapor açılıyor',
      description:
        'Yazdırma sayfası bu sekmede açıldı. Listeye dönmek için tarayıcının geri tuşunu kullanabilirsiniz.',
    });
  };

  const handlePrint = async (e) => {
    // Event'i engelle - sayfa yenilenmesini önle
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!record?.id) {
      toast({
        variant: 'destructive',
        title: 'Yazdırılamadı',
        description: 'Kayıt kimliği bulunamadı. Sayfayı yenileyip tekrar deneyin.',
      });
      return;
    }

    // window.open'u tıklama ile aynı senkron zincirde çalıştır (Safari ve popup engelleyiciler)
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      openPrintInSameTab();
      return;
    }

    setIsPrinting(true);
    try {
      // Attachments localStorage kotasını şişirmesin; rapor /print sayfası id ile DB'den tamamlanır
      const { attachments, closing_attachments, ...recordWithoutAttachments } = record;
      const lightweightRecord = {
        ...recordWithoutAttachments,
        supplier_name: supplierName || record.supplier_name,
      };

      if (onDownloadPDF) {
        await Promise.resolve(onDownloadPDF(lightweightRecord, 'nonconformity', printWindow));
      } else {
        await openPrintableReport(lightweightRecord, 'nonconformity', false, printWindow);
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      const msg = error?.message || '';
      const looksLikePopupBlock = /açılır pencere|Rapor sekmesi açılamadı|popup/i.test(msg);
      if (record?.id && looksLikePopupBlock) {
        try {
          printWindow.close();
        } catch {
          /* noop */
        }
        openPrintInSameTab();
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Yazdırılamadı',
        description: msg || 'Rapor açılırken hata oluştu.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      <Df8dImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <EditRejectionDetailsModal
        isOpen={isEditRejectionOpen}
        setIsOpen={setIsEditRejectionOpen}
        record={record}
        onSaved={() => onNcRecordUpdated?.(record.id)}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          key={recordId || 'nc-view'}
          className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col gap-0 p-0 rounded-xl border-0 shadow-2xl"
          hideCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              Uygunsuzluk detayı {record.nc_number || record.mdi_no || ''}
            </DialogTitle>
            <DialogDescription>Uygunsuzluk kaydı ayrıntıları</DialogDescription>
          </DialogHeader>

          <header className="relative shrink-0 border-b border-white/10 bg-gradient-to-br from-primary via-primary to-blue-800 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12),_transparent_55%)] pointer-events-none" aria-hidden />
            <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 sm:h-12 sm:w-12">
                  <AlertTriangle className="h-5 w-5 text-white sm:h-6 sm:w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                      Uygunsuzluk detayı
                    </h1>
                    {headerParts.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/95 ring-1 ring-white/25">
                        <Layers className="h-3 w-3 opacity-90" />
                        {headerParts.badge}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-white/80 tabular-nums sm:text-[13px]">
                    {headerParts.line1}
                  </p>
                  {headerParts.line2 && (
                    <p className="text-sm font-medium leading-snug text-white/95 [text-wrap:pretty] break-words normal-case tracking-normal">
                      {headerParts.line2}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {record.status && (
                      <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25">
                        {record.status}
                      </span>
                    )}
                    {record.is_major && (
                      <span className="rounded-full bg-amber-400/25 px-3 py-1 text-[11px] font-semibold text-amber-50 ring-1 ring-amber-300/40">
                        MAJOR
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 self-start sm:pt-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-10 w-10 rounded-xl bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Kapat</span>
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
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
                      {record.status && (
                        <InfoCard
                          icon={CircleDot}
                          label="Durum"
                          value={record.status}
                          variant={
                            record.status === 'İşlemde'
                              ? 'warning'
                              : record.status === 'Kapatıldı'
                                ? 'success'
                                : record.status === 'Reddedildi'
                                  ? 'danger'
                                  : 'default'
                          }
                        />
                      )}
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

                  {/* Problem Tanımı */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Problem Tanımı
                    </h3>
                    <Card className="border-border/80 shadow-sm">
                      <CardContent className="p-5 sm:p-6">
                        {problemDescriptionForView.trim() ? (
                          shouldRenderDf8dProblemDescriptionAsPlain(problemDescriptionForView) ? (
                            <Df8dProblemDescriptionSections text={problemDescriptionForView} />
                          ) : looksLikeStructuredProblemDescription(problemDescriptionForView) ? (
                            <StructuredProblemDescription text={problemDescriptionForView} />
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground [text-wrap:pretty] break-words">
                              {stripSquareBullets(problemDescriptionForView)}
                            </p>
                          )
                        ) : record.description?.trim() &&
                          hasStructuredRootCauseData(record) ? (
                          <p className="text-sm text-muted-foreground">
                            Sorun özetinin bu bölümü, metinde yalnızca «Kök Neden Analizleri»ne
                            taşınan içeriklerden oluşuyor; ayrıntılar aşağıdaki analiz
                            alanlarında.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Açıklama girilmemiş.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {showClosingNotesCard && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          {closingNotesViewTitle}
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


                  {hasAnyAttachmentGallery && (
                    <>
                      <Separator />
                      <div className="space-y-8">
                        {openingAttachmentPaths.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-foreground mb-3">
                              Kanıt dokümanları (kayıt / açılış)
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                              DF/8D formunda &quot;Kanıt Dokümanı&quot; ile eklenen dosyalar.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                              {openingAttachmentPaths.map((path, index) => (
                                <AttachmentItem
                                  key={`${recordId || 'nc'}::open::${path || index}`}
                                  path={path}
                                  onPreview={setLightboxUrl}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {closingAttachmentPaths.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-foreground mb-3">
                              Kanıt dokümanları (işlem / kapanış)
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                              İşlemde veya kayıt kapatılırken yüklenen dosyalar; açılış kanıtlarından ayrı tutulur.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                              {closingAttachmentPaths.map((path, index) => (
                                <AttachmentItem
                                  key={`${recordId || 'nc'}::close::${path || index}`}
                                  path={path}
                                  onPreview={setLightboxUrl}
                                />
                              ))}
                            </div>
                          </div>
                        )}
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
                                    {(() => {
                                      const raw = record.five_n1k_analysis.what || record.five_n1k_analysis.ne || '';
                                      if (!String(raw).trim()) return null;
                                      const display = shouldReplaceGrupOzetiBlobIn5n1kNe(raw)
                                        ? (inferMeaningful5n1kNe(record) || raw)
                                        : raw;
                                      return <InfoCard label="Ne" value={display} />;
                                    })()}
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
                                        <strong className="text-muted-foreground">1. Neden:</strong> {stripSquareBullets(record.five_why_analysis.why1)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.why2 && (
                                      <div className="p-3 bg-secondary/50 rounded-md">
                                        <strong className="text-muted-foreground">2. Neden:</strong> {stripSquareBullets(record.five_why_analysis.why2)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.why3 && (
                                      <div className="p-3 bg-secondary/50 rounded-md">
                                        <strong className="text-muted-foreground">3. Neden:</strong> {stripSquareBullets(record.five_why_analysis.why3)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.why4 && (
                                      <div className="p-3 bg-secondary/50 rounded-md">
                                        <strong className="text-muted-foreground">4. Neden:</strong> {stripSquareBullets(record.five_why_analysis.why4)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.why5 && (
                                      <div className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-md">
                                        <strong className="text-destructive">5. Neden (Kök Neden):</strong> {stripSquareBullets(record.five_why_analysis.why5)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.rootCause && (
                                      <div className="p-3 bg-primary/10 border-l-4 border-primary rounded-md mt-4">
                                        <strong className="text-primary">Kök Neden Özeti:</strong> {stripSquareBullets(record.five_why_analysis.rootCause)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.immediateAction && (
                                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 rounded-md mt-4">
                                        <strong className="text-yellow-700 dark:text-yellow-400">Anlık Aksiyon:</strong> {stripSquareBullets(record.five_why_analysis.immediateAction)}
                                      </div>
                                    )}
                                    {record.five_why_analysis.preventiveAction && (
                                      <div className="p-3 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-md mt-4">
                                        <strong className="text-green-700 dark:text-green-400">Önleyici Aksiyon:</strong> {stripSquareBullets(record.five_why_analysis.preventiveAction)}
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
                                          <strong className="text-muted-foreground">Üst Olay:</strong> {stripSquareBullets(record.fta_analysis.topEvent)}
                                        </div>
                                      )}
                                      {record.fta_analysis.events && Array.isArray(record.fta_analysis.events) && record.fta_analysis.events.length > 0 && (
                                        <div className="space-y-2">
                                          <strong className="text-muted-foreground block mb-2">Olaylar:</strong>
                                          {record.fta_analysis.events.map((event, idx) => (
                                            <div key={idx} className="p-3 bg-secondary/50 rounded-md">
                                              <div><strong>Tip:</strong> {event.type || '-'}</div>
                                              <div><strong>Açıklama:</strong> {stripSquareBullets(event.description || '-')}</div>
                                              {event.gate && <div><strong>Kapı:</strong> {stripSquareBullets(String(event.gate))}</div>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {record.fta_analysis.intermediateEvents && (
                                        <div className="p-3 bg-secondary/50 rounded-md">
                                          <strong className="text-muted-foreground">Ara Olaylar:</strong> {stripSquareBullets(record.fta_analysis.intermediateEvents)}
                                        </div>
                                      )}
                                      {record.fta_analysis.basicEvents && (
                                        <div className="p-3 bg-secondary/50 rounded-md">
                                          <strong className="text-muted-foreground">Temel Olaylar:</strong> {stripSquareBullets(record.fta_analysis.basicEvents)}
                                        </div>
                                      )}
                                      {record.fta_analysis.gates && (
                                        <div className="p-3 bg-secondary/50 rounded-md">
                                          <strong className="text-muted-foreground">Kapılar:</strong> {stripSquareBullets(record.fta_analysis.gates)}
                                        </div>
                                      )}
                                      {record.fta_analysis.rootCauses && (
                                        <div className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-md">
                                          <strong className="text-destructive">Kök Nedenler:</strong> {stripSquareBullets(record.fta_analysis.rootCauses)}
                                        </div>
                                      )}
                                      {record.fta_analysis.summary && (
                                        <div className="p-3 bg-primary/10 border-l-4 border-primary rounded-md mt-4">
                                          <strong className="text-primary">Özet:</strong> {stripSquareBullets(record.fta_analysis.summary)}
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
                        <div className="min-w-0 space-y-4">
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
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                            <XCircle className="h-5 w-5 shrink-0" />
                            Reddetme Detayları
                          </h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-destructive hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                            onClick={() => setIsEditRejectionOpen(true)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Reddetme bilgilerini düzenle
                          </Button>
                        </div>
                        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                          <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <InfoCard
                                icon={CalendarDays}
                                label="Reddetme Tarihi"
                                value={formatDateTime(record.rejected_at)}
                                variant="danger"
                              />
                            </div>
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

          <DialogFooter className="flex-shrink-0 flex-col gap-3 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap gap-2">
              {onEdit && (
                <Button variant="secondary" onClick={() => onEdit(record)}>
                  <Edit className="mr-2 h-4 w-4" /> Düzenle
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button onClick={handlePrint} variant="outline" disabled={isPrinting}>
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Yazdır / PDF
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="default" size="lg" className="min-w-[7rem]">
                  Kapat
                </Button>
              </DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NCViewModal;