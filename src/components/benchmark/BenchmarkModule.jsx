import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Filter, FileText, TrendingUp, 
    BarChart3, Download, Eye, Edit, Trash2, 
    CheckCircle, Clock, AlertCircle, X,
    ArrowUpDown, Calendar, User, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import BenchmarkForm from './BenchmarkForm';
import BenchmarkDetail from './BenchmarkDetail';
import BenchmarkComparison from './BenchmarkComparison';
import BenchmarkFilters from './BenchmarkFilters';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const BenchmarkModule = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    
    // State
    const [benchmarks, setBenchmarks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [personnel, setPersonnel] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPriority, setSelectedPriority] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [showFilters, setShowFilters] = useState(false);
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);
    const [selectedBenchmark, setSelectedBenchmark] = useState(null);
    
    // View mode
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

    // Data fetching
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Önce kategorileri yükle (en önemli)
            console.log('🔄 Kategoriler yükleniyor...');
            const categoriesRes = await supabase
                .from('benchmark_categories')
                .select('*')
                .order('order_index');

            if (categoriesRes.error) {
                console.error('❌ Kategori hatası:', categoriesRes.error);
                throw categoriesRes.error;
            }

            console.log('✅ Kategoriler yüklendi:', categoriesRes.data);
            setCategories(categoriesRes.data || []);

            if (!categoriesRes.data || categoriesRes.data.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Kategoriler Bulunamadı',
                    description: 'Lütfen Supabase SQL Editor\'de benchmark kategorilerini oluşturun.'
                });
            }

            // Sonra diğer verileri yükle
            const [benchmarksRes, personnelRes] = await Promise.all([
                supabase
                    .from('benchmarks')
                    .select(`
                        *,
                        category:benchmark_categories(id, name, color, icon),
                        owner:personnel!benchmarks_owner_id_fkey(id, name),
                        department:cost_settings!benchmarks_department_id_fkey(id, department_name),
                        approved_by_person:personnel!benchmarks_approved_by_fkey(id, name)
                    `)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('personnel')
                    .select('id, name, department')
                    .order('name')
            ]);

            if (benchmarksRes.error) console.error('Benchmark hatası:', benchmarksRes.error);
            if (personnelRes.error) console.error('Personel hatası:', personnelRes.error);

            setBenchmarks(benchmarksRes.data || []);
            setPersonnel(personnelRes.data || []);
        } catch (error) {
            console.error('❌ Veriler yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Veriler yüklenirken bir hata oluştu: ${error.message}`
            });
        } finally {
            setLoading(false);
        }
    };

    // Filtered and sorted benchmarks
    const filteredBenchmarks = useMemo(() => {
        let filtered = benchmarks;

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(b => 
                b.title?.toLowerCase().includes(term) ||
                b.benchmark_number?.toLowerCase().includes(term) ||
                b.description?.toLowerCase().includes(term) ||
                b.tags?.some(tag => tag.toLowerCase().includes(term))
            );
        }

        // Category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(b => b.category_id === selectedCategory);
        }

        // Status filter
        if (selectedStatus !== 'all') {
            filtered = filtered.filter(b => b.status === selectedStatus);
        }

        // Priority filter
        if (selectedPriority !== 'all') {
            filtered = filtered.filter(b => b.priority === selectedPriority);
        }

        // Sorting
        filtered.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'category') {
                aVal = a.category?.name || '';
                bVal = b.category?.name || '';
            } else if (sortBy === 'owner') {
                aVal = a.owner?.name || '';
                bVal = b.owner?.name || '';
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [benchmarks, searchTerm, selectedCategory, selectedStatus, selectedPriority, sortBy, sortOrder]);

    // Statistics
    const stats = useMemo(() => {
        return {
            total: benchmarks.length,
            inProgress: benchmarks.filter(b => b.status === 'Devam Ediyor').length,
            completed: benchmarks.filter(b => b.status === 'Tamamlandı').length,
            pendingApproval: benchmarks.filter(b => b.approval_status === 'Bekliyor').length
        };
    }, [benchmarks]);

    // Handlers
    const handleCreateNew = () => {
        setSelectedBenchmark(null);
        setIsFormOpen(true);
    };

    const handleEdit = (benchmark) => {
        setSelectedBenchmark(benchmark);
        setIsFormOpen(true);
    };

    const handleView = (benchmark) => {
        setSelectedBenchmark(benchmark);
        setIsDetailOpen(true);
    };

    const handleCompare = (benchmark) => {
        setSelectedBenchmark(benchmark);
        setIsComparisonOpen(true);
    };

    const handleDelete = async (benchmarkId) => {
        if (!confirm('Bu benchmark kaydını silmek istediğinizden emin misiniz?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('benchmarks')
                .delete()
                .eq('id', benchmarkId);

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Benchmark kaydı silindi.'
            });

            fetchData();
        } catch (error) {
            console.error('Silme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Benchmark kaydı silinirken bir hata oluştu.'
            });
        }
    };

    const handleFormSuccess = () => {
        fetchData();
        setIsFormOpen(false);
        setSelectedBenchmark(null);
    };

    // Status badge color
    const getStatusColor = (status) => {
        const colors = {
            'Taslak': 'bg-gray-100 text-gray-800',
            'Devam Ediyor': 'bg-blue-100 text-blue-800',
            'Analiz Aşamasında': 'bg-purple-100 text-purple-800',
            'Onay Bekliyor': 'bg-yellow-100 text-yellow-800',
            'Tamamlandı': 'bg-green-100 text-green-800',
            'İptal': 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getPriorityColor = (priority) => {
        const colors = {
            'Kritik': 'bg-red-500',
            'Yüksek': 'bg-orange-500',
            'Normal': 'bg-blue-500',
            'Düşük': 'bg-gray-400'
        };
        return colors[priority] || 'bg-gray-400';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Benchmark Yönetimi
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Ürün, süreç ve teknoloji karşılaştırma ve analiz sistemi
                        </p>
                    </div>
                    <Button onClick={handleCreateNew} size="lg">
                        <Plus className="mr-2 h-5 w-5" />
                        Yeni Benchmark
                    </Button>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Toplam Benchmark
                            </CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Devam Eden
                            </CardTitle>
                            <Clock className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.inProgress}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Tamamlanan
                            </CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {stats.completed}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Onay Bekleyen
                            </CardTitle>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">
                                {stats.pendingApproval}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Search and Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Başlık, numara, etiket ile ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter className="mr-2 h-4 w-4" />
                                Filtrele
                                {showFilters && <X className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>

                        {/* Filters Panel */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <BenchmarkFilters
                                        categories={categories}
                                        selectedCategory={selectedCategory}
                                        setSelectedCategory={setSelectedCategory}
                                        selectedStatus={selectedStatus}
                                        setSelectedStatus={setSelectedStatus}
                                        selectedPriority={selectedPriority}
                                        setSelectedPriority={setSelectedPriority}
                                        sortBy={sortBy}
                                        setSortBy={setSortBy}
                                        sortOrder={sortOrder}
                                        setSortOrder={setSortOrder}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </CardContent>
            </Card>

            {/* Benchmark List */}
            {filteredBenchmarks.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            Benchmark Kaydı Bulunamadı
                        </h3>
                        <p className="text-muted-foreground text-center mb-4">
                            {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
                                ? 'Arama kriterlerinize uygun kayıt bulunamadı.'
                                : 'Henüz benchmark kaydı eklenmemiş.'}
                        </p>
                        {!searchTerm && selectedCategory === 'all' && selectedStatus === 'all' && (
                            <Button onClick={handleCreateNew}>
                                <Plus className="mr-2 h-4 w-4" />
                                İlk Benchmark'ı Oluştur
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredBenchmarks.map((benchmark) => (
                        <motion.div
                            key={benchmark.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge
                                                    className={getStatusColor(benchmark.status)}
                                                >
                                                    {benchmark.status}
                                                </Badge>
                                                <div
                                                    className={`w-2 h-2 rounded-full ${getPriorityColor(benchmark.priority)}`}
                                                    title={`Öncelik: ${benchmark.priority}`}
                                                />
                                            </div>
                                            <CardTitle className="text-lg mb-1">
                                                {benchmark.title}
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground">
                                                {benchmark.benchmark_number}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                        {benchmark.description}
                                    </p>

                                    <div className="space-y-2 text-sm mb-4">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">
                                                {benchmark.category?.name || 'Kategori Yok'}
                                            </span>
                                        </div>
                                        {benchmark.owner && (
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>{benchmark.owner.name}</span>
                                            </div>
                                        )}
                                        {benchmark.start_date && (
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    {format(new Date(benchmark.start_date), 'dd MMM yyyy', { locale: tr })}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {benchmark.tags && benchmark.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {benchmark.tags.slice(0, 3).map((tag, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {benchmark.tags.length > 3 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{benchmark.tags.length - 3}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleView(benchmark)}
                                            className="flex-1"
                                        >
                                            <Eye className="mr-2 h-4 w-4" />
                                            Detay
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleCompare(benchmark)}
                                            className="flex-1"
                                        >
                                            <TrendingUp className="mr-2 h-4 w-4" />
                                            Karşılaştır
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modals */}
            <AnimatePresence>
                {isFormOpen && (
                    <BenchmarkForm
                        isOpen={isFormOpen}
                        onClose={() => {
                            setIsFormOpen(false);
                            setSelectedBenchmark(null);
                        }}
                        benchmark={selectedBenchmark}
                        categories={categories}
                        personnel={personnel}
                        onSuccess={handleFormSuccess}
                    />
                )}

                {isDetailOpen && (
                    <BenchmarkDetail
                        isOpen={isDetailOpen}
                        onClose={() => {
                            setIsDetailOpen(false);
                            setSelectedBenchmark(null);
                        }}
                        benchmark={selectedBenchmark}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onCompare={handleCompare}
                        onRefresh={fetchData}
                    />
                )}

                {isComparisonOpen && (
                    <BenchmarkComparison
                        isOpen={isComparisonOpen}
                        onClose={() => {
                            setIsComparisonOpen(false);
                            setSelectedBenchmark(null);
                        }}
                        benchmark={selectedBenchmark}
                        onRefresh={fetchData}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default BenchmarkModule;

