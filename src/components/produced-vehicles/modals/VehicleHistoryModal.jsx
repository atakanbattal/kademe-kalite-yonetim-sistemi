import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
                <DialogHeader>
                    <DialogTitle>Araç Geçmişi: {vehicleInfo?.vehicle_type} - {vehicleInfo?.serial_no}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-96">
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
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleHistoryModal;