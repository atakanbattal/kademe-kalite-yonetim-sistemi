import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { motion } from 'framer-motion';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#a4de6c', '#d0ed57', '#ffc658'];

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
    };

    const TrainingReportsTab = () => {
        const [stats, setStats] = useState({ totalTrainings: 0, totalParticipants: 0, avgParticipation: 0, avgSuccess: 0, totalManHours: 0, trainingCoverage: 0 });
        const [monthlyData, setMonthlyData] = useState([]);
        const [categoryData, setCategoryData] = useState([]);
        const [personnel, setPersonnel] = useState([]);
        const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
        const [personnelReport, setPersonnelReport] = useState(null);
        const [monthlyManHoursData, setMonthlyManHoursData] = useState([]);

        useEffect(() => {
            const fetchDashboardData = async () => {
                const { data: trainings, error: trainingsError } = await supabase.from('trainings').select('id, category, start_date, duration_hours, training_participants(id, personnel_id, status)');
                const { data: participants, error: participantsError } = await supabase.from('training_participants').select('id, status, score, personnel_id, training_id, trainings(training_exams(passing_score))');
                const { data: allPersonnel, error: personnelError, count: personnelCount } = await supabase.from('personnel').select('id', { count: 'exact' });

                if (trainingsError || participantsError || personnelError) return;

                const attendedCount = participants.filter(p => p.status === 'Katıldı' || p.status === 'Tamamlandı').length;
                
                const successfulParticipants = participants.filter(p => {
                    if (p.status !== 'Tamamlandı' || p.score === null) return false;
                    const exam = p.trainings?.training_exams?.[0];
                    if (!exam) return true; // If no exam, completion is success
                    return p.score >= exam.passing_score;
                });

                const participantsWithExams = participants.filter(p => p.trainings?.training_exams?.length > 0 && p.status === 'Tamamlandı');

                const totalManHours = trainings.reduce((acc, training) => {
                    const attendedParticipantsCount = training.training_participants.filter(p => p.status === 'Katıldı' || p.status === 'Tamamlandı').length;
                    return acc + ((training.duration_hours || 0) * attendedParticipantsCount);
                }, 0);
                
                const uniqueTrainedPersonnel = new Set(participants.filter(p => p.status === 'Katıldı' || p.status === 'Tamamlandı').map(p => p.personnel_id));
                const trainingCoverage = personnelCount > 0 ? (uniqueTrainedPersonnel.size / personnelCount) * 100 : 0;

                setStats({
                    totalTrainings: trainings.length,
                    totalParticipants: participants.length,
                    avgParticipation: participants.length > 0 ? (attendedCount / participants.length) * 100 : 0,
                    avgSuccess: participantsWithExams.length > 0 ? (successfulParticipants.length / participantsWithExams.length) * 100 : 0,
                    totalManHours: totalManHours,
                    trainingCoverage: trainingCoverage
                });

                const monthly = trainings.reduce((acc, t) => {
                    if (!t.start_date) return acc;
                    const month = format(new Date(t.start_date), 'yyyy-MM', { locale: tr });
                    acc[month] = (acc[month] || 0) + 1;
                    return acc;
                }, {});
                setMonthlyData(Object.entries(monthly).sort((a,b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name: format(new Date(name), 'MMM yyyy', { locale: tr }), eğitimler: value })));

                const category = trainings.reduce((acc, t) => {
                    const catName = t.category || 'Belirtilmemiş';
                    acc[catName] = (acc[catName] || 0) + 1;
                    return acc;
                }, {});
                setCategoryData(Object.entries(category).map(([name, value]) => ({ name, value })));

                const monthlyManHours = trainings.reduce((acc, training) => {
                    if (!training.start_date) return acc;
                    const month = format(new Date(training.start_date), 'yyyy-MM', { locale: tr });
                    const attendedParticipantsCount = training.training_participants.filter(p => p.status === 'Katıldı' || p.status === 'Tamamlandı').length;
                    const hours = (training.duration_hours || 0) * attendedParticipantsCount;
                    acc[month] = (acc[month] || 0) + hours;
                    return acc;
                }, {});
                 setMonthlyManHoursData(Object.entries(monthlyManHours).sort((a,b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name: format(new Date(name), 'MMM yyyy', { locale: tr }), "Adam/Saat": value })));
            };

            const fetchPersonnel = async () => {
                const { data } = await supabase.from('personnel').select('id, full_name');
                setPersonnel(data || []);
            };

            fetchDashboardData();
            fetchPersonnel();
        }, []);

        useEffect(() => {
            if (!selectedPersonnelId) {
                setPersonnelReport(null);
                return;
            }
            const fetchPersonnelReport = async () => {
                const { data: participations } = await supabase.from('training_participants').select('*, trainings(*)').eq('personnel_id', selectedPersonnelId);
                setPersonnelReport({ trainings: participations.map(p => p.trainings) });
            };
            fetchPersonnelReport();
        }, [selectedPersonnelId]);

        return (
            <motion.div initial="hidden" animate="visible" variants={cardVariants} className="space-y-6">
                <motion.div variants={cardVariants} className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <Card><CardHeader><CardTitle>Toplam Eğitim</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalTrainings}</div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Katılımcı Kaydı</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalParticipants}</div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Ort. Katılım Oranı</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.avgParticipation.toFixed(2)}%</div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Ort. Başarı Oranı</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.avgSuccess.toFixed(2)}%</div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Eğitim Kapsamı</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.trainingCoverage.toFixed(2)}%</div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Toplam Adam/Saat</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalManHours.toFixed(2)}</div></CardContent></Card>
                </motion.div>
                <motion.div variants={cardVariants} className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader><CardTitle>Aylık Adam/Saat Performansı</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyManHoursData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="Adam/Saat" fill="#16a34a" /></BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Kategori Dağılımı</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>{categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>
                 <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader><CardTitle>Aylık Eğitim Sayısı</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="eğitimler" fill="#8884d8" /></BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader><CardTitle>Personel Bazlı Rapor</CardTitle></CardHeader>
                        <CardContent>
                            <Select onValueChange={setSelectedPersonnelId}><SelectTrigger className="w-[300px]"><SelectValue placeholder="Personel Seçin" /></SelectTrigger><SelectContent>{personnel.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent></Select>
                            {personnelReport && (
                                <div className="mt-4 p-4 border rounded-md">
                                    <h4 className="font-semibold mb-2">{personnel.find(p => p.id === selectedPersonnelId)?.full_name} Aldığı Eğitimler:</h4>
                                    {personnelReport.trainings.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1">{personnelReport.trainings.map(t => <li key={t.id}>{t.title}</li>)}</ul>
                                    ) : (
                                        <p className="text-muted-foreground">Bu personele ait eğitim kaydı bulunamadı.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        );
    };

    export default TrainingReportsTab;