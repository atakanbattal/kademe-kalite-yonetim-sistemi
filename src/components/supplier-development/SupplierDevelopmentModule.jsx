import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, FileText, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DevelopmentPlans from './DevelopmentPlans';
import DevelopmentActions from './DevelopmentActions';
import DevelopmentAssessments from './DevelopmentAssessments';

const SupplierDevelopmentModule = () => {
    const [activeTab, setActiveTab] = useState('plans');

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-8 h-8" />
                    Tedarikçi Geliştirme
                </h1>
                <p className="text-muted-foreground mt-1">
                    Tedarikçi geliştirme planları ve aksiyon takibi
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
        </motion.div>
    );
};

export default SupplierDevelopmentModule;

