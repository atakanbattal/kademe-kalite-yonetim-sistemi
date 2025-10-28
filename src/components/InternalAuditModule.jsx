import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, ListChecks, Printer } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuditDashboard from '@/components/audit/AuditDashboard';
import AuditList from '@/components/audit/AuditList';
import AuditDetail from '@/components/audit/AuditDetail';
import AuditFindingsList from '@/components/audit/AuditFindingsList';
import AuditPlanModal from '@/components/audit/AuditPlanModal';
import QuestionBankModal from '@/components/audit/QuestionBankModal';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport } from '@/lib/reportUtils';

const InternalAuditModule = ({ onOpenNCForm, onOpenNCView }) => {
    const { audits, auditFindings, loading, refreshData } = useData();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeView, setActiveView] = useState('list');
    const [selectedAuditId, setSelectedAuditId] = useState(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingAudit, setEditingAudit] = useState(null);
    const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);

    const handleViewAudit = (auditId) => {
        setSelectedAuditId(auditId);
        setActiveView('detail');
    };

    const handleEditAudit = (audit) => {
        setEditingAudit(audit);
        setIsPlanModalOpen(true);
    };

    const handleBack = () => {
        setSelectedAuditId(null);
        setActiveView('list');
        refreshData();
    };

    const handleOpenNewPlan = () => {
        setEditingAudit(null);
        setIsPlanModalOpen(true);
    };

    const handlePrintReport = (audit) => {
        if (!audit || !audit.id) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Rapor oluşturmak için geçerli bir tetkik seçilmelidir.' });
            return;
        }
        openPrintableReport(audit, 'internal_audit');
    };

    if (activeView === 'detail' && selectedAuditId) {
        const selectedAudit = audits.find(a => a.id === selectedAuditId);
        return <AuditDetail 
            auditId={selectedAuditId} 
            onBack={handleBack} 
            onOpenNCForm={onOpenNCForm} 
            onPrintReport={() => handlePrintReport(selectedAudit)}
        />;
    }

    return (
        <div className="space-y-6">
             <AuditPlanModal
                isOpen={isPlanModalOpen}
                setIsOpen={setIsPlanModalOpen}
                refreshAudits={refreshData}
                auditToEdit={editingAudit}
            />
            <QuestionBankModal
                isOpen={isQuestionBankModalOpen}
                setIsOpen={setIsQuestionBankModalOpen}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">İç Tetkik Yönetimi</h1>
                    <p className="text-muted-foreground mt-1">İç tetkik süreçlerinizi planlayın, yürütün ve takip edin.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsQuestionBankModalOpen(true)}>
                        <ListChecks className="w-4 h-4 mr-2" />
                        Soru Bankası
                    </Button>
                    <Button onClick={handleOpenNewPlan}>
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni Tetkik Planı
                    </Button>
                    <Button onClick={() => openPrintableReport({ id: 'dashboard' }, 'internal_audit_dashboard')}>
                        <Printer className="w-4 h-4 mr-2" />
                        Genel Rapor
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="dashboard" onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="dashboard">Genel Bakış</TabsTrigger>
                    <TabsTrigger value="list">Tüm Tetkikler</TabsTrigger>
                    <TabsTrigger value="findings">Bulgular</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard">
                    <AuditDashboard audits={audits} findings={auditFindings} loading={loading} onViewAudit={handleViewAudit} />
                </TabsContent>
                <TabsContent value="list">
                    <AuditList audits={audits} loading={loading} onViewAudit={handleViewAudit} onEditAudit={handleEditAudit} refreshData={refreshData} onPrintReport={handlePrintReport} />
                </TabsContent>
                <TabsContent value="findings">
                    <AuditFindingsList findings={auditFindings} onOpenNCView={onOpenNCView} loading={loading} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default InternalAuditModule;