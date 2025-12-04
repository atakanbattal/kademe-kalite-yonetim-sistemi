import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DMAICProjectsList from './DMAICProjectsList';
import DMAICPhaseView from './DMAICPhaseView';

const DMAICModule = () => {
    const [activeTab, setActiveTab] = useState('projects');

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <Target className="w-8 h-8" />
                    DMAIC Projeleri
                </h1>
                <p className="text-muted-foreground mt-1">
                    Define, Measure, Analyze, Improve, Control - Six Sigma Metodolojisi
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="projects">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Projeler
                    </TabsTrigger>
                    <TabsTrigger value="phases">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Aşamalar
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="projects" className="mt-6">
                    <DMAICProjectsList />
                </TabsContent>

                <TabsContent value="phases" className="mt-6">
                    <DMAICPhaseView />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

export default DMAICModule;

