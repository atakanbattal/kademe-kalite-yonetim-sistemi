import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { PlusCircle, Edit, Trash2, Eye, Printer } from 'lucide-react';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Badge } from '@/components/ui/badge';
    import { openPrintableReport } from '@/lib/reportUtils';
    import ExamFormModal from '@/components/training/ExamFormModal';

    const ExamViewModal = ({ isOpen, setIsOpen, exam }) => {
        const [questions, setQuestions] = useState([]);

        useEffect(() => {
            const fetchQuestions = async () => {
                if (exam?.id) {
                    const { data } = await supabase.from('training_exam_questions').select('*').eq('exam_id', exam.id);
                    setQuestions(data || []);
                }
            };
            if (isOpen) fetchQuestions();
        }, [exam, isOpen]);

        if (!exam) return null;

        const handlePrint = () => {
            openPrintableReport(exam, 'exam_paper');
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex justify-between items-center">
                            <span>Sınav Detayları: {exam.title}</span>
                            <Button onClick={handlePrint} size="sm" variant="outline">
                                <Printer className="mr-2 h-4 w-4" />
                                Sınav Kağıdı Oluştur
                            </Button>
                        </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[70vh] p-4">
                        {questions.map((q, index) => (
                            <div key={q.id} className="mb-6 p-4 border rounded-lg bg-muted/20">
                                <p className="font-semibold">Soru {index + 1}: <span className="font-normal">{q.question_text}</span></p>
                                <p className="text-sm text-muted-foreground">Puan: {q.points}</p>
                                <div className="mt-2 space-y-1">
                                    {q.options?.map((opt, i) => (
                                        <p key={i} className={`text-sm p-2 rounded-md ${opt.text === q.correct_answer ? 'bg-green-100 dark:bg-green-900/50' : ''}`}>
                                            {String.fromCharCode(65 + i)}) {opt.text}
                                            {opt.text === q.correct_answer && <Badge variant="success" className="ml-2">Doğru Cevap</Badge>}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        );
    };


    const TrainingExamsTab = () => {
        const [exams, setExams] = useState([]);
        const [trainings, setTrainings] = useState([]);
        const [isFormModalOpen, setIsFormModalOpen] = useState(false);
        const [isViewModalOpen, setIsViewModalOpen] = useState(false);
        const [selectedExam, setSelectedExam] = useState(null);
        const { toast } = useToast();

        const fetchData = useCallback(async () => {
            const { data: examsData } = await supabase.from('training_exams').select('*, trainings(title)');
            const { data: trainingsData } = await supabase.from('trainings').select('id, title');
            setExams(examsData || []);
            setTrainings(trainingsData || []);
        }, []);

        useEffect(() => { fetchData(); }, [fetchData]);

        const handleSave = () => {
            fetchData();
        };

        const handleDelete = async (examId) => {
            const { error } = await supabase.from('training_exams').delete().eq('id', examId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Sınav silinemedi.' });
            } else {
                toast({ title: 'Başarılı', description: 'Sınav silindi.' });
                fetchData();
            }
        };
        
        const openModalForView = (exam) => {
            setSelectedExam(exam);
            setIsViewModalOpen(true);
        };
        
        const openModalForEdit = (exam) => {
            setSelectedExam(exam);
            setIsFormModalOpen(true);
        };
        
        const openModalForNew = () => {
            setSelectedExam(null);
            setIsFormModalOpen(true);
        };

        return (
            <div>
                <div className="flex justify-end mb-4">
                    <Button onClick={openModalForNew}><PlusCircle className="mr-2 h-4 w-4" /> Yeni Sınav</Button>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Sınav</TableHead><TableHead>Eğitim</TableHead><TableHead>Geçme Notu</TableHead><TableHead className="text-right z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {exams.map(exam => (
                            <TableRow key={exam.id}>
                                <TableCell>{exam.title}</TableCell>
                                <TableCell>{exam.trainings?.title}</TableCell>
                                <TableCell>{exam.passing_score}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openModalForView(exam)}><Eye className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => openModalForEdit(exam)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(exam.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <ExamFormModal isOpen={isFormModalOpen} setIsOpen={setIsFormModalOpen} onSave={handleSave} trainings={trainings} exam={selectedExam} />
                <ExamViewModal isOpen={isViewModalOpen} setIsOpen={setIsViewModalOpen} exam={selectedExam} />
            </div>
        );
    };

    export default TrainingExamsTab;