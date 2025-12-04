import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Award, AlertTriangle } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const PolyvalenceAnalytics = ({ personnel, skills, personnelSkills, polyvalenceSummary, certificationAlerts }) => {
    console.log('PolyvalenceAnalytics - personnel:', personnel.length);
    console.log('PolyvalenceAnalytics - polyvalenceSummary:', polyvalenceSummary.length);
    
    // Level distribution
    const levelDistribution = [0, 1, 2, 3, 4].map(level => ({
        name: `Seviye ${level}`,
        count: personnelSkills.filter(ps => ps.current_level === level).length
    }));

    // Department averages - İki yöntemli hesaplama (view yoksa manuel)
    const deptStats = personnel.reduce((acc, p) => {
        if (!p.department) return acc;
        if (!acc[p.department]) {
            acc[p.department] = { personnel: 0, totalScore: 0 };
        }
        acc[p.department].personnel++;
        
        // Önce view'den dene
        const summary = polyvalenceSummary.find(ps => ps.personnel_id === p.id);
        if (summary && summary.polyvalence_score) {
            const score = parseFloat(summary.polyvalence_score);
            if (!isNaN(score)) {
                acc[p.department].totalScore += score;
            }
        } else {
            // View yoksa manuel hesapla
            const personSkills = personnelSkills.filter(ps => ps.personnel_id === p.id);
            const totalSkillsCount = personSkills.length;
            
            if (totalSkillsCount > 0) {
                const proficientCount = personSkills.filter(ps => ps.current_level >= 3).length;
                const score = (proficientCount / totalSkillsCount) * 100;
                acc[p.department].totalScore += score;
            }
        }
        return acc;
    }, {});

    console.log('deptStats:', deptStats);

    const departmentData = Object.entries(deptStats)
        .filter(([_, data]) => data.personnel > 0)
        .map(([dept, data]) => ({
            name: dept,
            score: data.personnel > 0 ? parseFloat((data.totalScore / data.personnel).toFixed(1)) : 0,
            count: data.personnel
        }))
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score);

    console.log('departmentData:', departmentData);

    // Top performers - İki yöntemli hesaplama
    let topPerformers = [];
    
    if (polyvalenceSummary && polyvalenceSummary.length > 0) {
        // View'den veri varsa kullan
        topPerformers = polyvalenceSummary
            .map(summary => {
                const person = personnel.find(p => p.id === summary.personnel_id);
                return {
                    ...summary,
                    full_name: person?.full_name || 'Bilinmeyen',
                    department: person?.department || '-',
                    personnel_id: summary.personnel_id
                };
            })
            .filter(p => {
                const score = parseFloat(p.polyvalence_score);
                return p.polyvalence_score && !isNaN(score) && score > 0;
            })
            .sort((a, b) => {
                const scoreA = parseFloat(a.polyvalence_score);
                const scoreB = parseFloat(b.polyvalence_score);
                return scoreB - scoreA;
            })
            .slice(0, 10);
    } else {
        // View yoksa manuel hesapla
        topPerformers = personnel
            .map(person => {
                const personSkills = personnelSkills.filter(ps => ps.personnel_id === person.id);
                const totalSkillsCount = personSkills.length;
                
                if (totalSkillsCount === 0) return null;
                
                const proficientCount = personSkills.filter(ps => ps.current_level >= 3).length;
                const score = (proficientCount / totalSkillsCount) * 100;
                
                return {
                    personnel_id: person.id,
                    full_name: person.full_name,
                    department: person.department || '-',
                    polyvalence_score: score.toFixed(1),
                    total_skills: totalSkillsCount,
                    proficient_skills: proficientCount
                };
            })
            .filter(p => p !== null && parseFloat(p.polyvalence_score) > 0)
            .sort((a, b) => parseFloat(b.polyvalence_score) - parseFloat(a.polyvalence_score))
            .slice(0, 10);
    }

    console.log('topPerformers:', topPerformers);

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

            {/* Departman Performansı - TEK ALAN */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Departman Polivalans Skorları
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Her departmanın ortalama polivalans skoru (Seviye 3+ yetkinlik oranı)
                    </p>
                </CardHeader>
                <CardContent>
                    {departmentData.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Departman verisi bulunmuyor.</p>
                            <p className="text-xs mt-2">Personellere departman atayın ve yetkinlik seviyelerini belirleyin.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(400, departmentData.length * 60)}>
                            <BarChart 
                                data={departmentData} 
                                layout="vertical"
                                margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis 
                                    type="number" 
                                    domain={[0, 100]} 
                                    label={{ value: 'Polivalans Skoru (%)', position: 'insideBottom', offset: -10 }}
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={13}
                                />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={150}
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={13}
                                />
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl">
                                                    <p className="font-bold mb-2">{data.name}</p>
                                                    <p className="text-sm">
                                                        <span className="text-muted-foreground">Polivalans Skoru:</span>
                                                        <span className="ml-2 font-semibold text-green-600">{data.score}%</span>
                                                    </p>
                                                    <p className="text-sm">
                                                        <span className="text-muted-foreground">Personel Sayısı:</span>
                                                        <span className="ml-2 font-semibold">{data.count}</span>
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar 
                                    dataKey="score" 
                                    fill="#10B981" 
                                    radius={[0, 8, 8, 0]}
                                    label={{ 
                                        position: 'right', 
                                        formatter: (value) => `${value}%`,
                                        fill: 'hsl(var(--foreground))',
                                        fontSize: 12
                                    }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
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

