import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DMAICModule = () => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">DMAIC Projeleri</h1>
                    <p className="text-muted-foreground mt-2">
                        Define, Measure, Analyze, Improve, Control metodolojisi ile sürekli iyileştirme projeleri
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>DMAIC Projeleri Modülü</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Bu modül yakında kullanıma sunulacaktır.
                    </p>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default DMAICModule;

