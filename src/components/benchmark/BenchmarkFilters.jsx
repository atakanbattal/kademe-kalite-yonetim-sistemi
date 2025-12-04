import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const BenchmarkFilters = ({
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedStatus,
    setSelectedStatus,
    selectedPriority,
    setSelectedPriority,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder
}) => {
    const statuses = [
        'Taslak',
        'Devam Ediyor',
        'Analiz Aşamasında',
        'Onay Bekliyor',
        'Tamamlandı',
        'İptal'
    ];

    const priorities = ['Kritik', 'Yüksek', 'Normal', 'Düşük'];

    const sortOptions = [
        { value: 'created_at', label: 'Oluşturulma Tarihi' },
        { value: 'updated_at', label: 'Güncellenme Tarihi' },
        { value: 'title', label: 'Başlık' },
        { value: 'status', label: 'Durum' },
        { value: 'priority', label: 'Öncelik' },
        { value: 'category', label: 'Kategori' },
        { value: 'start_date', label: 'Başlangıç Tarihi' },
        { value: 'target_completion_date', label: 'Hedef Tarih' }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-5 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tüm Kategoriler" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Kategoriler</SelectItem>
                        {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Durum</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tüm Durumlar" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Durumlar</SelectItem>
                        {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                                {status}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Öncelik</Label>
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tüm Öncelikler" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Öncelikler</SelectItem>
                        {priorities.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                                {priority}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Sıralama</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Sıra</Label>
                <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    {sortOrder === 'asc' ? 'Artan' : 'Azalan'}
                </Button>
            </div>
        </div>
    );
};

export default BenchmarkFilters;

