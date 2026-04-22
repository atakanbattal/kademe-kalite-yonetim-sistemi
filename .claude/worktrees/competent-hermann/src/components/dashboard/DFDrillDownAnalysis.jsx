import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, TrendingUp, Repeat, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA', '#34D399', '#F87171'];

const DFDrillDownAnalysis = ({ onClose }) => {
    const { nonConformities, loading } = useData();
    const [activeTab, setActiveTab] = useState('department'); // 'department', 'problem', 'recurring'

    // Açık DF kayıtları
    const openDFs = useMemo(() => {
        return (nonConformities || []).filter(nc => nc.type === 'DF' && nc.status !== 'Kapatıldı');
    }, [nonConformities]);

    // Birimler bazında dağılım
    const departmentDistribution = useMemo(() => {
        const deptMap = {};
        openDFs.forEach(nc => {
            const dept = nc.requesting_unit || 'Belirtilmemiş';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        return Object.entries(deptMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [openDFs]);

    // Problem türleri analizi
    const problemTypes = useMemo(() => {
        const typeMap = {};
        openDFs.forEach(nc => {
            // Problem türünü belirle (title veya description'dan)
            let problemType = 'Genel Problem';
            if (nc.title) {
                const titleLower = nc.title.toLowerCase();
                if (titleLower.includes('boyut') || titleLower.includes('ölçü')) problemType = 'Boyut/Ölçü';
                else if (titleLower.includes('yüzey') || titleLower.includes('görünüm')) problemType = 'Yüzey/Görünüm';
                else if (titleLower.includes('malzeme') || titleLower.includes('material')) problemType = 'Malzeme';
                else if (titleLower.includes('montaj') || titleLower.includes('assembly')) problemType = 'Montaj';
                else if (titleLower.includes('fonksiyon') || titleLower.includes('function')) problemType = 'Fonksiyon';
                else if (titleLower.includes('kalite') || titleLower.includes('quality')) problemType = 'Kalite';
            }
            typeMap[problemType] = (typeMap[problemType] || 0) + 1;
        });
        return Object.entries(typeMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [openDFs]);

    // Tekrarlayan problemler (aynı parça kodu veya benzer başlık)
    const recurringProblems = useMemo(() => {
        const problemMap = {};
        openDFs.forEach(nc => {
            const key = nc.part_code || nc.title?.substring(0, 30) || 'Bilinmeyen';
            if (!problemMap[key]) {
                problemMap[key] = {
                    part_code: nc.part_code || '-',
                    title: nc.title || 'Başlıksız',
                    count: 0,
                    departments: new Set(),
                    first_occurrence: nc.created_at,
                    last_occurrence: nc.created_at,
                    records: []
                };
            }
            problemMap[key].count++;
            if (nc.requesting_unit) problemMap[key].departments.add(nc.requesting_unit);
            if (new Date(nc.created_at) < new Date(problemMap[key].first_occurrence)) {
                problemMap[key].first_occurrence = nc.created_at;
            }
            if (new Date(nc.created_at) > new Date(problemMap[key].last_occurrence)) {
                problemMap[key].last_occurrence = nc.created_at;
            }
            problemMap[key].records.push(nc);
        });
        return Object.values(problemMap)
            .filter(p => p.count > 1)
            .map(p => ({
                ...p,
                departments: Array.from(p.departments).join(', ')
            }))
            .sort((a, b) => b.count - a.count);
    }, [openDFs]);

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
                        <h1 className="text-3xl font-bold">Açık DF Analizi</h1>
                        <p className="text-muted-foreground mt-1">
                            Toplam {openDFs.length} açık DF kaydı analiz ediliyor
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                    {openDFs.length} Açık DF
                </Badge>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b">
                <Button
                    variant={activeTab === 'department' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('department')}
                    className="rounded-b-none"
                >
                    <Building2 className="mr-2 h-4 w-4" />
                    Birim Dağılımı
                </Button>
                <Button
                    variant={activeTab === 'problem' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('problem')}
                    className="rounded-b-none"
                >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Problem Türleri
                </Button>
                <Button
                    variant={activeTab === 'recurring' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('recurring')}
                    className="rounded-b-none"
                >
                    <Repeat className="mr-2 h-4 w-4" />
                    Tekrarlayan Problemler
                </Button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
            ) : openDFs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium">Açık DF kaydı bulunmamaktadır.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Birim Dağılımı */}
                    {activeTab === 'department' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Birimler Bazında Dağılım</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={departmentDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                            <XAxis 
                                                dataKey="name" 
                                                angle={-45} 
                                                textAnchor="end" 
                                                height={100}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: 'hsl(var(--background))', 
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '0.5rem'
                                                }} 
                                            />
                                            <Bar dataKey="value" name="DF Sayısı" radius={[4, 4, 0, 0]}>
                                                {departmentDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Birim Detayları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {departmentDistribution.map((dept, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                                    <span className="font-medium">{dept.name}</span>
                                                </div>
                                                <Badge variant="secondary">{dept.value} DF</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Problem Türleri */}
                    {activeTab === 'problem' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Problem Türleri Dağılımı</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <PieChart>
                                            <Pie
                                                data={problemTypes}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={120}
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {problemTypes.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Problem Türü Detayları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {problemTypes.map((type, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                                    <span className="font-medium">{type.name}</span>
                                                </div>
                                                <Badge variant="secondary">{type.value} adet</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Tekrarlayan Problemler */}
                    {activeTab === 'recurring' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Repeat className="h-5 w-5 text-orange-500" />
                                    Tekrarlayan Problemler ({recurringProblems.length} adet)
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Aynı parça kodu veya benzer problemler için birden fazla DF kaydı bulunan durumlar
                                </p>
                            </CardHeader>
                            <CardContent>
                                {recurringProblems.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Tekrarlayan problem bulunmamaktadır.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Parça Kodu</TableHead>
                                                    <TableHead>Problem Başlığı</TableHead>
                                                    <TableHead className="text-center">Tekrar Sayısı</TableHead>
                                                    <TableHead>Etkilenen Birimler</TableHead>
                                                    <TableHead>İlk Oluşum</TableHead>
                                                    <TableHead>Son Oluşum</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {recurringProblems.map((problem, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">{problem.part_code}</TableCell>
                                                        <TableCell className="max-w-xs truncate">{problem.title}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="destructive">{problem.count}</Badge>
                                                        </TableCell>
                                                        <TableCell>{problem.departments || '-'}</TableCell>
                                                        <TableCell>
                                                            {format(new Date(problem.first_occurrence), 'dd.MM.yyyy', { locale: tr })}
                                                        </TableCell>
                                                        <TableCell>
                                                            {format(new Date(problem.last_occurrence), 'dd.MM.yyyy', { locale: tr })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default DFDrillDownAnalysis;

