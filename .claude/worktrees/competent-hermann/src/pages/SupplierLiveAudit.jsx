import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Save, FileText, PlusCircle, Trash2, AlertTriangle, ListPlus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { useData } from '@/contexts/DataContext';

const SupplierLiveAudit = ({ onOpenNCForm }) => {
    const { auditId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { refreshData } = useData();
    const [auditPlan, setAuditPlan] = useState(null);
    const [supplier, setSupplier] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [results, setResults] = useState({});
    const [participants, setParticipants] = useState(['']);
    const [supplierAttendees, setSupplierAttendees] = useState(['']);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCompleteModalOpen, setCompleteModalOpen] = useState(false);

    const fetchAuditData = useCallback(async () => {
        setLoading(true);
        const { data: planData, error: planError } = await supabase
            .from('supplier_audit_plans')
            .select('*, supplier:suppliers(*)')
            .eq('id', auditId)
            .single();

        if (planError) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Denetim planı yüklenemedi: ' + planError.message });
            navigate('/supplier-quality');
            return;
        }

        setAuditPlan(planData);
        setSupplier(planData.supplier);
        setParticipants(planData.participants || ['']);
        // supplier_attendees alanı henüz veritabanında yoksa boş array kullan
        setSupplierAttendees(planData.supplier_attendees || ['']);

        const { data: questionData, error: questionError } = await supabase
            .from('supplier_audit_questions')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (questionError) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Sorular yüklenemedi: ' + questionError.message });
        } else {
            setQuestions(questionData);
            if (planData.results) {
                setResults(planData.results);
            } else {
                const initialResults = {};
                questionData.forEach(q => {
                    initialResults[q.id] = { answer: null, notes: '' };
                });
                setResults(initialResults);
            }
        }
        setLoading(false);
    }, [auditId, navigate, toast]);

    useEffect(() => {
        fetchAuditData();
    }, [fetchAuditData]);

    const handleResultChange = (questionId, field, value) => {
        setResults(prev => ({
            ...prev,
            [questionId]: {
                ...prev[questionId],
                [field]: value
            }
        }));
    };
    
    const handleParticipantChange = (index, value) => {
        const newParticipants = [...participants];
        newParticipants[index] = value;
        setParticipants(newParticipants);
    };

    const addParticipant = () => setParticipants([...participants, '']);
    const removeParticipant = (index) => setParticipants(participants.filter((_, i) => i !== index));

    const handleSupplierAttendeeChange = (index, value) => {
        const newAttendees = [...supplierAttendees];
        newAttendees[index] = value;
        setSupplierAttendees(newAttendees);
    };

    const addSupplierAttendee = () => setSupplierAttendees([...supplierAttendees, '']);
    const removeSupplierAttendee = (index) => setSupplierAttendees(supplierAttendees.filter((_, i) => i !== index));

    const calculateScore = useCallback(() => {
        let totalScore = 0;
        let totalPossible = 0;
        questions.forEach(q => {
            const result = results[q.id];
            const maxPoints = q.points || 0;
            totalPossible += maxPoints;
            if (result?.answer === 'Evet') {
                totalScore += maxPoints;
            } else if (result?.answer === 'Kısmen') {
                totalScore += maxPoints / 2;
            }
        });
        return totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
    }, [questions, results]);

    const handleSave = async (isCompleting = false) => {
        setIsSaving(true);
        const finalScore = calculateScore();

        // Temel veri (her zaman var olan alanlar)
        const updateData = {
            results,
            participants: participants.filter(p => p.trim() !== ''),
            score: finalScore,
            status: isCompleting ? 'Tamamlandı' : (auditPlan.status === 'Tamamlandı' ? 'Tamamlandı' : auditPlan.status),
            actual_date: isCompleting ? new Date().toISOString() : (auditPlan.actual_date || (isCompleting ? new Date().toISOString() : null)),
        };

        // supplier_attendees alanı eklenmişse ekle (migration sonrası)
        // Eğer kolon yoksa bu alan göz ardı edilecek
        try {
            updateData.supplier_attendees = supplierAttendees.filter(p => p.trim() !== '');
        } catch (e) {
            console.warn('supplier_attendees alanı henüz veritabanında yok, atlanıyor...');
        }

        const { error } = await supabase
            .from('supplier_audit_plans')
            .update(updateData)
            .eq('id', auditId);

        if (error) {
            // Eğer hata supplier_attendees ile ilgiliyse kullanıcıya uyarı göster
            if (error.message.includes('supplier_attendees')) {
                toast({ 
                    variant: 'destructive', 
                    title: 'Veritabanı Güncelleme Gerekli!', 
                    description: 'Lütfen migration scriptini çalıştırın. Detaylar için TEDARIKCI_DENETIM_GUNCELLEME.md dosyasına bakın.' 
                });
            } else {
                toast({ variant: 'destructive', title: 'Hata', description: 'Denetim kaydedilemedi: ' + error.message });
            }
        } else {
            const actionText = isCompleting ? 'tamamlandı' : (auditPlan.status === 'Tamamlandı' ? 'güncellendi' : 'kaydedildi');
            toast({ title: 'Başarılı', description: `Denetim başarıyla ${actionText}.` });
            
            // Veriyi refresh et
            await refreshData();
            
            // Pencereyi kapat ve denetim listesine dön
            // 500ms sonra yönlendir (toast mesajını görmek için)
            setTimeout(() => {
                navigate('/supplier-quality', { state: { defaultTab: 'audits' } });
            }, 500);
        }
        setIsSaving(false);
        setCompleteModalOpen(false);
    };

    const handleCreateNC = (question) => {
        const result = results[question.id] || {};
        const ncRecord = {
            is_supplier_nc: true,
            supplier_id: supplier.id,
            title: `Denetim Bulgusu: ${supplier.name} - Soru: ${question.question_text.substring(0, 50)}...`,
            description: `Denetim Sorusu: ${question.question_text}\n\nCevap: ${result.answer || 'Belirtilmemiş'}\n\nDenetçi Notu: ${result.notes || 'Not yok.'}\n\nDenetim Tarihi: ${format(new Date(), 'dd.MM.yyyy')}`,
        };
        onOpenNCForm(ncRecord);
    };

    const handleCreateBulkNC = () => {
        const findings = questions.filter(q => {
            const result = results[q.id];
            return result?.answer === 'Hayır' || result?.answer === 'Kısmen';
        });

        if (findings.length === 0) {
            toast({ title: 'Bilgi', description: 'Uygunsuzluk oluşturulacak bir bulgu bulunamadı.' });
            return;
        }

        const description = findings.map((q, index) => {
            const result = results[q.id];
            return `BULGU ${index + 1}:\nSoru: ${q.question_text}\nCevap: ${result.answer}\nNotlar: ${result.notes || 'Yok'}`;
        }).join('\n\n--------------------------------\n\n');

        const ncRecord = {
            is_supplier_nc: true,
            supplier_id: supplier.id,
            title: `Toplu Denetim Bulguları: ${supplier.name} - ${format(new Date(), 'dd.MM.yyyy')}`,
            description: `Tedarikçi denetimi sırasında tespit edilen toplu uygunsuzluklar aşağıdadır:\n\n${description}`,
        };
        onOpenNCForm(ncRecord);
    };
    
    if (loading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="w-16 h-16 animate-spin" /></div>;
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <Button variant="outline" onClick={() => navigate('/supplier-quality')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri Dön
                </Button>
                <div className="flex gap-2">
                    <Button onClick={() => handleSave(false)} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Kaydediliyor...' : (auditPlan.status === 'Tamamlandı' ? 'Değişiklikleri Kaydet' : 'Taslağı Kaydet')}
                    </Button>
                    {auditPlan.status !== 'Tamamlandı' && (
                        <Button onClick={() => setCompleteModalOpen(true)} disabled={isSaving}>
                            <FileText className="w-4 h-4 mr-2" /> Denetimi Tamamla
                        </Button>
                    )}
                </div>
            </div>

            <Card className="mb-8">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">Tedarikçi Denetimi: {supplier?.name}</CardTitle>
                            <p className="text-muted-foreground">
                                Planlanan Tarih: {format(new Date(auditPlan.planned_date), 'dd.MM.yyyy')}
                                {auditPlan.actual_date && ` | Gerçekleşen: ${format(new Date(auditPlan.actual_date), 'dd.MM.yyyy')}`}
                            </p>
                        </div>
                        {auditPlan.status === 'Tamamlandı' && (
                            <Badge className="bg-green-600 text-white">
                                <Check className="w-4 h-4 mr-1" />
                                Tamamlandı - Düzenleme Modu
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <Label className="text-lg font-semibold text-primary">Denetçiler (Bizim Firma)</Label>
                                <p className="text-sm text-muted-foreground mb-3">Denetimi yapan kişiler</p>
                            </div>
                            {participants.map((p, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input value={p} onChange={(e) => handleParticipantChange(index, e.target.value)} placeholder="Denetçi adı ve soyadı..." />
                                    <Button variant="destructive" size="icon" onClick={() => removeParticipant(index)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addParticipant}><PlusCircle className="w-4 h-4 mr-2" /> Denetçi Ekle</Button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <Label className="text-lg font-semibold text-green-600">Denetlenen Firmadan Katılanlar</Label>
                                <p className="text-sm text-muted-foreground mb-3">{supplier?.name} firmasından denetime katılanlar</p>
                            </div>
                            {supplierAttendees.map((p, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input value={p} onChange={(e) => handleSupplierAttendeeChange(index, e.target.value)} placeholder="Tedarikçi temsilcisi adı ve soyadı..." />
                                    <Button variant="destructive" size="icon" onClick={() => removeSupplierAttendee(index)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addSupplierAttendee}><PlusCircle className="w-4 h-4 mr-2" /> Tedarikçi Temsilcisi Ekle</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <AnimatePresence>
                {questions.map((question, index) => (
                    <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <Card className="mb-4">
                            <CardHeader>
                                <CardTitle className="text-lg flex justify-between">
                                    <span>{index + 1}. {question.question_text}</span>
                                    <span className="text-primary font-bold">{question.points || 0} Puan</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <Label>Cevap</Label>
                                    <Select value={results[question.id]?.answer || ''} onValueChange={(v) => handleResultChange(question.id, 'answer', v)}>
                                        <SelectTrigger><SelectValue placeholder="Cevap seçin..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Evet">Evet</SelectItem>
                                            <SelectItem value="Hayır">Hayır</SelectItem>
                                            <SelectItem value="Kısmen">Kısmen</SelectItem>
                                            <SelectItem value="Uygulanamaz">Uygulanamaz</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Notlar / Kanıtlar</Label>
                                    <Textarea value={results[question.id]?.notes || ''} onChange={(e) => handleResultChange(question.id, 'notes', e.target.value)} placeholder="Gözlemlerinizi ve kanıtları buraya yazın..."/>
                                </div>
                            </CardContent>
                            <CardFooter>
                                {(results[question.id]?.answer === 'Hayır' || results[question.id]?.answer === 'Kısmen') && (
                                    <Button variant="destructive" size="sm" onClick={() => handleCreateNC(question)}>
                                        <AlertTriangle className="w-4 h-4 mr-2" /> Uygunsuzluk Oluştur
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </motion.div>
                ))}
            </AnimatePresence>

            <div className="mt-8 flex justify-end">
                <Button onClick={handleCreateBulkNC} size="lg">
                    <ListPlus className="w-5 h-5 mr-2" /> Toplu Uygunsuzluk Oluştur
                </Button>
            </div>

            <AlertDialog open={isCompleteModalOpen} onOpenChange={setCompleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Denetimi Tamamla</AlertDialogTitle>
                        <AlertDialogDescription>
                            Denetimi tamamlamak üzeresiniz. Bu işlem sonucunda denetim puanı hesaplanacak ve durum 'Tamamlandı' olarak güncellenecektir. Devam etmek istiyor musunuz?
                            <div className="mt-4 font-bold text-lg text-center">Nihai Puan: {calculateScore()} / 100</div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleSave(true)}>Evet, Tamamla</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
};

export default SupplierLiveAudit;