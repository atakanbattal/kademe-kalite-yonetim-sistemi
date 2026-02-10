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
            // Önce kritik verileri yükle (alternatifler ve dokümanlar)
            const [itemsRes, docsRes] = await Promise.all([
                supabase
                    .from('benchmark_items')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('rank_order'),
                supabase
                    .from('benchmark_documents')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('created_at', { ascending: false })
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (docsRes.error) throw docsRes.error;

            setItems(itemsRes.data || []);
            setDocuments(docsRes.data || []);

            // Opsiyonel verileri ayrı ayrı yükle (hata olsa bile devam et)
            try {
                const activityRes = await supabase
                    .from('benchmark_activity_log')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('performed_at', { ascending: false })
                    .limit(20);
                
                if (!activityRes.error) {
                    setActivityLog(activityRes.data || []);
                }
            } catch (err) {
                console.warn('Activity log yüklenemedi:', err);
                setActivityLog([]);
            }

            try {
                const approvalsRes = await supabase
                    .from('benchmark_approvals')
                    .select(`
                        *,
                        approver:personnel!benchmark_approvals_approver_id_fkey(id, name)
                    `)
                    .eq('benchmark_id', benchmark.id)
                    .order('approval_level');
                
                if (!approvalsRes.error) {
                    setApprovals(approvalsRes.data || []);
                }
            } catch (err) {
                console.warn('Approvals yüklenemedi (tablo mevcut olmayabilir):', err);
                setApprovals([]);
            }
        } catch (error) {
            console.error('Detaylar yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Detaylar yüklenirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata')
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
                .from('documents')
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
        const htmlContent = generatePrintableReport();
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.'
            });
            return;
        }
        
        if (printWindow) {
            printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(url));
        }
    };

    const generatePrintableReport = () => {
        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR') : '-';

        const getStatusBadge = (status) => {
            let bgColor, textColor;
            switch (status) {
                case 'Taslak': bgColor = '#e5e7eb'; textColor = '#4b5563'; break;
                case 'Devam Ediyor': bgColor = '#dbeafe'; textColor = '#1e40af'; break;
                case 'Analiz Aşamasında': bgColor = '#e9d5ff'; textColor = '#7c3aed'; break;
                case 'Onay Bekliyor': bgColor = '#fde047'; textColor = '#713f12'; break;
                case 'Tamamlandı': bgColor = '#86efac'; textColor = '#15803d'; break;
                case 'İptal': bgColor = '#fca5a5'; textColor = '#b91c1c'; break;
                default: bgColor = '#e5e7eb'; textColor = '#4b5563'; break;
            }
            return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${status}</span>`;
        };

        const getPriorityBadge = (priority) => {
            let bgColor, textColor;
            switch (priority) {
                case 'Kritik': bgColor = '#fca5a5'; textColor = '#b91c1c'; break;
                case 'Yüksek': bgColor = '#fdba74'; textColor = '#c2410c'; break;
                case 'Normal': bgColor = '#93c5fd'; textColor = '#1e40af'; break;
                case 'Düşük': bgColor = '#d1d5db'; textColor = '#4b5563'; break;
                default: bgColor = '#d1d5db'; textColor = '#4b5563'; break;
            }
            return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${priority}</span>`;
        };

        // Alternatifler için detaylı HTML
        const alternativesHtml = items.length > 0 ? `
            <div class="section">
                <h2 class="section-title">Karşılaştırılan Alternatifler (${items.length})</h2>
                <div class="section-content">
                ${items.map((item, index) => `
                    <div class="step-section">
                        <h3 class="step-title">${index + 1}. ${item.item_name}${item.item_code ? ` (${item.item_code})` : ''}</h3>
                        <div class="step-content">
                            ${item.description ? `<p><strong>Açıklama:</strong> ${item.description}</p>` : ''}
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px;">
                                ${item.unit_price ? `<p><strong>Birim Fiyat:</strong> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: item.currency || 'TRY' }).format(item.unit_price)}</p>` : ''}
                                ${item.total_cost_of_ownership ? `<p><strong>TCO:</strong> ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: item.currency || 'TRY' }).format(item.total_cost_of_ownership)}</p>` : ''}
                                ${item.roi_percentage ? `<p><strong>ROI:</strong> ${item.roi_percentage}%</p>` : ''}
                                ${item.quality_score ? `<p><strong>Kalite Skoru:</strong> ${item.quality_score}/100</p>` : ''}
                                ${item.performance_score ? `<p><strong>Performans Skoru:</strong> ${item.performance_score}/100</p>` : ''}
                                ${item.reliability_score ? `<p><strong>Güvenilirlik Skoru:</strong> ${item.reliability_score}/100</p>` : ''}
                                ${item.delivery_time_days ? `<p><strong>Teslimat Süresi:</strong> ${item.delivery_time_days} gün</p>` : ''}
                                ${item.after_sales_service_score ? `<p><strong>Satış Sonrası Hizmet:</strong> ${item.after_sales_service_score}/100</p>` : ''}
                                ${item.risk_level ? `<p><strong>Risk Seviyesi:</strong> ${item.risk_level}</p>` : ''}
                            </div>
                            ${(item.manufacturer || item.model_number || item.category || item.origin) ? `
                                <div class="step-description">
                                    ${item.manufacturer ? `<p><strong>Üretici:</strong> ${item.manufacturer}</p>` : ''}
                                    ${item.model_number ? `<p><strong>Model/Seri No:</strong> ${item.model_number}</p>` : ''}
                                    ${item.category ? `<p><strong>Kategori:</strong> ${item.category}</p>` : ''}
                                    ${item.origin ? `<p><strong>Menşei:</strong> ${item.origin}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
                </div>
            </div>
        ` : '';

        // Dokümanlar için HTML
        const documentsHtml = documents.length > 0 ? `
            <div class="section">
                <h2 class="section-title">Ekli Dokümanlar (${documents.length})</h2>
                <div class="section-content">
                <div class="info-grid">
                    ${documents.slice(0, 10).map(doc => `
                        <div class="info-item">
                            <span class="label">${doc.document_title || 'Doküman'}</span>
                            <span class="value">${doc.document_type || '-'} | ${doc.document_date ? formatDate(doc.document_date) : '-'}</span>
                        </div>
                    `).join('')}
                </div>
                </div>
            </div>
        ` : '';

        const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Benchmark Raporu - ${benchmark.benchmark_number || benchmark.title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        
        * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            line-height: 1.6;
        }
        .page {
            background-color: white;
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            padding: 0;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
        }
        .page::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8mm;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            z-index: 1;
        }
        .page-content {
            padding: 25mm 20mm 20mm 20mm;
            position: relative;
            z-index: 2;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 20px;
            margin-bottom: 30px;
            position: relative;
        }
        .header-left {
            flex: 1;
        }
        .header-logo {
            height: 50px;
            margin-bottom: 10px;
        }
        .header h1 {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            font-weight: 700;
            color: #1e40af;
            margin: 0 0 5px 0;
            letter-spacing: -0.5px;
        }
        .header p {
            font-size: 13px;
            color: #64748b;
            margin: 0;
            font-weight: 500;
            letter-spacing: 0.5px;
        }
        .header-right {
            text-align: right;
        }
        .report-number {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 5px;
        }
        .report-date {
            font-size: 11px;
            color: #64748b;
        }
        .report-title-section {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            border-left: 5px solid #1e40af;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .report-title h2 {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 8px 0;
            letter-spacing: -0.3px;
        }
        .report-title p {
            font-size: 15px;
            color: #475569;
            margin: 0;
            font-weight: 500;
        }
        .badge-container {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .section {
            margin-bottom: 35px;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px 8px 0 0;
            margin: 0 0 0 0;
            letter-spacing: -0.2px;
        }
        .section-content {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-top: none;
            padding: 20px;
            border-radius: 0 0 8px 8px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
        }
        .info-item {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 10px;
            padding: 16px;
            border: 1px solid #e2e8f0;
            transition: all 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .info-item:hover {
            box-shadow: 0 4px 12px rgba(30, 64, 175, 0.1);
            transform: translateY(-2px);
        }
        .info-item .label {
            display: block;
            font-size: 11px;
            color: #64748b;
            margin-bottom: 6px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .info-item .value {
            font-size: 15px;
            font-weight: 600;
            color: #0f172a;
        }
        .full-width {
           grid-column: 1 / -1;
        }
        .problem-description {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 14px;
            line-height: 1.8;
            color: #334155;
        }

        .step-section {
            margin-bottom: 20px;
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .step-title {
            font-size: 16px;
            font-weight: 700;
            color: #1e40af;
            margin: 0 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
        }
        .step-content {
            background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
            border-left: 4px solid #3b82f6;
            padding: 18px;
            border-radius: 0 8px 8px 0;
        }
        .step-content p { 
            margin: 0 0 10px 0; 
            font-size: 13px; 
            color: #475569;
            line-height: 1.7;
        }
        .step-content p:last-child { margin-bottom: 0; }
        .step-content strong {
            color: #1e40af;
            font-weight: 600;
        }
        .step-description {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
        }
        .attachment-image {
            width: 100%;
            height: auto;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 15px 20mm;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .footer-left {
            text-align: left;
        }
        .footer-right {
            text-align: right;
        }
        .footer-center {
            flex: 1;
            text-align: center;
        }
        .page-number {
            font-weight: 600;
            color: #1e40af;
        }
        @media print {
            /* Print için renkleri koru */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            body { background-color: white !important; margin: 0; padding: 0; }
            .page { margin: 0; box-shadow: none; border: none; }
            .page::before { display: none; }
            @page {
                size: A4;
                margin: 12mm;
            }
            .section { page-break-inside: avoid; break-inside: avoid; }
            .section-title { page-break-after: avoid; break-after: avoid; }
            .info-grid { page-break-inside: avoid; break-inside: avoid; }
            .info-item { page-break-inside: avoid; break-inside: avoid; }
            .footer {
                position: fixed;
                bottom: 0;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="page-content">
        <div class="header">
            <div class="header-left">
                <h1>KADEME A.Ş.</h1>
                <p>Kalite Yönetim Sistemi</p>
            </div>
            <div class="header-right">
                <div class="report-number">Rapor No: ${benchmark.benchmark_number || 'N/A'}</div>
                <div class="report-date">${formatDate(new Date().toISOString())}</div>
            </div>
        </div>
        <div class="report-title-section">
            <div class="report-title">
                <h2>Benchmark Raporu</h2>
                <p>${benchmark.title || '-'}</p>
            </div>
            <div>
                ${getStatusBadge(benchmark.status)}
                ${getPriorityBadge(benchmark.priority)}
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Genel Bilgiler</h2>
            <div class="section-content">
            <div class="info-grid">
                <div class="info-item"><span class="label">Benchmark Numarası</span><span class="value">${benchmark.benchmark_number || '-'}</span></div>
                <div class="info-item"><span class="label">Durum</span><span class="value">${benchmark.status || '-'}</span></div>
                <div class="info-item"><span class="label">Öncelik</span><span class="value">${benchmark.priority || '-'}</span></div>
                ${benchmark.category ? `<div class="info-item"><span class="label">Kategori</span><span class="value">${benchmark.category.name || '-'}</span></div>` : ''}
                ${benchmark.start_date ? `<div class="info-item"><span class="label">Başlangıç Tarihi</span><span class="value">${formatDate(benchmark.start_date)}</span></div>` : ''}
                ${benchmark.target_completion_date ? `<div class="info-item"><span class="label">Hedef Tamamlanma</span><span class="value">${formatDate(benchmark.target_completion_date)}</span></div>` : ''}
                ${benchmark.owner ? `<div class="info-item"><span class="label">Sorumlu Kişi</span><span class="value">${benchmark.owner.full_name || benchmark.owner.name || '-'}</span></div>` : ''}
                ${benchmark.department ? `<div class="info-item"><span class="label">Departman</span><span class="value">${benchmark.department.unit_name || '-'}</span></div>` : ''}
                ${benchmark.estimated_budget ? `<div class="info-item"><span class="label">Tahmini Bütçe</span><span class="value">${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: benchmark.currency || 'TRY' }).format(benchmark.estimated_budget)}</span></div>` : ''}
            </div>
            </div>
        </div>

        ${benchmark.description ? `
        <div class="section">
            <h2 class="section-title">Açıklama</h2>
            <div class="section-content">
            <div class="info-item full-width">
                <p class="problem-description">${benchmark.description.replace(/\n/g, '<br>')}</p>
            </div>
            </div>
        </div>
        ` : ''}

        ${benchmark.objective ? `
        <div class="section">
            <h2 class="section-title">Amaç</h2>
            <div class="section-content">
            <div class="info-item full-width">
                <p class="problem-description">${benchmark.objective.replace(/\n/g, '<br>')}</p>
            </div>
            </div>
        </div>
        ` : ''}

        ${benchmark.scope ? `
        <div class="section">
            <h2 class="section-title">Kapsam</h2>
            <div class="section-content">
            <div class="info-item full-width">
                <p class="problem-description">${benchmark.scope.replace(/\n/g, '<br>')}</p>
            </div>
            </div>
        </div>
        ` : ''}

        ${alternativesHtml}

        ${documentsHtml}
        
        </div>
        <div class="footer">
            <div class="footer-left">
                <div>KADEME A.Ş.</div>
                <div style="font-size: 10px; margin-top: 2px;">Kalite Yönetim Sistemi</div>
            </div>
            <div class="footer-center">
                Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.
            </div>
            <div class="footer-right">
                <div class="page-number">Sayfa <span id="pageNum">1</span></div>
                <div style="font-size: 10px; margin-top: 2px;">${formatDate(new Date().toISOString())}</div>
            </div>
        </div>
    </div>
    <script>
        const images = document.querySelectorAll('.attachment-image');
        const promises = Array.from(images).map(img => {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve; // Resolve on error too, to not block printing
                }
            });
        });

        Promise.all(promises).then(() => {
            setTimeout(() => {
                window.print();
            }, 500); // Increased delay to ensure rendering
        });
    </script>
</body>
</html>
        `;

        return htmlContent;
    };

    if (!benchmark) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
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
                                onClick={() => {
                                    if (onCompare) {
                                        onCompare(benchmark);
                                        onClose(); // Detail modal'ını kapat
                                    }
                                }}
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
                                                <span>{benchmark.department.unit_name}</span>
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
                                                
                                                {/* Temel Bilgiler */}
                                                {(item.manufacturer || item.model_number || item.category || item.origin) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Temel Bilgiler</h4>
                                                        <div className="grid gap-2 md:grid-cols-2 text-sm">
                                                            {item.manufacturer && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Üretici</p>
                                                                    <p className="font-medium">{item.manufacturer}</p>
                                                                </div>
                                                            )}
                                                            {item.model_number && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Model/Seri No</p>
                                                                    <p className="font-medium">{item.model_number}</p>
                                                                </div>
                                                            )}
                                                            {item.category && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Kategori</p>
                                                                    <p className="font-medium">{item.category}</p>
                                                                </div>
                                                            )}
                                                            {item.origin && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Menşei</p>
                                                                    <p className="font-medium">{item.origin}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Maliyet Bilgileri */}
                                                {(item.unit_price || item.total_cost_of_ownership || item.roi_percentage || item.minimum_order_quantity || item.payment_terms) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Maliyet Bilgileri</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
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
                                                            {item.total_cost_of_ownership && (
                                                                <div>
                                                                    <p className="text-muted-foreground">TCO</p>
                                                                    <p className="font-medium">
                                                                        {new Intl.NumberFormat('tr-TR', {
                                                                            style: 'currency',
                                                                            currency: item.currency || 'TRY'
                                                                        }).format(item.total_cost_of_ownership)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {item.roi_percentage && (
                                                                <div>
                                                                    <p className="text-muted-foreground">ROI</p>
                                                                    <p className="font-medium">{item.roi_percentage}%</p>
                                                                </div>
                                                            )}
                                                            {item.minimum_order_quantity && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Minimum Sipariş</p>
                                                                    <p className="font-medium">{item.minimum_order_quantity} adet</p>
                                                                </div>
                                                            )}
                                                            {item.payment_terms && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Ödeme Koşulları</p>
                                                                    <p className="font-medium">{item.payment_terms}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Kalite ve Performans */}
                                                {(item.quality_score || item.performance_score || item.reliability_score || item.durability_score || item.safety_score || item.standards_compliance_score) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Kalite ve Performans</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.quality_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Kalite Skoru</p>
                                                                    <p className="font-medium">{item.quality_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.performance_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Performans Skoru</p>
                                                                    <p className="font-medium">{item.performance_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.reliability_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Güvenilirlik Skoru</p>
                                                                    <p className="font-medium">{item.reliability_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.durability_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Dayanıklılık Skoru</p>
                                                                    <p className="font-medium">{item.durability_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.safety_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Güvenlik Skoru</p>
                                                                    <p className="font-medium">{item.safety_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.standards_compliance_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Standart Uygunluk</p>
                                                                    <p className="font-medium">{item.standards_compliance_score}/100</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Hizmet Bilgileri */}
                                                {(item.after_sales_service_score || item.technical_support_score || item.warranty_period_months || item.support_availability) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Satış Sonrası Hizmet</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.after_sales_service_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Satış Sonrası Skoru</p>
                                                                    <p className="font-medium">{item.after_sales_service_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.technical_support_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Teknik Destek Skoru</p>
                                                                    <p className="font-medium">{item.technical_support_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.warranty_period_months && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Garanti Süresi</p>
                                                                    <p className="font-medium">{item.warranty_period_months} ay</p>
                                                                </div>
                                                            )}
                                                            {item.support_availability && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Destek Erişilebilirliği</p>
                                                                    <p className="font-medium">{item.support_availability}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Operasyonel Bilgiler */}
                                                {(item.delivery_time_days || item.lead_time_days || item.implementation_time_days || item.training_required_hours) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Operasyonel Bilgiler</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.delivery_time_days && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Teslimat Süresi</p>
                                                                    <p className="font-medium">{item.delivery_time_days} gün</p>
                                                                </div>
                                                            )}
                                                            {item.lead_time_days && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Tedarik Süresi</p>
                                                                    <p className="font-medium">{item.lead_time_days} gün</p>
                                                                </div>
                                                            )}
                                                            {item.implementation_time_days && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Uygulama Süresi</p>
                                                                    <p className="font-medium">{item.implementation_time_days} gün</p>
                                                                </div>
                                                            )}
                                                            {item.training_required_hours && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Eğitim Gereksinimi</p>
                                                                    <p className="font-medium">{item.training_required_hours} saat</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Risk */}
                                                {item.risk_level && (
                                                    <div className="mb-3">
                                                        <h4 className="text-sm font-semibold mb-2">Risk Değerlendirmesi</h4>
                                                        <Badge 
                                                            variant={
                                                                item.risk_level === 'Düşük' ? 'default' :
                                                                item.risk_level === 'Orta' ? 'secondary' :
                                                                item.risk_level === 'Yüksek' ? 'destructive' : 'destructive'
                                                            }
                                                        >
                                                            {item.risk_level}
                                                        </Badge>
                                                    </div>
                                                )}
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
                                                                    // Görüntüleme için yeni sekme aç (önce file_url kullan, yoksa oluştur)
                                                                    const url = doc.file_url || supabase.storage
                                                                        .from('documents')
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

