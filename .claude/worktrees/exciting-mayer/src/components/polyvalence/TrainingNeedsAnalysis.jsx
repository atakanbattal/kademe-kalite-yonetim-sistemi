import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, AlertTriangle, TrendingUp, Calendar, Download, GraduationCap, Users } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const TrainingNeedsAnalysis = ({ 
    personnel, 
    skills, 
    personnelSkills, 
    certificationAlerts, 
    onRefresh,
    onCreateTraining // ✅ YENİ: Modal açmak için callback
}) => {
    const { toast } = useToast();
    
    // Eğitim gerektiren kayıtlar
    const trainingNeeds = useMemo(() => {
        return personnelSkills
            .filter(ps => ps.training_required)
            .map(ps => {
                const person = personnel.find(p => p.id === ps.personnel_id);
                const skill = skills.find(s => s.id === ps.skill_id);
                return {
                    ...ps,
                    person,
                    skill
                };
            })
            .filter(item => item.person && item.skill)
            .sort((a, b) => {
                const priorityOrder = { 'Kritik': 0, 'Yüksek': 1, 'Orta': 2, 'Düşük': 3 };
                return (priorityOrder[a.training_priority] || 999) - (priorityOrder[b.training_priority] || 999);
            });
    }, [personnelSkills, personnel, skills]);

    // Yetkinlik bazlı gruplandırılmış eğitim ihtiyaçları
    const trainingNeedsBySkill = useMemo(() => {
        const grouped = {};
        trainingNeeds.forEach(need => {
            const skillId = need.skill_id;
            if (!grouped[skillId]) {
                grouped[skillId] = {
                    skill: need.skill,
                    personnel: [],
                    highestPriority: need.training_priority,
                    count: 0
                };
            }
            grouped[skillId].personnel.push(need.person);
            grouped[skillId].count++;
            
            // En yüksek önceliği belirle
            const priorityOrder = { 'Kritik': 0, 'Yüksek': 1, 'Orta': 2, 'Düşük': 3 };
            if (priorityOrder[need.training_priority] < priorityOrder[grouped[skillId].highestPriority]) {
                grouped[skillId].highestPriority = need.training_priority;
            }
        });
        
        return Object.values(grouped).sort((a, b) => {
            const priorityOrder = { 'Kritik': 0, 'Yüksek': 1, 'Orta': 2, 'Düşük': 3 };
            return (priorityOrder[a.highestPriority] || 999) - (priorityOrder[b.highestPriority] || 999);
        });
    }, [trainingNeeds]);

    // Sertifika yenileme gerektiren kayıtlar
    const expiringCerts = useMemo(() => {
        return certificationAlerts
            .filter(alert => alert.status !== 'Geçerli')
            .sort((a, b) => a.days_remaining - b.days_remaining);
    }, [certificationAlerts]);

    const getPriorityBadge = (priority) => {
        const colors = {
            'Kritik': 'bg-red-600',
            'Yüksek': 'bg-orange-500',
            'Orta': 'bg-yellow-500',
            'Düşük': 'bg-green-500'
        };
        return <Badge className={colors[priority] || 'bg-gray-500'}>{priority}</Badge>;
    };

    const getStatusBadge = (status) => {
        const colors = {
            'Süresi Dolmuş': 'destructive',
            'Kritik (30 gün içinde)': 'destructive',
            'Uyarı (90 gün içinde)': 'warning',
            'Geçerli': 'default'
        };
        return <Badge variant={colors[status] || 'secondary'}>{status}</Badge>;
    };

    const handleCreateTraining = (personnelId, skillId) => {
        // ✅ Modal'ı polivalans içinde aç (route etme!)
        if (onCreateTraining) {
            onCreateTraining({
                selectedPersonnel: [personnelId],
                selectedSkillId: skillId,
                isBulk: false
            });
        }
    };

    const handleCreateBulkTraining = async (skill, personnelList) => {
        // ✅ Toplu eğitim: Modal'ı aç ve training_required'ı güncelle
        try {
            const personnelIds = personnelList.map(p => p.id);
            
            // Modal'ı aç (route etme!)
            if (onCreateTraining) {
                onCreateTraining({
                    selectedPersonnel: personnelIds,
                    selectedSkillId: skill.id,
                    isBulk: true
                });
            }

            // personnel_skills'de training_required'ı false yap
            const { error } = await supabase
                .from('personnel_skills')
                .update({ 
                    training_required: false,
                    next_training_date: new Date().toISOString()
                })
                .in('personnel_id', personnelIds)
                .eq('skill_id', skill.id);

            if (error) throw error;

            toast({
                title: 'Toplu Eğitim Modalı Açıldı',
                description: `${skill.name} için ${personnelIds.length} personel seçildi.`,
            });

            // Eğitim kaydedildikten sonra refresh için callback
            // onRefresh(); // Modal kapandıktan sonra çağrılacak
        } catch (error) {
            console.error('Toplu eğitim hazırlama hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Toplu eğitim hazırlanamadı: ' + error.message
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Eğitim İhtiyaç Analizi</h3>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Rapor İndir
                </Button>
            </div>

            {/* İstatistikler */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Eğitim Gereksinimi</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{trainingNeeds.length}</div>
                        <p className="text-xs text-muted-foreground">Aktif eğitim ihtiyacı</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Kritik Eğitimler</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {trainingNeeds.filter(t => t.training_priority === 'Kritik').length}
                        </div>
                        <p className="text-xs text-muted-foreground">Öncelikli</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sertifika Yenileme</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{expiringCerts.length}</div>
                        <p className="text-xs text-muted-foreground">Yaklaşan/geçmiş</p>
                    </CardContent>
                </Card>
            </div>

            {/* Yetkinlik Bazlı Toplu Eğitim */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Yetkinlik Bazlı Toplu Eğitim Planı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {trainingNeedsBySkill.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Yetkinlik bazlı toplu eğitim ihtiyacı bulunmamaktadır.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {trainingNeedsBySkill.map((group) => (
                                <div 
                                    key={group.skill.id}
                                    className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-bold text-lg">{group.skill.name}</h4>
                                                {group.skill.code && (
                                                    <Badge variant="outline">{group.skill.code}</Badge>
                                                )}
                                                {getPriorityBadge(group.highestPriority)}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-4 w-4" />
                                                    {group.count} personel
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {group.personnel.slice(0, 5).map(person => (
                                                    <Badge key={person.id} variant="secondary" className="text-xs">
                                                        {person.full_name}
                                                    </Badge>
                                                ))}
                                                {group.count > 5 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        +{group.count - 5} kişi daha
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            size="lg"
                                            onClick={() => handleCreateBulkTraining(group.skill, group.personnel)}
                                            className="ml-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                                        >
                                            <GraduationCap className="h-5 w-5 mr-2" />
                                            Toplu Eğitim Oluştur
                                            <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs">
                                                {group.count}
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Eğitim İhtiyaçları (Detaylı Liste) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Detaylı Eğitim İhtiyaçları (Personel Bazlı)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {trainingNeeds.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Eğitim gereksinimi bulunmamaktadır.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {trainingNeeds.map((item) => (
                                <div 
                                    key={item.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="font-semibold">{item.person.full_name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {item.skill.name} • Mevcut Seviye: {item.current_level} • Hedef: {item.target_level}
                                        </div>
                                        {item.next_training_date && (
                                            <div className="text-xs text-blue-600 mt-1">
                                                Planlanan: {format(new Date(item.next_training_date), 'dd MMMM yyyy', { locale: tr })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getPriorityBadge(item.training_priority)}
                                        <Badge variant="outline">Seviye {item.current_level}</Badge>
                                        <Button
                                            size="sm"
                                            onClick={() => handleCreateTraining(item.personnel_id, item.skill_id)}
                                            className="ml-2"
                                        >
                                            <GraduationCap className="h-4 w-4 mr-1" />
                                            Eğitim Oluştur
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sertifika Yenileme Uyarıları */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Sertifika Geçerlilik Uyarıları
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {expiringCerts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Sertifika yenileme uyarısı bulunmamaktadır.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {expiringCerts.map((alert) => (
                                <div 
                                    key={alert.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="font-semibold">{alert.personnel_name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {alert.skill_name} ({alert.skill_code})
                                        </div>
                                        {alert.certification_expiry_date && (
                                            <div className="text-xs text-red-600 mt-1">
                                                Son Geçerlilik: {format(new Date(alert.certification_expiry_date), 'dd MMMM yyyy', { locale: tr })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-end gap-2">
                                            {getStatusBadge(alert.status)}
                                            {alert.days_remaining !== null && (
                                                <span className="text-xs text-muted-foreground">
                                                    {alert.days_remaining > 0 
                                                        ? `${alert.days_remaining} gün kaldı` 
                                                        : `${Math.abs(alert.days_remaining)} gün geçti`}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCreateTraining(alert.personnel_id, alert.skill_id)}
                                        >
                                            <GraduationCap className="h-4 w-4 mr-1" />
                                            Yenileme Eğitimi
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TrainingNeedsAnalysis;

