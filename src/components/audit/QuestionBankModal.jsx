import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Trash2 } from 'lucide-react';

const QuestionBankModal = ({ isOpen, setIsOpen }) => {
    const { toast } = useToast();
    const [departments, setDepartments] = useState([]);
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [questions, setQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
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
        fetchDepartments();
    }, [isOpen, toast]);

    const fetchQuestions = useCallback(async (departmentId) => {
        if (!departmentId) {
            setQuestions([]);
            return;
        }
        setLoading(true);

        const { data, error } = await supabase
            .from('audit_question_bank')
            .select('*')
            .eq('department_id', departmentId)
            .order('created_at');
        
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Sorular yüklenemedi.' });
            setQuestions([]);
        } else {
            setQuestions(data);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchQuestions(selectedDeptId);
    }, [selectedDeptId, fetchQuestions]);

    const handleAddQuestion = async () => {
        if (!newQuestion.trim() || !selectedDeptId) return;
        
        const { data, error } = await supabase
            .from('audit_question_bank')
            .insert([{ department_id: selectedDeptId, question_text: newQuestion.trim() }])
            .select();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru eklenemedi.' });
        } else {
            setQuestions([...questions, ...data]);
            setNewQuestion('');
            toast({ title: 'Başarılı', description: 'Soru eklendi.' });
        }
    };

    const handleDeleteQuestion = async (questionId) => {
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

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Soru Bankası Yönetimi</DialogTitle>
                    <DialogDescription>Birimler için tetkik sorularını yönetin.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="department-select">Birim Seçin</Label>
                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId} disabled={loadingDepartments}>
                            <SelectTrigger id="department-select">
                                <SelectValue placeholder={loadingDepartments ? "Birimler yükleniyor..." : "Soruları görmek için birim seçin"} />
                            </SelectTrigger>
                            <SelectContent>
                                {!loadingDepartments && departments.map(dept => (
                                    <SelectItem key={dept.id} value={dept.id}>{dept.unit_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedDeptId && (
                        <div className="space-y-4 pt-4 border-t border-border">
                            <h4 className="font-semibold text-foreground">Sorular</h4>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {loading && <p>Yükleniyor...</p>}
                                {!loading && questions.length === 0 && <p className="text-muted-foreground text-sm">Bu birim için soru bulunmuyor.</p>}
                                {!loading && questions.map(q => (
                                    <div key={q.id} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                                        <p className="text-sm text-foreground flex-grow">{q.question_text}</p>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleDeleteQuestion(q.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Yeni soru ekle..."
                                    value={newQuestion}
                                    onChange={e => setNewQuestion(e.target.value)}
                                    className="flex-grow"
                                />
                                <Button onClick={handleAddQuestion} size="icon">
                                    <PlusCircle className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default QuestionBankModal;