import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit, X, FileText, Users, Calendar, Package, AlertCircle, AlertTriangle,
    CheckCircle2, Clock, Download, Upload, Trash2, Plus,
    BarChart3, MessageSquare, Activity, ExternalLink, User, Hash
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InfoCard } from '@/components/ui/InfoCard';
import { DialogClose } from '@/components/ui/dialog';
import AnalysisTab from './AnalysisTab';
import ActionsTab from './ActionsTab';
import DocumentsTab from './DocumentsTab';
import CommunicationTab from './CommunicationTab';
import CreateNCFromComplaintModal from './CreateNCFromComplaintModal';

const SEVERITY_COLORS = {
    'Kritik': 'destructive',
    'Yüksek': 'warning',
    'Orta': 'default',
    'Düşük': 'secondary'
};

const STATUS_COLORS = {
    'Açık': 'destructive',
    'Analiz Aşamasında': 'warning',
    'Aksiyon Alınıyor': 'default',
    'Doğrulama Bekleniyor': 'secondary',
    'Kapalı': 'success',
    'İptal': 'outline'
};

const ComplaintDetailModal = ({ open, setOpen, complaint, onEdit, onRefresh }) => {
    const { toast } = useToast();
    const { personnel, unitCostSettings } = useData();
    const [activeTab, setActiveTab] = useState('overview');
    const [complaintData, setComplaintData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analyses, setAnalyses] = useState([]);
    const [actions, setActions] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [communications, setCommunications] = useState([]);
    const [isNCModalOpen, setNCModalOpen] = useState(false);

    // Şikayet verilerini yükle
    const loadComplaintData = useCallback(async () => {
        if (!complaint?.id) return;

        setLoading(true);
        try {
            // Ana şikayet verisi
            const { data: mainData, error: mainError } = await supabase
                .from('customer_complaints')
                .select(`
                    *,
                    customer:customer_id(name, customer_code, customer_type, contact_person, contact_email, contact_phone),
                    responsible_person:responsible_personnel_id(full_name, department),
                    assigned_to:assigned_to_id(full_name, department),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .eq('id', complaint.id)
                .single();

            if (mainError) throw mainError;
            setComplaintData(mainData);

            // Analizler
            const { data: analysesData, error: analysesError } = await supabase
                .from('complaint_analyses')
                .select('*')
                .eq('complaint_id', complaint.id)
                .order('analysis_date', { ascending: false });

            if (!analysesError) setAnalyses(analysesData || []);

            // Aksiyonlar
            const { data: actionsData, error: actionsError } = await supabase
                .from('complaint_actions')
                .select(`
                    *,
                    responsible_person:responsible_person_id(full_name),
                    responsible_department:responsible_department_id(unit_name)
                `)
                .eq('complaint_id', complaint.id)
                .order('created_at', { ascending: false });

            if (!actionsError) setActions(actionsData || []);

            // Dokümanlar
            const { data: documentsData, error: documentsError } = await supabase
                .from('complaint_documents')
                .select('*')
                .eq('complaint_id', complaint.id)
                .order('upload_date', { ascending: false });

            if (!documentsError) setDocuments(documentsData || []);

            // İletişim geçmişi
            const { data: commData, error: commError } = await supabase
                .from('customer_communication_history')
                .select('*')
                .eq('complaint_id', complaint.id)
                .order('communication_date', { ascending: false });

            if (!commError) setCommunications(commData || []);

        } catch (error) {
            console.error('Error loading complaint data:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Şikayet detayları yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [complaint?.id, toast]);

    useEffect(() => {
        if (open && complaint?.id) {
            loadComplaintData();
        }
    }, [open, complaint?.id, loadComplaintData]);

    const handleRefresh = useCallback(() => {
        loadComplaintData();
        if (onRefresh) onRefresh();
    }, [loadComplaintData, onRefresh]);

    const getDaysOpen = useCallback((complaintDate, closeDate) => {
        const start = new Date(complaintDate);
        const end = closeDate ? new Date(closeDate) : new Date();
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }, []);

    if (!complaintData && !loading) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                                <AlertCircle className="h-6 w-6" />
                                Müşteri Şikayeti Detayı
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                {complaintData?.complaint_number || 'Yükleniyor...'} - {complaintData?.title || ''}
                            </DialogDescription>
                        </div>
                        {complaintData && (
                            <div className="flex items-center gap-2">
                                <Badge variant={SEVERITY_COLORS[complaintData.severity]}>
                                    {complaintData.severity}
                                </Badge>
                                <Badge variant={STATUS_COLORS[complaintData.status]}>
                                    {complaintData.status}
                                </Badge>
                            </div>
                        )}
                    </div>
                </DialogHeader>
                
                {complaintData && (
                    <div className="flex gap-2 px-6 pb-4 border-b">
                        <Button
                            variant="outline"
                            onClick={() => setNCModalOpen(true)}
                        >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Uygunsuzluk Oluştur
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
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (window.confirm('Bu şikayeti silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                                    try {
                                        const { error } = await supabase
                                            .from('customer_complaints')
                                            .delete()
                                            .eq('id', complaintData.id);
                                        
                                        if (error) throw error;
                                        
                                        toast({
                                            title: 'Başarılı',
                                            description: 'Şikayet başarıyla silindi.'
                                        });
                                        setOpen(false);
                                        onRefresh();
                                    } catch (error) {
                                        console.error('Error deleting complaint:', error);
                                        toast({
                                            variant: 'destructive',
                                            title: 'Hata',
                                            description: 'Şikayet silinirken hata oluştu.'
                                        });
                                    }
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Sil
                        </Button>
                    </div>
                )}

                <ScrollArea className="flex-1 pr-4 -mr-4 mt-4">

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center text-muted-foreground">
                            Yükleniyor...
                        </div>
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="overview">
                                <FileText className="w-4 h-4 mr-2" />
                                Genel Bakış
                            </TabsTrigger>
                            <TabsTrigger value="analysis">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Analizler
                            </TabsTrigger>
                            <TabsTrigger value="actions">
                                <CheckCircle2 className="w-4 h-4 mr-2" />
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

                        {/* Genel Bakış */}
                        <TabsContent value="overview" className="space-y-6">
                            {/* Önemli Bilgiler */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-primary" />
                                    Önemli Bilgiler
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <InfoCard 
                                        icon={Hash} 
                                        label="Şikayet No" 
                                        value={complaintData?.complaint_number} 
                                        variant="primary"
                                    />
                                    <InfoCard 
                                        icon={Calendar} 
                                        label="Şikayet Tarihi" 
                                        value={complaintData?.complaint_date ? new Date(complaintData.complaint_date).toLocaleDateString('tr-TR') : '-'} 
                                    />
                                    <InfoCard 
                                        icon={Clock} 
                                        label="Açık Süre" 
                                        value={`${getDaysOpen(complaintData?.complaint_date, complaintData?.actual_close_date)} gün`}
                                        variant="warning"
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Müşteri Bilgileri */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Users className="h-5 w-5 text-primary" />
                                        Müşteri Bilgileri
                                    </h3>
                                    <Card>
                                        <CardContent className="p-6 space-y-4">
                                            <InfoCard 
                                                icon={Users} 
                                                label="Müşteri Adı" 
                                                value={complaintData.customer?.customer_name} 
                                            />
                                            <InfoCard 
                                                icon={Hash} 
                                                label="Müşteri Kodu" 
                                                value={complaintData.customer?.customer_code} 
                                            />
                                            {complaintData.customer?.contact_person && (
                                                <InfoCard 
                                                    icon={User} 
                                                    label="Yetkili Kişi" 
                                                    value={complaintData.customer.contact_person} 
                                                />
                                            )}
                                            {complaintData.customer?.contact_email && (
                                                <InfoCard 
                                                    icon={Package} 
                                                    label="Email" 
                                                    value={complaintData.customer.contact_email} 
                                                />
                                            )}
                                            {complaintData.customer?.contact_phone && (
                                                <InfoCard 
                                                    icon={Package} 
                                                    label="Telefon" 
                                                    value={complaintData.customer.contact_phone} 
                                                />
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                    {/* SLA Bilgileri */}
                                    {complaintData.sla_status && (
                                        <Card className="border-l-4 border-l-primary">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Clock className="w-5 h-5" />
                                                    SLA Takibi
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        SLA Durumu
                                                    </div>
                                                    <Badge 
                                                        variant={
                                                            complaintData.sla_status === 'Overdue' ? 'destructive' :
                                                            complaintData.sla_status === 'At Risk' ? 'warning' :
                                                            'default'
                                                        }
                                                        className="mt-1"
                                                    >
                                                        {complaintData.sla_status === 'Overdue' ? 'Gecikmiş' :
                                                         complaintData.sla_status === 'At Risk' ? 'Risk Altında' :
                                                         complaintData.sla_status === 'On Time' ? 'Zamanında' :
                                                         'Beklemede'}
                                                    </Badge>
                                                </div>
                                                {complaintData.sla_first_response_hours && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            İlk Yanıt SLA
                                                        </div>
                                                        <div className="text-sm">
                                                            {complaintData.sla_first_response_hours} saat
                                                            {complaintData.first_response_hours && (
                                                                <span className={`ml-2 ${
                                                                    complaintData.first_response_hours > complaintData.sla_first_response_hours 
                                                                        ? 'text-red-600 font-semibold' 
                                                                        : 'text-green-600'
                                                                }`}>
                                                                    (Gerçekleşen: {complaintData.first_response_hours.toFixed(1)} saat)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {complaintData.sla_resolution_hours && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            Çözüm SLA
                                                        </div>
                                                        <div className="text-sm">
                                                            {complaintData.sla_resolution_hours} saat
                                                            {complaintData.resolution_hours && (
                                                                <span className={`ml-2 ${
                                                                    complaintData.resolution_hours > complaintData.sla_resolution_hours 
                                                                        ? 'text-red-600 font-semibold' 
                                                                        : 'text-green-600'
                                                                }`}>
                                                                    (Gerçekleşen: {complaintData.resolution_hours.toFixed(1)} saat)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {complaintData.first_response_date && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            İlk Yanıt Tarihi
                                                        </div>
                                                        <div className="text-sm">
                                                            {new Date(complaintData.first_response_date).toLocaleDateString('tr-TR')}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Şikayet Detayları */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <AlertCircle className="w-5 h-5" />
                                                Şikayet Detayları
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    Kaynak
                                                </div>
                                                <div>{complaintData.complaint_source}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    Kategori
                                                </div>
                                                <div>{complaintData.complaint_category}</div>
                                            </div>
                                            {complaintData.complaint_classification && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Sınıflandırma (ISO 10002)
                                                    </div>
                                                    <div>
                                                        <Badge variant="outline">
                                                            {complaintData.complaint_classification}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    Öncelik
                                                </div>
                                                <div>
                                                    <Badge variant="outline">
                                                        {complaintData.priority}
                                                    </Badge>
                                                </div>
                                            </div>
                                            {complaintData.target_close_date && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Hedef Kapanış
                                                    </div>
                                                    <div>
                                                        {new Date(complaintData.target_close_date).toLocaleDateString('tr-TR')}
                                                    </div>
                                                </div>
                                            )}
                                            {complaintData.actual_close_date && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Gerçekleşen Kapanış
                                                    </div>
                                                    <div>
                                                        {new Date(complaintData.actual_close_date).toLocaleDateString('tr-TR')}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Sorumluluk */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Users className="w-5 h-5" />
                                                Sorumluluk
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {complaintData.responsible_department && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Sorumlu Departman
                                                    </div>
                                                    <div>{complaintData.responsible_department.unit_name}</div>
                                                </div>
                                            )}
                                            {complaintData.responsible_person && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Sorumlu Kişi
                                                    </div>
                                                    <div>{complaintData.responsible_person.full_name}</div>
                                                </div>
                                            )}
                                            {complaintData.assigned_to && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Atanan Kişi
                                                    </div>
                                                    <div>{complaintData.assigned_to.full_name}</div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Ürün Bilgileri */}
                                    {(complaintData.product_name || complaintData.product_code) && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Package className="w-5 h-5" />
                                                    Ürün Bilgileri
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {complaintData.product_name && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            Ürün Adı
                                                        </div>
                                                        <div>{complaintData.product_name}</div>
                                                    </div>
                                                )}
                                                {complaintData.product_code && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            Ürün Kodu
                                                        </div>
                                                        <div className="font-mono text-sm">
                                                            {complaintData.product_code}
                                                        </div>
                                                    </div>
                                                )}
                                                {complaintData.batch_number && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            Parti/Lot No
                                                        </div>
                                                        <div className="font-mono text-sm">
                                                            {complaintData.batch_number}
                                                        </div>
                                                    </div>
                                                )}
                                                {complaintData.quantity_affected && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            Etkilenen Miktar
                                                        </div>
                                                        <div>{complaintData.quantity_affected}</div>
                                                    </div>
                                                )}
                                                {complaintData.production_date && (
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">
                                                            Üretim Tarihi
                                                        </div>
                                                        <div>
                                                            {new Date(complaintData.production_date).toLocaleDateString('tr-TR')}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                {/* Açıklama */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Şikayet Açıklaması</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="whitespace-pre-wrap text-sm">
                                            {complaintData.description}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Müşteri Etkisi */}
                                {complaintData.customer_impact && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Müşteri Etkisi</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="whitespace-pre-wrap text-sm">
                                                {complaintData.customer_impact}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Finansal Etki */}
                                {complaintData.financial_impact && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Finansal Etki</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-red-600">
                                                {Number(complaintData.financial_impact).toLocaleString('tr-TR', {
                                                    style: 'currency',
                                                    currency: 'TRY'
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>

                            {/* Analizler Tab */}
                            <TabsContent value="analysis" className="mt-0">
                                <AnalysisTab
                                    complaintId={complaintData?.id}
                                    analyses={analyses}
                                    onRefresh={handleRefresh}
                                />
                            </TabsContent>

                            {/* Aksiyonlar Tab */}
                            <TabsContent value="actions" className="mt-0">
                                <ActionsTab
                                    complaintId={complaintData?.id}
                                    actions={actions}
                                    onRefresh={handleRefresh}
                                />
                            </TabsContent>

                            {/* Dokümanlar Tab */}
                            <TabsContent value="documents" className="mt-0">
                                <DocumentsTab
                                    complaintId={complaintData?.id}
                                    documents={documents}
                                    onRefresh={handleRefresh}
                                />
                            </TabsContent>

                            {/* İletişim Tab */}
                            <TabsContent value="communication" className="mt-0">
                                <CommunicationTab
                                    complaintId={complaintData?.id}
                                    communications={communications}
                                    onRefresh={handleRefresh}
                                />
                            </TabsContent>
                        </div>
                    </Tabs>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Kapat
                    </Button>
                </DialogFooter>
            </DialogContent>

            <CreateNCFromComplaintModal
                open={isNCModalOpen}
                setOpen={setNCModalOpen}
                complaint={complaintData}
                onSuccess={() => {
                    loadComplaintData();
                    onRefresh();
                }}
            />
        </Dialog>
    );
};

export default ComplaintDetailModal;
