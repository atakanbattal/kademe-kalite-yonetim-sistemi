import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Award, AlertTriangle } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const PolyvalenceAnalytics = ({ personnel, skills, personnelSkills, polyvalenceSummary, certificationAlerts }) => {
    // Level distribution
    const levelDistribution = [0, 1, 2, 3, 4].map(level => ({
        name: `Seviye ${level}`,
        count: personnelSkills.filter(ps => ps.current_level === level).length
    }));

    // Department averages - FIX: polyvalenceSummary'den personnel bilgisini al
    const deptStats = personnel.reduce((acc, p) => {
        if (!p.department) return acc;
        if (!acc[p.department]) {
            acc[p.department] = { personnel: 0, totalScore: 0 };
        }
        acc[p.department].personnel++;
        const summary = polyvalenceSummary.find(ps => ps.personnel_id === p.id);
        if (summary && summary.polyvalence_score) {
            acc[p.department].totalScore += parseFloat(summary.polyvalence_score);
        }
        return acc;
    }, {});

    const departmentData = Object.entries(deptStats)
        .filter(([_, data]) => data.personnel > 0)
        .map(([dept, data]) => ({
            name: dept,
            score: parseFloat((data.totalScore / data.personnel).toFixed(1))
        }))
        .sort((a, b) => b.score - a.score);

    // Top performers - FIX: personnel bilgisini ekle
    const topPerformers = polyvalenceSummary
        .map(summary => {
            const person = personnel.find(p => p.id === summary.personnel_id);
            return {
                ...summary,
                full_name: person?.full_name || 'Bilinmeyen',
                department: person?.department || '-'
            };
        })
        .filter(p => p.polyvalence_score && parseFloat(p.polyvalence_score) > 0)
        .sort((a, b) => parseFloat(b.polyvalence_score) - parseFloat(a.polyvalence_score))
        .slice(0, 10);

    // Certification status
    const certStats = [
        { name: 'Geçerli', value: certificationAlerts.filter(a => a.status === 'Geçerli').length },
        { name: 'Uyarı', value: certificationAlerts.filter(a => a.status === 'Uyarı (90 gün içinde)').length },
        { name: 'Kritik', value: certificationAlerts.filter(a => a.status === 'Kritik (30 gün içinde)').length },
        { name: 'Süresi Dolmuş', value: certificationAlerts.filter(a => a.status === 'Süresi Dolmuş').length }
    ];

    return (
        <div className="space-y-6">
            {/* Seviye Dağılımı */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Yetkinlik Seviye Dağılımı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={levelDistribution}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#3B82F6" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Departman Performansı */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Departman Polivalans Skorları
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={departmentData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" width={120} />
                                <Tooltip />
                                <Bar dataKey="score" fill="#10B981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Sertifika Durumu */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Sertifika Geçerlilik Durumu
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={certStats}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {certStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* En Yüksek Performans Gösteren Personel */}
            <Card>
                <CardHeader>
                    <CardTitle>En Yüksek Polivalans Skorları</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {topPerformers.map((person, index) => (
                            <div key={person.personnel_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-2xl text-muted-foreground">#{index + 1}</span>
                                    <div>
                                        <div className="font-semibold">{person.full_name}</div>
                                        <div className="text-sm text-muted-foreground">{person.department}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-blue-600">{person.polyvalence_score}%</div>
                                    <div className="text-xs text-muted-foreground">
                                        {person.proficient_skills}/{person.total_skills} yetkinlik
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PolyvalenceAnalytics;

