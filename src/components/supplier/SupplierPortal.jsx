import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const SupplierPortal = ({ token, supplierId }) => {
    const { toast } = useToast();
    const [supplier, setSupplier] = useState(null);
    const [ncRequests, setNcRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedNC, setSelectedNC] = useState(null);
    const [eightDSteps, setEightDSteps] = useState({});
    const [files, setFiles] = useState([]);

    useEffect(() => {
        if (token && supplierId) {
            loadSupplierData();
            loadNCRequests();
        }
    }, [token, supplierId]);

    const loadSupplierData = async () => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', supplierId)
                .single();

            if (error) throw error;
            setSupplier(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Tedarikçi bilgileri yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const loadNCRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('supplier_non_conformities')
                .select('*, source_nc:non_conformities(*)')
                .eq('supplier_id', supplierId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNcRequests(data || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Uygunsuzluk talepleri yüklenemedi: ' + error.message
            });
        }
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const handleRemoveFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleStepChange = (stepKey, field, value) => {
        setEightDSteps(prev => ({
            ...prev,
            [stepKey]: {
                ...prev[stepKey],
                [field]: value
            }
        }));
    };

    const handleSubmit8D = async () => {
        if (!selectedNC) return;

        setSubmitting(true);
        try {
            // Dosyaları yükle
            const uploadedFiles = [];
            for (const file of files) {
                const filePath = `supplier-8d/${supplierId}/${selectedNC.id}/${Date.now()}-${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('df_attachments')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;
                uploadedFiles.push(filePath);
            }

            // 8D adımlarını kaydet
            const { error: updateError } = await supabase
                .from('supplier_non_conformities')
                .update({
                    eight_d_steps: eightDSteps,
                    eight_d_attachments: uploadedFiles,
                    eight_d_submitted_at: new Date().toISOString(),
                    status: '8D Gönderildi'
                })
                .eq('id', selectedNC.id);

            if (updateError) throw updateError;

            toast({
                title: 'Başarılı',
                description: '8D formu başarıyla gönderildi.'
            });

            setSelectedNC(null);
            setEightDSteps({});
            setFiles([]);
            loadNCRequests();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: '8D formu gönderilemedi: ' + error.message
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Tedarikçi Portalı</CardTitle>
                        <CardDescription>
                            {supplier?.name} - 8D Formu Gönderme Portalı
                        </CardDescription>
                    </CardHeader>
                </Card>

                <Tabs defaultValue="requests" className="w-full">
                    <TabsList>
                        <TabsTrigger value="requests">8D Talepleri</TabsTrigger>
                        <TabsTrigger value="submit">8D Formu Gönder</TabsTrigger>
                    </TabsList>

                    <TabsContent value="requests" className="space-y-4">
                        {ncRequests.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    Henüz 8D talebi bulunmuyor.
                                </CardContent>
                            </Card>
                        ) : (
                            ncRequests.map((nc) => (
                                <Card key={nc.id}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-lg">{nc.title}</CardTitle>
                                                <CardDescription>{nc.description}</CardDescription>
                                            </div>
                                            <Badge variant={nc.status === '8D Gönderildi' ? 'default' : 'destructive'}>
                                                {nc.status}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <p className="text-sm">
                                                <strong>Tarih:</strong> {new Date(nc.created_at).toLocaleDateString('tr-TR')}
                                            </p>
                                            {nc.eight_d_submitted_at && (
                                                <p className="text-sm text-green-600">
                                                    <CheckCircle className="inline h-4 w-4 mr-1" />
                                                    8D Formu Gönderildi: {new Date(nc.eight_d_submitted_at).toLocaleDateString('tr-TR')}
                                                </p>
                                            )}
                                            {nc.status !== '8D Gönderildi' && (
                                                <Button
                                                    onClick={() => {
                                                        setSelectedNC(nc);
                                                        setEightDSteps(nc.eight_d_steps || {});
                                                    }}
                                                    className="mt-2"
                                                >
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    8D Formu Doldur
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="submit" className="space-y-4">
                        {selectedNC ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>8D Formu - {selectedNC.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <ScrollArea className="h-[600px] pr-4">
                                        {['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'].map((stepKey) => (
                                            <Card key={stepKey} className="mb-4">
                                                <CardHeader>
                                                    <CardTitle className="text-base">{stepKey}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div>
                                                        <Label>Sorumlu</Label>
                                                        <Input
                                                            value={eightDSteps[stepKey]?.responsible || ''}
                                                            onChange={(e) => handleStepChange(stepKey, 'responsible', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Tamamlanma Tarihi</Label>
                                                        <Input
                                                            type="date"
                                                            value={eightDSteps[stepKey]?.completionDate || ''}
                                                            onChange={(e) => handleStepChange(stepKey, 'completionDate', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Açıklama</Label>
                                                        <Textarea
                                                            value={eightDSteps[stepKey]?.description || ''}
                                                            onChange={(e) => handleStepChange(stepKey, 'description', e.target.value)}
                                                            rows={4}
                                                        />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Kanıt Dosyaları</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <Input
                                                    type="file"
                                                    multiple
                                                    onChange={handleFileSelect}
                                                    accept="image/*,video/*,.pdf,.doc,.docx"
                                                />
                                                {files.length > 0 && (
                                                    <div className="space-y-2">
                                                        {files.map((file, index) => (
                                                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                                                <span className="text-sm">{file.name}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveFile(index)}
                                                                >
                                                                    <AlertCircle className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </ScrollArea>

                                    <div className="flex justify-end gap-2 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedNC(null);
                                                setEightDSteps({});
                                                setFiles([]);
                                            }}
                                        >
                                            İptal
                                        </Button>
                                        <Button
                                            onClick={handleSubmit8D}
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Gönderiliyor...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="h-4 w-4 mr-2" />
                                                    8D Formu Gönder
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    Lütfen "8D Talepleri" sekmesinden bir talep seçin.
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default SupplierPortal;

