import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, BarChart, List, AlertTriangle, CalendarCheck, HelpCircle, FileText, TrendingUp, CheckCircle2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from '@/contexts/DataContext';
import { openPrintableReport } from '@/lib/reportUtils';

import SupplierDashboard from '@/components/supplier/SupplierDashboard';
import SupplierList from '@/components/supplier/SupplierList';
import SupplierFilters from '@/components/supplier/SupplierFilters';
import SupplierFormModal from '@/components/supplier/SupplierFormModal';
import SupplierNCTab from '@/components/supplier/SupplierNCTab';
import AuditTrackingTab from '@/components/supplier/AuditTrackingTab';
import SupplierQuestionBank from '@/components/supplier/SupplierQuestionBank';
import SupplierDocumentsTab from '@/components/supplier/SupplierDocumentsTab';
import DevelopmentPlans from '@/components/supplier-development/DevelopmentPlans';
import DevelopmentActions from '@/components/supplier-development/DevelopmentActions';
import DevelopmentAssessments from '@/components/supplier-development/DevelopmentAssessments';


const SupplierQualityModule = ({ onOpenNCForm, onOpenNCView, onOpenPdfViewer }) => {
  const { suppliers, nonConformities, loading, refreshData } = useData();
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isNewAlternative, setIsNewAlternative] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: '',
    status: 'all',
    riskClass: 'all'
  });

  const getGradeInfo = (score) => {
    if (score === null || score === undefined) return { grade: 'N/A', description: 'Puanlanmamış' };
    if (score >= 90) return { grade: 'A', description: 'Stratejik İş Ortağı' };
    if (score >= 75) return { grade: 'B', description: 'Güvenilir Tedarikçi' };
    if (score >= 60) return { grade: 'C', description: 'İzlemeye Alınacak' };
    return { grade: 'D', description: 'İş Birliği Sonlandırılacak' };
  };

  const mergedSuppliers = useMemo(() => {
    return suppliers.map(s => {
      const supplierNcs = nonConformities.filter(nc => nc.supplier_id === s.id);
      const altSupplier = s.alternative_to_supplier_id ? suppliers.find(main => main.id === s.alternative_to_supplier_id) : null;
      return {
        ...s,
        supplier_non_conformities: supplierNcs,
        alternative_supplier: altSupplier
      };
    });
  }, [suppliers, nonConformities]);

  useEffect(() => {
    let tempSuppliers = [...mergedSuppliers];
    if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        // Kapsamlı arama: tedarikçi adı, ürün grubu, kod, adres, iletişim bilgileri, uygunsuzluk başlıkları
        tempSuppliers = tempSuppliers.filter(s => 
            s.name.toLowerCase().includes(term) || 
            s.product_group?.toLowerCase().includes(term) ||
            s.code?.toLowerCase().includes(term) ||
            s.address?.toLowerCase().includes(term) ||
            s.contact_person?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term) ||
            s.phone?.toLowerCase().includes(term) ||
            s.supplier_non_conformities?.some(nc => nc.title?.toLowerCase().includes(term) || nc.description?.toLowerCase().includes(term))
        );
    }
    if (filters.status !== 'all') {
        tempSuppliers = tempSuppliers.filter(s => s.status === filters.status);
    }
    if (filters.riskClass !== 'all') {
        tempSuppliers = tempSuppliers.filter(s => s.risk_class === filters.riskClass);
    }
    setFilteredSuppliers(tempSuppliers);
  }, [filters, mergedSuppliers]);

  const handleEditSupplier = useCallback((supplier, isAlternative = false) => {
    setSelectedSupplier(supplier);
    setIsNewAlternative(isAlternative);
    setFormModalOpen(true);
  }, []);

  const handleAddNewSupplier = useCallback(() => {
    setSelectedSupplier(null);
    setIsNewAlternative(false);
    setFormModalOpen(true);
  }, []);


  return (
    <div className="space-y-6">
      <SupplierFormModal
        isOpen={isFormModalOpen}
        setIsOpen={setFormModalOpen}
        supplier={selectedSupplier}
        refreshSuppliers={refreshData}
        allSuppliers={suppliers}
        isNewAlternative={isNewAlternative}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tedarikçi Kalite Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Tedarikçi performansınızı değerlendirin, denetleyin ve takip edin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAddNewSupplier}>
            <Plus className="w-4 h-4 mr-2" /> Yeni Tedarikçi
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 gap-1 overflow-x-auto">
            <TabsTrigger value="dashboard" className="text-xs md:text-sm"><BarChart className="w-4 h-4 mr-1 md:mr-2" />Genel Bakış</TabsTrigger>
            <TabsTrigger value="list" className="text-xs md:text-sm"><List className="w-4 h-4 mr-1 md:mr-2" />Tedarikçi Listesi</TabsTrigger>
            <TabsTrigger value="audits" className="text-xs md:text-sm"><CalendarCheck className="w-4 h-4 mr-1 md:mr-2" />Denetim Takibi</TabsTrigger>
            <TabsTrigger value="question-bank" className="text-xs md:text-sm"><HelpCircle className="w-4 h-4 mr-1 md:mr-2" />Soru Bankası</TabsTrigger>
            <TabsTrigger value="ncs" className="text-xs md:text-sm"><AlertTriangle className="w-4 h-4 mr-1 md:mr-2" />Uygunsuzluklar & DF</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs md:text-sm"><FileText className="w-4 h-4 mr-1 md:mr-2" />Dokümanlar</TabsTrigger>
            <TabsTrigger value="development" className="text-xs md:text-sm"><TrendingUp className="w-4 h-4 mr-1 md:mr-2" />Geliştirme</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
            <SupplierDashboard 
              suppliers={suppliers} 
              loading={loading} 
              refreshData={refreshData}
              allSuppliers={suppliers} />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
            <motion.div 
                className="dashboard-widget"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Onaylı Tedarikçi Listesi</h2>
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            const reportData = {
                                id: `supplier-list-${Date.now()}`,
                                title: 'Tedarikçi Listesi Raporu',
                                reportDate: new Date().toISOString(),
                                suppliers: filteredSuppliers.map((s, idx) => {
                                    const completedAudits = (s.supplier_audit_plans || [])
                                        .filter(a => a.status === 'Tamamlandı' && a.score !== null)
                                        .sort((a, b) => new Date(b.actual_date || b.planned_date) - new Date(a.actual_date || a.planned_date));
                                    const latestAuditScore = completedAudits.length > 0 ? completedAudits[0].score : null;
                                    const gradeInfo = getGradeInfo(latestAuditScore);
                                    const alternativeSupplier = s.alternative_to_supplier_id ? suppliers.find(main => main.id === s.alternative_to_supplier_id) : null;
                                    const alternativeSuppliers = suppliers.filter(alt => alt.alternative_to_supplier_id === s.id);
                                    return {
                                        ...s,
                                        serialNumber: idx + 1,
                                        gradeInfo,
                                        alternativeSupplier: alternativeSupplier ? { name: alternativeSupplier.name, id: alternativeSupplier.id } : null,
                                        alternativeSuppliers: alternativeSuppliers.map(alt => ({ name: alt.name, id: alt.id }))
                                    };
                                }),
                                totalCount: filteredSuppliers.length,
                                approvedCount: filteredSuppliers.filter(s => s.status === 'Onaylı').length,
                                alternativeCount: filteredSuppliers.filter(s => s.status === 'Alternatif').length
                            };
                            openPrintableReport(reportData, 'supplier_list', true);
                        }}
                        disabled={loading || filteredSuppliers.length === 0}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        PDF Rapor Oluştur
                    </Button>
                </div>
                <SupplierFilters filters={filters} setFilters={setFilters} />
                {loading ? (
                    <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
                ) : (
                <SupplierList 
                    suppliers={filteredSuppliers} 
                    allSuppliers={suppliers}
                    onEdit={handleEditSupplier} 
                    refreshSuppliers={refreshData}
                    onOpenNCForm={onOpenNCForm}
                />
                )}
            </motion.div>
        </TabsContent>
         <TabsContent value="audits" className="mt-6">
            <AuditTrackingTab suppliers={suppliers} loading={loading} refreshData={refreshData} onOpenPdfViewer={onOpenPdfViewer} />
        </TabsContent>
         <TabsContent value="question-bank" className="mt-6">
            <SupplierQuestionBank refreshData={refreshData} />
         </TabsContent>
        <TabsContent value="ncs" className="mt-6">
            <SupplierNCTab 
              allSuppliers={suppliers} 
              loading={loading} 
              onOpenNCForm={onOpenNCForm}
              onOpenNCView={onOpenNCView}
              refreshData={refreshData}
            />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
            <SupplierDocumentsTab 
              suppliers={suppliers} 
              loading={loading} 
              refreshData={refreshData}
            />
        </TabsContent>
        <TabsContent value="development" className="mt-6">
            <Tabs defaultValue="plans" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="plans">
                        <FileText className="w-4 h-4 mr-2" />
                        Geliştirme Planları
                    </TabsTrigger>
                    <TabsTrigger value="actions">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Aksiyonlar
                    </TabsTrigger>
                    <TabsTrigger value="assessments">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Değerlendirmeler
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="plans" className="mt-6">
                    <DevelopmentPlans />
                </TabsContent>
                <TabsContent value="actions" className="mt-6">
                    <DevelopmentActions />
                </TabsContent>
                <TabsContent value="assessments" className="mt-6">
                    <DevelopmentAssessments />
                </TabsContent>
            </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierQualityModule;
