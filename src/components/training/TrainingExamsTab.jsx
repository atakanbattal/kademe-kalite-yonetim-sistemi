import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Eye, Printer, MoreVertical, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ListTableShell from '@/components/ui/ListTableShell';
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
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
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
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
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

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        const { error } = await supabase.from('training_exams').delete().eq('id', deleteTarget.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Sınav silinemedi.' });
        } else {
            toast({ title: 'Başarılı', description: 'Sınav silindi.' });
            fetchData();
        }
        setDeleteTarget(null);
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

    const q = searchTerm.trim().toLowerCase();
    const filteredExams = !q
        ? exams
        : exams.filter((e) =>
            (e.title && e.title.toLowerCase().includes(q)) ||
            (e.trainings?.title && e.trainings.title.toLowerCase().includes(q))
        );

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                    <div className="search-box w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Sınav veya eğitim ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={openModalForNew} className="shrink-0">
                        <PlusCircle className="mr-2 h-4 w-4" /> Yeni Sınav
                    </Button>
                </div>

                <ListTableShell noInner>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sınav</TableHead>
                                <TableHead>Eğitim</TableHead>
                                <TableHead>Geçme Notu</TableHead>
                                <TableHead className="text-right w-[140px]">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExams.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                        {exams.length === 0 ? 'Henüz sınav tanımlanmamış.' : 'Aramanızla eşleşen sınav yok.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredExams.map((exam) => (
                                    <TableRow key={exam.id}>
                                        <TableCell className="font-medium">{exam.title}</TableCell>
                                        <TableCell>{exam.trainings?.title ?? '—'}</TableCell>
                                        <TableCell className="tabular-nums">{exam.passing_score}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="inline-flex items-center justify-end gap-0.5">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            onClick={() => openModalForView(exam)}
                                                            aria-label="Görüntüle"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom">Görüntüle</TooltipContent>
                                                </Tooltip>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            aria-label="Diğer işlemler"
                                                        >
                                                            <MoreVertical className="h-4 w-4 shrink-0" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuItem className="text-sm" onClick={() => openModalForEdit(exam)}>
                                                            <Edit className="mr-2 h-4 w-4 shrink-0" /> Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-sm"
                                                            onClick={() => openPrintableReport(exam, 'exam_paper')}
                                                        >
                                                            <Printer className="mr-2 h-4 w-4 shrink-0" /> Sınav kağıdı
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                                            onSelect={(e) => { e.preventDefault(); setDeleteTarget(exam); }}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4 shrink-0" /> Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ListTableShell>

                <ExamFormModal isOpen={isFormModalOpen} setIsOpen={setIsFormModalOpen} onSave={handleSave} trainings={trainings} exam={selectedExam} />
                <ExamViewModal isOpen={isViewModalOpen} setIsOpen={setIsViewModalOpen} exam={selectedExam} />

                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Sınavı sil</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bu sınavı silmek istediğinize emin misiniz? İlişkili sorular da kaldırılabilir. Bu işlem geri alınamaz.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>İptal</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={handleDeleteConfirm}
                            >
                                Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </TooltipProvider>
    );
};

export default TrainingExamsTab;
