import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SupplierPortal from '@/components/supplier/SupplierPortal';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const SupplierPortalPage = () => {
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const [token, setToken] = useState(null);
    const [supplierId, setSupplierId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        const supplierIdParam = searchParams.get('supplier_id');

        if (tokenParam && supplierIdParam) {
            // Token doğrulama
            verifyToken(tokenParam, supplierIdParam);
        } else {
            toast({
                variant: 'destructive',
                title: 'Geçersiz Link',
                description: 'Portal linki geçersiz veya eksik parametreler içeriyor.'
            });
            setLoading(false);
        }
    }, [searchParams, toast]);

    const verifyToken = async (tokenValue, supplierIdValue) => {
        try {
            // Token doğrulama mantığı (basit bir kontrol)
            // Gerçek uygulamada daha güvenli bir token sistemi kullanılmalı
            const { data, error } = await supabase
                .from('suppliers')
                .select('id')
                .eq('id', supplierIdValue)
                .single();

            if (error) throw error;

            setToken(tokenValue);
            setSupplierId(supplierIdValue);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Doğrulama Hatası',
                description: 'Token doğrulanamadı: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Yükleniyor...</p>
            </div>
        );
    }

    if (!token || !supplierId) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Geçersiz Portal Linki</h1>
                    <p className="text-muted-foreground">
                        Bu portal linki geçersiz veya süresi dolmuş olabilir.
                    </p>
                </div>
            </div>
        );
    }

    return <SupplierPortal token={token} supplierId={supplierId} />;
};

export default SupplierPortalPage;

