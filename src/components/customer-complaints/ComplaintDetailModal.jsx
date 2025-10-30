import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit, X, FileText, Users, Calendar, Package, AlertCircle, AlertTriangle,
    CheckCircle2, Clock, Download, Upload, Trash2, Plus,
    BarChart3, MessageSquare, Activity, ExternalLink
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
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <DialogTitle className="text-2xl">
                                    {complaintData?.complaint_number || 'Yükleniyor...'}
                                </DialogTitle>
                                {complaintData && (
                                    <>
                                        <Badge variant={SEVERITY_COLORS[complaintData.severity]}>
                                            {complaintData.severity}
                                        </Badge>
                                        <Badge variant={STATUS_COLORS[complaintData.status]}>
                                            {complaintData.status}
                                        </Badge>
                                    </>
                                )}
                            </div>
                            {complaintData && (
                                <div className="text-sm text-muted-foreground">
                                    <div className="font-medium">{complaintData.title}</div>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {complaintData.customer?.customer_name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(complaintData.complaint_date).toLocaleDateString('tr-TR')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {getDaysOpen(complaintData.complaint_date, complaintData.actual_close_date)} gün
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {complaintData && (
                            <div className="flex gap-2">
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
                            </div>
                        )}
                    </div>
                </DialogHeader>

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

                        <div className="flex-1 overflow-y-auto mt-4">
                            {/* Genel Bakış */}
                            <TabsContent value="overview" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Müşteri Bilgileri */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Users className="w-5 h-5" />
                                                Müşteri Bilgileri
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    Müşteri Adı
                                                </div>
                                                <div className="font-medium">
                                                    {complaintData.customer?.customer_name}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    Müşteri Kodu
                                                </div>
                                                <div className="font-mono text-sm">
                                                    {complaintData.customer?.customer_code}
                                                </div>
                                            </div>
                                            {complaintData.customer?.contact_person && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Yetkili Kişi
                                                    </div>
                                                    <div>{complaintData.customer.contact_person}</div>
                                                </div>
                                            )}
                                            {complaintData.customer?.contact_email && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Email
                                                    </div>
                                                    <div className="text-sm">
                                                        {complaintData.customer.contact_email}
                                                    </div>
                                                </div>
                                            )}
                                            {complaintData.customer?.contact_phone && (
                                                <div>
                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        Telefon
                                                    </div>
                                                    <div className="text-sm">
                                                        {complaintData.customer.contact_phone}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

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
