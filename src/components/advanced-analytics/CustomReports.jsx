import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const CustomReports = () => {
    const { toast } = useToast();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            // Özel raporlar tablosu yoksa boş liste döndür
            const { data, error } = await supabase
                .from('quality_analytics_reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // Tablo yoksa sessizce boş liste döndür
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    setReports([]);
                    return;
                }
                throw error;
            }
            setReports(data || []);
        } catch (error) {
            console.error('Reports loading error:', error);
            // Tablo yoksa hata gösterme, sadece boş liste göster
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                setReports([]);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Raporlar yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Özel Raporlar</CardTitle>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Rapor
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz özel rapor oluşturulmamış.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {reports.map((report) => (
                                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <h4 className="font-semibold">{report.report_name}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {report.report_type} | {new Date(report.created_at).toLocaleDateString('tr-TR')}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        Görüntüle
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomReports;

