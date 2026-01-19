import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Routes, Route } from 'react-router-dom';

import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { NCFormProvider } from '@/contexts/NCFormContext';
import { Toaster } from '@/components/ui/toaster';

import Login from '@/pages/Login';
import SupplierPortalPage from '@/pages/SupplierPortalPage';
import PrintableReport from '@/pages/PrintableReport';
import PrintableDashboardReport from '@/pages/PrintableDashboardReport';
import PrintableInternalAuditDashboard from '@/pages/PrintableInternalAuditDashboard';

import AuthProtected from '@/components/auth/AuthProtected';
import MainLayout from '@/components/layout/MainLayout';

function App() {
    return (
        <HelmetProvider>
            <AuthProvider>
                <DataProvider>
                    <NCFormProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/supplier-portal" element={<SupplierPortalPage />} />
                            <Route path="/print/report/:type/:id" element={<AuthProtected><PrintableReport /></AuthProtected>} />
                            <Route path="/print/dashboard-report" element={<AuthProtected><PrintableDashboardReport /></AuthProtected>} />
                            <Route path="/print/internal-audit-dashboard" element={<AuthProtected><PrintableInternalAuditDashboard /></AuthProtected>} />
                            <Route path="/*" element={
                                <AuthProtected>
                                    <MainLayout />
                                </AuthProtected>
                            } />
                        </Routes>
                    </NCFormProvider>
                </DataProvider>
                <Toaster />
            </AuthProvider>
        </HelmetProvider>
    );
}

export default App;