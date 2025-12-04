import React, { useState, useCallback } from 'react';
import { Plus, FileCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PPAPSubmissionFormModal from './PPAPSubmissionFormModal';

const SUBMISSION_STATUS_COLORS = {
    'Draft': 'default',
    'Submitted': 'warning',
    'Approved': 'success',
    'Rejected': 'destructive',
    'Conditionally Approved': 'default'
};

const PPAPSubmissions = ({ projects }) => {
    const { toast } = useToast();
    const [selectedProject, setSelectedProject] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingSubmission, setEditingSubmission] = useState(null);

    const loadSubmissions = useCallback(async (projectId) => {
        if (!projectId) {
            setSubmissions([]);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ppap_submissions')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'ppap_submissions tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-ppap-apqp-module.sql script\'ini çalıştırın.'
                    });
                    setSubmissions([]);
                    return;
                }
                throw error;
            }
            setSubmissions(data || []);
        } catch (error) {
            console.error('Submissions loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Submissions yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setSubmissions([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (selectedProject) {
            loadSubmissions(selectedProject);
        }
    }, [selectedProject, loadSubmissions]);

    const openFormModal = (submission = null) => {
        setEditingSubmission(submission);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingSubmission(null);
        setFormModalOpen(false);
        if (selectedProject) {
            loadSubmissions(selectedProject);
        }
    };

    const activeProjects = projects.filter(p => 
        ['Product Validation', 'Feedback & Corrective Action', 'Approved'].includes(p.status)
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>PPAP Submissions (PSW)</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Part Submission Warrant yönetimi
                        </p>
                    </div>
                    {selectedProject && (
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Submission
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Proje seçin..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activeProjects.map(project => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.project_name} ({project.project_number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : !selectedProject ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Lütfen bir proje seçin.
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Bu proje için henüz submission bulunmuyor.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {submissions.map((submission) => (
                            <Card key={submission.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-semibold">
                                                    {submission.psw_number || `Submission #${submission.id.slice(0, 8)}`}
                                                </h4>
                                                <Badge variant={SUBMISSION_STATUS_COLORS[submission.submission_status] || 'default'}>
                                                    {submission.submission_status}
                                                </Badge>
                                                <Badge variant="outline">
                                                    Level {submission.submission_level}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {submission.customer_part_number && `Müşteri Parça No: ${submission.customer_part_number} | `}
                                                {submission.reason_for_submission && `Neden: ${submission.reason_for_submission} | `}
                                                {submission.date_submitted && `Gönderim: ${new Date(submission.date_submitted).toLocaleDateString('tr-TR')} | `}
                                                {submission.date_approved && `Onay: ${new Date(submission.date_approved).toLocaleDateString('tr-TR')}`}
                                            </div>
                                            {submission.customer_decision && (
                                                <div className="mt-2">
                                                    <Badge 
                                                        variant={submission.customer_decision === 'Approved' ? 'success' : 
                                                                submission.customer_decision === 'Rejected' ? 'destructive' : 
                                                                'warning'}
                                                    >
                                                        {submission.customer_decision === 'Approved' ? 'Onaylandı' :
                                                         submission.customer_decision === 'Rejected' ? 'Reddedildi' :
                                                         'Şartlı Onay'}
                                                    </Badge>
                                                    {submission.customer_comments && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {submission.customer_comments}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openFormModal(submission)}
                                            >
                                                <FileCheck className="w-4 h-4 mr-1" />
                                                Düzenle
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {isFormModalOpen && (
                    <PPAPSubmissionFormModal
                        open={isFormModalOpen}
                        setOpen={setFormModalOpen}
                        existingSubmission={editingSubmission}
                        projectId={selectedProject}
                        onSuccess={closeFormModal}
                    />
                )}
            </CardContent>
        </Card>
    );
};

export default PPAPSubmissions;
