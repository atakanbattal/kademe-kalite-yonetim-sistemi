import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    Clock,
    Download,
    Edit,
    FileText,
    Globe,
    Hash,
    MessageSquare,
    Package,
    Repeat,
    ShieldCheck,
    Trash2,
    Upload,
    User,
    Users,
    Wrench,
    Workflow,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InfoCard } from '@/components/ui/InfoCard';
import AnalysisTab from './AnalysisTab';
import ActionsTab from './ActionsTab';
import DocumentsTab from './DocumentsTab';
import CommunicationTab from './CommunicationTab';
import CreateNCFromComplaintModal from './CreateNCFromComplaintModal';
import { generateComplaintReport } from '@/lib/pdfGenerator';
import {
    calculateFirstResponseHours,
    calculateResolutionHours,
    formatBooleanLabel,
    getCaseTypeLabel,
    getCustomerDisplayName,
    getDynamicSlaStatus,
    getFaultPartSummaryLabel,
    getComplaintDisplayStatus,
    getSlaStatusVariant,
    getVehicleDisplayLabel,
    getWarrantyStatusVariant,
} from '@/components/customer-complaints/afterSalesConfig';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '-');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('tr-TR') : '-');
const formatCurrency = (value) =>
    Number(value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

const ComplaintDetailModal = ({ open, setOpen, complaint, onEdit, onRefresh }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [complaintData, setComplaintData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyses, setAnalyses] = useState([]);
    const [actions, setActions] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [communications, setCommunications] = useState([]);
    const [linkedMethods, setLinkedMethods] = useState([]);
    const [serviceOperations, setServiceOperations] = useState([]);
    const [isNCModalOpen, setNCModalOpen] = useState(false);

    const loadComplaintData = useCallback(async () => {
        if (!complaint?.id) return;

        setLoading(true);
        try {
            const { data: mainData, error: mainError } = await supabase
                .from('customer_complaints')
                .select(`
                    *,
                    customer:customer_id(name, customer_name, customer_code, customer_type, contact_person, contact_email, contact_phone),
                    responsible_person:responsible_personnel_id(full_name, department),
                    assigned_to:assigned_to_id(full_name, department),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .eq('id', complaint.id)
                .single();

            if (mainError) throw mainError;
            setComplaintData(mainData);

            const [
                analysesResult,
                actionsResult,
                documentsResult,
                communicationsResult,
                linkedMethodsResult,
                operationsResult,
            ] = await Promise.all([
                supabase.from('complaint_analyses').select('*').eq('complaint_id', complaint.id).order('analysis_date', { ascending: false }),
                supabase
                    .from('complaint_actions')
                    .select(`
                        *,
                        responsible_person:responsible_person_id(full_name),
                        responsible_department:responsible_department_id(unit_name)
                    `)
                    .eq('complaint_id', complaint.id)
                    .order('created_at', { ascending: false }),
                supabase.from('complaint_documents').select('*').eq('complaint_id', complaint.id).order('upload_date', { ascending: false }),
                supabase.from('customer_communication_history').select('*').eq('complaint_id', complaint.id).order('communication_date', { ascending: false }),
                supabase
                    .from('non_conformities')
                    .select('id, nc_number, mdi_no, title, status, type, opening_date, due_date, due_at, closed_at')
                    .eq('source_complaint_id', complaint.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('after_sales_service_operations')
                    .select(`
                        id,
                        operation_title,
                        operation_type,
                        status,
                        city,
                        current_location,
                        planned_start_date,
                        planned_end_date,
                        actual_start_date,
                        actual_end_date,
                        labor_hours,
                        total_cost,
                        completion_notes,
                        assigned_person:assigned_person_id(full_name)
                    `)
                    .eq('complaint_id', complaint.id)
                    .order('created_at', { ascending: false }),
            ]);

            if (!analysesResult.error) setAnalyses(analysesResult.data || []);
            if (!actionsResult.error) setActions(actionsResult.data || []);
            if (!documentsResult.error) setDocuments(documentsResult.data || []);
            if (!communicationsResult.error) setCommunications(communicationsResult.data || []);
            if (!linkedMethodsResult.error) setLinkedMethods(linkedMethodsResult.data || []);
            else setLinkedMethods([]);

            if (!operationsResult.error) setServiceOperations(operationsResult.data || []);
            else setServiceOperations([]);
        } catch (error) {
            console.error('After sales detail load error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Satış sonrası vaka detayları yüklenemedi.',
            });
        } finally {
            setLoading(false);
        }
    }, [complaint?.id, toast]);

    useEffect(() => {
        if (open && complaint?.id) loadComplaintData();
    }, [open, complaint?.id, loadComplaintData]);

    const handleRefresh = useCallback(() => {
        loadComplaintData();
        onRefresh?.();
    }, [loadComplaintData, onRefresh]);

    const getDaysOpen = useCallback((complaintDate, closeDate) => {
        if (!complaintDate) return 0;
        const start = new Date(complaintDate);
        const end = closeDate ? new Date(closeDate) : new Date();
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }, []);

    const handleGenerateReport = async () => {
        if (!complaintData) return;
        try {
            await generateComplaintReport(complaintData, analyses, actions);
        } catch (error) {
            console.error('After sales report error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Vaka raporu oluşturulamadı.',
            });
        }
    };

    const handleDelete = async () => {
        if (!complaintData) return;
        const confirmed = window.confirm('Bu satış sonrası vakayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.');
        if (!confirmed) return;

        try {
            const { error } = await supabase.from('customer_complaints').delete().eq('id', complaintData.id);
            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Satış sonrası vaka silindi.',
            });

            setOpen(false);
            onRefresh?.();
        } catch (error) {
            console.error('After sales delete error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Satış sonrası vaka silinemedi.',
            });
        }
    };

    if (!complaintData && !loading) return null;

    const customerName = getCustomerDisplayName(complaintData?.customer);
    const caseType = getCaseTypeLabel(complaintData);
    const vehicleLabel = getVehicleDisplayLabel(complaintData);
    const displayStatus = getComplaintDisplayStatus(complaintData);
    const dynamicSlaStatus = getDynamicSlaStatus(complaintData);
    const firstResponseHours = calculateFirstResponseHours(complaintData);
    const resolutionHours = calculateResolutionHours(complaintData);
    const hasFirstResponseData = Boolean(
        complaintData?.first_response_date ||
        complaintData?.service_start_date ||
        (complaintData?.first_response_hours !== undefined &&
            complaintData?.first_response_hours !== null &&
            complaintData?.first_response_hours !== '')
    );
    const hasResolutionData = Boolean(
        complaintData?.actual_close_date ||
        complaintData?.service_completion_date ||
        (complaintData?.resolution_hours !== undefined &&
            complaintData?.resolution_hours !== null &&
            complaintData?.resolution_hours !== '')
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Satış Sonrası Vaka Detayı - {complaintData?.complaint_number || ''}</DialogTitle>
                </DialogHeader>

                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg">
                            <Wrench className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Satış Sonrası Vaka Detayı</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">
                                {complaintData?.complaint_number || 'Yükleniyor...'} - {complaintData?.title || ''}
                            </p>
                        </div>
                        {complaintData && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                    {caseType}
                                </span>
                                <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                    {complaintData.severity}
                                </span>
                                <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                    {displayStatus}
                                </span>
                            </div>
                        )}
                    </div>
                </header>

                {complaintData && (
                    <div className="flex flex-wrap gap-2 px-6 py-4 border-b bg-muted/30 shrink-0">
                        <Button variant="default" onClick={handleGenerateReport} className="bg-primary">
                            <Download className="w-4 h-4 mr-2" />
                            Vaka Raporu
                        </Button>
                        <Button variant="outline" onClick={() => setNCModalOpen(true)}>
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Yöntem Aç
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setOpen(false);
                                onEdit(complaintData);
                            }}
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Düzenle
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Sil
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                        Satış sonrası vaka yükleniyor...
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden min-h-0">
                            <div className="px-6 pt-4 shrink-0 bg-background">
                                <TabsList className="grid w-full grid-cols-5">
                                    <TabsTrigger value="overview">
                                        <FileText className="w-4 h-4 mr-2" />
                                        Vaka Özeti
                                    </TabsTrigger>
                                    <TabsTrigger value="analysis">
                                        <BarChart3 className="w-4 h-4 mr-2" />
                                        Analizler
                                    </TabsTrigger>
                                    <TabsTrigger value="actions">
                                        <AlertCircle className="w-4 h-4 mr-2" />
                                        Aksiyonlar
                                    </TabsTrigger>
                                    <TabsTrigger value="documents">
                                        <Upload className="w-4 h-4 mr-2" />
                                        Dokümanlar
                                    </TabsTrigger>
                                    <TabsTrigger value="communication">
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        İletişim
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto px-6">
                                <TabsContent value="overview" className="space-y-6 mt-6 pb-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg border">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Vaka No</p>
                                            <p className="font-semibold">{complaintData?.complaint_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Vaka Tipi</p>
                                            <p className="font-semibold">{caseType}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Açık Süre</p>
                                            <p className="font-semibold text-amber-600">
                                                {getDaysOpen(
                                                    complaintData?.complaint_date,
                                                    complaintData?.actual_close_date || complaintData?.service_completion_date
                                                )} gün
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Müşteri</p>
                                            <p className="font-semibold truncate" title={customerName}>
                                                {customerName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50/60 rounded-lg border border-blue-100">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Seri No</p>
                                            <p className="font-semibold">{complaintData?.vehicle_serial_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Şasi No</p>
                                            <p className="font-semibold">{complaintData?.vehicle_chassis_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Garanti</p>
                                            <p className="font-semibold">{complaintData?.warranty_status || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase">Tekrar Sayısı</p>
                                            <p className="font-semibold">{complaintData?.repeat_failure_count ?? 0}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InfoCard icon={Hash} label="Vaka No" value={complaintData?.complaint_number || '-'} variant="primary" />
                                        <InfoCard icon={Clock} label="SLA Durumu" value={dynamicSlaStatus} />
                                        <InfoCard icon={Package} label="Araç / Üstyapı" value={vehicleLabel} />
                                    </div>

                                    <Separator className="my-2" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Users className="h-5 w-5 text-primary" />
                                                    Müşteri Bilgileri
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <InfoCard icon={Users} label="Müşteri Adı" value={customerName} />
                                                <InfoCard icon={Hash} label="Müşteri Kodu" value={complaintData.customer?.customer_code || '-'} />
                                                {complaintData.customer?.contact_person && (
                                                    <InfoCard icon={User} label="Yetkili Kişi" value={complaintData.customer.contact_person} />
                                                )}
                                                {complaintData.customer?.contact_email && (
                                                    <InfoCard icon={FileText} label="Email" value={complaintData.customer.contact_email} />
                                                )}
                                                {complaintData.customer?.contact_phone && (
                                                    <InfoCard icon={FileText} label="Telefon" value={complaintData.customer.contact_phone} />
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card className="border-l-4 border-l-primary">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Clock className="w-5 h-5" />
                                                    SLA Takibi
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">SLA Durumu</div>
                                                    <Badge variant={getSlaStatusVariant(dynamicSlaStatus)} className="mt-1">
                                                        {dynamicSlaStatus}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">İlk Yanıt</div>
                                                    <div>
                                                        {hasFirstResponseData
                                                            ? `${formatDate(complaintData.first_response_date || complaintData.service_start_date)} • ${firstResponseHours.toFixed(1)} saat`
                                                            : '-'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Çözüm Süresi</div>
                                                    <div>
                                                        {hasResolutionData
                                                            ? `${resolutionHours.toFixed(1)} saat`
                                                            : `${getDaysOpen(
                                                                complaintData?.complaint_date,
                                                                complaintData?.actual_close_date || complaintData?.service_completion_date
                                                            )} gün`}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Hedef / Gerçekleşen</div>
                                                    <div>
                                                        {formatDate(complaintData.target_close_date)} / {formatDate(complaintData.actual_close_date || complaintData.service_completion_date)}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <AlertCircle className="w-5 h-5" />
                                                    Vaka Detayları
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Giriş Kanalı</div>
                                                    <div>{complaintData.complaint_source || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Servis Kanalı</div>
                                                    <div>{complaintData.service_channel || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Kategori</div>
                                                    <div>{complaintData.complaint_category || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Sınıflandırma</div>
                                                    <div>{complaintData.complaint_classification || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Öncelik</div>
                                                    <div>{complaintData.priority || '-'}</div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Globe className="w-5 h-5" />
                                                    Servis ve Lokasyon
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Servis Lokasyonu</div>
                                                    <div>{complaintData.service_location_type || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Ülke / Şehir</div>
                                                    <div>
                                                        {complaintData.service_country || '-'}
                                                        {complaintData.service_city ? ` • ${complaintData.service_city}` : ''}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Servis Partneri</div>
                                                    <div>{complaintData.service_partner_name || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Help Desk Desteği</div>
                                                    <div>{formatBooleanLabel(complaintData.helpdesk_supported)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Görüşme Kaydı</div>
                                                    <div>{formatBooleanLabel(complaintData.conversation_recorded)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Servis Kaydı</div>
                                                    <div>{formatBooleanLabel(complaintData.service_record_created)}</div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <ShieldCheck className="w-5 h-5" />
                                                    Garanti Durumu
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Garanti Durumu</div>
                                                    <Badge variant={getWarrantyStatusVariant(complaintData.warranty_status)}>
                                                        {complaintData.warranty_status || 'Belirtilmedi'}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Garanti Belge No</div>
                                                    <div>{complaintData.warranty_document_no || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Garanti Başlangıç</div>
                                                    <div>{formatDate(complaintData.warranty_start_date)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Garanti Bitiş</div>
                                                    <div>{formatDate(complaintData.warranty_end_date)}</div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Package className="w-5 h-5" />
                                                    Araç ve Arızalı Parçalar
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Araç / Üstyapı</div>
                                                    <div>{vehicleLabel}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Kategori / Model Kodu</div>
                                                    <div>
                                                        {complaintData.vehicle_category || '-'}
                                                        {complaintData.vehicle_model_code ? ` • ${complaintData.vehicle_model_code}` : ''}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Şase</div>
                                                    <div>
                                                        {complaintData.chassis_brand || '-'}
                                                        {complaintData.chassis_model ? ` • ${complaintData.chassis_model}` : ''}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Seri / Şasi</div>
                                                    <div>
                                                        {complaintData.vehicle_serial_number || '-'}
                                                        {complaintData.vehicle_chassis_number ? ` • ${complaintData.vehicle_chassis_number}` : ''}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Plaka</div>
                                                    <div>{complaintData.vehicle_plate_number || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Arızalı Parçalar</div>
                                                    <div className="break-words">{getFaultPartSummaryLabel(complaintData)}</div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Workflow className="w-5 h-5" />
                                                    Yöntem ve Sistem Önerisi
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Önerilen Yöntem</div>
                                                    <div>{complaintData.recommended_workflow || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Öneri Gerekçesi</div>
                                                    <div className="text-sm">{complaintData.workflow_reason || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Kök Neden Metodu</div>
                                                    <div>{complaintData.root_cause_methodology || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Tekrar Sayısı</div>
                                                    <div>{complaintData.repeat_failure_count ?? 0}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">Tekrar Risk Seviyesi</div>
                                                    <div>{complaintData.recurrence_risk_level || '-'}</div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <AlertTriangle className="w-5 h-5" />
                                                    Bağlı DF / MDI / 8D Kayıtları
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {linkedMethods.length === 0 ? (
                                                    <div className="text-sm text-muted-foreground">
                                                        Bu vaka için henüz bağlı yöntem kaydı açılmamış.
                                                    </div>
                                                ) : (
                                                    linkedMethods.map((method) => (
                                                        <div key={method.id} className="rounded-lg border p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline">{method.type}</Badge>
                                                                        <span className="font-medium">
                                                                            {method.nc_number || method.mdi_no || method.id.slice(0, 8)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground mt-1">{method.title}</div>
                                                                </div>
                                                                <Badge variant={method.status === 'Kapatıldı' ? 'success' : 'secondary'}>
                                                                    {method.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-2">
                                                                Açılış: {formatDate(method.opening_date)} • Hedef: {formatDate(method.due_date || method.due_at)}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Wrench className="w-5 h-5" />
                                                    Saha Operasyonları
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {serviceOperations.length === 0 ? (
                                                    <div className="text-sm text-muted-foreground">
                                                        Bu vakaya bağlı operasyon planı bulunmuyor.
                                                    </div>
                                                ) : (
                                                    serviceOperations.map((operation) => (
                                                        <div key={operation.id} className="rounded-lg border p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline">{operation.operation_type}</Badge>
                                                                        <span className="font-medium">{operation.operation_title}</span>
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground mt-1">
                                                                        {operation.assigned_person?.full_name || 'Atanmamış'} • {operation.city || operation.current_location || '-'}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge variant={operation.status === 'Tamamlandı' ? 'success' : 'secondary'}>
                                                                        {operation.status}
                                                                    </Badge>
                                                                    <div className="text-xs text-muted-foreground mt-2">
                                                                        Plan: {formatDate(operation.planned_end_date)} • Bitiş: {formatDate(operation.actual_end_date)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-medium mt-2">{formatCurrency(operation.total_cost)}</div>
                                                        </div>
                                                    ))
                                                )}
                                            </CardContent>
                                        </Card>

                                        {(complaintData.responsible_department?.unit_name || complaintData.responsible_person?.full_name || complaintData.assigned_to?.full_name) && (
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-2 text-lg">
                                                        <Users className="w-5 h-5" />
                                                        Sorumluluk
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Sorumlu Departman</div>
                                                        <div>{complaintData.responsible_department?.unit_name || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Sorumlu Kişi</div>
                                                        <div>{complaintData.responsible_person?.full_name || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Atanan Kişi</div>
                                                        <div>{complaintData.assigned_to?.full_name || '-'}</div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>

                                    <Card className="border-primary/20">
                                        <CardHeader>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <FileText className="h-5 w-5" />
                                                Vaka Açıklaması
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="whitespace-pre-wrap text-base leading-relaxed">
                                                {complaintData.description || '-'}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {complaintData.customer_impact && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">Müşteri Etkisi</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                                    {complaintData.customer_impact}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {complaintData.financial_impact && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">Finansal Etki</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {formatCurrency(complaintData.financial_impact)}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </TabsContent>

                                <TabsContent value="analysis" className="mt-6 pb-6">
                                    <AnalysisTab complaintId={complaintData?.id} analyses={analyses} onRefresh={handleRefresh} />
                                </TabsContent>

                                <TabsContent value="actions" className="mt-6 pb-6">
                                    <ActionsTab
                                        complaintId={complaintData?.id}
                                        actions={actions}
                                        operations={serviceOperations}
                                        onRefresh={handleRefresh}
                                    />
                                </TabsContent>

                                <TabsContent value="documents" className="mt-6 pb-6">
                                    <DocumentsTab complaintId={complaintData?.id} documents={documents} onRefresh={handleRefresh} />
                                </TabsContent>

                                <TabsContent value="communication" className="mt-6 pb-6">
                                    <CommunicationTab complaintId={complaintData?.id} communications={communications} onRefresh={handleRefresh} />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                )}

                <DialogFooter className="px-6 py-4 border-t bg-muted/30">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" size="lg">
                            Kapat
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>

            <CreateNCFromComplaintModal
                open={isNCModalOpen}
                setOpen={setNCModalOpen}
                complaint={complaintData}
                onSuccess={() => {
                    loadComplaintData();
                    onRefresh?.();
                }}
            />
        </Dialog>
    );
};

export default ComplaintDetailModal;
