import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InfoCard } from '@/components/ui/InfoCard';
import { ViewModalLayout } from '@/components/shared/ViewModalLayout';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ClipboardList, Hash, Calendar, Package, User, Building2,
  MapPin, AlertTriangle, Layers, Car, FileText, MessageSquare,
  Shield, Activity, Wrench
} from 'lucide-react';

const severityConfig = {
  'Düşük': { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', variant: 'success' },
  'Orta': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', variant: 'warning' },
  'Yüksek': { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', variant: 'warning' },
  'Kritik': { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', variant: 'danger' },
};

const statusConfig = {
  'Açık': { color: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500' },
  'DF Önerildi': { color: 'bg-indigo-100 text-indigo-800', dotColor: 'bg-indigo-500' },
  '8D Önerildi': { color: 'bg-purple-100 text-purple-800', dotColor: 'bg-purple-500' },
  'DF Açıldı': { color: 'bg-emerald-100 text-emerald-800', dotColor: 'bg-emerald-500' },
  '8D Açıldı': { color: 'bg-teal-100 text-teal-800', dotColor: 'bg-teal-500' },
  'Kapatıldı': { color: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-500' },
};

const NonconformityDetailModal = ({ isOpen, setIsOpen, record }) => {
  if (!record) return null;

  const severity = severityConfig[record.severity] || {};
  const status = statusConfig[record.status] || {};

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd MMMM yyyy', { locale: tr });
    } catch {
      return '-';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd MMMM yyyy HH:mm', { locale: tr });
    } catch {
      return '-';
    }
  };

  return (
    <ViewModalLayout
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Uygunsuzluk Detayı"
      subtitle="Uygunsuzluk Yönetimi"
      icon={<ClipboardList className="h-5 w-5 text-white" />}
      badge={
        <div className="flex items-center gap-2">
          {record.severity && (
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${severity.color}`}>
              {record.severity}
            </span>
          )}
          {record.status && (
            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${status.dotColor || 'bg-white'}`} />
              {record.status}
            </span>
          )}
        </div>
      }
      maxWidth="sm:max-w-5xl"
    >
      <div className="space-y-6">
        {/* Kayıt Bilgileri */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard
            icon={Hash}
            label="Kayıt No"
            value={record.record_number}
            variant="primary"
          />
          <InfoCard
            icon={Calendar}
            label="Tespit Tarihi"
            value={formatDate(record.detection_date)}
          />
          <InfoCard
            icon={Calendar}
            label="Oluşturulma Tarihi"
            value={formatDateTime(record.created_at)}
          />
        </div>

        <Separator />

        {/* Parça & Ürün Bilgileri */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground uppercase tracking-wider">
            <Package className="h-4 w-4 text-primary" />
            Parça & Ürün Bilgileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard icon={Package} label="Parça Kodu" value={record.part_code} variant="primary" />
            <InfoCard icon={Package} label="Parça Adı" value={record.part_name} />
            <InfoCard icon={Car} label="Araç Tipi" value={record.vehicle_type} variant="warning" />
            <InfoCard icon={Layers} label="Hatalı Adet" value={record.quantity} variant={record.quantity > 10 ? 'danger' : 'default'} />
          </div>
        </div>

        <Separator />

        {/* Uygunsuzluk Detayları */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Uygunsuzluk Detayları
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <InfoCard icon={Layers} label="Hata Kategorisi" value={record.category} />
            <InfoCard icon={Shield} label="Ciddiyet" value={record.severity} variant={severity.variant || 'default'} />
            <InfoCard icon={MapPin} label="Tespit Alanı" value={record.detection_area} />
            <InfoCard icon={Activity} label="Durum" value={record.status} variant="info" />
          </div>

          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Uygunsuzluk Açıklaması
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {record.description || '-'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Personel Bilgileri */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground uppercase tracking-wider">
            <User className="h-4 w-4 text-primary" />
            Personel & Birim Bilgileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard icon={User} label="Tespit Eden Kişi" value={record.detected_by} />
            <InfoCard icon={User} label="Sorumlu Kişi" value={record.responsible_person} variant="warning" />
            <InfoCard icon={Building2} label="Sorumlu Birim" value={record.department} />
          </div>
        </div>

        {/* Acil Aksiyon */}
        {record.action_taken && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground uppercase tracking-wider">
                <Wrench className="h-4 w-4 text-primary" />
                Alınan Acil Aksiyon
              </h3>
              <Card className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <CardContent className="p-5">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {record.action_taken}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Ek Notlar */}
        {record.notes && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground uppercase tracking-wider">
                <MessageSquare className="h-4 w-4 text-primary" />
                Ek Notlar
              </h3>
              <Card className="bg-muted/30">
                <CardContent className="p-5">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {record.notes}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </ViewModalLayout>
  );
};

export default NonconformityDetailModal;
