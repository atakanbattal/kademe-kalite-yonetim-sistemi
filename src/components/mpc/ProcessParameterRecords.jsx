import React, { useState, useCallback } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ProcessParameterRecordFormModal from './ProcessParameterRecordFormModal';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine } from 'recharts';

const ProcessParameterRecords = ({ parameterId, onClose }) => {
    const { toast } = useToast();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    const loadRecords = useCallback(async () => {
        if (!parameterId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('process_parameter_records')
                .select(`
                    *,
                    operator:operator_id(full_name)
                `)
                .eq('parameter_id', parameterId)
                .order('record_date', { ascending: false })
                .limit(100);

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Parameter records loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Parametre kayıtları yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [parameterId, toast]);

    React.useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const openFormModal = (record = null) => {
        setEditingRecord(record);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingRecord(null);
        setFormModalOpen(false);
        loadRecords();
    };

    // Grafik verisi hazırla
    const chartData = records.slice().reverse().map((r, idx) => ({
        index: idx + 1,
        value: parseFloat(r.recorded_value),
        date: new Date(r.record_date).toLocaleDateString('tr-TR'),
        isOutOfSpec: r.is_out_of_spec
    }));

    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Parametre Kayıtları</CardTitle>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Kayıt
                        </Button>
                        <Button size="sm" variant="outline" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : records.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Henüz kayıt bulunmuyor.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Grafik */}
                        {chartData.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-4">Trend Grafiği</h4>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="index" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#8884d8" 
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Kayıt Listesi */}
                        <div>
                            <h4 className="font-semibold mb-4">Son Kayıtlar</h4>
                            <div className="space-y-2">
                                {records.slice(0, 20).map((record) => (
                                    <div 
                                        key={record.id} 
                                        className={`p-3 border rounded-lg ${record.is_out_of_spec ? 'bg-red-50 border-red-200' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{record.recorded_value}</span>
                                                    {record.is_out_of_spec && (
                                                        <Badge variant="destructive">
                                                            <AlertCircle className="w-3 h-3 mr-1" />
                                                            Limit Dışı
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {new Date(record.record_date).toLocaleString('tr-TR')} | 
                                                    {record.shift && ` Shift: ${record.shift} |`}
                                                    {record.personnel && ` Operatör: ${record.personnel.full_name}`}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openFormModal(record)}
                                            >
                                                Düzenle
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>

            {isFormModalOpen && (
                <ProcessParameterRecordFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingRecord={editingRecord}
                    parameterId={parameterId}
                    onSuccess={closeFormModal}
                />
            )}
        </Card>
    );
};

export default ProcessParameterRecords;

