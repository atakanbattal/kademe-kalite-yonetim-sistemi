import React from 'react';
import { User, Building, Factory, KeyRound, Users, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonnelManager from '@/components/cost-settings/PersonnelManager';
import UnitCosts from '@/components/cost-settings/UnitCosts';
import MaterialCosts from '@/components/cost-settings/MaterialCosts';
import AccountManager from '@/components/cost-settings/AccountManager';
import CustomerManager from '@/components/cost-settings/CustomerManager';
import ProductManager from '@/components/cost-settings/ProductManager';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const CostSettingsModule = () => {
    const { user, profile } = useAuth();
    const isSuperAdmin = user?.email === 'atakan.battal@kademe.com.tr';
    const hasAccountAccess = isSuperAdmin || (profile?.permissions?.['settings'] === 'full');

    return (
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
            <div className="mb-4 sm:mb-6 md:mb-8">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Genel Ayarlar</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Sistem genelindeki maliyetleri, personeli ve hesapları yönetin.</p>
            </div>

            <Tabs defaultValue={hasAccountAccess ? "accounts" : "personnel"} className="w-full">
                {/* Mobil için yatay scroll ile tabs */}
                <div className="w-full overflow-x-auto pb-2 -mx-1 px-1">
                    <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full gap-1" style={{ gridTemplateColumns: `repeat(${hasAccountAccess ? 6 : 5}, minmax(0, 1fr))` }}>
                        <TabsTrigger value="personnel" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" />
                            <span className="hidden xs:inline">Personel</span>
                            <span className="xs:hidden">👤</span>
                        </TabsTrigger>
                        <TabsTrigger value="products" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" />
                            <span className="hidden xs:inline">Ürün</span>
                            <span className="xs:hidden">📦</span>
                        </TabsTrigger>
                        <TabsTrigger value="customers" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" />
                            <span className="hidden xs:inline">Müşteri</span>
                            <span className="xs:hidden">👥</span>
                        </TabsTrigger>
                        <TabsTrigger value="units" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                            <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0"/>
                            <span className="hidden xs:inline">Birim</span>
                            <span className="xs:hidden">🏢</span>
                        </TabsTrigger>
                        <TabsTrigger value="materials" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                            <Factory className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0"/>
                            <span className="hidden xs:inline">Malzeme</span>
                            <span className="xs:hidden">🏭</span>
                        </TabsTrigger>
                        {hasAccountAccess && (
                            <TabsTrigger value="accounts" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                                <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0"/>
                                <span className="hidden xs:inline">Hesap</span>
                                <span className="xs:hidden">🔑</span>
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>
                <TabsContent value="personnel" className="mt-6">
                    <PersonnelManager />
                </TabsContent>
                <TabsContent value="products" className="mt-6">
                    <ProductManager />
                </TabsContent>
                <TabsContent value="customers" className="mt-6">
                    <CustomerManager />
                </TabsContent>
                <TabsContent value="units" className="mt-6">
                    <UnitCosts />
                </TabsContent>
                <TabsContent value="materials" className="mt-6">
                    <MaterialCosts />
                </TabsContent>
                {hasAccountAccess && (
                    <TabsContent value="accounts" className="mt-6">
                        <AccountManager />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default CostSettingsModule;