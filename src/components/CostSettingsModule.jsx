import React from 'react';
import { User, Building, Factory, KeyRound } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonnelManager from '@/components/cost-settings/PersonnelManager';
import UnitCosts from '@/components/cost-settings/UnitCosts';
import MaterialCosts from '@/components/cost-settings/MaterialCosts';
import AccountManager from '@/components/cost-settings/AccountManager';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const CostSettingsModule = () => {
    const { user } = useAuth();
    const isSuperAdmin = user?.email === 'atakan.battal@kademe.com.tr';

    return (
        <div className="space-y-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">Genel Ayarlar</h1>
                <p className="text-muted-foreground mt-1">Sistem genelindeki maliyetleri, personeli ve hesapları yönetin.</p>
            </div>

            <Tabs defaultValue="personnel" className="w-full">
                <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <TabsTrigger value="personnel"><User className="w-4 h-4 mr-2" />Personel Yönetimi</TabsTrigger>
                    <TabsTrigger value="units"><Building className="w-4 h-4 mr-2"/>Birim Maliyetleri</TabsTrigger>
                    <TabsTrigger value="materials"><Factory className="w-4 h-4 mr-2"/>Malzeme Maliyetleri</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="accounts"><KeyRound className="w-4 h-4 mr-2"/>Hesap Yönetimi</TabsTrigger>}
                </TabsList>
                <TabsContent value="personnel" className="mt-6">
                    <PersonnelManager />
                </TabsContent>
                <TabsContent value="units" className="mt-6">
                    <UnitCosts />
                </TabsContent>
                <TabsContent value="materials" className="mt-6">
                    <MaterialCosts />
                </TabsContent>
                {isSuperAdmin && (
                    <TabsContent value="accounts" className="mt-6">
                        <AccountManager />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default CostSettingsModule;