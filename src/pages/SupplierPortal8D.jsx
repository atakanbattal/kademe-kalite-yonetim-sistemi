import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Upload, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import EightDStepsEnhanced from '@/components/df-8d/EightDStepsEnhanced';

const SupplierPortal8D = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [loading, setLoading] = useState(true);
    const [linkData, setLinkData] = useState(null);
    const [ncData, setNcData] = useState(null);
    const [supplierData, setSupplierData] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [formData, setFormData] = useState({
        eight_d_steps: {},
        root_cause_analysis: '',
        corrective_actions: '',
        preventive_actions: '',
        supplier_contact_name: '',
        supplier_contact_email: ''
    });
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (token) {
            loadLinkData();
        }
    }, [token]);

    const loadLinkData = async () => {
        setLoading(true);
        try {
            // Link'i kontrol et ve erişimi takip et
            const { data: link, error: linkError } = await supabase
                .from('supplier_8d_links')
                .select('*, nc:non_conformities(*), supplier:suppliers(*)')
                .eq('unique_token', token)
                .eq('is_active', true)
                .single();

            if (linkError || !link) {
                throw new Error('Geçersiz veya süresi dolmuş link.');
            }

            if (link.expires_at && new Date(link.expires_at) < new Date()) {
                throw new Error('Bu linkin süresi dolmuş.');
            }

            // Erişimi takip et
            await supabase.rpc('track_supplier_link_access', { p_token: token });

            setLinkData(link);
            setNcData(link.nc);
            setSupplierData(link.supplier);

            // Mevcut gönderimi kontrol et
            const { data: existingSubmission } = await supabase
                .from('supplier_8d_submissions')
                .select('*')
                .eq('link_id', link.id)
                .single();

            if (existingSubmission) {
                setSubmission(existingSubmission);
                setFormData({
                    eight_d_steps: existingSubmission.eight_d_steps || {},
                    root_cause_analysis: existingSubmission.root_cause_analysis || '',
                    corrective_actions: existingSubmission.corrective_actions || '',
                    preventive_actions: existingSubmission.preventive_actions || '',
                    supplier_contact_name: existingSubmission.supplier_contact_name || '',
                    supplier_contact_email: existingSubmission.supplier_contact_email || ''
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const handleRemoveFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!formData.supplier_contact_name || !formData.supplier_contact_email) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen iletişim bilgilerinizi girin.'
            });
            return;
        }

        setSubmitting(true);
        try {
            // Dosyaları yükle
            const uploadedFilePaths = [];
            for (const file of files) {
                const filePath = `supplier-8d/${linkData.id}/${Date.now()}-${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('df_attachments')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;
                uploadedFilePaths.push(filePath);
            }

            // Gönderimi kaydet
            const submissionData = {
                link_id: linkData.id,
                supplier_id: linkData.supplier_id,
                nc_id: linkData.nc_id,
                eight_d_steps: formData.eight_d_steps,
                root_cause_analysis: formData.root_cause_analysis,
                corrective_actions: formData.corrective_actions,
                preventive_actions: formData.preventive_actions,
                evidence_files: uploadedFilePaths,
                supplier_contact_name: formData.supplier_contact_name,
                supplier_contact_email: formData.supplier_contact_email,
                status: 'Beklemede'
            };

            const { data, error } = await supabase
                .from('supplier_8d_submissions')
                .upsert(submissionData, { onConflict: 'link_id' })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: '8D raporunuz başarıyla gönderildi. İnceleme sonrası size geri dönüş yapılacaktır.'
            });

            setSubmission(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Gönderim yapılamadı: ' + error.message
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!linkData || !ncData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Geçersiz Link</AlertTitle>
                    <AlertDescription>
                        Bu link geçersiz veya süresi dolmuş olabilir.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Tedarikçi 8D Portal
                        </CardTitle>
                        <CardDescription>
                            {supplierData?.name} - Uygunsuzluk No: {ncData?.nc_number || ncData?.mdi_no}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div>
                                <Label className="text-sm font-semibold">Problem Tanımı</Label>
                                <p className="text-sm mt-1">{ncData?.title || '-'}</p>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold">Açıklama</Label>
                                <p className="text-sm mt-1">{ncData?.description || '-'}</p>
                            </div>
                            {ncData?.part_code && (
                                <div>
                                    <Label className="text-sm font-semibold">Parça Kodu</Label>
                                    <p className="text-sm mt-1">{ncData.part_code}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Gönderim Durumu */}
                {submission && (
                    <Alert className={submission.status === 'Onaylandı' ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                        <div className="flex items-center justify-between">
                            <div>
                                <AlertTitle>Gönderim Durumu</AlertTitle>
                                <AlertDescription>
                                    {submission.status === 'Beklemede' && 'Raporunuz incelenmektedir.'}
                                    {submission.status === 'İnceleniyor' && 'Raporunuz detaylı inceleniyor.'}
                                    {submission.status === 'Onaylandı' && 'Raporunuz onaylanmıştır.'}
                                    {submission.status === 'Reddedildi' && 'Raporunuz reddedilmiştir. Lütfen revize edin.'}
                                </AlertDescription>
                            </div>
                            <Badge variant={
                                submission.status === 'Onaylandı' ? 'default' :
                                submission.status === 'Reddedildi' ? 'destructive' :
                                'secondary'
                            }>
                                {submission.status}
                            </Badge>
                        </div>
                    </Alert>
                )}

                {/* 8D Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>8D Raporu</CardTitle>
                        <CardDescription>
                            Lütfen 8D adımlarını doldurun ve kök neden analizi yapın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 8D Adımları */}
                        <div>
                            <Label className="text-base font-semibold mb-3 block">8D Adımları</Label>
                            <EightDStepsEnhanced
                                steps={formData.eight_d_steps || {}}
                                onStepsChange={(steps) => setFormData(prev => ({ ...prev, eight_d_steps: steps }))}
                                isEditMode={false}
                                ncId={ncData?.id}
                            />
                        </div>

                        {/* Kök Neden Analizi */}
                        <div>
                            <Label htmlFor="root_cause_analysis" className="text-base font-semibold">
                                Kök Neden Analizi
                            </Label>
                            <Textarea
                                id="root_cause_analysis"
                                value={formData.root_cause_analysis}
                                onChange={(e) => setFormData(prev => ({ ...prev, root_cause_analysis: e.target.value }))}
                                placeholder="Problemin kök nedenini detaylı şekilde açıklayın..."
                                rows={6}
                                className="mt-2"
                            />
                        </div>

                        {/* Düzeltici Faaliyetler */}
                        <div>
                            <Label htmlFor="corrective_actions" className="text-base font-semibold">
                                Düzeltici Faaliyetler
                            </Label>
                            <Textarea
                                id="corrective_actions"
                                value={formData.corrective_actions}
                                onChange={(e) => setFormData(prev => ({ ...prev, corrective_actions: e.target.value }))}
                                placeholder="Alınan düzeltici faaliyetleri açıklayın..."
                                rows={6}
                                className="mt-2"
                            />
                        </div>

                        {/* Önleyici Faaliyetler */}
                        <div>
                            <Label htmlFor="preventive_actions" className="text-base font-semibold">
                                Önleyici Faaliyetler
                            </Label>
                            <Textarea
                                id="preventive_actions"
                                value={formData.preventive_actions}
                                onChange={(e) => setFormData(prev => ({ ...prev, preventive_actions: e.target.value }))}
                                placeholder="Alınan önleyici faaliyetleri açıklayın..."
                                rows={6}
                                className="mt-2"
                            />
                        </div>

                        {/* Kanıt Dosyaları */}
                        <div>
                            <Label className="text-base font-semibold mb-2 block">Kanıt Dosyaları</Label>
                            <Input
                                type="file"
                                multiple
                                accept="image/*,video/*,.pdf,.doc,.docx"
                                onChange={handleFileSelect}
                                className="mb-2"
                            />
                            {files.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    {files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                            <span className="text-sm">{file.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveFile(index)}
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* İletişim Bilgileri */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="supplier_contact_name">
                                    İletişim Kişisi <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="supplier_contact_name"
                                    value={formData.supplier_contact_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact_name: e.target.value }))}
                                    placeholder="Ad Soyad"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="supplier_contact_email">
                                    E-posta <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="supplier_contact_email"
                                    type="email"
                                    value={formData.supplier_contact_email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact_email: e.target.value }))}
                                    placeholder="email@example.com"
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Gönder Butonu */}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || submission?.status === 'Onaylandı'}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Gönderiliyor...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        {submission ? 'Güncelle' : 'Gönder'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SupplierPortal8D;

