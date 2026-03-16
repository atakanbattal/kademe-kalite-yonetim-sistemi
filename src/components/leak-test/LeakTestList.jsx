import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    Edit,
    Eye,
    MoreVertical,
    Search,
    Trash2,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { normalizeTurkishForSearch } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
    TANK_TYPE_OPTIONS,
    formatDuration,
    formatTestDateTime,
    getPersonnelName,
    getVehicleTypeLabel,
} from './utils';

const RESULT_FILTER_OPTIONS = ['all', 'Kabul', 'Kaçak Var'];

const LEADING_ICON_INPUT_PADDING = '2.75rem';

const getResultBadge = (result, leakCount) => {
    if (result === 'Kabul') {
        return <Badge variant="success">Kabul</Badge>;
    }

    if (result === 'Kaçak Var') {
        return <Badge variant="destructive">{leakCount || 0} Kaçak</Badge>;
    }

    return <Badge variant="secondary">Belirsiz</Badge>;
};

const LeakTestList = ({
    records = [],
    loading = false,
    onView,
    onEdit,
    onDelete,
}) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTankType, setSelectedTankType] = useState('all');
    const [selectedResult, setSelectedResult] = useState('all');
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredRecords = useMemo(() => {
        return records.filter((record) => {
            const normalizedSearch = normalizeTurkishForSearch(searchTerm);
            const searchableText = normalizeTurkishForSearch([
                record.record_number,
                getVehicleTypeLabel(record),
                record.vehicle_serial_number,
                record.tank_type,
                getPersonnelName(record, 'tested_by', 'tested_by_name'),
                getPersonnelName(record, 'welded_by', 'welded_by_name'),
                record.notes,
            ].filter(Boolean).join(' '));

            const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
            const matchesTankType = selectedTankType === 'all' || record.tank_type === selectedTankType;
            const matchesResult = selectedResult === 'all' || record.test_result === selectedResult;

            return matchesSearch && matchesTankType && matchesResult;
        });
    }, [records, searchTerm, selectedTankType, selectedResult]);

    const handleDeleteClick = (record) => {
        setRecordToDelete(record);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!recordToDelete) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('leak_test_records')
                .delete()
                .eq('id', recordToDelete.id);

            if (error) throw error;

            toast({
                title: 'Kayıt silindi',
                description: `${recordToDelete.record_number} arşivden kaldırıldı.`,
            });

            setDeleteDialogOpen(false);
            setRecordToDelete(null);
            onDelete?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Silme hatası',
                description: error.message || 'Kayıt silinirken bir hata oluştu.',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-4">
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kayıt silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. <strong>{recordToDelete?.record_number}</strong> numaralı test kaydı kalıcı olarak silinecek.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting}>
                            {isDeleting ? 'Siliniyor...' : 'Sil'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1 max-w-xl">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                        <Search className="h-4 w-4" />
                    </div>
                    <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        style={{ paddingLeft: LEADING_ICON_INPUT_PADDING }}
                        placeholder="Kayıt no, araç tipi, seri no, sızdırmazlık parçası, personel veya not ile ara..."
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
                    <Select value={selectedTankType} onValueChange={setSelectedTankType}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Sızdırmazlık parçası" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm sızdırmazlık parçaları</SelectItem>
                            {TANK_TYPE_OPTIONS.map((tankType) => (
                                <SelectItem key={tankType} value={tankType}>
                                    {tankType}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedResult} onValueChange={setSelectedResult}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Test sonucu" />
                        </SelectTrigger>
                        <SelectContent>
                            {RESULT_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option === 'all' ? 'Tüm sonuçlar' : option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {!records.length ? (
                <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <AlertTriangle className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">Henüz sızdırmazlık testi yok</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        İlk testi eklediğinde burada arama, filtreleme ve aksiyon listesi oluşacak.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                        {filteredRecords.length} / {records.length} kayıt görüntüleniyor
                    </div>

                    <div className="table-responsive">
                        <table className="data-table min-w-[1180px]">
                            <thead>
                                <tr>
                                    <th>Kayıt No</th>
                                    <th>Tarih / Saat</th>
                                    <th>Araç Tipi</th>
                                    <th>Araç Seri No</th>
                                    <th>Sızdırmazlık Parçası</th>
                                    <th>Süre</th>
                                    <th>Sonuç</th>
                                    <th>Testi Yapan</th>
                                    <th>Ürünü Kaynatan</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="py-10 text-center text-muted-foreground">
                                            Filtrelere uyan kayıt bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record, index) => (
                                        <motion.tr
                                            key={record.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="cursor-pointer"
                                            onClick={(event) => {
                                                if (event.target.closest('button') || event.target.closest('[role=\"menuitem\"]')) return;
                                                onView?.(record);
                                            }}
                                        >
                                            <td className="font-semibold">{record.record_number}</td>
                                            <td>{formatTestDateTime(record.test_date, record.test_start_time)}</td>
                                            <td className="max-w-[240px] whitespace-normal">
                                                <div className="font-medium">{getVehicleTypeLabel(record)}</div>
                                            </td>
                                            <td>{record.vehicle_serial_number || '-'}</td>
                                            <td>{record.tank_type || '-'}</td>
                                            <td>{formatDuration(record.test_duration_minutes)}</td>
                                            <td>{getResultBadge(record.test_result, record.leak_count)}</td>
                                            <td>{getPersonnelName(record, 'tested_by', 'tested_by_name')}</td>
                                            <td>{getPersonnelName(record, 'welded_by', 'welded_by_name')}</td>
                                            <td>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => onView?.(record)}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            Görüntüle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onEdit?.(record)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => handleDeleteClick(record)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeakTestList;
