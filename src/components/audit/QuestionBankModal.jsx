import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Plus } from 'lucide-react';

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
    const [isAddingAuditStandard, setIsAddingAuditStandard] = useState(false);
    const [newAuditStandardCode, setNewAuditStandardCode] = useState('');
    const [newAuditStandardName, setNewAuditStandardName] = useState('');

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
        
        const fetchStandards = async () => {
            setLoadingStandards(true);
            const { data, error } = await supabase
                .from('audit_standards')
                .select('id, code, name')
                .eq('is_active', true)
                .order('code');

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Standartlar yüklenemedi.' });
                setAuditStandards([]);
            } else {
                setAuditStandards(data);
                // Varsayılan olarak 9001'i seç
                if (data && data.length > 0) {
                    const defaultStandard = data.find(s => s.code === '9001') || data[0];
                    setSelectedStandardId(defaultStandard.id);
                }
            }
            setLoadingStandards(false);
        };
        
        fetchDepartments();
        fetchStandards();
    }, [isOpen, toast]);

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
        fetchQuestions(selectedDeptId, selectedStandardId);
    }, [selectedDeptId, selectedStandardId, fetchQuestions]);

    const handleAddQuestion = async () => {
        if (!newQuestion.trim() || !selectedDeptId || !selectedStandardId) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen birim ve standart seçin.' });
            return;
        }
        
        const { data, error } = await supabase
            .from('audit_question_bank')
            .insert([{ 
                department_id: selectedDeptId, 
                audit_standard_id: selectedStandardId,
                question_text: newQuestion.trim() 
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

    const handleAddAuditStandard = async () => {
        if (!newAuditStandardCode.trim() || !newAuditStandardName.trim()) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen standart kodu ve adı girin.' });
            return;
        }

        const { data, error } = await supabase
            .from('audit_standards')
            .insert([{
                code: newAuditStandardCode.trim(),
                name: newAuditStandardName.trim()
            }])
            .select()
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Standart eklenemedi: ' + error.message });
        } else {
            setAuditStandards([...auditStandards, data]);
            setSelectedStandardId(data.id);
            setNewAuditStandardCode('');
            setNewAuditStandardName('');
            setIsAddingAuditStandard(false);
            toast({ title: 'Başarılı', description: 'Standart eklendi.' });
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="standard-select">İç Tetkik Standartı <span className="text-red-500">*</span></Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingAuditStandard(!isAddingAuditStandard)}
                                    className="h-7 text-xs"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {isAddingAuditStandard ? 'İptal' : 'Yeni Ekle'}
                                </Button>
                            </div>
                            {isAddingAuditStandard ? (
                                <div className="space-y-2">
                                    <Input
                                        placeholder="Standart Kodu (örn: 9001, 14001)"
                                        value={newAuditStandardCode}
                                        onChange={(e) => setNewAuditStandardCode(e.target.value)}
                                    />
                                    <Input
                                        placeholder="Standart Adı (örn: ISO 9001:2015)"
                                        value={newAuditStandardName}
                                        onChange={(e) => setNewAuditStandardName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddAuditStandard();
                                            }
                                        }}
                                    />
                                    <Button type="button" onClick={handleAddAuditStandard} size="sm" className="w-full">
                                        Ekle
                                    </Button>
                                </div>
                            ) : (
                                <Select value={selectedStandardId} onValueChange={setSelectedStandardId} disabled={loadingStandards}>
                                    <SelectTrigger id="standard-select">
                                        <SelectValue placeholder={loadingStandards ? "Standartlar yükleniyor..." : "Standart seçin"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {!loadingStandards && auditStandards.map(standard => (
                                            <SelectItem key={standard.id} value={standard.id}>
                                                {standard.code} - {standard.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="department-select">Birim Seçin <span className="text-red-500">*</span></Label>
                            <Select value={selectedDeptId} onValueChange={setSelectedDeptId} disabled={loadingDepartments}>
                                <SelectTrigger id="department-select">
                                    <SelectValue placeholder={loadingDepartments ? "Birimler yükleniyor..." : "Birim seçin"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {!loadingDepartments && departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>{dept.unit_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {selectedDeptId && selectedStandardId && (
                        <div className="space-y-4 pt-4 border-t border-border">
                            <h4 className="font-semibold text-foreground">
                                Sorular ({auditStandards.find(s => s.id === selectedStandardId)?.code || ''} - {departments.find(d => d.id === selectedDeptId)?.unit_name || ''})
                            </h4>
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