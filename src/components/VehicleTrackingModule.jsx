import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Car, Search, GitMerge, AlertCircle, CheckCircle, MoreVertical } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const VehicleTrackingModule = () => {
    const { toast } = useToast();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchVehicleData = useCallback(async () => {
        setLoading(true);
        // Fetch vehicles and related non-conformities count
        const { data, error } = await supabase.from('produced_vehicles').select(`
            *,
            vehicle_non_conformities ( id )
        `).order('production_date', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Araç verileri alınamadı.' });
            setVehicles([]);
        } else {
            const vehicleDataWithDefects = data.map(v => ({
                ...v,
                defects: v.vehicle_non_conformities.length
            }));
            setVehicles(vehicleDataWithDefects);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchVehicleData();
    }, [fetchVehicleData]);


    const handleAction = () => {
        toast({
            title: "🚧 Özellik Henüz Geliştirilmedi!",
            description: "Ama endişelenmeyin! Bir sonraki isteğinizde bu özelliği talep edebilirsiniz! 🚀",
        });
    };

     const getStatusColor = (status) => {
        const colors = {
            'Planlandı': 'bg-gray-100 text-gray-800',
            'Üretimde': 'bg-blue-100 text-blue-800',
            'Montaj': 'bg-cyan-100 text-cyan-800',
            'Boya': 'bg-indigo-100 text-indigo-800',
            'Son Kontrol': 'bg-yellow-100 text-yellow-800',
            'Rework': 'bg-orange-100 text-orange-800',
            'Sevke Hazır': 'bg-purple-100 text-purple-800',
            'Sevk Edildi': 'bg-green-100 text-green-800',
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Kalite Takip Modülü</h1>
                    <p className="text-white/80 mt-1">Araç bazlı kalite durumunu ve performansını takip edin.</p>
                </div>
                 <div className="relative mt-4 sm:mt-0 w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80" />
                    <Input placeholder="Şasi no veya araç tipi ara..." className="pl-9" />
                </div>
            </div>
      
            <div className="dashboard-widget">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Şasi No</th>
                                <th>Araç Tipi</th>
                                <th>Durum</th>
                                <th>Uygunsuzluk Sayısı</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center p-8 text-white/80">Yükleniyor...</td></tr>
                            ) : vehicles.length === 0 ? (
                                 <tr><td colSpan="5" className="text-center p-8 text-white/80">Takip edilecek araç bulunamadı.</td></tr>
                            ) : (
                                vehicles.map((vehicle, index) => (
                                    <motion.tr
                                        key={vehicle.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                    >
                                        <td className="font-medium text-white">{vehicle.chassis_no}</td>
                                        <td className="text-white">{vehicle.vehicle_type}</td>
                                        <td className="text-white">{new Date(vehicle.status).toLocaleDateString('tr-TR')}</td>
                                        <td>
                                            <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${vehicle.defects > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {vehicle.defects}
                                            </div>
                                        </td>
                                        <td>
                                            <Button variant="ghost" size="icon" onClick={handleAction}>
                                                <MoreVertical className="h-4 w-4 text-white" />
                                            </Button>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VehicleTrackingModule;