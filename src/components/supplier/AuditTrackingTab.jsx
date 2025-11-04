import React, { useMemo, useState } from 'react';
    import { motion } from 'framer-motion';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Calendar, Check, X, Edit, Eye, PlusCircle, Trash2, Rocket, Clock, CalendarClock, AlertOctagon, FileText, Info } from 'lucide-react';
    import SupplierAuditPlanModal from '@/components/supplier/SupplierAuditPlanModal';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { format, differenceInDays, isPast, isToday, parseISO } from 'date-fns';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { useNavigate } from 'react-router-dom';
    import { openPrintableReport } from '@/lib/reportUtils';
    import { useData } from '@/contexts/DataContext';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

    const AuditTrackingTab = ({ suppliers, loading, refreshData, onOpenPdfViewer }) => {
        const { toast } = useToast();
        const navigate = useNavigate();
        const { questions: allQuestions } = useData();
        const [isPlanModalOpen, setPlanModalOpen] = useState(false);
        const [selectedPlan, setSelectedPlan] = useState(null);
        const [selectedSupplierForNewPlan, setSelectedSupplierForNewPlan] = useState(null);

        const auditPlans = useMemo(() => {
            if (!suppliers) return [];
            const plans = suppliers.flatMap(s => (s.supplier_audit_plans || []).map(p => ({ ...p, supplierName: s.name, supplier_id: s.id, supplier: s })));
            
            return plans.sort((a, b) => {
                const statusOrder = { 'Gecikti': 0, 'Planlandı': 1, 'Ertelendi': 2, 'Tamamlandı': 3, 'İptal Edildi': 4 };
                const aDate = a.planned_date ? parseISO(a.planned_date) : new Date(8640000000000000);
                const bDate = b.planned_date ? parseISO(b.planned_date) : new Date(8640000000000000);

                const aIsOverdue = a.status === 'Planlandı' && a.planned_date && isPast(aDate) && !isToday(aDate);
                const bIsOverdue = b.status === 'Planlandı' && b.planned_date && isPast(bDate) && !isToday(bDate);

                const aStatus = aIsOverdue ? 'Gecikti' : a.status;
                const bStatus = bIsOverdue ? 'Gecikti' : b.status;
                
                if (statusOrder[aStatus] < statusOrder[bStatus]) return -1;
                if (statusOrder[aStatus] > statusOrder[bStatus]) return 1;

                if (aStatus === 'Planlandı' || aStatus === 'Gecikti') {
                    return aDate - bDate;
                }

                return bDate - aDate;
            });
        }, [suppliers]);

        const handleOpenModal = (plan = null, supplier = null) => {
            setSelectedPlan(plan);
            setSelectedSupplierForNewPlan(supplier);
            setPlanModalOpen(true);
        };
        
        const handleEditAudit = (plan) => {
            // Tamamlanmış olsa bile denetimi düzenleme sayfasında aç
            navigate(`/supplier-audit/${plan.id}`);
        };
        
        const handleViewPdf = async (files) => {
            if (!files || files.length === 0) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya bulunamadı.' });
                return;
            }
            const path = files[0].path;
            const { data, error } = await supabase.storage.from('supplier_audit_reports').createSignedUrl(path, 3600);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'PDF görüntülenemedi: ' + error.message });
            } else {
                onOpenPdfViewer(data.signedUrl, files[0]?.name || 'Denetim Raporu');
            }
        };

        const handleDeletePlan = async (planId) => {
            const { error } = await supabase.from('supplier_audit_plans').delete().eq('id', planId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Denetim planı silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Denetim planı başarıyla silindi.' });
                refreshData();
            }
        };

        const handleStartAudit = (plan) => {
            navigate(`/supplier-audit/${plan.id}`);
        };

    const handleDownloadReport = async (plan) => {
        // Soruları veritabanından çek
        const { data: questionsData, error: questionsError } = await supabase
            .from('supplier_audit_questions')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (questionsError) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Sorular yüklenemedi: ' + questionsError.message });
            return;
        }
        
        const fullPlanData = {
            ...plan,
            questions: questionsData || [],
        };
        openPrintableReport(fullPlanData, 'supplier_audit');
    };

        const getStatusBadge = (plan) => {
            const { status, planned_date, reason_for_delay } = plan;
            const planned = planned_date ? parseISO(planned_date) : null;
            if (status === 'Planlandı' && planned && isPast(planned) && !isToday(planned)) {
                const daysOverdue = differenceInDays(new Date(), planned);
                const badge = <Badge variant="destructive"><AlertOctagon className="w-3 h-3 mr-1"/>Gecikti ({daysOverdue} gün)</Badge>;

                if (reason_for_delay) {
                    return (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>{badge}</TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-destructive text-destructive-foreground">
                                    <p className="font-bold">Gecikme Nedeni:</p>
                                    <p>{reason_for_delay}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }
                return badge;
            }
            
            if (status === 'Ertelendi') {
                const badge = <Badge variant="warning"><Clock className="w-3 h-3 mr-1"/>Ertelendi</Badge>;
                 if (reason_for_delay) {
                    return (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>{badge}</TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-yellow-500 text-black">
                                    <p className="font-bold">Erteleme Nedeni:</p>
                                    <p>{reason_for_delay}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }
                return badge;
            }

            if (status === 'Planlandı' && planned && !isPast(planned)) {
                const daysRemaining = differenceInDays(planned, new Date()) + 1;
                return <Badge variant="secondary"><CalendarClock className="w-3 h-3 mr-1"/>{daysRemaining} gün kaldı</Badge>;
            }

            switch (status) {
                case 'Tamamlandı': return <Badge variant="success"><Check className="w-3 h-3 mr-1"/>Tamamlandı</Badge>;
                case 'İptal Edildi': return <Badge variant="destructive"><X className="w-3 h-3 mr-1"/>İptal Edildi</Badge>;
                default: return <Badge variant="outline">{status}</Badge>;
            }
        };


        if (loading) {
            return <p className="text-center text-muted-foreground">Denetim verileri yükleniyor...</p>;
        }
        
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                 <SupplierAuditPlanModal
                    isOpen={isPlanModalOpen}
                    setIsOpen={setPlanModalOpen}
                    supplier={selectedSupplierForNewPlan || suppliers.find(s => s.id === selectedPlan?.supplier_id)}
                    refreshData={refreshData}
                    existingPlan={selectedPlan}
                />

                <Card className="dashboard-widget">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Tüm Tedarikçi Denetim Planları</CardTitle>
                        <Button onClick={() => handleOpenModal()}>
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Denetim Planla
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[70vh]">
                            <table className="data-table w-full">
                                <thead>
                                    <tr>
                                        <th>Tedarikçi</th>
                                        <th>Planlanan Tarih</th>
                                        <th>Gerçekleşen Tarih</th>
                                        <th>Puan</th>
                                        <th>Durum</th>
                                        <th>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditPlans.map(plan => (
                                        <tr key={plan.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenModal(plan, suppliers.find(s => s.id === plan.supplier_id))}>
                                            <td className="font-semibold text-foreground">{plan.supplierName}</td>
                                            <td>{plan.planned_date ? format(new Date(plan.planned_date), 'dd.MM.yyyy') : '-'}</td>
                                            <td>{plan.actual_date ? format(new Date(plan.actual_date), 'dd.MM.yyyy') : '-'}</td>
                                            <td>{plan.score ?? '-'}</td>
                                            <td>{getStatusBadge(plan)}</td>
                                            <td onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                                                {plan.status === 'Planlandı' && (
                                                    <Button size="sm" variant="default" onClick={() => handleStartAudit(plan)}>
                                                        <Rocket className="w-4 h-4 mr-2" /> Başlat
                                                    </Button>
                                                )}
                                                {plan.status === 'Tamamlandı' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleDownloadReport(plan)}>
                                                      <FileText className="w-4 h-4 mr-2" /> Rapor
                                                    </Button>
                                                )}
                                                {plan.report_files && plan.report_files.length > 0 && (
                                                    <Button size="icon" variant="ghost" onClick={() => handleViewPdf(plan.report_files)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button size="icon" variant="ghost" onClick={() => handleEditAudit(plan)} title={plan.status === 'Tamamlandı' ? 'Tüm denetim verilerini düzenle' : 'Denetim planını düzenle'}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Bu işlem geri alınamaz. {plan.supplierName} için planlanan bu denetimi kalıcı olarak sileceksiniz.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeletePlan(plan.id)}>Evet, Sil</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {auditPlans.length === 0 && <p className="text-center text-muted-foreground py-8">Denetim planı bulunamadı.</p>}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    export default AuditTrackingTab;