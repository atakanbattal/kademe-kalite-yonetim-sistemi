import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
    Building2, 
    Mail, 
    Phone, 
    User, 
    Star, 
    Shield, 
    Eye, 
    AlertOctagon,
    TrendingUp,
    TrendingDown,
    Package,
    Calendar,
    FileText,
    AlertTriangle,
    Award,
    Clock,
    CheckCircle,
    XCircle,
    Users,
    Edit,
    BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SupplierDetailModal = ({ isOpen, setIsOpen, supplier, onEdit, onSetGrade, allSuppliers, onOpenNCView }) => {
    const [loading, setLoading] = useState(false);
    const [audits, setAudits] = useState([]);
    const [nonConformities, setNCs] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [ppmData, setPpmData] = useState(null);
    const [deliveryStats, setDeliveryStats] = useState({ total: 0, onTime: 0, otd: 0 });

    const currentYear = new Date().getFullYear();

    useEffect(() => {
        if (isOpen && supplier?.id) {
            loadSupplierDetails();
        }
    }, [isOpen, supplier?.id]);

    const loadSupplierDetails = async () => {
        setLoading(true);
        try {
            // Denetimleri yükle
            const { data: auditData } = await supabase
                .from('supplier_audit_plans')
                .select('*')
                .eq('supplier_id', supplier.id)
                .order('planned_date', { ascending: false })
                .limit(5);
            setAudits(auditData || []);

            // Uygunsuzlukları yükle - non_conformities'dan (gerçek DF/8D kayıtları)
            const { data: ncData } = await supabase
                .from('non_conformities')
                .select('*')
                .eq('supplier_id', supplier.id)
                .order('created_at', { ascending: false })
                .limit(10);
            setNCs(ncData || []);

            // Sertifikaları yükle
            const { data: certData } = await supabase
                .from('supplier_certificates')
                .select('*')
                .eq('supplier_id', supplier.id);
            setCertificates(certData || []);

            // PPM verisi hesapla
            const { data: inspections } = await supabase
                .from('incoming_inspections')
                .select('quantity_received, quantity_rejected, quantity_conditional, inspection_date')
                .eq('supplier_id', supplier.id);

            if (inspections && inspections.length > 0) {
                const yearInspections = inspections.filter(i => 
                    new Date(i.inspection_date).getFullYear() === currentYear
                );
                let totalReceived = 0;
                let totalDefective = 0;
                yearInspections.forEach(i => {
                    totalReceived += (i.quantity_received || 0);
                    totalDefective += ((i.quantity_rejected || 0) + (i.quantity_conditional || 0));
                });
                const ppm = totalReceived > 0 ? (totalDefective / totalReceived) * 1000000 : 0;
                setPpmData({
                    ppm: Math.round(ppm),
                    inspected: totalReceived,
                    defective: totalDefective
                });
            } else {
                setPpmData(null);
            }

            // Teslimat istatistikleri
            try {
                const { data: deliveries } = await supabase
                    .from('supplier_deliveries')
                    .select('on_time')
                    .eq('supplier_id', supplier.id);

                if (deliveries && deliveries.length > 0) {
                    const total = deliveries.length;
                    const onTime = deliveries.filter(d => d.on_time).length;
                    setDeliveryStats({
                        total,
                        onTime,
                        otd: Math.round((onTime / total) * 100)
                    });
                } else {
                    setDeliveryStats({ total: 0, onTime: 0, otd: 0 });
                }
            } catch (err) {
                setDeliveryStats({ total: 0, onTime: 0, otd: 0 });
            }

        } catch (error) {
            console.error('Detay yükleme hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    const getGradeInfo = (grade) => {
        switch (grade) {
            case 'A': return { label: 'A Sınıfı', description: 'Stratejik İş Ortağı', color: 'bg-green-500', icon: Star };
            case 'B': return { label: 'B Sınıfı', description: 'Güvenilir Tedarikçi', color: 'bg-blue-500', icon: Shield };
            case 'C': return { label: 'C Sınıfı', description: 'İzlemeye Alınacak', color: 'bg-yellow-500', icon: Eye };
            case 'D': return { label: 'D Sınıfı', description: 'İş Birliği Sonlandırılacak', color: 'bg-red-500', icon: AlertOctagon };
            default: return { label: 'Belirlenmedi', description: 'Henüz sınıflandırılmamış', color: 'bg-gray-500', icon: Award };
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Onaylı': return <Badge className="bg-green-600 text-white">{status}</Badge>;
            case 'Askıya Alınmış': return <Badge variant="destructive">{status}</Badge>;
            case 'Red': return <Badge className="bg-red-700 text-white">{status}</Badge>;
            case 'Alternatif': return <Badge className="bg-blue-500 text-white">{status}</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getRiskBadge = (risk) => {
        switch (risk) {
            case 'Yüksek': return <Badge variant="destructive">{risk}</Badge>;
            case 'Orta': return <Badge className="bg-yellow-500 text-white">{risk}</Badge>;
            case 'Düşük': return <Badge className="bg-green-500 text-white">{risk}</Badge>;
            default: return <Badge variant="outline">{risk || 'Belirsiz'}</Badge>;
        }
    };

    const getPPMStatus = (ppm) => {
        if (ppm < 100) return { label: 'Mükemmel', color: 'text-green-500', bgColor: 'bg-green-500' };
        if (ppm < 500) return { label: 'İyi', color: 'text-blue-500', bgColor: 'bg-blue-500' };
        if (ppm < 1000) return { label: 'Orta', color: 'text-yellow-500', bgColor: 'bg-yellow-500' };
        return { label: 'Kötü', color: 'text-red-500', bgColor: 'bg-red-500' };
    };

    const alternatives = useMemo(() => {
        if (!allSuppliers || !supplier) return [];
        return allSuppliers.filter(s => s.alternative_to_supplier_id === supplier.id);
    }, [allSuppliers, supplier]);

    const mainSupplier = useMemo(() => {
        if (!allSuppliers || !supplier?.alternative_to_supplier_id) return null;
        return allSuppliers.find(s => s.id === supplier.alternative_to_supplier_id);
    }, [allSuppliers, supplier]);

    if (!supplier) return null;

    const gradeInfo = getGradeInfo(supplier.supplier_grade);
    const GradeIcon = gradeInfo.icon;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><Building2 className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{supplier.name}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{supplier.product_group || 'Tedarikçi'} • {supplier.status}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{supplier.status}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => { setIsOpen(false); onSetGrade?.(supplier); }}>
                            <Star className="h-4 w-4 mr-1" />
                            Sınıf Belirle
                        </Button>
                        <Button size="sm" className="bg-white text-primary hover:bg-blue-50" onClick={() => { setIsOpen(false); onEdit?.(supplier); }}>
                            <Edit className="h-4 w-4 mr-1" />
                                Düzenle
                            </Button>
                        </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 mb-4">
                            <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                            <TabsTrigger value="performance">Performans</TabsTrigger>
                            <TabsTrigger value="audits">Denetimler</TabsTrigger>
                            <TabsTrigger value="issues">Uygunsuzluklar</TabsTrigger>
                        </TabsList>

                        {/* GENEL BAKIŞ */}
                        <TabsContent value="overview" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Sınıf Bilgisi */}
                                <Card className="border-2" style={{ borderColor: supplier.supplier_grade ? undefined : '#6b7280' }}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Award className="h-4 w-4" />
                                            Tedarikçi Sınıfı
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${gradeInfo.color}`}>
                                                <GradeIcon className="h-6 w-6 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg">{gradeInfo.label}</p>
                                                <p className="text-sm text-muted-foreground">{gradeInfo.description}</p>
                                            </div>
                                        </div>
                                        {supplier.grade_reason && (
                                            <div className="mt-3 p-2 bg-muted rounded-lg">
                                                <p className="text-xs text-muted-foreground">Gerekçe:</p>
                                                <p className="text-sm">{supplier.grade_reason}</p>
                                            </div>
                                        )}
                                        {supplier.grade_updated_at && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Güncelleme: {new Date(supplier.grade_updated_at).toLocaleDateString('tr-TR')}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* İletişim Bilgileri */}
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            İletişim Bilgileri
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {supplier.contact_info?.name && (
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>{supplier.contact_info.name}</span>
                                            </div>
                                        )}
                                        {supplier.contact_info?.email && (
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <a href={`mailto:${supplier.contact_info.email}`} className="text-primary hover:underline">
                                                    {supplier.contact_info.email}
                                                </a>
                                            </div>
                                        )}
                                        {supplier.contact_info?.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <a href={`tel:${supplier.contact_info.phone}`} className="text-primary hover:underline">
                                                    {supplier.contact_info.phone}
                                                </a>
                                            </div>
                                        )}
                                        {!supplier.contact_info?.name && !supplier.contact_info?.email && !supplier.contact_info?.phone && (
                                            <p className="text-muted-foreground text-sm">İletişim bilgisi girilmemiş</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Hızlı İstatistikler */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl border"
                                >
                                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                                        <BarChart3 className="h-4 w-4" />
                                        <span className="text-xs font-medium">PPM</span>
                                    </div>
                                    <p className="text-2xl font-bold">
                                        {ppmData ? ppmData.ppm.toLocaleString('tr-TR') : '-'}
                                    </p>
                                    {ppmData && (
                                        <p className={`text-xs ${getPPMStatus(ppmData.ppm).color}`}>
                                            {getPPMStatus(ppmData.ppm).label}
                                        </p>
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl border"
                                >
                                    <div className="flex items-center gap-2 text-green-600 mb-1">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-xs font-medium">OTD%</span>
                                    </div>
                                    <p className="text-2xl font-bold">
                                        {deliveryStats.total > 0 ? `${deliveryStats.otd}%` : '-'}
                                    </p>
                                    {deliveryStats.total > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            {deliveryStats.onTime}/{deliveryStats.total} zamanında
                                        </p>
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl border"
                                >
                                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                                        <FileText className="h-4 w-4" />
                                        <span className="text-xs font-medium">Denetim</span>
                                    </div>
                                    <p className="text-2xl font-bold">{audits.length}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {audits.filter(a => a.status === 'Tamamlandı').length} tamamlandı
                                    </p>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl border"
                                >
                                    <div className="flex items-center gap-2 text-orange-600 mb-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="text-xs font-medium">Uygunsuzluk</span>
                                    </div>
                                    <p className="text-2xl font-bold">{nonConformities.length}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {nonConformities.filter(nc => nc.status === 'Açık').length} açık
                                    </p>
                                </motion.div>
                            </div>

                            {/* İlişkiler */}
                            {(mainSupplier || alternatives.length > 0) && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Tedarikçi İlişkileri
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {mainSupplier && (
                                            <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg mb-2">
                                                <Badge className="bg-blue-500 text-white">Ana Tedarikçi</Badge>
                                                <span className="font-medium">{mainSupplier.name}</span>
                                            </div>
                                        )}
                                        {alternatives.length > 0 && (
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-2">Alternatif Tedarikçiler:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {alternatives.map(alt => (
                                                        <Badge key={alt.id} variant="outline" className="flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            {alt.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Sertifikalar */}
                            {certificates.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Award className="h-4 w-4" />
                                            Sertifikalar
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {certificates.map(cert => (
                                                <Badge key={cert.id} variant="outline" className="flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                    {cert.certificate_type || cert.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* PERFORMANS */}
                        <TabsContent value="performance" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* PPM Detay */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-primary" />
                                            PPM Analizi ({currentYear})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {ppmData ? (
                                            <div className="space-y-4">
                                                <div className="text-center p-4 bg-muted rounded-lg">
                                                    <p className="text-4xl font-bold text-primary">
                                                        {ppmData.ppm.toLocaleString('tr-TR')}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">PPM (Parts Per Million)</p>
                                                    <Badge className={`mt-2 ${getPPMStatus(ppmData.ppm).bgColor} text-white`}>
                                                        {getPPMStatus(ppmData.ppm).label}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div className="p-3 bg-muted/50 rounded-lg">
                                                        <p className="text-muted-foreground">Muayene Edilen</p>
                                                        <p className="text-xl font-bold">{ppmData.inspected.toLocaleString('tr-TR')}</p>
                                                    </div>
                                                    <div className="p-3 bg-muted/50 rounded-lg">
                                                        <p className="text-muted-foreground">Hatalı</p>
                                                        <p className="text-xl font-bold text-red-500">{ppmData.defective.toLocaleString('tr-TR')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                                <p>Bu yıl için gelen muayene verisi yok</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* OTD Detay */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-primary" />
                                            Zamanında Teslimat (OTD%)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {deliveryStats.total > 0 ? (
                                            <div className="space-y-4">
                                                <div className="text-center p-4 bg-muted rounded-lg">
                                                    <p className="text-4xl font-bold text-primary">
                                                        {deliveryStats.otd}%
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">On-Time Delivery</p>
                                                    <Progress value={deliveryStats.otd} className="mt-3 h-2" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div className="p-3 bg-muted/50 rounded-lg">
                                                        <p className="text-muted-foreground">Toplam Teslimat</p>
                                                        <p className="text-xl font-bold">{deliveryStats.total}</p>
                                                    </div>
                                                    <div className="p-3 bg-muted/50 rounded-lg">
                                                        <p className="text-muted-foreground">Zamanında</p>
                                                        <p className="text-xl font-bold text-green-500">{deliveryStats.onTime}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                                <p>Teslimat verisi bulunmuyor</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* DENETİMLER */}
                        <TabsContent value="audits" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Son Denetimler
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {audits.length > 0 ? (
                                        <div className="space-y-3">
                                            {audits.map((audit, index) => (
                                                <motion.div
                                                    key={audit.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {audit.status === 'Tamamlandı' ? (
                                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                                        ) : audit.status === 'Planlandı' ? (
                                                            <Calendar className="h-5 w-5 text-blue-500" />
                                                        ) : (
                                                            <XCircle className="h-5 w-5 text-red-500" />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">{audit.audit_type || 'Denetim'}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(audit.planned_date).toLocaleDateString('tr-TR')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <Badge variant={audit.status === 'Tamamlandı' ? 'default' : 'outline'}>
                                                            {audit.status}
                                                        </Badge>
                                                        {audit.score !== null && (
                                                            <p className="text-sm font-bold mt-1">{audit.score} puan</p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                            <p>Henüz denetim kaydı yok</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* UYGUNSUZLUKLAR */}
                        <TabsContent value="issues" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-primary" />
                                        Son Uygunsuzluklar
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {nonConformities.length > 0 ? (
                                        <div className="space-y-3">
                                            {nonConformities.map((nc, index) => (
                                                <motion.div
                                                    key={nc.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    onClick={() => onOpenNCView && onOpenNCView(nc)}
                                                    className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg ${onOpenNCView ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {nc.status === 'Açık' ? (
                                                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                                                        ) : (
                                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">{nc.nc_number || nc.mdi_no || nc.title?.substring(0, 50) || 'Uygunsuzluk'}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {nc.title ? nc.title.substring(0, 60) + (nc.title.length > 60 ? '...' : '') : ''} • {new Date(nc.opening_date || nc.created_at).toLocaleDateString('tr-TR')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant={nc.status === 'Açık' ? 'destructive' : 'default'}>
                                                        {nc.status}
                                                    </Badge>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-30 text-green-500" />
                                            <p>Uygunsuzluk kaydı yok - Harika!</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierDetailModal;
