import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, X, Eye, Save, CheckCircle, GitBranch, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { openPrintableReport } from '@/lib/reportUtils';

const AuditDetail = ({ auditId, onBack, onOpenNCForm }) => {
    const { toast } = useToast();
    const [audit, setAudit] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [findings, setFindings] = useState([]);
    const [loading, setLoading] = useState(true);

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
            setQuestions(existingResults);
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
                <div className="dashboard-widget text-center p-8">
                    <h2 className="text-xl font-semibold mb-2 text-foreground">Bu tetkik henüz başlamadı.</h2>
                    <p className="text-muted-foreground mb-4">Tetkiki başlatarak soruları cevaplamaya başlayabilirsiniz.</p>
                    <Button onClick={startAudit}>Tetkiki Başlat</Button>
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
        </motion.div>
    );
};

export default AuditDetail;