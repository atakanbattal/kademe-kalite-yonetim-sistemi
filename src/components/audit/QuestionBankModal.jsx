import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Trash2, Plus, Edit2, Save, X, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const QuestionBankModal = ({ isOpen, setIsOpen }) => {
    const { toast } = useToast();
    const [departments, setDepartments] = useState([]);
    const [auditStandards, setAuditStandards] = useState([]);
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [selectedStandardId, setSelectedStandardId] = useState('');
    const [questions, setQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [loadingStandards, setLoadingStandards] = useState(true);
    
    // Standart yönetimi
    const [isAddingStandard, setIsAddingStandard] = useState(false);
    const [editingStandardId, setEditingStandardId] = useState(null);
    const [newStandardCode, setNewStandardCode] = useState('');
    const [newStandardName, setNewStandardName] = useState('');
    const [editStandardCode, setEditStandardCode] = useState('');
    const [editStandardName, setEditStandardName] = useState('');
    
    // Soru düzenleme
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [editQuestionText, setEditQuestionText] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        fetchDepartments();
        fetchStandards();
    }, [isOpen]);

        const fetchDepartments = async () => {
            setLoadingDepartments(true);
            const { data, error } = await supabase
                .from('cost_settings')
                .select('id, unit_name')
                .order('unit_name');

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Birimler yüklenemedi.' });
                setDepartments([]);
            } else {
                setDepartments(data);
            }
            setLoadingDepartments(false);
        };
    
    const fetchStandards = async () => {
        setLoadingStandards(true);
        const { data, error } = await supabase
            .from('audit_standards')
            .select('id, code, name, is_active')
            .order('code');

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Standartlar yüklenemedi.' });
            setAuditStandards([]);
        } else {
            setAuditStandards(data);
            // Varsayılan olarak 9001'i seç
            if (data && data.length > 0 && !selectedStandardId) {
                const defaultStandard = data.find(s => s.code === '9001') || data[0];
                setSelectedStandardId(defaultStandard.id);
            }
        }
        setLoadingStandards(false);
    };

    const fetchQuestions = useCallback(async (departmentId, standardId) => {
        if (!departmentId || !standardId) {
            setQuestions([]);
            return;
        }
        setLoading(true);

        const { data, error } = await supabase
            .from('audit_question_bank')
            .select('*, audit_standard:audit_standards(code, name)')
            .eq('department_id', departmentId)
            .eq('audit_standard_id', standardId)
            .order('order_number', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });
        
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Sorular yüklenemedi.' });
            setQuestions([]);
        } else {
            setQuestions(data);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchQuestions(selectedDeptId, selectedStandardId);
    }, [selectedDeptId, selectedStandardId, fetchQuestions]);

    // Standart yönetimi fonksiyonları
    const handleAddStandard = async () => {
        if (!newStandardCode.trim() || !newStandardName.trim()) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen standart kodu ve adı girin.' });
            return;
        }

        const { data, error } = await supabase
            .from('audit_standards')
            .insert([{
                code: newStandardCode.trim(),
                name: newStandardName.trim()
            }])
            .select()
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Standart eklenemedi: ' + error.message });
        } else {
            setAuditStandards([...auditStandards, data]);
            setSelectedStandardId(data.id);
            setNewStandardCode('');
            setNewStandardName('');
            setIsAddingStandard(false);
            toast({ title: 'Başarılı', description: 'Standart eklendi.' });
        }
    };

    const handleDeleteStandard = async (standardId) => {
        if (!confirm('Bu standartı silmek istediğinizden emin misiniz? Bu standartla ilişkili tüm sorular da silinecektir.')) {
            return;
        }

        const { error } = await supabase
            .from('audit_standards')
            .delete()
            .eq('id', standardId);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Standart silinemedi: ' + error.message });
        } else {
            setAuditStandards(auditStandards.filter(s => s.id !== standardId));
            if (selectedStandardId === standardId) {
                setSelectedStandardId('');
            }
            toast({ title: 'Başarılı', description: 'Standart silindi.' });
        }
    };

    const handleStartEditStandard = (standard) => {
        setEditingStandardId(standard.id);
        setEditStandardCode(standard.code);
        setEditStandardName(standard.name);
    };

    const handleSaveStandard = async (standardId) => {
        if (!editStandardCode.trim() || !editStandardName.trim()) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen standart kodu ve adı girin.' });
            return;
        }

        const { error } = await supabase
            .from('audit_standards')
            .update({
                code: editStandardCode.trim(),
                name: editStandardName.trim()
            })
            .eq('id', standardId);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Standart güncellenemedi: ' + error.message });
        } else {
            setAuditStandards(auditStandards.map(s => 
                s.id === standardId 
                    ? { ...s, code: editStandardCode.trim(), name: editStandardName.trim() }
                    : s
            ));
            setEditingStandardId(null);
            toast({ title: 'Başarılı', description: 'Standart güncellendi.' });
        }
    };

    const handleCancelEditStandard = () => {
        setEditingStandardId(null);
        setEditStandardCode('');
        setEditStandardName('');
    };

    // Soru yönetimi fonksiyonları
    const handleAddQuestion = async () => {
        if (!newQuestion.trim() || !selectedDeptId || !selectedStandardId) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen birim ve standart seçin, soru metni girin.' });
            return;
        }
        
        // Mevcut soruların maksimum order_number'ını bul
        const { data: existingQuestions } = await supabase
            .from('audit_question_bank')
            .select('order_number')
            .eq('department_id', selectedDeptId)
            .eq('audit_standard_id', selectedStandardId)
            .order('order_number', { ascending: false })
            .limit(1);
        
        const nextOrderNumber = existingQuestions && existingQuestions.length > 0 
            ? (existingQuestions[0].order_number || 0) + 1 
            : 1;
        
        const { data, error } = await supabase
            .from('audit_question_bank')
            .insert([{ 
                department_id: selectedDeptId, 
                audit_standard_id: selectedStandardId,
                question_text: newQuestion.trim(),
                order_number: nextOrderNumber
            }])
            .select('*, audit_standard:audit_standards(code, name)');

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru eklenemedi: ' + error.message });
        } else {
            setQuestions([...questions, ...data]);
            setNewQuestion('');
            toast({ title: 'Başarılı', description: 'Soru eklendi.' });
        }
    };

    const handleDeleteQuestion = async (questionId) => {
        if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) {
            return;
        }

        const { error } = await supabase
            .from('audit_question_bank')
            .delete()
            .eq('id', questionId);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru silinemedi.' });
        } else {
            setQuestions(questions.filter(q => q.id !== questionId));
            toast({ title: 'Başarılı', description: 'Soru silindi.' });
        }
    };

    const handleStartEditQuestion = (question) => {
        setEditingQuestionId(question.id);
        setEditQuestionText(question.question_text);
    };

    const handleSaveQuestion = async (questionId) => {
        if (!editQuestionText.trim()) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen soru metni girin.' });
            return;
        }

        const { error } = await supabase
            .from('audit_question_bank')
            .update({ question_text: editQuestionText.trim() })
            .eq('id', questionId);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru güncellenemedi: ' + error.message });
        } else {
            setQuestions(questions.map(q => 
                q.id === questionId 
                    ? { ...q, question_text: editQuestionText.trim() }
                    : q
            ));
            setEditingQuestionId(null);
            setEditQuestionText('');
            toast({ title: 'Başarılı', description: 'Soru güncellendi.' });
        }
    };

    const handleCancelEditQuestion = () => {
        setEditingQuestionId(null);
        setEditQuestionText('');
    };

    const handleGenerateReport = () => {
        if (!selectedDeptId || !selectedStandardId || questions.length === 0) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata', 
                description: 'Rapor oluşturmak için birim, standart seçilmeli ve sorular bulunmalıdır.' 
            });
            return;
        }

        const selectedDept = departments.find(d => d.id === selectedDeptId);
        const selectedStandard = auditStandards.find(s => s.id === selectedStandardId);
        
        if (!selectedDept || !selectedStandard) {
            toast({ 
                variant: 'destructive', 
                title: 'Hata', 
                description: 'Birim veya standart bilgisi bulunamadı.' 
            });
            return;
        }

        // Rapor HTML'i oluştur
        const reportDate = format(new Date(), 'dd MMMM yyyy', { locale: tr });
        
        const questionsHtml = questions.map((q, index) => `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <div style="display: flex; align-items: start; gap: 10px;">
                    <div style="min-width: 30px; height: 30px; background-color: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1f2937;">
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
                <title>İç Tetkik Soruları - ${selectedDept.unit_name}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Inter', sans-serif;
                        color: #1f2937;
                        background-color: #f3f4f6;
                        padding: 20px;
                    }
                    
                    .page {
                        background-color: white;
                        width: 210mm;
                        min-height: 297mm;
                        margin: 0 auto;
                        padding: 20mm;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }
                    
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #3b82f6;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .header h1 {
                        font-size: 28px;
                        font-weight: 700;
                        color: #111827;
                        margin-bottom: 5px;
                    }
                    
                    .header p {
                        font-size: 16px;
                        color: #6b7280;
                        margin-top: 5px;
                    }
                    
                    .info-section {
                        background-color: #f9fafb;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 15px;
                    }
                    
                    .info-item {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .info-label {
                        font-size: 12px;
                        color: #6b7280;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 5px;
                    }
                    
                    .info-value {
                        font-size: 16px;
                        color: #1f2937;
                        font-weight: 600;
                    }
                    
                    .questions-section {
                        margin-top: 30px;
                    }
                    
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #1e40af;
                        border-bottom: 2px solid #bfdbfe;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #e5e7eb;
                        text-align: center;
                        font-size: 12px;
                        color: #9ca3af;
                    }
                    
                    @media print {
                        /* Print için renkleri koru */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        
                        body {
                            background-color: white !important;
                            padding: 0;
                        }
                        
                        .page {
                            margin: 0;
                            box-shadow: none;
                            border: none;
                        }
                        
                        @page {
                            size: A4;
                            margin: 12mm;
                        }
                        
                        .section { page-break-inside: avoid; break-inside: avoid; }
                        .section-title { page-break-after: avoid; break-after: avoid; }
                        .info-grid { page-break-inside: avoid; break-inside: avoid; }
                        .info-item { page-break-inside: avoid; break-inside: avoid; }
                        .questions-section { page-break-inside: auto; }
                        .question-item { page-break-inside: avoid; break-inside: avoid; }
                        .footer { page-break-inside: avoid; break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <h1>KADEME A.Ş.</h1>
                        <p>Kalite Yönetim Sistemi</p>
                    </div>
                    
                    <div class="info-section">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Birim</span>
                                <span class="info-value">${selectedDept.unit_name}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Tetkik Standartı</span>
                                <span class="info-value">${selectedStandard.code} - ${selectedStandard.name}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Soru Sayısı</span>
                                <span class="info-value">${questions.length} adet</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Rapor Tarihi</span>
                                <span class="info-value">${reportDate}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="questions-section">
                        <h2 class="section-title">İç Tetkik Soruları</h2>
                        ${questionsHtml}
                    </div>
                    
                    <div class="footer">
                        Bu rapor, Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.<br>
                        Denetim öncesi hazırlık için birimlerle paylaşılabilir.
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

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tetkik Yönetimi</DialogTitle>
                    <DialogDescription>İç tetkik standartlarını ve sorularını yönetin.</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="standards" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="standards">Standartlar</TabsTrigger>
                        <TabsTrigger value="questions">Sorular</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="standards" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>İç Tetkik Standartları</CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsAddingStandard(!isAddingStandard)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        {isAddingStandard ? 'İptal' : 'Yeni Standart'}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isAddingStandard && (
                                    <Card className="bg-muted/50">
                                        <CardContent className="pt-6 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label>Standart Kodu</Label>
                                                    <Input
                                                        placeholder="örn: 9001, 14001, FordQ1"
                                                        value={newStandardCode}
                                                        onChange={(e) => setNewStandardCode(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Standart Adı</Label>
                                                    <Input
                                                        placeholder="örn: ISO 9001:2015"
                                                        value={newStandardName}
                                                        onChange={(e) => setNewStandardName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddStandard();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <Button onClick={handleAddStandard} className="w-full">
                                                <PlusCircle className="w-4 h-4 mr-2" />
                                                Standart Ekle
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                                
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {loadingStandards ? (
                                        <p className="text-muted-foreground text-center py-4">Yükleniyor...</p>
                                    ) : auditStandards.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-4">Henüz standart eklenmemiş.</p>
                                    ) : (
                                        auditStandards.map(standard => (
                                            <Card key={standard.id} className={!standard.is_active ? 'opacity-50' : ''}>
                                                <CardContent className="pt-4">
                                                    {editingStandardId === standard.id ? (
                                                        <div className="space-y-3">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <Input
                                                                    value={editStandardCode}
                                                                    onChange={(e) => setEditStandardCode(e.target.value)}
                                                                    placeholder="Standart Kodu"
                                                                />
                                                                <Input
                                                                    value={editStandardName}
                                                                    onChange={(e) => setEditStandardName(e.target.value)}
                                                                    placeholder="Standart Adı"
                                                                />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    size="sm" 
                                                                    onClick={() => handleSaveStandard(standard.id)}
                                                                    className="flex-1"
                                                                >
                                                                    <Save className="w-4 h-4 mr-2" />
                                                                    Kaydet
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline"
                                                                    onClick={handleCancelEditStandard}
                                                                    className="flex-1"
                                                                >
                                                                    <X className="w-4 h-4 mr-2" />
                                                                    İptal
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary">{standard.code}</Badge>
                                                                    <span className="font-medium">{standard.name}</span>
                                                                    {!standard.is_active && (
                                                                        <Badge variant="outline">Pasif</Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleStartEditStandard(standard)}
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive"
                                                                    onClick={() => handleDeleteStandard(standard.id)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="questions" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Soru Yönetimi</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                    <div>
                                        <Label>İç Tetkik Standartı <span className="text-red-500">*</span></Label>
                                        <Select value={selectedStandardId} onValueChange={setSelectedStandardId} disabled={loadingStandards}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingStandards ? "Yükleniyor..." : "Standart seçin"} />
                            </SelectTrigger>
                            <SelectContent>
                                                {auditStandards.filter(s => s.is_active).map(standard => (
                                                    <SelectItem key={standard.id} value={standard.id}>
                                                        {standard.code} - {standard.name}
                                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                                    <div>
                                        <Label>Birim <span className="text-red-500">*</span></Label>
                                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId} disabled={loadingDepartments}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingDepartments ? "Yükleniyor..." : "Birim seçin"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map(dept => (
                                                    <SelectItem key={dept.id} value={dept.id}>
                                                        {dept.unit_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                            </div>

                                {selectedDeptId && selectedStandardId && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Soru Ekle</Label>
                            <div className="flex gap-2">
                                <Textarea
                                                    placeholder="Yeni soru metni girin..."
                                    value={newQuestion}
                                                    onChange={(e) => setNewQuestion(e.target.value)}
                                                    className="flex-1 min-h-[100px]"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.ctrlKey) {
                                                            e.preventDefault();
                                                            handleAddQuestion();
                                                        }
                                                    }}
                                />
                                                <Button onClick={handleAddQuestion} size="icon" className="h-auto">
                                    <PlusCircle className="w-5 h-5" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Ctrl+Enter ile hızlı ekleme</p>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label>
                                                    Sorular ({questions.length} adet)
                                                    {auditStandards.find(s => s.id === selectedStandardId) && (
                                                        <span className="text-muted-foreground ml-2">
                                                            - {auditStandards.find(s => s.id === selectedStandardId).code}
                                                        </span>
                                                    )}
                                                </Label>
                                                {questions.length > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleGenerateReport}
                                                        className="gap-2"
                                                    >
                                                        <FileDown className="w-4 h-4" />
                                                        Rapor Al
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                                                {loading ? (
                                                    <p className="text-muted-foreground text-center py-4">Yükleniyor...</p>
                                                ) : questions.length === 0 ? (
                                                    <p className="text-muted-foreground text-center py-4">Bu birim ve standart için soru bulunmuyor.</p>
                                                ) : (
                                                    questions.map((q, index) => (
                                                        <Card key={q.id}>
                                                            <CardContent className="pt-4">
                                                                {editingQuestionId === q.id ? (
                                                                    <div className="space-y-3">
                                                                        <Textarea
                                                                            value={editQuestionText}
                                                                            onChange={(e) => setEditQuestionText(e.target.value)}
                                                                            className="min-h-[80px]"
                                                                        />
                                                                        <div className="flex gap-2">
                                                                            <Button 
                                                                                size="sm" 
                                                                                onClick={() => handleSaveQuestion(q.id)}
                                                                                className="flex-1"
                                                                            >
                                                                                <Save className="w-4 h-4 mr-2" />
                                                                                Kaydet
                                                                            </Button>
                                                                            <Button 
                                                                                size="sm" 
                                                                                variant="outline"
                                                                                onClick={handleCancelEditQuestion}
                                                                                className="flex-1"
                                                                            >
                                                                                <X className="w-4 h-4 mr-2" />
                                                                                İptal
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <Badge variant="outline">{index + 1}</Badge>
                                                                                <span className="text-sm text-muted-foreground">
                                                                                    {q.audit_standard?.code || ''}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-sm text-foreground">{q.question_text}</p>
                                                                        </div>
                                                                        <div className="flex gap-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => handleStartEditQuestion(q)}
                                                                                className="h-8 w-8"
                                                                            >
                                                                                <Edit2 className="w-4 h-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                                onClick={() => handleDeleteQuestion(q.id)}
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                                                            </CardContent>
                                                        </Card>
                                                    ))
                                                )}
                                            </div>
                </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default QuestionBankModal;
