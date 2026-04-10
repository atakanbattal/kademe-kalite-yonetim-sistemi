import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Filter, FileText, 
    BarChart3, Download, Eye, Edit, Trash2, 
    CheckCircle, Clock, AlertCircle, X,
    ArrowUpDown, Calendar, User, Tag, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { approveBenchmarkWithSignedPdf } from '@/lib/benchmarkApprovalUpload';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import BenchmarkForm from './BenchmarkForm';
import BenchmarkDetail from './BenchmarkDetail';
import BenchmarkFilters from './BenchmarkFilters';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Liste ve kart görünümünde aynı işlem seti: detay + tek menü (dağınık butonları toplar).
 */
function BenchmarkActionsMenu({
    benchmark,
    approveUploading,
    onView,
    onEdit,
    onApprove,
    onDelete,
    layout = 'row',
}) {
    const menuEditApproveDelete = (
        <>
            <DropdownMenuItem onClick={() => onEdit(benchmark)}>
                <Edit className="mr-2 h-4 w-4 shrink-0" />
                Düzenle
            </DropdownMenuItem>
            {benchmark.approval_status !== 'Onaylandı' && (
                <DropdownMenuItem
                    disabled={approveUploading}
                    onClick={() => onApprove(benchmark)}
                >
                    <CheckCircle className="mr-2 h-4 w-4 shrink-0" />
                    Onayla (PDF)
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => onDelete(benchmark.id)}
            >
                <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                Sil
            </DropdownMenuItem>
        </>
    );

    if (layout === 'card') {
        return (
            <div className="space-y-2">
                <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => onView(benchmark)}
                >
                    <Eye className="mr-1.5 h-4 w-4 shrink-0" />
                    Görüntüle
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-center gap-2"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                            Diğer işlemler
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-52">
                        {menuEditApproveDelete}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }

    return (
        <div className="inline-flex items-center justify-end gap-1.5">
            <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 gap-1.5 px-2.5 sm:px-3"
                onClick={() => onView(benchmark)}
            >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Görüntüle</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 sm:w-auto sm:px-2.5 sm:gap-1.5"
                        aria-label="İşlemler menüsü"
                    >
                        <MoreHorizontal className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline text-xs font-medium">İşlemler</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {menuEditApproveDelete}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

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
    const [selectedBenchmark, setSelectedBenchmark] = useState(null);
    
    // View mode — varsayılan liste (daha derli toplu)
    const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'
    const [approveUploading, setApproveUploading] = useState(false);
    const approvePdfInputRef = useRef(null);
    const approveTargetIdRef = useRef(null);

    // Data fetching
    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!isDetailOpen || !selectedBenchmark?.id) return;
        const fresh = benchmarks.find((b) => b.id === selectedBenchmark.id);
        if (fresh) setSelectedBenchmark(fresh);
    }, [benchmarks, isDetailOpen, selectedBenchmark?.id]);

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
                        owner:personnel!benchmarks_owner_id_fkey(id, full_name),
                        department:cost_settings!benchmarks_department_id_fkey(id, unit_name),
                        approved_by_person:personnel!benchmarks_approved_by_fkey(id, full_name)
                    `)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('personnel')
                    .select('id, full_name, department, email')
                    .order('full_name')
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

    const handleEdit = (benchmark, options = {}) => {
        setSelectedBenchmark(benchmark);
        if (options.fromDetail) {
            setIsDetailOpen(false);
        }
        setIsFormOpen(true);
    };

    const handleView = (benchmark) => {
        setSelectedBenchmark(benchmark);
        setIsDetailOpen(true);
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

    const handleApproveClick = (benchmark) => {
        approveTargetIdRef.current = benchmark.id;
        approvePdfInputRef.current?.click();
    };

    const handleApprovePdfChange = async (e) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = '';
        const benchmarkId = approveTargetIdRef.current;
        approveTargetIdRef.current = null;
        if (!file || !benchmarkId) return;

        const approverId = personnel.find((p) => p.email === user?.email)?.id;
        if (!approverId) {
            toast({
                variant: 'destructive',
                title: 'Onay verilemedi',
                description: 'Oturum e-postanızla eşleşen personel kaydı bulunamadı.',
            });
            return;
        }

        setApproveUploading(true);
        try {
            await approveBenchmarkWithSignedPdf({ benchmarkId, file, approverId });
            toast({
                title: 'Onaylandı',
                description: 'Onay dokümanı kaydedildi.',
            });
            fetchData();
        } catch (error) {
            console.error('Onay hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Onay hatası',
                description: error.message || 'İşlem tamamlanamadı.',
            });
        } finally {
            setApproveUploading(false);
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
                            <div className="search-box flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Başlık, numara, etiket ile ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant={viewMode === 'list' ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                >
                                    Liste
                                </Button>
                                <Button
                                    type="button"
                                    variant={viewMode === 'grid' ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                >
                                    Kart
                                </Button>
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
            ) : viewMode === 'list' ? (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[200px]">Başlık</TableHead>
                                    <TableHead className="whitespace-nowrap">Kayıt no</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Onay</TableHead>
                                    <TableHead>Sorumlu</TableHead>
                                    <TableHead className="text-right w-[130px] min-w-[7.5rem]">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBenchmarks.map((benchmark) => (
                                    <TableRow key={benchmark.id} className="hover:bg-muted/40">
                                        <TableCell>
                                            <div className="font-medium">{benchmark.title}</div>
                                            {benchmark.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 max-w-md">
                                                    {benchmark.description}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs whitespace-nowrap">
                                            {benchmark.benchmark_number}
                                        </TableCell>
                                        <TableCell>{benchmark.category?.name || '—'}</TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(benchmark.status)}>{benchmark.status}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    benchmark.approval_status === 'Onaylandı'
                                                        ? 'border-green-600 text-green-800 bg-green-50'
                                                        : ''
                                                }
                                            >
                                                {benchmark.approval_status || '—'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {benchmark.owner?.full_name || '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <BenchmarkActionsMenu
                                                benchmark={benchmark}
                                                approveUploading={approveUploading}
                                                onView={handleView}
                                                onEdit={handleEdit}
                                                onApprove={handleApproveClick}
                                                onDelete={handleDelete}
                                                layout="row"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
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
                                                <span>{benchmark.owner.full_name}</span>
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

                                    <BenchmarkActionsMenu
                                        benchmark={benchmark}
                                        approveUploading={approveUploading}
                                        onView={handleView}
                                        onEdit={handleEdit}
                                        onApprove={handleApproveClick}
                                        onDelete={(id) => handleDelete(id)}
                                        layout="card"
                                    />
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            <input
                ref={approvePdfInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,.pdf"
                onChange={handleApprovePdfChange}
            />

            {/* Modals */}
            <AnimatePresence>
                {isFormOpen && (
                    <BenchmarkForm
                        key={selectedBenchmark?.id ?? 'new-benchmark'}
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
                        onRefresh={fetchData}
                        personnel={personnel}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default BenchmarkModule;

