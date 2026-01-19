import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, BarChart, List, AlertTriangle, CalendarCheck, HelpCircle, FileText, TrendingUp, CheckCircle2, Printer, BarChart3, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useData } from '@/contexts/DataContext';
import { openPrintableReport } from '@/lib/reportUtils';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';

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
  const { suppliers, nonConformities, loading, refreshData, incomingInspections } = useData();
  const { toast } = useToast();
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isNewAlternative, setIsNewAlternative] = useState(false);
  const [isReportSelectionModalOpen, setIsReportSelectionModalOpen] = useState(false);
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

  const handleOpenReportModal = useCallback(() => {
    if (suppliers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Rapor oluşturmak için en az bir tedarikçi kaydı olmalıdır.',
      });
      return;
    }
    setIsReportSelectionModalOpen(true);
  }, [suppliers.length, toast]);

  const handleGenerateExecutiveReport = useCallback(async () => {
    if (suppliers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Rapor oluşturmak için en az bir tedarikçi kaydı olmalıdır.',
      });
      return;
    }

    const formatDate = (dateInput) => {
      if (!dateInput) return '-';
      try {
        const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(dateObj.getTime())) return '-';
        return format(dateObj, 'dd.MM.yyyy', { locale: tr });
      } catch {
        return '-';
      }
    };

    try {
      // Tüm tedarikçi verilerini detaylı olarak çek
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select(`
          *,
          supplier_non_conformities:non_conformities!non_conformities_supplier_id_fkey(*),
          supplier_audit_plans:supplier_audit_plans(*),
          supplier_certificates:supplier_certificates(*),
          supplier_development_plans:supplier_development_plans(*)
        `);

      if (suppliersError) throw suppliersError;

      const allSuppliers = suppliersData || suppliers;
      const allNCs = nonConformities || [];
      const allInspections = incomingInspections || [];

      // Genel istatistikler
      const totalSuppliers = allSuppliers.length;
      const approvedSuppliers = allSuppliers.filter(s => s.status === 'Onaylı').length;
      const alternativeSuppliers = allSuppliers.filter(s => s.status === 'Alternatif').length;
      const suspendedSuppliers = allSuppliers.filter(s => s.status === 'Askıya Alınmış').length;
      const rejectedSuppliers = allSuppliers.filter(s => s.status === 'Red').length;

      // Uygunsuzluk analizi
      const totalNCs = allNCs.filter(nc => nc.supplier_id).length;
      const openNCs = allNCs.filter(nc => nc.supplier_id && nc.status === 'Açık').length;
      const closedNCs = allNCs.filter(nc => nc.supplier_id && nc.status === 'Kapatıldı').length;
      const ncBySupplier = {};
      allNCs.filter(nc => nc.supplier_id).forEach(nc => {
        if (!ncBySupplier[nc.supplier_id]) {
          ncBySupplier[nc.supplier_id] = { total: 0, open: 0, closed: 0 };
        }
        ncBySupplier[nc.supplier_id].total++;
        if (nc.status === 'Açık') ncBySupplier[nc.supplier_id].open++;
        if (nc.status === 'Kapatıldı') ncBySupplier[nc.supplier_id].closed++;
      });

      // En çok uygunsuzluk olan tedarikçiler (Top 10)
      const topNCSuppliers = Object.entries(ncBySupplier)
        .map(([supplierId, data]) => {
          const supplier = allSuppliers.find(s => s.id === supplierId);
          return {
            supplierName: supplier?.name || 'Bilinmeyen',
            totalNCs: data.total,
            openNCs: data.open,
            closedNCs: data.closed
          };
        })
        .sort((a, b) => b.totalNCs - a.totalNCs)
        .slice(0, 10);

      // Denetim analizi
      const allAudits = allSuppliers.flatMap(s => (s.supplier_audit_plans || []).map(a => ({ ...a, supplierName: s.name })));
      const completedAudits = allAudits.filter(a => a.status === 'Tamamlandı' && a.score !== null);
      const plannedAudits = allAudits.filter(a => a.status === 'Planlandı');
      const inProgressAudits = allAudits.filter(a => a.status === 'Devam Ediyor');
      const averageAuditScore = completedAudits.length > 0
        ? completedAudits.reduce((sum, a) => sum + (a.score || 0), 0) / completedAudits.length
        : 0;

      // En düşük skorlu tedarikçiler (Top 10)
      const supplierScores = {};
      allSuppliers.forEach(s => {
        const completedAudits = (s.supplier_audit_plans || [])
          .filter(a => a.status === 'Tamamlandı' && a.score !== null)
          .sort((a, b) => new Date(b.actual_date || b.planned_date) - new Date(a.actual_date || a.planned_date));
        if (completedAudits.length > 0) {
          supplierScores[s.id] = {
            name: s.name,
            score: completedAudits[0].score,
            grade: getGradeInfo(completedAudits[0].score).grade
          };
        }
      });
      const topLowScoreSuppliers = Object.values(supplierScores)
        .sort((a, b) => a.score - b.score)
        .slice(0, 10);

      // Sertifika analizi
      const allCertificates = allSuppliers.flatMap(s => (s.supplier_certificates || []).map(c => ({ ...c, supplierName: s.name })));
      const expiringCerts = allCertificates.filter(c => {
        if (!c.valid_until) return false;
        const validUntil = new Date(c.valid_until);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return validUntil < thirtyDaysFromNow && validUntil > new Date();
      });
      const expiredCerts = allCertificates.filter(c => {
        if (!c.valid_until) return false;
        return new Date(c.valid_until) < new Date();
      });

      // Geliştirme planları analizi
      const allDevPlans = allSuppliers.flatMap(s => (s.supplier_development_plans || []).map(p => ({ ...p, supplierName: s.name })));
      const plannedDevPlans = allDevPlans.filter(p => p.current_status === 'Planlanan');
      const inProgressDevPlans = allDevPlans.filter(p => p.current_status === 'Devam Eden');
      const completedDevPlans = allDevPlans.filter(p => p.current_status === 'Tamamlanan');

      // PPM analizi (giriş kalite kontrolünden)
      const supplierPerformance = {};
      allInspections.forEach(inspection => {
        if (!inspection.supplier_id || !inspection.inspection_date) return;
        const inspected = Number(inspection.quantity_received) || 0;
        if (inspected === 0) return;
        const defective = (Number(inspection.quantity_rejected) || 0) + (Number(inspection.quantity_conditional) || 0);
        if (!supplierPerformance[inspection.supplier_id]) {
          supplierPerformance[inspection.supplier_id] = { inspected: 0, defective: 0 };
        }
        supplierPerformance[inspection.supplier_id].inspected += inspected;
        supplierPerformance[inspection.supplier_id].defective += defective;
      });
      const supplierPPM = Object.entries(supplierPerformance)
        .map(([supplierId, data]) => {
          const supplier = allSuppliers.find(s => s.id === supplierId);
          const ppm = data.inspected > 0 ? Math.round((data.defective / data.inspected) * 1000000) : 0;
          return {
            supplierName: supplier?.name || 'Bilinmeyen',
            ppm,
            inspected: data.inspected,
            defective: data.defective
          };
        })
        .filter(item => item.ppm > 0)
        .sort((a, b) => b.ppm - a.ppm)
        .slice(0, 10);

      const totalInspected = Object.values(supplierPerformance).reduce((sum, d) => sum + d.inspected, 0);
      const totalDefective = Object.values(supplierPerformance).reduce((sum, d) => sum + d.defective, 0);
      const overallPPM = totalInspected > 0 ? Math.round((totalDefective / totalInspected) * 1000000) : 0;

      // Notlar analizi (DF açılan tedarikçiler)
      const suppliersWithDF = {};
      allNCs.filter(nc => nc.supplier_id && nc.nc_type === 'DF').forEach(nc => {
        if (!suppliersWithDF[nc.supplier_id]) {
          suppliersWithDF[nc.supplier_id] = {
            supplierName: allSuppliers.find(s => s.id === nc.supplier_id)?.name || 'Bilinmeyen',
            dfCount: 0,
            openDFs: 0
          };
        }
        suppliersWithDF[nc.supplier_id].dfCount++;
        if (nc.status === 'Açık') suppliersWithDF[nc.supplier_id].openDFs++;
      });
      const topDFSuppliers = Object.values(suppliersWithDF)
        .sort((a, b) => b.dfCount - a.dfCount)
        .slice(0, 10);

      // Rapor verisi
      const reportData = {
        id: `supplier-quality-executive-${Date.now()}`,
        totalSuppliers,
        approvedSuppliers,
        alternativeSuppliers,
        suspendedSuppliers,
        rejectedSuppliers,
        totalNCs,
        openNCs,
        closedNCs,
        topNCSuppliers,
        completedAudits: completedAudits.length,
        plannedAudits: plannedAudits.length,
        inProgressAudits: inProgressAudits.length,
        averageAuditScore: Math.round(averageAuditScore * 100) / 100,
        topLowScoreSuppliers,
        expiringCerts: expiringCerts.length,
        expiredCerts: expiredCerts.length,
        plannedDevPlans: plannedDevPlans.length,
        inProgressDevPlans: inProgressDevPlans.length,
        completedDevPlans: completedDevPlans.length,
        supplierPPM,
        overallPPM,
        topDFSuppliers,
        reportDate: formatDate(new Date())
      };

      openPrintableReport(reportData, 'supplier_quality_executive_summary', true);

      toast({
        title: 'Başarılı',
        description: 'Yönetici özeti raporu oluşturuldu.',
      });
    } catch (error) {
      console.error('Rapor oluşturulurken hata:', error);
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Rapor oluşturulurken hata oluştu: ' + (error.message || 'Bilinmeyen hata'),
      });
    }
  }, [suppliers, nonConformities, incomingInspections, toast]);

  const handleSelectReportType = useCallback((reportType) => {
    setIsReportSelectionModalOpen(false);
    if (reportType === 'executive') {
      handleGenerateExecutiveReport();
    }
  }, [handleGenerateExecutiveReport]);


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

      {/* Rapor Seçim Modalı */}
      <Dialog open={isReportSelectionModalOpen} onOpenChange={setIsReportSelectionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Rapor Türü Seçin
            </DialogTitle>
            <DialogDescription>
              Oluşturmak istediğiniz rapor türünü seçin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <button
              onClick={() => handleSelectReportType('executive')}
              className="flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all cursor-pointer text-left group"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1 text-foreground">Yönetici Özeti Raporu</h3>
                <p className="text-sm text-muted-foreground">
                  Tedarikçi performans analizi, uygunsuzluklar, denetimler, sertifikalar, geliştirme planları ve PPM analizi içeren kapsamlı özet rapor.
                </p>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportSelectionModalOpen(false)}>
              İptal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tedarikçi Kalite Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Tedarikçi performansınızı değerlendirin, denetleyin ve takip edin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenReportModal} variant="outline">
            <FileText className="w-4 h-4 mr-2" /> Rapor Al
          </Button>
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
