import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, Search, Building2, User, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA', '#34D399', '#F87171'];

const QuarantineDrillDownAnalysis = ({ onClose }) => {
    const { quarantineRecords, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');

    // Karantinadaki kayıtlar
    const inQuarantine = useMemo(() => {
        return (quarantineRecords || []).filter(q => q.status === 'Karantinada');
    }, [quarantineRecords]);

    // Filtrelenmiş kayıtlar
    const filteredRecords = useMemo(() => {
        if (!searchTerm) return inQuarantine;
        const search = searchTerm.toLowerCase();
        return inQuarantine.filter(record =>
            record.part_code?.toLowerCase().includes(search) ||
            record.part_name?.toLowerCase().includes(search) ||
            record.lot_no?.toLowerCase().includes(search) ||
            record.source_department?.toLowerCase().includes(search) ||
            record.requesting_person_name?.toLowerCase().includes(search)
        );
    }, [inQuarantine, searchTerm]);

    // Parça kodu bazında dağılım
    const partCodeDistribution = useMemo(() => {
        const partMap = {};
        inQuarantine.forEach(record => {
            const partCode = record.part_code || 'Belirtilmemiş';
            partMap[partCode] = (partMap[partCode] || 0) + (record.quantity || 0);
        });
        return Object.entries(partMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // İlk 10 parça
    }, [inQuarantine]);

    // Birim bazında dağılım
    const departmentDistribution = useMemo(() => {
        const deptMap = {};
        inQuarantine.forEach(record => {
            const dept = record.source_department || record.requesting_department || 'Belirtilmemiş';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        return Object.entries(deptMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [inQuarantine]);

    // Kontrolör bazında dağılım
    const controllerDistribution = useMemo(() => {
        const controllerMap = {};
        inQuarantine.forEach(record => {
            const controller = record.requesting_person_name || 'Belirtilmemiş';
            controllerMap[controller] = (controllerMap[controller] || 0) + 1;
        });
        return Object.entries(controllerMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // İlk 10 kontrolör
    }, [inQuarantine]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Karantina Ürünleri Analizi</h1>
                        <p className="text-muted-foreground mt-1">
                            Toplam {inQuarantine.length} karantina kaydı analiz ediliyor
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                    {inQuarantine.length} Kayıt
                </Badge>
            </div>

            {/* Arama */}
            <Card>
                <CardContent className="pt-6">
                    <div className="search-box">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Parça kodu, parça adı, lot no, birim veya kontrolör ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* İstatistikler */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Parça Çeşidi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{partCodeDistribution.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Etkilenen Birim Sayısı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{departmentDistribution.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Miktar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {inQuarantine.reduce((sum, r) => sum + (r.quantity || 0), 0).toLocaleString('tr-TR')} adet
                        </div>
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
            ) : inQuarantine.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium">Karantinada ürün bulunmamaktadır.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Grafikler */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Parça Kodu Bazında Miktar Dağılımı (Top 10)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={partCodeDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <XAxis 
                                            dataKey="name" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem'
                                            }}
                                            formatter={(value) => `${value.toLocaleString('tr-TR')} adet`}
                                        />
                                        <Bar dataKey="value" name="Miktar" radius={[4, 4, 0, 0]}>
                                            {partCodeDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Birim Bazında Kayıt Dağılımı
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={departmentDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <XAxis 
                                            dataKey="name" 
                                            angle={-45} 
                                            textAnchor="end" 
                                            height={100}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'hsl(var(--background))', 
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem'
                                            }}
                                        />
                                        <Bar dataKey="value" name="Kayıt Sayısı" radius={[4, 4, 0, 0]}>
                                            {departmentDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detaylı Liste */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Karantina Kayıtları Detay Listesi
                                <Badge variant="secondary" className="ml-2">
                                    {filteredRecords.length} kayıt
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Parça Kodu</TableHead>
                                            <TableHead>Parça Adı</TableHead>
                                            <TableHead>Lot No</TableHead>
                                            <TableHead className="text-right">Miktar</TableHead>
                                            <TableHead>Birim</TableHead>
                                            <TableHead>Kaynak Birim</TableHead>
                                            <TableHead>Kontrolör</TableHead>
                                            <TableHead>Tarih</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    Arama kriterlerine uygun kayıt bulunamadı.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredRecords.map((record, index) => (
                                                <TableRow key={record.id || index}>
                                                    <TableCell className="font-medium">{record.part_code || '-'}</TableCell>
                                                    <TableCell className="max-w-xs truncate">{record.part_name || '-'}</TableCell>
                                                    <TableCell>{record.lot_no || '-'}</TableCell>
                                                    <TableCell className="text-right">{record.quantity?.toLocaleString('tr-TR') || 0}</TableCell>
                                                    <TableCell>{record.unit || 'Adet'}</TableCell>
                                                    <TableCell>{record.source_department || record.requesting_department || '-'}</TableCell>
                                                    <TableCell>{record.requesting_person_name || '-'}</TableCell>
                                                    <TableCell>
                                                        {record.quarantine_date 
                                                            ? format(new Date(record.quarantine_date), 'dd.MM.yyyy', { locale: tr })
                                                            : record.created_at 
                                                            ? format(new Date(record.created_at), 'dd.MM.yyyy', { locale: tr })
                                                            : '-'
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </motion.div>
    );
};

export default QuarantineDrillDownAnalysis;

