import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, Search, Filter, Download, BarChart3, 
    AlertCircle, TrendingUp, Clock, CheckCircle2,
    X, FileText, Users
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComplaintFormModal from '@/components/customer-complaints/ComplaintFormModal';
import ComplaintDetailModal from '@/components/customer-complaints/ComplaintDetailModal';
import ComplaintAnalytics from '@/components/customer-complaints/ComplaintAnalytics';
import ComplaintSLADashboard from '@/components/customer-complaints/ComplaintSLADashboard';
import { normalizeTurkishForSearch } from '@/lib/utils';

const SEVERITY_COLORS = {
    'Kritik': 'destructive',
    'Yüksek': 'warning',
    'Orta': 'default',
    'Düşük': 'secondary'
};

const STATUS_COLORS = {
    'Açık': 'destructive',
    'Analiz Aşamasında': 'warning',
    'Aksiyon Alınıyor': 'default',
    'Doğrulama Bekleniyor': 'secondary',
    'Kapalı': 'success',
    'İptal': 'outline'
};

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = "blue" }) => {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                            {title}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <h2 className={`text-3xl font-bold text-${color}-600`}>
                                {value}
                            </h2>
                            {trend && trendValue && (
                                <span className={`text-sm ${trend === 'up' ? 'text-red-500' : 'text-green-500'} flex items-center gap-1`}>
                                    <TrendingUp className={`w-4 h-4 ${trend === 'down' ? 'rotate-180' : ''}`} />
                                    {trendValue}%
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={`p-3 bg-${color}-100 dark:bg-${color}-900/20 rounded-full`}>
                        <Icon className={`w-6 h-6 text-${color}-600`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const ComplaintFilters = ({ 
    searchTerm, 
    setSearchTerm, 
    filterStatus, 
    setFilterStatus,
    filterSeverity,
    setFilterSeverity,
    filterCustomer,
    setFilterCustomer,
    customers,
    onReset
}) => {
    const hasActiveFilters = searchTerm || filterStatus !== 'all' || 
        filterSeverity !== 'all' || filterCustomer !== 'all';

    return (
        <Card className="mb-6">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        <CardTitle className="text-lg">Filtreler</CardTitle>
                    </div>
                    {hasActiveFilters && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={onReset}
                            className="flex items-center gap-1"
                        >
                            <X className="w-4 h-4" />
                            Temizle
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="search-box">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Şikayet ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm Müşteriler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Müşteriler</SelectItem>
                            {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.customer_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm Durumlar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            <SelectItem value="Açık">Açık</SelectItem>
                            <SelectItem value="Analiz Aşamasında">Analiz Aşamasında</SelectItem>
                            <SelectItem value="Aksiyon Alınıyor">Aksiyon Alınıyor</SelectItem>
                            <SelectItem value="Doğrulama Bekleniyor">Doğrulama Bekleniyor</SelectItem>
                            <SelectItem value="Kapalı">Kapalı</SelectItem>
                            <SelectItem value="İptal">İptal</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm Önem Seviyeleri" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Önem Seviyeleri</SelectItem>
                            <SelectItem value="Kritik">Kritik</SelectItem>
                            <SelectItem value="Yüksek">Yüksek</SelectItem>
                            <SelectItem value="Orta">Orta</SelectItem>
                            <SelectItem value="Düşük">Düşük</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};

const ComplaintList = ({ 
    complaints, 
    loading, 
    onViewComplaint, 
    searchTerm, 
    filterStatus, 
    filterSeverity,
    filterCustomer 
}) => {
    const filteredComplaints = useMemo(() => {
        let filtered = complaints;

        if (filterCustomer !== 'all') {
            filtered = filtered.filter(c => c.customer_id === filterCustomer);
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter(c => c.status === filterStatus);
        }

        if (filterSeverity !== 'all') {
            filtered = filtered.filter(c => c.severity === filterSeverity);
        }

        if (searchTerm) {
            const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm);
            // Kapsamlı arama: şikayet no, başlık, açıklama, ürün, müşteri, çözüm, root cause
            filtered = filtered.filter(c =>
                normalizeTurkishForSearch(c.complaint_number).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.title).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.description).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.product_name).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.product_code).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.batch_number).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.customer?.customer_name).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.root_cause).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.solution).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.assigned_to).includes(normalizedSearchTerm)
            );
        }

        return filtered;
    }, [complaints, searchTerm, filterStatus, filterSeverity, filterCustomer]);

    const getDaysOpen = (complaintDate, closeDate) => {
        const start = new Date(complaintDate);
        const end = closeDate ? new Date(closeDate) : new Date();
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        Yükleniyor...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (filteredComplaints.length === 0) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        {searchTerm || filterStatus !== 'all' || filterSeverity !== 'all' || filterCustomer !== 'all'
                            ? 'Arama kriterlerine uygun şikayet bulunamadı.'
                            : 'Henüz şikayet kaydı bulunmuyor.'}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="w-12">S.No</th>
                                <th>Şikayet No</th>
                                <th>Müşteri</th>
                                <th>Başlık</th>
                                <th>Ürün</th>
                                <th>Önem</th>
                                <th>Durum</th>
                                <th>Tarih</th>
                                <th>Açık Gün</th>
                                <th>Sorumlu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredComplaints.map((complaint, index) => (
                                <tr 
                                    key={complaint.id}
                                    onClick={() => onViewComplaint(complaint)}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                    <td>{index + 1}</td>
                                    <td className="font-mono text-sm font-medium">
                                        {complaint.complaint_number}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <div className="font-medium">
                                                    {complaint.customer?.customer_name || 'N/A'}
                                                </div>
                                                {complaint.customer?.customer_code && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {complaint.customer.customer_code}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="max-w-xs">
                                            <div className="font-medium truncate">
                                                {complaint.title}
                                            </div>
                                            {complaint.complaint_category && (
                                                <div className="text-xs text-muted-foreground">
                                                    {complaint.complaint_category}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {complaint.product_name ? (
                                            <div className="text-sm">
                                                <div>{complaint.product_name}</div>
                                                {complaint.product_code && (
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        {complaint.product_code}
                                                    </div>
                                                )}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        <Badge variant={SEVERITY_COLORS[complaint.severity] || 'default'}>
                                            {complaint.severity}
                                        </Badge>
                                    </td>
                                    <td>
                                        <Badge variant={STATUS_COLORS[complaint.status] || 'default'}>
                                            {complaint.status}
                                        </Badge>
                                    </td>
                                    <td className="text-sm">
                                        {new Date(complaint.complaint_date).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                            <span className={`text-sm ${getDaysOpen(complaint.complaint_date, complaint.actual_close_date) > 30 ? 'text-red-600 font-semibold' : ''}`}>
                                                {getDaysOpen(complaint.complaint_date, complaint.actual_close_date)} gün
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-sm">
                                        {complaint.assigned_to?.full_name || 
                                         complaint.responsible_person?.full_name || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t bg-muted/50">
                    <div className="text-sm text-muted-foreground">
                        Toplam {filteredComplaints.length} şikayet gösteriliyor
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const CustomerComplaintsModule = () => {
    const { customerComplaints, customers, loading, refreshData } = useData();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [editingComplaint, setEditingComplaint] = useState(null);
    const [viewingComplaint, setViewingComplaint] = useState(null);
    
    // Filtreler
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [filterCustomer, setFilterCustomer] = useState('all');
    const [activeTab, setActiveTab] = useState('list');

    // İstatistikler
    const stats = useMemo(() => {
        const total = customerComplaints.length;
        const open = customerComplaints.filter(c => 
            c.status !== 'Kapalı' && c.status !== 'İptal'
        ).length;
        const critical = customerComplaints.filter(c => 
            c.severity === 'Kritik' && c.status !== 'Kapalı' && c.status !== 'İptal'
        ).length;
        const closed = customerComplaints.filter(c => c.status === 'Kapalı').length;
        
        // Ortalama çözüm süresi (kapalı şikayetler için)
        const resolvedComplaints = customerComplaints.filter(c => c.actual_close_date);
        let avgResolutionDays = 0;
        if (resolvedComplaints.length > 0) {
            const totalDays = resolvedComplaints.reduce((sum, c) => {
                const start = new Date(c.complaint_date);
                const end = new Date(c.actual_close_date);
                return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            }, 0);
            avgResolutionDays = Math.round(totalDays / resolvedComplaints.length);
        }

        return { total, open, critical, closed, avgResolutionDays };
    }, [customerComplaints]);

    const openFormModal = useCallback((complaint = null) => {
        setEditingComplaint(complaint);
        setFormModalOpen(true);
    }, []);

    const closeFormModal = useCallback(() => {
        setEditingComplaint(null);
        setFormModalOpen(false);
    }, []);

    const openDetailModal = useCallback((complaint) => {
        setViewingComplaint(complaint);
        setDetailModalOpen(true);
    }, []);

    const closeDetailModal = useCallback(() => {
        setViewingComplaint(null);
        setDetailModalOpen(false);
    }, []);

    const handleFormSuccess = useCallback(() => {
        refreshData();
        closeFormModal();
    }, [refreshData, closeFormModal]);

    const handleEditFromDetail = useCallback((complaint) => {
        closeDetailModal();
        openFormModal(complaint);
    }, [closeDetailModal, openFormModal]);

    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setFilterStatus('all');
        setFilterSeverity('all');
        setFilterCustomer('all');
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        <AlertCircle className="w-8 h-8" />
                        Müşteri Şikayetleri Yönetimi
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Müşteri şikayetlerini kaydedin, analiz edin ve çözümleyin
                    </p>
                </div>
                <Button onClick={() => openFormModal()} size="lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Yeni Şikayet
                </Button>
            </div>

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard 
                    title="Toplam Şikayet" 
                    value={stats.total} 
                    icon={FileText}
                    color="blue"
                />
                <StatCard 
                    title="Açık Şikayet" 
                    value={stats.open} 
                    icon={AlertCircle}
                    color="orange"
                />
                <StatCard 
                    title="Kritik" 
                    value={stats.critical} 
                    icon={AlertCircle}
                    color="red"
                />
                <StatCard 
                    title="Kapalı" 
                    value={stats.closed} 
                    icon={CheckCircle2}
                    color="green"
                />
                <StatCard 
                    title="Ort. Çözüm Süresi" 
                    value={`${stats.avgResolutionDays}g`} 
                    icon={Clock}
                    color="purple"
                />
            </div>

            {/* Tab Menüsü */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="list">
                        <FileText className="w-4 h-4 mr-2" />
                        Şikayet Listesi
                    </TabsTrigger>
                    <TabsTrigger value="sla">
                        <Clock className="w-4 h-4 mr-2" />
                        SLA Takibi
                    </TabsTrigger>
                    <TabsTrigger value="analytics">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analiz ve Raporlar
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-6 mt-6">
                    {/* Filtreler */}
                    <ComplaintFilters
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filterStatus={filterStatus}
                        setFilterStatus={setFilterStatus}
                        filterSeverity={filterSeverity}
                        setFilterSeverity={setFilterSeverity}
                        filterCustomer={filterCustomer}
                        setFilterCustomer={setFilterCustomer}
                        customers={customers}
                        onReset={resetFilters}
                    />

                    {/* Şikayet Listesi */}
                    <ComplaintList
                        complaints={customerComplaints}
                        loading={loading}
                        onViewComplaint={openDetailModal}
                        searchTerm={searchTerm}
                        filterStatus={filterStatus}
                        filterSeverity={filterSeverity}
                        filterCustomer={filterCustomer}
                    />
                </TabsContent>

                <TabsContent value="sla" className="mt-6">
                    <ComplaintSLADashboard complaints={customerComplaints} />
                </TabsContent>

                <TabsContent value="analytics" className="mt-6">
                    <ComplaintAnalytics 
                        complaints={customerComplaints}
                        customers={customers}
                    />
                </TabsContent>
            </Tabs>

            {/* Modaller */}
            {isFormModalOpen && (
                <ComplaintFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingComplaint={editingComplaint}
                    onSuccess={handleFormSuccess}
                />
            )}

            {isDetailModalOpen && viewingComplaint && (
                <ComplaintDetailModal
                    open={isDetailModalOpen}
                    setOpen={setDetailModalOpen}
                    complaint={viewingComplaint}
                    onEdit={handleEditFromDetail}
                    onRefresh={refreshData}
                />
            )}
        </motion.div>
    );
};

export default CustomerComplaintsModule;
