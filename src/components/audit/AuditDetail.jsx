import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, X, Eye, Save, CheckCircle, GitBranch, Printer, UploadCloud, File as FileIcon, Trash2, Download, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { openPrintableReport } from '@/lib/reportUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AuditDetail = ({ auditId, onBack, onOpenNCForm }) => {
    const { toast } = useToast();
    const [audit, setAudit] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [findings, setFindings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadingFiles, setUploadingFiles] = useState({});
    const [lightboxUrl, setLightboxUrl] = useState(null);

    const fetchAuditData = useCallback(async () => {
        setLoading(true);
        const { data: auditData, error: auditError } = await supabase
            .from('audits')
            .select(`
                *,
                department:cost_settings(id, unit_name),
                audit_standard:audit_standards(id, code, name)
            `)
            .eq('id', auditId)
            .single();

        if (auditError) {
            toast({ variant: 'destructive', title: 'Hata', description: `Tetkik detayları alınamadı: ${auditError.message}` });
            setLoading(false);
            return;
        }
        
        const { data: findingsData, error: findingsError } = await supabase
            .from('audit_findings')
            .select('*, non_conformity:non_conformities(id, nc_number, status, type)')
            .eq('audit_id', auditId);

        if (findingsError) {
            toast({ variant: 'destructive', title: 'Hata', description: `Bulgular alınamadı: ${findingsError.message}` });
        } else {
            const findingsWithNC = findingsData.map(f => ({...f, non_conformity: Array.isArray(f.non_conformity) && f.non_conformity.length > 0 ? f.non_conformity[0] : null }));
            setFindings(findingsWithNC);
        }

        const { data: existingResults, error: resultsError } = await supabase
            .from('audit_results')
            .select('*')
            .eq('audit_id', auditId)
            .order('order_number', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

        if (resultsError) {
            toast({ variant: 'destructive', title: 'Hata', description: `Tetkik soruları alınamadı: ${resultsError.message}` });
            setLoading(false);
            return;
        }
        
        if (existingResults && existingResults.length > 0) {
            // attachments JSONB alanını parse et
            const parsedResults = existingResults.map(result => ({
                ...result,
                attachments: result.attachments 
                    ? (typeof result.attachments === 'string' ? JSON.parse(result.attachments) : result.attachments)
                    : []
            }));
            setQuestions(parsedResults);
        } else if (auditData && (auditData.status === 'Devam Ediyor' || auditData.status === 'Planlandı')) {
             const { data: questionsFromBank, error: bankError } = await supabase
                .from('audit_question_bank')
                .select('*')
                .eq('department_id', auditData.department_id)
                .eq('audit_standard_id', auditData.audit_standard_id)
                .eq('is_active', true)
                .order('order_number', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true });

            if (bankError) {
                toast({ variant: 'destructive', title: 'Hata', description: `Soru bankası alınamadı: ${bankError.message}` });
            } else if (questionsFromBank && questionsFromBank.length > 0) {
                // Planlanan tetkikler için soruları sakla (rapor için)
                if (auditData.status === 'Planlandı') {
                    setPlannedQuestions(questionsFromBank);
                }
                
                 const newResults = questionsFromBank.map(q => ({
                    audit_id: auditId,
                    question_id: q.id,
                    question_text: q.question_text,
                    answer: null,
                    notes: '',
                    order_number: q.order_number || 0
                }));

                const { data: insertedResults, error: insertError } = await supabase
                    .from('audit_results')
                    .insert(newResults)
                    .select();

                if (insertError) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Sorular tetkike kaydedilemedi: ${insertError.message}` });
                } else {
                    setQuestions(insertedResults);
                }
            }
        }
        
        setAudit({...auditData, department: auditData.department });
        setLoading(false);
    }, [auditId, toast]);

    useEffect(() => {
        fetchAuditData();
    }, [fetchAuditData]);
    
    const handleAnswerChange = async (resultId, newAnswer) => {
        const originalQuestions = [...questions];
        const updatedQuestions = questions.map(q => q.id === resultId ? { ...q, answer: newAnswer } : q);
        setQuestions(updatedQuestions);

        const { error } = await supabase.from('audit_results').update({ answer: newAnswer }).eq('id', resultId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Cevap güncellenemedi: ${error.message}` });
            setQuestions(originalQuestions);
            return;
        }

        const existingFinding = findings.find(f => f.audit_result_id === resultId);
        if (newAnswer === 'Uygunsuz' && !existingFinding) {
            const question = questions.find(q => q.id === resultId);
            const { data: newFinding, error: findingError } = await supabase
                .from('audit_findings').insert({
                    audit_id: auditId,
                    audit_result_id: resultId,
                    description: question.question_text
                }).select('*, non_conformity:non_conformities(id, nc_number, status, type)').single();
            if (findingError) {
                toast({ variant: 'destructive', title: 'Hata', description: `Bulgu oluşturulamadı: ${findingError.message}` });
            } else {
                setFindings(prev => [...prev, {...newFinding, non_conformity: null}]);
                toast({ title: 'Bulgu Oluşturuldu', description: 'Uygunsuzluk için bulgu kaydı açıldı.' });
            }
        }
    };
    
    const handleNotesChange = async (resultId, newNotes) => {
        const originalQuestions = [...questions];
        const updatedQuestions = questions.map(q => q.id === resultId ? { ...q, notes: newNotes } : q);
        setQuestions(updatedQuestions);

        const { error } = await supabase.from('audit_results').update({ notes: newNotes }).eq('id', resultId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Not güncellenemedi: ${error.message}` });
            setQuestions(originalQuestions);
        }
    };

    const sanitizeFileName = (fileName) => {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    };

    const handleFileUpload = async (resultId, files) => {
        if (!files || files.length === 0) return;

        setUploadingFiles(prev => ({ ...prev, [resultId]: true }));
        const question = questions.find(q => q.id === resultId);
        if (!question) return;

        const currentAttachments = question.attachments || [];
        const newAttachments = [];

        try {
            for (const file of files) {
                const sanitizedFileName = sanitizeFileName(file.name);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 9);
                const filePath = `audit_evidence/${auditId}/${resultId}/${timestamp}-${randomStr}-${sanitizedFileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('audit_attachments')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type || 'application/octet-stream'
                    });

                if (uploadError) {
                    toast({ variant: 'destructive', title: 'Hata', description: `${file.name} yüklenemedi: ${uploadError.message}` });
                    continue;
                }

                newAttachments.push({
                    path: filePath,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploaded_at: new Date().toISOString()
                });
            }

            if (newAttachments.length > 0) {
                const updatedAttachments = [...currentAttachments, ...newAttachments];
                const { error } = await supabase
                    .from('audit_results')
                    .update({ attachments: updatedAttachments })
                    .eq('id', resultId);

                if (error) {
                    toast({ variant: 'destructive', title: 'Hata', description: `Dosya bilgileri kaydedilemedi: ${error.message}` });
                } else {
                    setQuestions(questions.map(q => 
                        q.id === resultId 
                            ? { ...q, attachments: updatedAttachments }
                            : q
                    ));
                    toast({ title: 'Başarılı', description: `${newAttachments.length} dosya eklendi.` });
                }
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Dosya yükleme hatası: ${error.message}` });
        } finally {
            setUploadingFiles(prev => ({ ...prev, [resultId]: false }));
        }
    };

    const handleRemoveAttachment = async (resultId, attachmentPath) => {
        const question = questions.find(q => q.id === resultId);
        if (!question) return;

        const updatedAttachments = (question.attachments || []).filter(att => att.path !== attachmentPath);

        // Storage'dan dosyayı sil
        const { error: deleteError } = await supabase.storage
            .from('audit_attachments')
            .remove([attachmentPath]);

        if (deleteError) {
            toast({ variant: 'destructive', title: 'Hata', description: `Dosya silinemedi: ${deleteError.message}` });
            return;
        }

        // Veritabanını güncelle
        const { error } = await supabase
            .from('audit_results')
            .update({ attachments: updatedAttachments })
            .eq('id', resultId);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Dosya bilgileri güncellenemedi: ${error.message}` });
        } else {
            setQuestions(questions.map(q => 
                q.id === resultId 
                    ? { ...q, attachments: updatedAttachments }
                    : q
            ));
            toast({ title: 'Başarılı', description: 'Dosya silindi.' });
        }
    };

    const handleDownloadAttachment = async (attachment) => {
        try {
            const { data, error } = await supabase.storage
                .from('audit_attachments')
                .download(attachment.path);

            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Dosya indirilemedi: ${error.message}` });
        }
    };

    const AttachmentItem = ({ attachment, resultId }) => {
        const [signedUrl, setSignedUrl] = useState(null);
        const [loadingUrl, setLoadingUrl] = useState(true);

        useEffect(() => {
            const fetchSignedUrl = async () => {
                try {
                    const { data, error } = await supabase.storage
                        .from('audit_attachments')
                        .createSignedUrl(attachment.path, 3600);
                    
                    if (!error && data?.signedUrl) {
                        setSignedUrl(data.signedUrl);
                    }
                } catch (err) {
                    console.error('Signed URL fetch error:', err);
                } finally {
                    setLoadingUrl(false);
                }
            };
            
            if (attachment.path) {
                fetchSignedUrl();
            }
        }, [attachment.path]);

        if (loadingUrl) {
            return (
                <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                    <FileIcon className="w-6 h-6 text-muted-foreground animate-pulse" />
                </div>
            );
        }

        if (!signedUrl) return null;

        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(attachment.name || attachment.path);
        const isPdf = /\.pdf$/i.test(attachment.name || attachment.path);
        const isVideo = /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(attachment.name || attachment.path);

        return (
            <div className="relative group w-24 h-24">
                {isImage ? (
                    <img
                        src={signedUrl}
                        alt={attachment.name || 'Ek'}
                        className="rounded-lg object-cover w-full h-full cursor-pointer border border-border"
                        onClick={() => setLightboxUrl(signedUrl)}
                    />
                ) : isPdf ? (
                    <a 
                        href={signedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex flex-col items-center justify-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded-lg h-full text-center border border-border hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                    >
                        <FileIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <span className="text-xs text-foreground truncate w-full">{attachment.name?.substring(0, 10) || 'PDF'}</span>
                    </a>
                ) : isVideo ? (
                    <a 
                        href={signedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex flex-col items-center justify-center gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded-lg h-full text-center border border-border hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                    >
                        <FileIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs text-foreground truncate w-full">{attachment.name?.substring(0, 10) || 'Video'}</span>
                    </a>
                ) : (
                    <a 
                        href={signedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex flex-col items-center justify-center gap-2 p-2 bg-background rounded-lg h-full text-center border border-border hover:bg-muted transition-colors"
                    >
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate w-full">{attachment.name?.substring(0, 10) || 'Dosya'}</span>
                    </a>
                )}
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => handleDownloadAttachment(attachment)}
                    >
                        <Download className="h-3 w-3" />
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => handleRemoveAttachment(resultId, attachment.path)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        );
    };

    const handleOpenNCModal = (finding) => {
        if (!onOpenNCForm) return;
        const initialRecord = {
            source: 'audit',
            source_finding_id: finding.id,
            description: finding.description,
            title: `Tetkik: ${audit?.report_number || 'N/A'} - ${finding.description.substring(0, 50)}...`,
            audit_title: audit?.title || '',
            department: audit?.department?.unit_name,
        };
        onOpenNCForm(initialRecord, (savedNC) => {
            setFindings(prevFindings => prevFindings.map(f => {
                if (f.id === finding.id) {
                    return { ...f, non_conformity: savedNC };
                }
                return f;
            }));
        });
    };

    const startAudit = async () => {
        const { error } = await supabase.from('audits').update({ status: 'Devam Ediyor' }).eq('id', auditId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Tetkik başlatılamadı.' });
        } else {
            toast({ title: 'Başarılı', description: 'Tetkik başlatıldı.' });
            fetchAuditData();
        }
    };
    
    const completeAudit = async () => {
        const unansweredQuestions = questions.filter(q => q.answer === null);
        if (unansweredQuestions.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Eksik Cevaplar',
                description: `Lütfen tetkiki tamamlamadan önce tüm ${unansweredQuestions.length} soruyu cevaplayın.`
            });
            return;
        }

        const { error } = await supabase.from('audits').update({ status: 'Tamamlandı' }).eq('id', auditId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Tetkik tamamlanamadı: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'Tetkik başarıyla tamamlandı.' });
            fetchAuditData();
        }
    };

    const handlePrint = () => {
        if (audit) {
            openPrintableReport(audit, 'internal_audit');
        } else {
            toast({ variant: 'destructive', title: 'Hata', description: 'Rapor oluşturmak için tetkik verileri yüklenemedi.' });
        }
    };

    const handleGenerateQuestionsReport = () => {
        if (!audit || plannedQuestions.length === 0) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata', 
                description: 'Rapor oluşturmak için tetkik bilgileri ve sorular bulunmalıdır.' 
            });
            return;
        }

        const department = audit.department?.unit_name || 'Belirtilmemiş';
        const standard = audit.audit_standard ? `${audit.audit_standard.code} - ${audit.audit_standard.name}` : 'Belirtilmemiş';
        const reportDate = format(new Date(), 'dd MMMM yyyy', { locale: tr });
        const auditDate = audit.audit_date ? format(new Date(audit.audit_date), 'dd MMMM yyyy', { locale: tr }) : 'Belirtilmemiş';
        
        const questionsHtml = plannedQuestions.map((q, index) => `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <div style="display: flex; align-items: start; gap: 15px; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 5px solid #3b82f6; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="min-width: 45px; height: 45px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <p style="margin: 0; font-size: 15px; line-height: 1.8; color: #1e293b; font-weight: 500;">
                            ${q.question_text}
                        </p>
                    </div>
                </div>
            </div>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <title>İç Tetkik Soruları - ${audit.report_number || 'Planlanan Tetkik'}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Inter', sans-serif;
                        color: #1e293b;
                        background-color: #f8fafc;
                        padding: 20px;
                    }
                    
                    .page {
                        background-color: white;
                        width: 210mm;
                        min-height: 297mm;
                        margin: 0 auto;
                        padding: 25mm;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    
                    .header {
                        text-align: center;
                        border-bottom: 4px solid #3b82f6;
                        padding-bottom: 25px;
                        margin-bottom: 35px;
                        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                        padding: 30px 20px;
                        border-radius: 8px 8px 0 0;
                    }
                    
                    .header h1 {
                        font-size: 32px;
                        font-weight: 700;
                        color: #0f172a;
                        margin-bottom: 8px;
                        letter-spacing: -0.5px;
                    }
                    
                    .header p {
                        font-size: 18px;
                        color: #64748b;
                        margin-top: 5px;
                        font-weight: 500;
                    }
                    
                    .report-number {
                        display: inline-block;
                        margin-top: 15px;
                        padding: 8px 20px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border-radius: 20px;
                        font-weight: 600;
                        font-size: 14px;
                        letter-spacing: 0.5px;
                    }
                    
                    .info-section {
                        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                        border: 2px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 25px;
                        margin-bottom: 35px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    }
                    
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                    }
                    
                    .info-item {
                        display: flex;
                        flex-direction: column;
                        padding: 15px;
                        background: white;
                        border-radius: 8px;
                        border-left: 4px solid #3b82f6;
                    }
                    
                    .info-label {
                        font-size: 11px;
                        color: #64748b;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 8px;
                    }
                    
                    .info-value {
                        font-size: 16px;
                        color: #0f172a;
                        font-weight: 600;
                    }
                    
                    .questions-section {
                        margin-top: 35px;
                    }
                    
                    .section-title {
                        font-size: 22px;
                        font-weight: 700;
                        color: #0f172a;
                        border-bottom: 3px solid #3b82f6;
                        padding-bottom: 12px;
                        margin-bottom: 25px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .section-title::before {
                        content: '';
                        width: 5px;
                        height: 30px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        border-radius: 3px;
                    }
                    
                    .footer {
                        margin-top: 50px;
                        padding-top: 25px;
                        border-top: 3px solid #e2e8f0;
                        text-align: center;
                        font-size: 12px;
                        color: #94a3b8;
                        background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
                        padding: 20px;
                        border-radius: 8px;
                    }
                    
                    .footer-note {
                        margin-top: 10px;
                        font-style: italic;
                        color: #64748b;
                    }
                    
                    @media print {
                        body {
                            background-color: white;
                            padding: 0;
                        }
                        
                        .page {
                            margin: 0;
                            box-shadow: none;
                            border: none;
                        }
                        
                        @page {
                            size: A4;
                            margin: 20mm;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <h1>KADEME A.Ş.</h1>
                        <p>Kalite Yönetim Sistemi</p>
                        ${audit.report_number ? `<div class="report-number">Rapor No: ${audit.report_number}</div>` : ''}
                    </div>
                    
                    <div class="info-section">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Tetkik Başlığı</span>
                                <span class="info-value">${audit.title || 'Belirtilmemiş'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Rapor Numarası</span>
                                <span class="info-value">${audit.report_number || 'Henüz Atanmadı'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Denetlenecek Birim</span>
                                <span class="info-value">${department}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Tetkik Standartı</span>
                                <span class="info-value">${standard}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Planlanan Tetkik Tarihi</span>
                                <span class="info-value">${auditDate}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Tetkikçi</span>
                                <span class="info-value">${audit.auditor_name || 'Belirtilmemiş'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Soru Sayısı</span>
                                <span class="info-value">${plannedQuestions.length} adet</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Rapor Oluşturma Tarihi</span>
                                <span class="info-value">${reportDate}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="questions-section">
                        <h2 class="section-title">İç Tetkik Soruları</h2>
                        ${questionsHtml}
                    </div>
                    
                    <div class="footer">
                        <p><strong>Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</strong></p>
                        <p class="footer-note">Denetim öncesi hazırlık için birimlerle paylaşılabilir. Bu sorular denetim sırasında kullanılacaktır.</p>
                    </div>
                </div>
                
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        // Yeni pencerede aç ve yazdır
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } else {
            toast({ 
                variant: 'destructive', 
                title: 'Hata', 
                description: 'Pop-up engelleyici nedeniyle rapor açılamadı. Lütfen pop-up izinlerini kontrol edin.' 
            });
        }
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Planlandı': return 'secondary';
            case 'Devam Ediyor': return 'default';
            case 'Tamamlandı': return 'success';
            case 'Kapatıldı': return 'outline';
            default: return 'secondary';
        }
    };

    if (loading) return <div className="text-center p-8 text-muted-foreground">Yükleniyor...</div>;
    if (!audit) return <div className="text-center p-8 text-muted-foreground">Tetkik bulunamadı.</div>;

    const AnswerButton = ({ question, currentAnswer, newAnswer, icon: Icon, colorClass, text }) => (
        <Button 
            variant={currentAnswer === newAnswer ? 'default' : 'outline'}
            size="sm" 
            className={`w-full justify-start ${currentAnswer === newAnswer ? colorClass : ''}`}
            onClick={() => handleAnswerChange(question.id, newAnswer)}
        >
            <Icon className="w-4 h-4 mr-2" /> {text}
        </Button>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground">{audit.report_number}</h1>
                            <Badge variant={getStatusVariant(audit.status)}>{audit.status}</Badge>
                        </div>
                        <p className="text-muted-foreground">
                            {audit.title} - {audit.department?.unit_name || 'N/A'}
                            {audit.audit_standard && ` | ${audit.audit_standard.code} - ${audit.audit_standard.name}`}
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" /> Raporu Yazdır
                </Button>
            </div>

            {audit.status === 'Planlandı' && (
                <div className="space-y-4">
                    <div className="dashboard-widget text-center p-8">
                        <h2 className="text-xl font-semibold mb-2 text-foreground">Bu tetkik henüz başlamadı.</h2>
                        <p className="text-muted-foreground mb-4">Tetkiki başlatarak soruları cevaplamaya başlayabilirsiniz.</p>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={startAudit}>Tetkiki Başlat</Button>
                            {plannedQuestions.length > 0 && (
                                <Button variant="outline" onClick={() => handleGenerateQuestionsReport()}>
                                    <FileDown className="w-4 h-4 mr-2" /> Sorular Raporunu Al
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    {plannedQuestions.length > 0 && (
                        <div className="dashboard-widget p-6">
                            <h3 className="text-lg font-semibold mb-4">Tetkik Soruları ({plannedQuestions.length} adet)</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {plannedQuestions.map((q, index) => (
                                    <div key={q.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-muted/30 rounded-r">
                                        <div className="flex items-start gap-2">
                                            <span className="font-semibold text-blue-600 min-w-[30px]">{index + 1}.</span>
                                            <p className="text-sm flex-1">{q.question_text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {audit.status !== 'Planlandı' && (
              <div className="space-y-4">
                {questions.map((q, index) => {
                    const finding = findings.find(f => f.audit_result_id === q.id);
                    const hasNC = finding && finding.non_conformity;
                    return (
                    <motion.div 
                        key={q.id || `q-${index}`} 
                        className="dashboard-widget p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <p className="font-semibold text-foreground mb-3">{index + 1}. {q.question_text}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col sm:flex-row gap-2">
                               <AnswerButton question={q} currentAnswer={q.answer} newAnswer="Uygun" icon={Check} colorClass="bg-green-600 hover:bg-green-700" text="Uygun" />
                               <AnswerButton question={q} currentAnswer={q.answer} newAnswer="Uygunsuz" icon={X} colorClass="bg-red-600 hover:bg-red-700" text="Uygunsuz" />
                               <AnswerButton question={q} currentAnswer={q.answer} newAnswer="Gözlem" icon={Eye} colorClass="bg-yellow-500 hover:bg-yellow-600" text="Gözlem" />
                            </div>
                            <div className="flex-grow">
                                <Textarea 
                                    placeholder="Notlar ve kanıtlar..." 
                                    className="h-full"
                                    defaultValue={q.notes || ''}
                                    onBlur={(e) => handleNotesChange(q.id, e.target.value)}
                                />
                            </div>
                        </div>
                        
                        {/* Kanıt Dokümanları */}
                        <div className="mt-4 pt-4 border-t border-border">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-sm font-medium">Kanıt Dokümanları</Label>
                                <div className="relative">
                                    <Input
                                        type="file"
                                        multiple
                                        accept="*/*"
                                        className="hidden"
                                        id={`file-input-${q.id}`}
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length > 0) {
                                                handleFileUpload(q.id, files);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById(`file-input-${q.id}`)?.click()}
                                        disabled={uploadingFiles[q.id]}
                                    >
                                        <UploadCloud className="w-4 h-4 mr-2" />
                                        {uploadingFiles[q.id] ? 'Yükleniyor...' : 'Dosya Ekle'}
                                    </Button>
                                </div>
                            </div>
                            {q.attachments && q.attachments.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {q.attachments.map((attachment, attIndex) => (
                                        <AttachmentItem 
                                            key={attIndex} 
                                            attachment={attachment} 
                                            resultId={q.id}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Henüz kanıt dokümanı eklenmemiş.</p>
                            )}
                        </div>

                        {q.answer === 'Uygunsuz' && finding && (
                            <div className="mt-3 text-right">
                               <Button variant={hasNC ? 'success' : 'destructive'} size="sm" onClick={() => handleOpenNCModal(finding)} disabled={!!hasNC}>
                                    <GitBranch className="w-4 h-4 mr-2"/> {hasNC ? `Uygunsuzluk Açıldı (${hasNC.nc_number})` : 'Uygunsuzluk Oluştur'}
                               </Button>
                            </div>
                        )}
                    </motion.div>
                )})}
                 <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => toast({ title: 'Kaydedildi!', description: 'Tüm değişiklikleriniz otomatik olarak kaydedilmiştir.' })}>
                        <Save className="w-4 h-4 mr-2" /> Raporu Kaydet
                    </Button>
                    {audit.status !== 'Tamamlandı' && (
                        <Button onClick={completeAudit}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Tetkiki Tamamla
                        </Button>
                    )}
                </div>
              </div>
            )}
            
            {/* Lightbox Modal */}
            {lightboxUrl && (
                <div 
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <img 
                        src={lightboxUrl} 
                        alt="Kanıt" 
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
              </div>
            )}
        </motion.div>
    );
};

export default AuditDetail;