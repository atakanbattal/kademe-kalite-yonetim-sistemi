import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Plus, X } from 'lucide-react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Textarea } from '@/components/ui/textarea';
    import { v4 as uuidv4 } from 'uuid';

    const ExamFormModal = ({ isOpen, setIsOpen, onSave, trainings, exam }) => {
        const [formData, setFormData] = useState({ training_id: '', title: '', passing_score: 70 });
        const [questions, setQuestions] = useState([]);
        const { toast } = useToast();

        const resetForm = useCallback(() => {
            setFormData({ training_id: '', title: '', passing_score: 70 });
            setQuestions([{ id: `new-${Date.now()}`, question_text: '', question_type: 'Çoktan Seçmeli', options: [{ text: '' }], correct_answer: '', points: 10 }]);
        }, []);

        useEffect(() => {
            const initializeForm = async () => {
                if (exam && isOpen) {
                    setFormData({ training_id: exam.training_id, title: exam.title, passing_score: exam.passing_score });
                    const { data } = await supabase.from('training_exam_questions').select('*').eq('exam_id', exam.id);
                    setQuestions(data && data.length > 0 ? data : [{ id: `new-${Date.now()}`, question_text: '', question_type: 'Çoktan Seçmeli', options: [{ text: '' }], correct_answer: '', points: 10 }]);
                } else {
                    resetForm();
                }
            };
            initializeForm();
        }, [exam, isOpen, resetForm]);

        const addQuestion = () => setQuestions([...questions, { id: `new-${Date.now()}`, question_text: '', question_type: 'Çoktan Seçmeli', options: [{ text: '' }], correct_answer: '', points: 10 }]);
        const removeQuestion = (index) => setQuestions(questions.filter((_, i) => i !== index));
        
        const handleQuestionChange = (index, field, value) => {
            const newQuestions = [...questions];
            newQuestions[index][field] = value;
            setQuestions(newQuestions);
        };
        
        const handleOptionChange = (qIndex, oIndex, value) => {
            const newQuestions = [...questions];
            newQuestions[qIndex].options[oIndex].text = value;
            setQuestions(newQuestions);
        };

        const addOption = (qIndex) => {
            const newQuestions = [...questions];
            newQuestions[qIndex].options.push({ text: '' });
            setQuestions(newQuestions);
        };

        const removeOption = (qIndex, oIndex) => {
            const newQuestions = [...questions];
            newQuestions[qIndex].options = newQuestions[qIndex].options.filter((_, i) => i !== oIndex);
            setQuestions(newQuestions);
        };

        const handleSubmit = async () => {
            let examId = exam?.id;
            
            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedFormData = {};
            for (const key in formData) {
                if (formData[key] !== undefined && key !== 'undefined') {
                    cleanedFormData[key] = formData[key];
                }
            }
            
            const { error: examError, data: examData } = await supabase.from('training_exams').upsert({ id: examId, ...cleanedFormData }).select().single();
            if (examError) { toast({ variant: 'destructive', title: 'Hata', description: examError.message }); return; }
            examId = examData.id;

            const questionUpserts = questions.map(q => {
                const { id, ...questionData } = q;
                const finalId = String(id).startsWith('new-') ? uuidv4() : id;
                return { id: finalId, exam_id: examId, ...questionData };
            });
            const { error: questionsError } = await supabase.from('training_exam_questions').upsert(questionUpserts);
            if (questionsError) { toast({ variant: 'destructive', title: 'Hata', description: `Sorular kaydedilemedi: ${questionsError.message}` }); return; }

            const questionIdsToKeep = questionUpserts.map(q => q.id);
            if (exam) { 
                const { error: deleteError } = await supabase.from('training_exam_questions').delete().eq('exam_id', examId).not('id', 'in', `(${questionIdsToKeep.join(',')})`);
                if (deleteError && questionIdsToKeep.length > 0) console.error("Eski soruları silerken hata:", deleteError);
            }
            
            toast({ title: 'Başarılı', description: 'Sınav kaydedildi.' });
            onSave();
            setIsOpen(false);
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{exam ? 'Sınavı Düzenle' : 'Yeni Sınav Oluştur'}</DialogTitle>
                        <DialogDescription>Sınav detaylarını ve soruları buradan yönetebilirsiniz.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[70vh] p-4">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <Label>Eğitim</Label>
                                    <Select value={formData.training_id} onValueChange={v => setFormData(p => ({ ...p, training_id: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Eğitim seçin" /></SelectTrigger>
                                        <SelectContent>{trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Sınav Başlığı</Label>
                                    <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Geçme Notu</Label>
                                    <Input type="number" value={formData.passing_score} onChange={e => setFormData(p => ({ ...p, passing_score: e.target.value }))} />
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                {questions.map((q, qIndex) => (
                                    <div key={q.id || qIndex} className="p-4 border rounded-lg space-y-3 bg-muted/20 relative">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-semibold">Soru {qIndex + 1}</Label>
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => removeQuestion(qIndex)}><X className="h-4 w-4" /></Button>
                                        </div>
                                        <Textarea placeholder="Soru metni" value={q.question_text} onChange={e => handleQuestionChange(qIndex, 'question_text', e.target.value)} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Select value={q.question_type} onValueChange={v => handleQuestionChange(qIndex, 'question_type', v)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="Çoktan Seçmeli">Çoktan Seçmeli</SelectItem><SelectItem value="Doğru/Yanlış">Doğru/Yanlış</SelectItem></SelectContent>
                                            </Select>
                                            <Input type="number" placeholder="Puan" value={q.points} onChange={e => handleQuestionChange(qIndex, 'points', parseInt(e.target.value, 10) || 0)} />
                                        </div>
                                        
                                        <Label className="text-sm">Seçenekler ve Doğru Cevap</Label>
                                        <div className="space-y-2">
                                            {q.options.map((opt, oIndex) => (
                                                <div key={oIndex} className="flex items-center gap-2">
                                                    <Input placeholder={`Seçenek ${String.fromCharCode(65 + oIndex)}`} value={opt.text} onChange={e => handleOptionChange(qIndex, oIndex, e.target.value)} autoFormat={false} />
                                                    <Button variant="ghost" size="icon" onClick={() => removeOption(qIndex, oIndex)}><X className="h-4 w-4 text-destructive/50 hover:text-destructive" /></Button>
                                                </div>
                                            ))}
                                            <Button size="sm" variant="outline" onClick={() => addOption(qIndex)}>Seçenek Ekle</Button>
                                        </div>
                                        
                                        <Select value={q.correct_answer} onValueChange={v => handleQuestionChange(qIndex, 'correct_answer', v)}>
                                            <SelectTrigger><SelectValue placeholder="Doğru cevabı seçin..." /></SelectTrigger>
                                            <SelectContent>
                                                {q.options.filter(o => o.text.trim() !== '').map((opt, i) => (
                                                    <SelectItem key={i} value={opt.text}>{opt.text}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                             <Button onClick={addQuestion} variant="secondary" className="w-full"><Plus className="mr-2 h-4 w-4" />Soru Ekle</Button>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-4"><Button onClick={handleSubmit}>Kaydet</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default ExamFormModal;