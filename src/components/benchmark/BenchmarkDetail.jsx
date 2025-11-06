import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    X, Edit, Trash2, TrendingUp, FileText, User, Calendar,
    Clock, Tag, DollarSign, CheckCircle, AlertCircle,
    Download, Eye, Plus, Upload, File, Image as ImageIcon,
    ExternalLink, Printer
} from 'lucide-react';
import BenchmarkDocumentUpload from './BenchmarkDocumentUpload';
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
    const [showDocumentUpload, setShowDocumentUpload] = useState(false);

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

    const handleDownloadDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage
                .from('benchmark_documents')
                .download(doc.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
                title: 'Başarılı',
                description: 'Doküman indirildi.'
            });
        } catch (error) {
            console.error('İndirme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Doküman indirilirken bir hata oluştu.'
            });
        }
    };

    const handleDocumentUploadSuccess = () => {
        setShowDocumentUpload(false);
        fetchDetails();
        toast({
            title: 'Başarılı',
            description: 'Dokümanlar başarıyla yüklendi.'
        });
    };

    const handleGenerateReport = () => {
        // Yazdırma sayfasını aç
        const printContent = generatePrintableReport();
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.'
            });
            return;
        }

        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Sayfayı yazdır
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const generatePrintableReport = () => {
        const today = format(new Date(), 'dd MMMM yyyy', { locale: tr });
        
        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benchmark Raporu - ${benchmark.title}</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .header .meta {
            color: #666;
            font-size: 14px;
        }
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .section-title {
            background: #2563eb;
            color: white;
            padding: 10px 15px;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        .info-item {
            border-left: 3px solid #2563eb;
            padding-left: 12px;
        }
        .info-label {
            font-weight: 600;
            color: #666;
            font-size: 13px;
            margin-bottom: 3px;
        }
        .info-value {
            font-size: 15px;
            color: #000;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
        }
        .badge-status {
            background: #3b82f6;
            color: white;
        }
        .badge-priority {
            background: #f59e0b;
            color: white;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }
        th {
            background: #f3f4f6;
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .description {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        @media print {
            body {
                padding: 0;
            }
            .section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Benchmark Analiz Raporu</h1>
        <div class="meta">
            <strong>${benchmark.benchmark_number}</strong> | ${today}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Genel Bilgiler</div>
        <h2 style="margin-top: 0;">${benchmark.title}</h2>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Durum</div>
                <div class="info-value"><span class="badge badge-status">${benchmark.status}</span></div>
            </div>
            <div class="info-item">
                <div class="info-label">Öncelik</div>
                <div class="info-value"><span class="badge badge-priority">${benchmark.priority}</span></div>
            </div>
            ${benchmark.category ? `
            <div class="info-item">
                <div class="info-label">Kategori</div>
                <div class="info-value">${benchmark.category.name}</div>
            </div>
            ` : ''}
            ${benchmark.owner ? `
            <div class="info-item">
                <div class="info-label">Sorumlu</div>
                <div class="info-value">${benchmark.owner.name}</div>
            </div>
            ` : ''}
            ${benchmark.department ? `
            <div class="info-item">
                <div class="info-label">Departman</div>
                <div class="info-value">${benchmark.department.department_name}</div>
            </div>
            ` : ''}
            ${benchmark.estimated_budget ? `
            <div class="info-item">
                <div class="info-label">Tahmini Bütçe</div>
                <div class="info-value">${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: benchmark.currency || 'TRY' }).format(benchmark.estimated_budget)}</div>
            </div>
            ` : ''}
        </div>

        ${benchmark.description ? `
        <div class="description">
            <strong>Açıklama:</strong><br>
            ${benchmark.description.replace(/\n/g, '<br>')}
        </div>
        ` : ''}
        
        ${benchmark.objective ? `
        <div class="description">
            <strong>Amaç:</strong><br>
            ${benchmark.objective.replace(/\n/g, '<br>')}
        </div>
        ` : ''}
    </div>

    ${items.length > 0 ? `
    <div class="section">
        <div class="section-title">Karşılaştırılan Alternatifler (${items.length})</div>
        <table>
            <thead>
                <tr>
                    <th>Sıra</th>
                    <th>Alternatif</th>
                    <th>Açıklama</th>
                    ${items[0].unit_price ? '<th>Fiyat</th>' : ''}
                    ${items[0].quality_score ? '<th>Kalite Skoru</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.item_name}</strong>${item.item_code ? `<br><small>${item.item_code}</small>` : ''}</td>
                    <td>${item.description || '-'}</td>
                    ${item.unit_price ? `<td>${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: item.currency || 'TRY' }).format(item.unit_price)}</td>` : ''}
                    ${item.quality_score ? `<td>${item.quality_score}/100</td>` : ''}
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${documents.length > 0 ? `
    <div class="section">
        <div class="section-title">Ekli Dokümanlar (${documents.length})</div>
        <table>
            <thead>
                <tr>
                    <th>Doküman Başlığı</th>
                    <th>Tür</th>
                    <th>Tarih</th>
                </tr>
            </thead>
            <tbody>
                ${documents.slice(0, 10).map(doc => `
                <tr>
                    <td>${doc.document_title}</td>
                    <td>${doc.document_type}</td>
                    <td>${doc.document_date ? format(new Date(doc.document_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p>Bu rapor Kademe QMS sistemi tarafından otomatik olarak oluşturulmuştur.</p>
        <p>Oluşturulma Tarihi: ${today}</p>
    </div>
</body>
</html>
        `;
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
                                onClick={handleGenerateReport}
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Rapor
                            </Button>
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
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">
                                        Kanıt Dokümanları ({documents.length})
                                    </h3>
                                    <Button
                                        size="sm"
                                        onClick={() => setShowDocumentUpload(!showDocumentUpload)}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Doküman Yükle
                                    </Button>
                                </div>

                                {showDocumentUpload && (
                                    <Card className="border-2 border-primary">
                                        <CardHeader>
                                            <CardTitle className="text-base">Yeni Doküman Yükle</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <BenchmarkDocumentUpload
                                                benchmarkId={benchmark.id}
                                                onUploadSuccess={handleDocumentUploadSuccess}
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                                {documents.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-semibold mb-2">
                                                Henüz Doküman Yok
                                            </h3>
                                            <p className="text-muted-foreground text-center mb-4">
                                                Benchmark çalışmanıza kanıt dokümanlar ekleyerek<br />
                                                karşılaştırmanızı güçlendirin.
                                            </p>
                                            <Button onClick={() => setShowDocumentUpload(true)}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                İlk Dokümanı Yükle
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {documents.map((doc) => (
                                            <Card key={doc.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 mt-1">
                                                            {doc.file_type?.includes('image') ? (
                                                                <ImageIcon className="h-10 w-10 text-blue-500" />
                                                            ) : doc.file_type?.includes('pdf') ? (
                                                                <FileText className="h-10 w-10 text-red-500" />
                                                            ) : (
                                                                <File className="h-10 w-10 text-gray-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold truncate mb-1">
                                                                {doc.document_title}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {doc.document_type}
                                                                </Badge>
                                                                {doc.file_size && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {doc.description && (
                                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                                    {doc.description}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span>{doc.file_name}</span>
                                                            </div>
                                                            {doc.tags && doc.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {doc.tags.slice(0, 3).map((tag, idx) => (
                                                                        <Badge key={idx} variant="outline" className="text-xs">
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                    {doc.tags.length > 3 && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            +{doc.tags.length - 3}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-3">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDownloadDocument(doc)}
                                                            className="flex-1"
                                                        >
                                                            <Download className="h-4 w-4 mr-2" />
                                                            İndir
                                                        </Button>
                                                        {doc.file_type?.includes('image') && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    // Görüntüleme için yeni sekme aç
                                                                    const url = supabase.storage
                                                                        .from('benchmark_documents')
                                                                        .getPublicUrl(doc.file_path).data.publicUrl;
                                                                    window.open(url, '_blank');
                                                                }}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
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

