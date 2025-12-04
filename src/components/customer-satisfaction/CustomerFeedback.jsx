import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const CustomerFeedback = () => {
    const { toast } = useToast();
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFeedback();
    }, []);

    const loadFeedback = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_feedback')
                .select(`
                    *,
                    customers!customer_id(customer_name, customer_code)
                `)
                .order('feedback_date', { ascending: false });

            if (error) throw error;
            setFeedback(data || []);
        } catch (error) {
            console.error('Feedback loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Geri bildirimler yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Müşteri Geri Bildirimleri</CardTitle>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Geri Bildirim
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : feedback.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz geri bildirim kaydı yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {feedback.map((item) => (
                                <div key={item.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold">{item.subject}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {item.customers?.customer_name} | {new Date(item.feedback_date).toLocaleDateString('tr-TR')}
                                            </p>
                                        </div>
                                        <Badge variant={item.status === 'Çözüldü' ? 'success' : 'default'}>
                                            {item.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomerFeedback;

