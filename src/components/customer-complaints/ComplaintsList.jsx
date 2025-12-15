import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/customSupabaseClient';
import { 
    Search, 
    Filter,
    Eye,
    Edit,
    Trash2,
    FileText,
    Calendar,
    User,
    AlertTriangle,
    ChevronDown,
    Download,
    Plus
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { normalizeTurkishForSearch } from '../../lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function ComplaintsList({ 
    onEdit, 
    onView, 
    onNew,
    filterStatus = 'all' 
}) {
    const [complaints, setComplaints] = useState([]);
    const [filteredComplaints, setFilteredComplaints] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: filterStatus,
        severity: 'all',
        customer: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: ''
    });
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'complaint_date', direction: 'desc' });

    useEffect(() => {
        fetchCustomers();
        fetchComplaints();
    }, []);

    useEffect(() => {
        setFilters(prev => ({ ...prev, status: filterStatus }));
    }, [filterStatus]);

    useEffect(() => {
        applyFilters();
    }, [complaints, searchTerm, filters, sortConfig]);

    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, customer_name, customer_code')
                .eq('is_active', true)
                .order('customer_name');

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Müşteriler yüklenirken hata:', error);
        }
    };

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_complaints')
                .select(`
                    *,
                    customer:customers(customer_name, customer_code),
                    assigned_user:assigned_to(full_name),
                    responsible_user:responsible_person(full_name)
                `)
                .order('complaint_date', { ascending: false });

            if (error) throw error;
            setComplaints(data || []);
        } catch (error) {
            console.error('Şikayetler yüklenirken hata:', error);
            alert('Şikayetler yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...complaints];

        // Arama filtresi
        if (searchTerm) {
            const normalizedSearchTerm = normalizeTurkishForSearch(searchTerm);
            filtered = filtered.filter(c =>
                normalizeTurkishForSearch(c.complaint_number).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.complaint_title).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.complaint_description).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.customer?.customer_name).includes(normalizedSearchTerm) ||
                normalizeTurkishForSearch(c.product_name).includes(normalizedSearchTerm)
            );
        }

        // Durum filtresi
        if (filters.status !== 'all') {
            if (filters.status === 'new') {
                filtered = filtered.filter(c => c.status === 'Yeni');
            } else if (filters.status === 'inProgress') {
                filtered = filtered.filter(c => 
                    ['İnceleniyor', 'Analiz Aşamasında', 'Aksiyon Alınıyor'].includes(c.status)
                );
            } else if (filters.status === 'resolved') {
                filtered = filtered.filter(c => 
                    ['Çözüldü', 'Kapatıldı'].includes(c.status)
                );
            } else if (filters.status === 'critical') {
                filtered = filtered.filter(c => c.severity === 'Kritik');
            } else {
                filtered = filtered.filter(c => c.status === filters.status);
            }
        }

        // Şiddet filtresi
        if (filters.severity !== 'all') {
            filtered = filtered.filter(c => c.severity === filters.severity);
        }

        // Müşteri filtresi
        if (filters.customer !== 'all') {
            filtered = filtered.filter(c => c.customer_id === filters.customer);
        }

        // Kategori filtresi
        if (filters.category !== 'all') {
            filtered = filtered.filter(c => c.complaint_category === filters.category);
        }

        // Tarih filtreleri
        if (filters.dateFrom) {
            filtered = filtered.filter(c => 
                new Date(c.complaint_date) >= new Date(filters.dateFrom)
            );
        }
        if (filters.dateTo) {
            filtered = filtered.filter(c => 
                new Date(c.complaint_date) <= new Date(filters.dateTo)
            );
        }

        // Sıralama
        filtered.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            if (aVal === bVal) return 0;
            
            const comparison = aVal < bVal ? -1 : 1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        setFilteredComplaints(filtered);
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu şikayeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm ilişkili veriler silinecektir.')) {
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('customer_complaints')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('Şikayet başarıyla silindi!');
            fetchComplaints();
        } catch (error) {
            console.error('Şikayet silinirken hata:', error);
            alert(`Hata: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'Yeni': { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: AlertTriangle },
            'İnceleniyor': { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Eye },
            'Analiz Aşamasında': { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: FileText },
            'Aksiyon Alınıyor': { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: User },
            'Çözüldü': { color: 'bg-green-100 text-green-800 border-green-300', icon: FileText },
            'Kapatıldı': { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: FileText },
            'İptal': { color: 'bg-red-100 text-red-800 border-red-300', icon: FileText }
        };

        const config = statusConfig[status] || statusConfig['Yeni'];
        return (
            <Badge className={config.color}>
                {status}
            </Badge>
        );
    };

    const getSeverityBadge = (severity) => {
        const severityConfig = {
            'Kritik': 'bg-red-100 text-red-800 border-red-300',
            'Yüksek': 'bg-orange-100 text-orange-800 border-orange-300',
            'Orta': 'bg-yellow-100 text-yellow-800 border-yellow-300',
            'Düşük': 'bg-green-100 text-green-800 border-green-300'
        };

        return (
            <Badge className={severityConfig[severity] || 'bg-gray-100 text-gray-800 border-gray-300'}>
                {severity}
            </Badge>
        );
    };

    const formatDate = (date) => {
        if (!date) return '-';
        try {
            return format(new Date(date), 'dd MMM yyyy', { locale: tr });
        } catch {
            return '-';
        }
    };

    const categories = [...new Set(complaints.map(c => c.complaint_category).filter(Boolean))];

    return (
        <div className="space-y-4">
            {/* Başlık ve Yeni Şikayet Butonu */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        Şikayet Listesi ({filteredComplaints.length})
                    </h3>
                    <p className="text-sm text-gray-600">
                        Tüm müşteri şikayetlerini görüntüleyin ve yönetin
                    </p>
                </div>
                <Button
                    onClick={onNew}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Şikayet
                </Button>
            </div>

            {/* Arama ve Filtreler */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="search-box flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Şikayet numarası, başlık, müşteri, ürün ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            Filtreler
                            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="Yeni">Yeni</option>
                                    <option value="İnceleniyor">İnceleniyor</option>
                                    <option value="Analiz Aşamasında">Analiz Aşamasında</option>
                                    <option value="Aksiyon Alınıyor">Aksiyon Alınıyor</option>
                                    <option value="Çözüldü">Çözüldü</option>
                                    <option value="Kapatıldı">Kapatıldı</option>
                                    <option value="İptal">İptal</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Şiddet</label>
                                <select
                                    value={filters.severity}
                                    onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="Kritik">Kritik</option>
                                    <option value="Yüksek">Yüksek</option>
                                    <option value="Orta">Orta</option>
                                    <option value="Düşük">Düşük</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Müşteri</label>
                                <select
                                    value={filters.customer}
                                    onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="all">Tüm Müşteriler</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.customer_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Kategori</label>
                                <select
                                    value={filters.category}
                                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="all">Tüm Kategoriler</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Tarih Aralığı</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={filters.dateFrom}
                                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                        className="text-sm"
                                    />
                                    <Input
                                        type="date"
                                        value={filters.dateTo}
                                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tablo */}
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-gray-600">Yükleniyor...</p>
                        </div>
                    ) : filteredComplaints.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600">Şikayet bulunamadı.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th 
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('complaint_number')}
                                        >
                                            Şikayet No
                                        </th>
                                        <th 
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('complaint_date')}
                                        >
                                            Tarih
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Müşteri
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Başlık / Ürün
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Kategori
                                        </th>
                                        <th 
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('severity')}
                                        >
                                            Şiddet
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Durum
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Sorumlu
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                            İşlemler
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredComplaints.map((complaint) => (
                                        <tr 
                                            key={complaint.id} 
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={(e) => {
                                                // Butonlara tıklanırsa modal açılmasın
                                                if (e.target.closest('button')) {
                                                    return;
                                                }
                                                onView(complaint);
                                            }}
                                            title="Detayları görüntülemek için tıklayın"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-sm font-semibold text-blue-600">
                                                    {complaint.complaint_number}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-900">
                                                    {formatDate(complaint.complaint_date)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {complaint.customer?.customer_name || 'Bilinmeyen'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {complaint.customer?.customer_code || '-'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="max-w-xs">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {complaint.complaint_title}
                                                    </p>
                                                    {complaint.product_name && (
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {complaint.product_name}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-gray-700">
                                                    {complaint.complaint_category || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {getSeverityBadge(complaint.severity)}
                                                {complaint.sla_status && (
                                                    <Badge 
                                                        variant={
                                                            complaint.sla_status === 'Overdue' ? 'destructive' :
                                                            complaint.sla_status === 'At Risk' ? 'warning' :
                                                            'success'
                                                        }
                                                        className="ml-1"
                                                    >
                                                        {complaint.sla_status === 'Overdue' ? 'SLA Gecikmiş' :
                                                         complaint.sla_status === 'At Risk' ? 'SLA Risk' :
                                                         'SLA OK'}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(complaint.status)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-700">
                                                    {complaint.assigned_user?.full_name || 
                                                     complaint.responsible_user?.full_name || 
                                                     '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onView(complaint)}
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        title="Görüntüle"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onEdit(complaint)}
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        title="Düzenle"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(complaint.id)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

