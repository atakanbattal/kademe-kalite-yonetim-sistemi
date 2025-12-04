import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, FileText, Compare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrendAnalysis from './TrendAnalysis';
import ForecastAnalysis from './ForecastAnalysis';
import ComparisonAnalysis from './ComparisonAnalysis';
import CustomReports from './CustomReports';

const AdvancedAnalyticsModule = () => {
    const [activeTab, setActiveTab] = useState('trends');

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Başlık */}
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-8 h-8" />
                    Gelişmiş Kalite Veri Analizi
                </h1>
                <p className="text-muted-foreground mt-1">
                    Trend analizi, tahminleme ve karşılaştırma raporları
                </p>
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="trends">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Trend Analizi
                    </TabsTrigger>
                    <TabsTrigger value="forecast">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Tahminleme
                    </TabsTrigger>
                    <TabsTrigger value="comparison">
                        <Compare className="w-4 h-4 mr-2" />
                        Karşılaştırma
                    </TabsTrigger>
                    <TabsTrigger value="reports">
                        <FileText className="w-4 h-4 mr-2" />
                        Özel Raporlar
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="trends" className="mt-6">
                    <TrendAnalysis />
                </TabsContent>

                <TabsContent value="forecast" className="mt-6">
                    <ForecastAnalysis />
                </TabsContent>

                <TabsContent value="comparison" className="mt-6">
                    <ComparisonAnalysis />
                </TabsContent>

                <TabsContent value="reports" className="mt-6">
                    <CustomReports />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default AdvancedAnalyticsModule;

