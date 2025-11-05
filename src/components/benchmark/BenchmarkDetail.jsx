import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    X, Edit, Trash2, TrendingUp, FileText, User, Calendar,
    Clock, Tag, DollarSign, CheckCircle, AlertCircle,
    Download, Eye, Plus, Upload, File, Image as ImageIcon
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const BenchmarkDetail = ({
    isOpen,
    onClose,
    benchmark,
    onEdit,
    onDelete,
    onCompare,
    onRefresh
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [activityLog, setActivityLog] = useState([]);
    const [approvals, setApprovals] = useState([]);

    useEffect(() => {
        if (benchmark?.id) {
            fetchDetails();
        }
    }, [benchmark?.id]);

    const fetchDetails = async () => {
        if (!benchmark?.id) return;

        setLoading(true);
        try {
            const [itemsRes, docsRes, activityRes, approvalsRes] = await Promise.all([
                supabase
                    .from('benchmark_items')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('rank_order'),
                supabase
                    .from('benchmark_documents')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('benchmark_activity_log')
                    .select(`
                        *,
                        user:auth.users(email)
                    `)
                    .eq('benchmark_id', benchmark.id)
                    .order('performed_at', { ascending: false })
                    .limit(20),
                supabase
                    .from('benchmark_approvals')
                    .select(`
                        *,
                        approver:personnel!benchmark_approvals_approver_id_fkey(id, name)
                    `)
                    .eq('benchmark_id', benchmark.id)
                    .order('approval_level')
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (docsRes.error) throw docsRes.error;
            if (activityRes.error) throw activityRes.error;
            if (approvalsRes.error) throw approvalsRes.error;

            setItems(itemsRes.data || []);
            setDocuments(docsRes.data || []);
            setActivityLog(activityRes.data || []);
            setApprovals(approvalsRes.data || []);
        } catch (error) {
            console.error('Detaylar yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Detaylar yüklenirken bir hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Taslak': 'bg-gray-100 text-gray-800',
            'Devam Ediyor': 'bg-blue-100 text-blue-800',
            'Analiz Aşamasında': 'bg-purple-100 text-purple-800',
            'Onay Bekliyor': 'bg-yellow-100 text-yellow-800',
            'Tamamlandı': 'bg-green-100 text-green-800',
            'İptal': 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getPriorityColor = (priority) => {
        const colors = {
            'Kritik': 'text-red-500',
            'Yüksek': 'text-orange-500',
            'Normal': 'text-blue-500',
            'Düşük': 'text-gray-500'
        };
        return colors[priority] || 'text-gray-500';
    };

    const getApprovalStatusColor = (status) => {
        const colors = {
            'Bekliyor': 'bg-yellow-100 text-yellow-800',
            'Onaylandı': 'bg-green-100 text-green-800',
            'Reddedildi': 'bg-red-100 text-red-800',
            'Revizyon İstendi': 'bg-orange-100 text-orange-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    if (!benchmark) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh]">
                <DialogHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <DialogTitle className="text-2xl mb-2">
                                {benchmark.title}
                            </DialogTitle>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={getStatusColor(benchmark.status)}>
                                    {benchmark.status}
                                </Badge>
                                <Badge variant="outline">
                                    {benchmark.benchmark_number}
                                </Badge>
                                <span className={`text-sm font-medium ${getPriorityColor(benchmark.priority)}`}>
                                    Öncelik: {benchmark.priority}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(benchmark)}
                            >
                                <Edit className="h-4 w-4 mr-2" />
                                Düzenle
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => onCompare(benchmark)}
                            >
                                <TrendingUp className="h-4 w-4 mr-2" />
                                Karşılaştır
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="h-[calc(90vh-150px)] pr-4">
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                            <TabsTrigger value="items">
                                Alternatifler ({items.length})
                            </TabsTrigger>
                            <TabsTrigger value="documents">
                                Dokümanlar ({documents.length})
                            </TabsTrigger>
                            <TabsTrigger value="approvals">
                                Onaylar ({approvals.length})
                            </TabsTrigger>
                            <TabsTrigger value="activity">
                                Geçmiş ({activityLog.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Genel Bakış */}
                        <TabsContent value="overview" className="space-y-4 mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Temel Bilgiler</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Kategori
                                            </p>
                                            <Badge variant="secondary">
                                                {benchmark.category?.name || 'Belirtilmemiş'}
                                            </Badge>
                                        </div>

                                        {benchmark.owner && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Sorumlu
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span>{benchmark.owner.name}</span>
                                                </div>
                                            </div>
                                        )}

                                        {benchmark.department && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Departman
                                                </p>
                                                <span>{benchmark.department.department_name}</span>
                                            </div>
                                        )}

                                        {benchmark.start_date && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Başlangıç Tarihi
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {format(new Date(benchmark.start_date), 'dd MMMM yyyy', { locale: tr })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {benchmark.target_completion_date && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Hedef Tamamlanma
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {format(new Date(benchmark.target_completion_date), 'dd MMMM yyyy', { locale: tr })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {benchmark.estimated_budget && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Tahmini Bütçe
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {new Intl.NumberFormat('tr-TR', {
                                                            style: 'currency',
                                                            currency: benchmark.currency || 'TRY'
                                                        }).format(benchmark.estimated_budget)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {benchmark.description && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Açıklama
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.description}
                                            </p>
                                        </div>
                                    )}

                                    {benchmark.objective && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Amaç
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.objective}
                                            </p>
                                        </div>
                                    )}

                                    {benchmark.scope && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Kapsam
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.scope}
                                            </p>
                                        </div>
                                    )}

                                    {benchmark.tags && benchmark.tags.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">
                                                Etiketler
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {benchmark.tags.map((tag, idx) => (
                                                    <Badge key={idx} variant="outline">
                                                        <Tag className="h-3 w-3 mr-1" />
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {benchmark.notes && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Notlar
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.notes}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Onay Durumu */}
                            {benchmark.approval_status && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Onay Durumu</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge className={getApprovalStatusColor(benchmark.approval_status)}>
                                            {benchmark.approval_status}
                                        </Badge>
                                        {benchmark.approved_by_person && benchmark.approval_date && (
                                            <div className="mt-3 text-sm">
                                                <p>
                                                    <span className="font-medium">Onaylayan:</span>{' '}
                                                    {benchmark.approved_by_person.name}
                                                </p>
                                                <p>
                                                    <span className="font-medium">Onay Tarihi:</span>{' '}
                                                    {format(new Date(benchmark.approval_date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                                                </p>
                                            </div>
                                        )}
                                        {benchmark.approval_notes && (
                                            <div className="mt-3">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Onay Notları
                                                </p>
                                                <p className="text-sm">{benchmark.approval_notes}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* Alternatifler */}
                        <TabsContent value="items" className="mt-4">
                            <div className="space-y-4">
                                {items.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <TrendingUp className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Henüz alternatif eklenmemiş.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    items.map((item, idx) => (
                                        <Card key={item.id}>
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="flex items-center gap-2">
                                                            {item.rank_order > 0 && (
                                                                <Badge variant="outline">
                                                                    #{item.rank_order}
                                                                </Badge>
                                                            )}
                                                            {item.item_name}
                                                        </CardTitle>
                                                        {item.item_code && (
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                Kod: {item.item_code}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {item.is_recommended && (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Önerilen
                                                            </Badge>
                                                        )}
                                                        {item.is_current_solution && (
                                                            <Badge className="bg-blue-100 text-blue-800">
                                                                Mevcut
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {item.description && (
                                                    <p className="text-sm mb-3">{item.description}</p>
                                                )}
                                                <div className="grid gap-3 md:grid-cols-3 text-sm">
                                                    {item.unit_price && (
                                                        <div>
                                                            <p className="text-muted-foreground">Birim Fiyat</p>
                                                            <p className="font-medium">
                                                                {new Intl.NumberFormat('tr-TR', {
                                                                    style: 'currency',
                                                                    currency: item.currency || 'TRY'
                                                                }).format(item.unit_price)}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {item.quality_score && (
                                                        <div>
                                                            <p className="text-muted-foreground">Kalite Skoru</p>
                                                            <p className="font-medium">{item.quality_score}/100</p>
                                                        </div>
                                                    )}
                                                    {item.lead_time_days && (
                                                        <div>
                                                            <p className="text-muted-foreground">Tedarik Süresi</p>
                                                            <p className="font-medium">{item.lead_time_days} gün</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Dokümanlar */}
                        <TabsContent value="documents" className="mt-4">
                            <div className="space-y-3">
                                {documents.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Henüz doküman eklenmemiş.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    documents.map((doc) => (
                                        <Card key={doc.id}>
                                            <CardContent className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0">
                                                        {doc.file_type?.includes('image') ? (
                                                            <ImageIcon className="h-8 w-8 text-blue-500" />
                                                        ) : (
                                                            <File className="h-8 w-8 text-gray-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate">
                                                            {doc.document_title}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Badge variant="outline" className="text-xs">
                                                                {doc.document_type}
                                                            </Badge>
                                                            <span>{doc.file_name}</span>
                                                            {doc.file_size && (
                                                                <span>
                                                                    ({(doc.file_size / 1024).toFixed(1)} KB)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button size="sm" variant="outline">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Onaylar */}
                        <TabsContent value="approvals" className="mt-4">
                            <div className="space-y-3">
                                {approvals.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <CheckCircle className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Onay kaydı bulunmuyor.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    approvals.map((approval) => (
                                        <Card key={approval.id}>
                                            <CardContent className="py-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-medium">
                                                            {approval.approver?.name || 'Bilinmiyor'}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {approval.approver_role || 'Onaylayıcı'}
                                                        </p>
                                                    </div>
                                                    <Badge className={getApprovalStatusColor(approval.status)}>
                                                        {approval.status}
                                                    </Badge>
                                                </div>
                                                {approval.comments && (
                                                    <p className="text-sm mt-3">{approval.comments}</p>
                                                )}
                                                {approval.decision_date && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {format(new Date(approval.decision_date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Aktivite Geçmişi */}
                        <TabsContent value="activity" className="mt-4">
                            <div className="space-y-3">
                                {activityLog.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <Clock className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Aktivite geçmişi bulunmuyor.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    activityLog.map((activity) => (
                                        <Card key={activity.id}>
                                            <CardContent className="py-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 mt-1">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <AlertCircle className="h-4 w-4 text-primary" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">
                                                            {activity.activity_type}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {activity.description}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {format(new Date(activity.performed_at), 'dd MMMM yyyy HH:mm', { locale: tr })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default BenchmarkDetail;

