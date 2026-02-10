import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { History } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const VehicleHistoryModal = ({ isOpen, setIsOpen, vehicleId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vehicleInfo, setVehicleInfo] = useState(null);

    useEffect(() => {
        if (isOpen && vehicleId) {
            const fetchHistory = async () => {
                setLoading(true);
                
                const { data: vehicleData, error: vehicleError } = await supabase
                    .from('quality_inspections')
                    .select('vehicle_type, serial_no')
                    .eq('id', vehicleId)
                    .single();

                if (vehicleError) console.error("Araç bilgisi alınamadı:", vehicleError);
                else setVehicleInfo(vehicleData);

                const { data, error } = await supabase
                    .from('quality_inspection_history')
                    .select('*')
                    .eq('inspection_id', vehicleId)
                    .order('changed_at', { ascending: false });
                
                if (error) {
                    console.error("Geçmiş verileri alınamadı:", error);
                    setHistory([]);
                } else {
                    setHistory(data);
                }
                setLoading(false);
            };
            fetchHistory();
        }
    }, [isOpen, vehicleId]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><History className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Araç Geçmişi: {vehicleInfo?.vehicle_type} - {vehicleInfo?.serial_no}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Geçmiş kayıtları</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Geçmiş</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    {loading ? <p>Yükleniyor...</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Değiştiren</TableHead>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Notlar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.status}</TableCell>
                                        <TableCell>{item.changed_by_name || 'Sistem'}</TableCell>
                                        <TableCell>{new Date(item.changed_at).toLocaleString()}</TableCell>
                                        <TableCell>{item.notes}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleHistoryModal;