import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, TrendingUp, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const BalanceDashboard = ({ records, loading }) => {
    const stats = useMemo(() => {
        if (!records || records.length === 0) {
            return {
                total: 0,
                pass: 0,
                fail: 0,
                passRate: 0,
                recentRecords: []
            };
        }

        const pass = records.filter(r => r.overall_result === 'PASS').length;
        const fail = records.filter(r => r.overall_result === 'FAIL').length;
        const passRate = records.length > 0 ? ((pass / records.length) * 100).toFixed(1) : 0;

        // Son 10 kayıt
        const recentRecords = [...records]
            .sort((a, b) => new Date(b.test_date || b.created_at) - new Date(a.test_date || a.created_at))
            .slice(0, 10);

        return {
            total: records.length,
            pass,
            fail,
            passRate: parseFloat(passRate),
            recentRecords
        };
    }, [records]);

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-6">
            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Toplam Kayıt</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground">
                                Toplam balans kaydı
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Geçen Kayıtlar</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{stats.pass}</div>
                            <p className="text-xs text-muted-foreground">
                                ISO 1940-1 standardına uygun
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kalan Kayıtlar</CardTitle>
                            <XCircle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
                            <p className="text-xs text-muted-foreground">
                                Tolerans dışı kayıtlar
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Başarı Oranı</CardTitle>
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.passRate}%</div>
                            <p className="text-xs text-muted-foreground">
                                Geçen kayıtların yüzdesi
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Son Kayıtlar */}
            {stats.recentRecords.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Son Kayıtlar</CardTitle>
                            <CardDescription>
                                En son eklenen balans kayıtları
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {stats.recentRecords.map((record) => (
                                    <div
                                        key={record.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium">{record.serial_number}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {record.test_date
                                                    ? format(new Date(record.test_date), 'dd.MM.yyyy', { locale: tr })
                                                    : '-'}
                                                {record.supplier_name && ` • ${record.supplier_name}`}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {record.overall_result === 'PASS' ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : record.overall_result === 'FAIL' ? (
                                                <XCircle className="w-5 h-5 text-red-500" />
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
};

export default BalanceDashboard;









