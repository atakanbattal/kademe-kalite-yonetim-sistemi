import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, BarChart, List, AlertTriangle, CalendarCheck, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from '@/contexts/DataContext';

import SupplierDashboard from '@/components/supplier/SupplierDashboard';
import SupplierList from '@/components/supplier/SupplierList';
import SupplierFilters from '@/components/supplier/SupplierFilters';
import SupplierFormModal from '@/components/supplier/SupplierFormModal';
import SupplierNCTab from '@/components/supplier/SupplierNCTab';
import AuditTrackingTab from '@/components/supplier/AuditTrackingTab';
import SupplierQuestionBank from '@/components/supplier/SupplierQuestionBank';


const SupplierQualityModule = ({ onOpenNCForm, onOpenNCView, onOpenPdfViewer }) => {
  const { suppliers, nonConformities, loading, refreshData } = useData();
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [filters, setFilters] = useState({
    searchTerm: '',
    status: 'all',
    riskClass: 'all'
  });

  const mergedSuppliers = useMemo(() => {
    return suppliers.map(s => {
      const supplierNcs = nonConformities.filter(nc => nc.supplier_id === s.id);
      return {
        ...s,
        supplier_non_conformities: supplierNcs
      };
    });
  }, [suppliers, nonConformities]);

  useEffect(() => {
    let tempSuppliers = [...mergedSuppliers];
    if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        tempSuppliers = tempSuppliers.filter(s => s.name.toLowerCase().includes(term) || s.product_group?.toLowerCase().includes(term));
    }
    if (filters.status !== 'all') {
        tempSuppliers = tempSuppliers.filter(s => s.status === filters.status);
    }
    if (filters.riskClass !== 'all') {
        tempSuppliers = tempSuppliers.filter(s => s.risk_class === filters.riskClass);
    }
    setFilteredSuppliers(tempSuppliers);
  }, [filters, mergedSuppliers]);


  const handleEditSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setFormModalOpen(true);
  };

  const handleAddNewSupplier = () => {
    setSelectedSupplier(null);
    setFormModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <SupplierFormModal
        isOpen={isFormModalOpen}
        setIsOpen={setFormModalOpen}
        supplier={selectedSupplier}
        refreshSuppliers={refreshData}
        allSuppliers={suppliers}
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
        <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard"><BarChart className="w-4 h-4 mr-2" />Genel Bakış</TabsTrigger>
            <TabsTrigger value="list"><List className="w-4 h-4 mr-2" />Tedarikçi Listesi</TabsTrigger>
            <TabsTrigger value="audits"><CalendarCheck className="w-4 h-4 mr-2" />Denetim Takibi</TabsTrigger>
            <TabsTrigger value="question-bank"><HelpCircle className="w-4 h-4 mr-2" />Soru Bankası</TabsTrigger>
            <TabsTrigger value="ncs"><AlertTriangle className="w-4 h-4 mr-2" />Uygunsuzluklar & DF</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
            <SupplierDashboard 
              suppliers={suppliers} 
              loading={loading} 
              refreshData={refreshData} />
        </TabsContent>
        <TabsContent value="list" className="mt-6">
            <motion.div 
                className="dashboard-widget"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <h2 className="text-xl font-semibold text-foreground mb-4">Onaylı Tedarikçi Listesi</h2>
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
            <SupplierQuestionBank />
        </TabsContent>
        <TabsContent value="ncs" className="mt-6">
            <SupplierNCTab 
              allSuppliers={suppliers} 
              loading={loading} 
              onOpenNCForm={onOpenNCForm}
              onOpenNCView={onOpenNCView}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupplierQualityModule;