import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlusCircle, Save, Edit, Trash2, Loader2, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const SupplierQuestionBank = () => {
    const { toast } = useToast();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(null);
    const [newQuestionText, setNewQuestionText] = useState('');
    const [newQuestionPoints, setNewQuestionPoints] = useState(10);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('supplier_audit_questions')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Sorular alınamadı: ' + error.message });
        } else {
            setQuestions(data);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    const handleAddQuestion = async () => {
        if (!newQuestionText.trim() || newQuestionPoints <= 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen geçerli bir soru metni ve puan girin.' });
            return;
        }
        setIsSubmitting(true);
        const { error } = await supabase.from('supplier_audit_questions').insert({
            question_text: newQuestionText,
            points: newQuestionPoints
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru eklenemedi: ' + error.message });
        } else {
            toast({ title: 'Başarılı', description: 'Soru başarıyla eklendi.' });
            setNewQuestionText('');
            setNewQuestionPoints(10);
            fetchQuestions();
        }
        setIsSubmitting(false);
    };

    const handleUpdateQuestion = async (id, text, points) => {
        if (!text.trim() || points <= 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen geçerli bir soru metni ve puan girin.' });
            return;
        }
        setIsSubmitting(true);
        const { error } = await supabase.from('supplier_audit_questions').update({
            question_text: text,
            points: points
        }).eq('id', id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru güncellenemedi: ' + error.message });
        } else {
            toast({ title: 'Başarılı', description: 'Soru başarıyla güncellendi.' });
            setIsEditing(null);
            fetchQuestions();
        }
        setIsSubmitting(false);
    };

    const handleDeleteQuestion = async (id) => {
        const { error } = await supabase.from('supplier_audit_questions').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Soru silinemedi: ' + error.message });
        } else {
            toast({ title: 'Başarılı', description: 'Soru başarıyla silindi.' });
            fetchQuestions();
        }
    };

    const EditQuestionForm = ({ question }) => {
        const [text, setText] = useState(question.question_text);
        const [points, setPoints] = useState(question.points);

        return (
            <div className="p-4 bg-muted/50 rounded-lg my-2 space-y-3">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} />
                <Input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
                <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdateQuestion(question.id, text, points)} disabled={isSubmitting}>
                        <Save className="w-4 h-4 mr-2" /> {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(null)}>İptal</Button>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tedarikçi Denetim Soru Bankası</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-card space-y-3">
                        <h3 className="font-semibold">Yeni Soru Ekle</h3>
                        <Textarea
                            placeholder="Yeni denetim sorusu..."
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                        />
                         <Input
                            type="number"
                            placeholder="Soru Puanı"
                            value={newQuestionPoints}
                            onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                            className="w-32"
                        />
                        <Button onClick={handleAddQuestion} disabled={isSubmitting}>
                            <PlusCircle className="w-4 h-4 mr-2" /> {isSubmitting ? 'Ekleniyor...' : 'Soru Ekle'}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                        ) : (
                            <AnimatePresence>
                                {questions.map((q, index) => (
                                    <motion.div
                                        key={q.id}
                                        layout
                                        initial={{ opacity: 0, y: -20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -300 }}
                                        className="p-3 border rounded-lg flex items-start gap-4 bg-background"
                                    >
                                        <GripVertical className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
                                        <div className="flex-grow">
                                            {isEditing === q.id ? (
                                                <EditQuestionForm question={q} />
                                            ) : (
                                                <>
                                                    <p className="font-medium">{q.question_text}</p>
                                                    <p className="text-sm text-primary font-semibold">{q.points} Puan</p>
                                                </>
                                            )}
                                        </div>
                                        {isEditing !== q.id && (
                                            <div className="flex-shrink-0 flex gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => setIsEditing(q.id)}><Edit className="w-4 h-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Bu işlem geri alınamaz. Bu soruyu kalıcı olarak sileceksiniz.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteQuestion(q.id)}>Evet, Sil</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default SupplierQuestionBank;