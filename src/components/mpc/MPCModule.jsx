import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, Target, Activity, Package,
    BarChart3, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductionPlans from './ProductionPlans';
import CriticalCharacteristics from './CriticalCharacteristics';
import ProcessParameters from './ProcessParameters';
import LotTraceability from './LotTraceability';

const MPCModule = () => {
    const [activeTab, setActiveTab] = useState('plans');

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        <Calendar className="w-8 h-8" />
                        Üretim Planlama ve Kontrolü (MPC)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Üretim planları, kritik karakteristikler, proses parametreleri ve lot takibi
                    </p>
                </div>
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="plans">
                        <Calendar className="w-4 h-4 mr-2" />
                        Üretim Planları
                    </TabsTrigger>
                    <TabsTrigger value="characteristics">
                        <Target className="w-4 h-4 mr-2" />
                        Kritik Karakteristikler
                    </TabsTrigger>
                    <TabsTrigger value="parameters">
                        <Activity className="w-4 h-4 mr-2" />
                        Proses Parametreleri
                    </TabsTrigger>
                    <TabsTrigger value="traceability">
                        <Package className="w-4 h-4 mr-2" />
                        Lot/Seri Takibi
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="plans" className="mt-6">
                    <ProductionPlans />
                </TabsContent>

                <TabsContent value="characteristics" className="mt-6">
                    <CriticalCharacteristics />
                </TabsContent>

                <TabsContent value="parameters" className="mt-6">
                    <ProcessParameters />
                </TabsContent>

                <TabsContent value="traceability" className="mt-6">
                    <LotTraceability />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default MPCModule;

