import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, FileCheck2 } from 'lucide-react';
import TemplatesTab from '@/components/control-forms/TemplatesTab';
import ExecutionsTab from '@/components/control-forms/ExecutionsTab';

const ControlFormsModule = () => {
    const [activeTab, setActiveTab] = useState('templates');

    return (
        <div className="space-y-4 sm:space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="templates" className="gap-2">
                        <ClipboardCheck className="w-4 h-4" />
                        <span>Form Şablonları</span>
                    </TabsTrigger>
                    <TabsTrigger value="executions" className="gap-2">
                        <FileCheck2 className="w-4 h-4" />
                        <span>Kontrol Kayıtları</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="templates" className="mt-6">
                    <TemplatesTab />
                </TabsContent>
                <TabsContent value="executions" className="mt-6">
                    <ExecutionsTab />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ControlFormsModule;
