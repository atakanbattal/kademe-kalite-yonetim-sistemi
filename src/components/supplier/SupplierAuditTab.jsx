import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, FilePlus, Calendar, Check, X, Edit } from 'lucide-react';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import SupplierAuditPlanModal from '@/components/supplier/SupplierAuditPlanModal';

const SupplierAuditTab = ({ supplier, refreshData }) => {
    const { toast } = useToast();
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfModalOpen, setPdfModalOpen] = useState(false);
    const [isPlanModalOpen, setPlanModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);

    const handleViewPdf = async (files) => {
        if (!files || files.length === 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Görüntülenecek dosya bulunamadı.' });
            return;
        }
        const path = files[0].path;
        const { data, error } = await supabase.storage.from('supplier_audit_reports').createSignedUrl(path, 60);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'PDF görüntülenemedi: ' + error.message });
        } else {
            setPdfUrl(data.signedUrl);
            setPdfModalOpen(true);
        }
    };

    const handleOpenPlanModal = (plan = null) => {
        setSelectedPlan(plan);
        setPlanModalOpen(true);
    };

    const combinedAudits = useMemo(() => {
        const oldAudits = (supplier.supplier_audits || []).map(a => ({
            id: a.id,
            date: a.audit_date,
            title: a.report_number || `Denetim ${new Date(a.audit_date).toLocaleDateString('tr-TR')}`,
            status: a.status || 'Tamamlandı',
            score: a.score || 'N/A',
            files: a.report_path ? [{ path: a.report_path, name: 'Rapor' }] : [],
            isPlan: false,
        }));

        const newPlans = (supplier.supplier_audit_plans || []).map(p => ({
            id: p.id,
            date: p.planned_date,
            title: `Planlanan Denetim`,
            status: p.status,
            score: p.score || 'N/A',
            files: p.report_files || [],
            isPlan: true,
            planData: p,
        }));

        return [...oldAudits, ...newPlans].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [supplier.supplier_audits, supplier.supplier_audit_plans]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Planlandı': return <Badge variant="secondary"><Calendar className="w-3 h-3 mr-1"/>Planlandı</Badge>;
            case 'Tamamlandı': return <Badge variant="success"><Check className="w-3 h-3 mr-1"/>Tamamlandı</Badge>;
            case 'Ertelendi': return <Badge className="bg-orange-500 text-white"><Calendar className="w-3 h-3 mr-1"/>Ertelendi</Badge>;
            case 'İptal Edildi': return <Badge variant="destructive"><X className="w-3 h-3 mr-1"/>İptal Edildi</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    }

    return (
        <div className="space-y-4">
            <PdfViewerModal isOpen={isPdfModalOpen} setIsOpen={setPdfModalOpen} pdfUrl={pdfUrl} />
            <SupplierAuditPlanModal 
                isOpen={isPlanModalOpen}
                setIsOpen={setPlanModalOpen}
                supplier={supplier}
                refreshData={refreshData}
                existingPlan={selectedPlan}
            />

            <div className="flex justify-end">
                <Button onClick={() => handleOpenPlanModal()}>
                    <FilePlus className="w-4 h-4 mr-2" /> Yeni Denetim Planı
                </Button>
            </div>
            
            {combinedAudits.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Bu tedarikçi için denetim veya plan bulunmuyor.</div>
            ) : (
                <div className="space-y-3">
                    {combinedAudits.map(audit => (
                        <div key={audit.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                            <div>
                                <p className="font-semibold text-foreground">{audit.title}</p>
                                <p className="text-sm text-muted-foreground">
                                    Tarih: {new Date(audit.date).toLocaleDateString('tr-TR')} | Puan: {audit.score}
                                </p>
                            </div>
                            <div className='flex items-center gap-2'>
                                {getStatusBadge(audit.status)}
                                {audit.files && audit.files.length > 0 && (
                                    <Button variant="outline" size="icon" onClick={() => handleViewPdf(audit.files)}>
                                        <Eye className="w-4 h-4"/>
                                    </Button>
                                )}
                                {audit.isPlan && (
                                    <Button variant="outline" size="icon" onClick={() => handleOpenPlanModal(audit.planData)}>
                                        <Edit className="w-4 h-4"/>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SupplierAuditTab;