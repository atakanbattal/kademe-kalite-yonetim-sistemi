import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Smile, BarChart3, MessageSquare, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SatisfactionSurveys from './SatisfactionSurveys';
import NPSScore from './NPSScore';
import CustomerFeedback from './CustomerFeedback';
import SatisfactionTrends from './SatisfactionTrends';

const CustomerSatisfactionModule = () => {
    const [activeTab, setActiveTab] = useState('surveys');

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <Smile className="w-8 h-8" />
                    Müşteri Memnuniyeti
                </h1>
                <p className="text-muted-foreground mt-1">
                    NPS, CSAT skorları ve müşteri geri bildirimleri
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="surveys">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Anketler
                    </TabsTrigger>
                    <TabsTrigger value="nps">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        NPS Skoru
                    </TabsTrigger>
                    <TabsTrigger value="feedback">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Geri Bildirimler
                    </TabsTrigger>
                    <TabsTrigger value="trends">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Trendler
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="surveys" className="mt-6">
                    <SatisfactionSurveys />
                </TabsContent>

                <TabsContent value="nps" className="mt-6">
                    <NPSScore />
                </TabsContent>

                <TabsContent value="feedback" className="mt-6">
                    <CustomerFeedback />
                </TabsContent>

                <TabsContent value="trends" className="mt-6">
                    <SatisfactionTrends />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default CustomerSatisfactionModule;

