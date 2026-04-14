import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    BookOpen,
    ClipboardList,
    UserCheck,
    Award,
    Target,
    GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#a4de6c', '#d0ed57', '#ffc658'];

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
};

/** Aynı eğitimde aynı personel birden fazla satırda olmasın (adam/saat şişmesin) */
function uniqueAttendedCount(training) {
    const seen = new Set();
    for (const p of training.training_participants || []) {
        if (p.status !== 'Katıldı' && p.status !== 'Tamamlandı') continue;
        if (p.personnel_id == null) continue;
        seen.add(p.personnel_id);
    }
    return seen.size;
}

function ReportKpiCard({ icon: Icon, iconClassName, value, label, labelClassName }) {
    return (
        <Card
            className={cn(
                'rounded-xl border border-border/80 bg-card shadow-sm',
                'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5'
            )}
        >
            <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="rounded-lg bg-muted/70 p-2 ring-1 ring-border/40">
                        <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} />
                    </div>
                </div>
                <div className="mt-3 min-w-0">
                    <span className="block text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</span>
                    <p
                        className={cn(
                            'text-[10px] font-medium text-muted-foreground mt-1 leading-snug',
                            labelClassName ?? 'uppercase tracking-wider'
                        )}
                    >
                        {label}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

/** Sınav tanımlı eğitimde notu girilmiş tamamlanan katılımcı (başarı oranı paydası) */
function isEvaluatedExamCompletion(p) {
    if (p.status !== 'Tamamlandı') return false;
    const exams = p.trainings?.training_exams;
    if (!exams?.length) return false;
    if (p.score === null || p.score === undefined) return false;
    return true;
}

function isExamPassed(p) {
    if (!isEvaluatedExamCompletion(p)) return false;
    const passing = p.trainings.training_exams[0]?.passing_score;
    if (passing === null || passing === undefined) return false;
    return Number(p.score) >= Number(passing);
}

const TrainingReportsTab = () => {
    const [stats, setStats] = useState({
        totalTrainings: 0,
        totalParticipants: 0,
        avgParticipation: 0,
        avgSuccess: 0,
        /** Toplam adam/saat (benzersiz) ÷ toplam personel */
        avgManHoursPerEmployee: 0,
        trainingCoverage: 0,
    });
    const [monthlyData, setMonthlyData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [personnel, setPersonnel] = useState([]);
    const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
    const [personnelReport, setPersonnelReport] = useState(null);
    const [monthlyManHoursData, setMonthlyManHoursData] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            const { data: trainings, error: trainingsError } = await supabase
                .from('trainings')
                .select('id, category, start_date, duration_hours, training_participants(id, personnel_id, status)');
            const { data: participants, error: participantsError } = await supabase
                .from('training_participants')
                .select('id, status, score, personnel_id, training_id, trainings(training_exams(passing_score))');
            const { error: personnelError, count: personnelCount } = await supabase.from('personnel').select('id', { count: 'exact' });

            if (trainingsError || participantsError || personnelError) return;

            const attendedCount = participants.filter((p) => p.status === 'Katıldı' || p.status === 'Tamamlandı').length;

            const evaluatedExam = participants.filter(isEvaluatedExamCompletion);
            const passedExam = evaluatedExam.filter(isExamPassed);
            const avgSuccess =
                evaluatedExam.length > 0
                    ? Math.min(100, (passedExam.length / evaluatedExam.length) * 100)
                    : 0;

            const totalManHours = trainings.reduce((acc, training) => {
                const n = uniqueAttendedCount(training);
                return acc + (Number(training.duration_hours) || 0) * n;
            }, 0);

            const avgManHoursPerEmployee =
                personnelCount > 0 ? totalManHours / personnelCount : 0;

            const uniqueTrainedPersonnel = new Set(
                participants.filter((p) => p.status === 'Katıldı' || p.status === 'Tamamlandı').map((p) => p.personnel_id)
            );
            const trainingCoverage = personnelCount > 0 ? (uniqueTrainedPersonnel.size / personnelCount) * 100 : 0;

            setStats({
                totalTrainings: trainings.length,
                totalParticipants: participants.length,
                avgParticipation: participants.length > 0 ? (attendedCount / participants.length) * 100 : 0,
                avgSuccess,
                avgManHoursPerEmployee,
                trainingCoverage,
            });

            const monthly = trainings.reduce((acc, t) => {
                if (!t.start_date) return acc;
                const month = format(new Date(t.start_date), 'yyyy-MM', { locale: tr });
                acc[month] = (acc[month] || 0) + 1;
                return acc;
            }, {});
            setMonthlyData(
                Object.entries(monthly)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([name, value]) => ({ name: format(new Date(name), 'MMM yyyy', { locale: tr }), eğitimler: value }))
            );

            const category = trainings.reduce((acc, t) => {
                const catName = t.category || 'Belirtilmemiş';
                acc[catName] = (acc[catName] || 0) + 1;
                return acc;
            }, {});
            setCategoryData(Object.entries(category).map(([name, value]) => ({ name, value })));

            const monthlyManHours = trainings.reduce((acc, training) => {
                if (!training.start_date) return acc;
                const month = format(new Date(training.start_date), 'yyyy-MM', { locale: tr });
                const hours = (Number(training.duration_hours) || 0) * uniqueAttendedCount(training);
                acc[month] = (acc[month] || 0) + hours;
                return acc;
            }, {});
            setMonthlyManHoursData(
                Object.entries(monthlyManHours)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([name, value]) => ({ name: format(new Date(name), 'MMM yyyy', { locale: tr }), 'Adam/Saat': value }))
            );
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
            setPersonnelReport({ trainings: participations.map((p) => p.trainings) });
        };
        fetchPersonnelReport();
    }, [selectedPersonnelId]);

    return (
        <motion.div initial="hidden" animate="visible" variants={cardVariants} className="space-y-6">
            <motion.div variants={cardVariants}>
                <h2 className="text-sm font-semibold text-foreground tracking-tight mb-3">Özet metrikler</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <ReportKpiCard
                        icon={BookOpen}
                        iconClassName="text-sky-600 dark:text-sky-400"
                        value={stats.totalTrainings}
                        label="Toplam eğitim"
                    />
                    <ReportKpiCard
                        icon={ClipboardList}
                        iconClassName="text-violet-600 dark:text-violet-400"
                        value={stats.totalParticipants}
                        label="Katılımcı kaydı"
                    />
                    <ReportKpiCard
                        icon={UserCheck}
                        iconClassName="text-emerald-600 dark:text-emerald-400"
                        value={`${stats.avgParticipation.toFixed(1)}%`}
                        label="Ort. katılım"
                    />
                    <ReportKpiCard
                        icon={Award}
                        iconClassName="text-amber-600 dark:text-amber-400"
                        value={`${stats.avgSuccess.toFixed(1)}%`}
                        label="Sınav başarısı"
                    />
                    <ReportKpiCard
                        icon={Target}
                        iconClassName="text-rose-600 dark:text-rose-400"
                        value={`${stats.trainingCoverage.toFixed(1)}%`}
                        label="Eğitim kapsamı"
                    />
                    <ReportKpiCard
                        icon={GraduationCap}
                        iconClassName="text-orange-600 dark:text-orange-400"
                        value={`${stats.avgManHoursPerEmployee.toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })} sa`}
                        label="Adam/saat eğitim ortalaması"
                        labelClassName="normal-case tracking-tight"
                    />
                </div>
            </motion.div>
            <motion.div variants={cardVariants} className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                <Card className="lg:col-span-2 rounded-xl border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Aylık Adam/Saat Performansı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={monthlyManHoursData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Adam/Saat" fill="#16a34a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="rounded-xl border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Kategori Dağılımı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </motion.div>
            <motion.div variants={cardVariants}>
                <Card className="rounded-xl border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Aylık Eğitim Sayısı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="eğitimler" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </motion.div>
            <motion.div variants={cardVariants}>
                <Card className="rounded-xl border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Personel Bazlı Rapor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select onValueChange={setSelectedPersonnelId}>
                            <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Personel Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {personnel.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {personnelReport && (
                            <div className="mt-4 rounded-lg border border-border/80 bg-muted/20 p-4">
                                <h4 className="font-semibold mb-2">{personnel.find((p) => p.id === selectedPersonnelId)?.full_name} Aldığı Eğitimler:</h4>
                                {personnelReport.trainings.length > 0 ? (
                                    <ul className="list-disc pl-5 space-y-1">
                                        {personnelReport.trainings.map((t) => (
                                            <li key={t.id}>{t.title}</li>
                                        ))}
                                    </ul>
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
