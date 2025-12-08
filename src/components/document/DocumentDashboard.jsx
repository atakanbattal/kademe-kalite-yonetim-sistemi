import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    FileText, 
    Clock, 
    CheckCircle, 
    AlertTriangle, 
    Users, 
    Building2,
    TrendingUp,
    Archive,
    FileCheck
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const DocumentDashboard = ({ documents, loading }) => {
    const stats = useMemo(() => {
        if (!documents || documents.length === 0) {
            return {
                total: 0,
                byDepartment: {},
                byCategory: {},
                byStatus: {},
                expiringSoon: 0,
                pendingApproval: 0,
                archived: 0,
                active: 0
            };
        }

        const stats = {
            total: documents.length,
            byDepartment: {},
            byCategory: {},
            byStatus: {},
            expiringSoon: 0,
            pendingApproval: 0,
            archived: 0,
            active: 0
        };

        const today = new Date();
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);

        documents.forEach(doc => {
            // Birim bazlı
            const deptName = doc.department?.unit_name || doc.department_name || 'Belirtilmemiş';
            stats.byDepartment[deptName] = (stats.byDepartment[deptName] || 0) + 1;

            // Kategori bazlı
            const category = doc.document_type || 'Diğer';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

            // Durum bazlı
            const status = doc.approval_status || doc.status || 'Bilinmiyor';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

            // Süresi yaklaşan
            if (doc.next_review_date) {
                const reviewDate = new Date(doc.next_review_date);
                if (reviewDate <= thirtyDaysLater && reviewDate >= today) {
                    stats.expiringSoon++;
                }
            }
            if (doc.valid_until) {
                const expiryDate = new Date(doc.valid_until);
                if (expiryDate <= thirtyDaysLater && expiryDate >= today) {
                    stats.expiringSoon++;
                }
            }

            // Onay bekleyen
            if (doc.approval_status === 'Onay Bekliyor' || doc.approval_status === 'Taslak') {
                stats.pendingApproval++;
            }

            // Arşivlenmiş
            if (doc.is_archived) {
                stats.archived++;
            } else {
                stats.active++;
            }
        });

        return stats;
    }, [documents]);

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Yükleniyor...</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">-</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* İstatistik Kartları */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Doküman</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.active} aktif, {stats.archived} arşivlenmiş
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Onay Bekleyen</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</div>
                        <p className="text-xs text-muted-foreground">
                            Onay sürecinde bekleyen dokümanlar
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Süresi Yaklaşan</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
                        <p className="text-xs text-muted-foreground">
                            30 gün içinde revizyon/geçerlilik tarihi
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Birim Sayısı</CardTitle>
                        <Building2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {Object.keys(stats.byDepartment).length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Dokümanı olan birim sayısı
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Birim Bazlı Dağılım */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Birim Bazlı Doküman Dağılımı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {Object.keys(stats.byDepartment).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            Birim bazlı doküman bulunmuyor.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(stats.byDepartment)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 10)
                                .map(([dept, count]) => (
                                    <div key={dept} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">{dept}</span>
                                        </div>
                                        <Badge variant="secondary">{count} doküman</Badge>
                                    </div>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Kategori Bazlı Dağılım */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Kategori Dağılımı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {Object.keys(stats.byCategory).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Kategori bilgisi bulunmuyor.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(stats.byCategory)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([category, count]) => (
                                        <div key={category} className="flex items-center justify-between">
                                            <span className="text-sm">{category}</span>
                                            <Badge>{count}</Badge>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Durum Dağılımı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {Object.keys(stats.byStatus).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Durum bilgisi bulunmuyor.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(stats.byStatus)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([status, count]) => {
                                        const statusColors = {
                                            'Yayınlandı': 'bg-green-100 text-green-800',
                                            'Onaylandı': 'bg-blue-100 text-blue-800',
                                            'Onay Bekliyor': 'bg-yellow-100 text-yellow-800',
                                            'Taslak': 'bg-gray-100 text-gray-800',
                                            'Reddedildi': 'bg-red-100 text-red-800'
                                        };
                                        return (
                                            <div key={status} className="flex items-center justify-between">
                                                <span className="text-sm">{status}</span>
                                                <Badge className={statusColors[status] || ''}>{count}</Badge>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DocumentDashboard;

