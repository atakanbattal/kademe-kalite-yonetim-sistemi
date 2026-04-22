import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { tr } from 'date-fns/locale';

const NCFilters = ({ filters, setFilters, suppliers = [] }) => {
    const [departments, setDepartments] = useState([]);
    const [localSearchTerm, setLocalSearchTerm] = useState(filters.searchTerm || '');

    useEffect(() => {
        const fetchDepartments = async () => {
            // Fetch departments from cost_settings table (daha güvenilir)
            const { data: costSettingsData, error: costError } = await supabase
                .from('cost_settings')
                .select('unit_name')
                .order('unit_name');

            if (!costError && costSettingsData) {
                const departmentNames = costSettingsData.map(d => d.unit_name).filter(Boolean);
                setDepartments(['all', ...departmentNames]);
            } else {
                // Fallback: personnel tablosundan al
                const { data, error } = await supabase
                    .from('personnel')
                    .select('department')
                    .neq('department', null);

                if (!error && data) {
                    const departmentNames = [...new Set(data.map(d => d.department))].sort();
                    setDepartments(['all', ...departmentNames]);
                } else {
                    setDepartments(['all']);
                }
            }
        };
        fetchDepartments();
    }, []);

    // Local search term'i senkronize et
    useEffect(() => {
        setLocalSearchTerm(filters.searchTerm || '');
    }, [filters.searchTerm]);

    // Debounce ile arama terimini güncelle (100ms gecikme)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearchTerm !== filters.searchTerm) {
                setFilters(prev => ({ ...prev, searchTerm: localSearchTerm }));
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [localSearchTerm, filters.searchTerm, setFilters]);

    const handleInputChange = (e) => {
        setLocalSearchTerm(e.target.value);
    };

    const handleSelectChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    // Hızlı tarih seçimi fonksiyonları
    const handleQuickDateSelect = (preset) => {
        const now = new Date();
        let dateFrom, dateTo;
        
        switch (preset) {
            case 'thisMonth':
                dateFrom = format(startOfMonth(now), 'yyyy-MM-dd');
                dateTo = format(endOfMonth(now), 'yyyy-MM-dd');
                break;
            case 'lastMonth':
                const lastMonth = subMonths(now, 1);
                dateFrom = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
                dateTo = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
                break;
            case 'last3Months':
                dateFrom = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd');
                dateTo = format(endOfMonth(now), 'yyyy-MM-dd');
                break;
            case 'thisYear':
                dateFrom = format(startOfYear(now), 'yyyy-MM-dd');
                dateTo = format(endOfYear(now), 'yyyy-MM-dd');
                break;
            case 'all':
            default:
                dateFrom = '';
                dateTo = '';
                break;
        }
        
        setFilters(prev => ({ ...prev, dateFrom, dateTo }));
    };

    const clearDateFilter = () => {
        setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
    };

    const hasDateFilter = filters.dateFrom || filters.dateTo;

    return (
        <div className="space-y-4 mb-6 p-4 bg-card border rounded-lg">
            {/* İlk Satır: Arama ve Ana Filtreler */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <div className="search-box col-span-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Ara (No, Başlık, Açıklama, Sorumlu, Birim, Tedarikçi, Parça...)"
                        value={localSearchTerm}
                        onChange={handleInputChange}
                        className="search-input"
                    />
                </div>
                <Select value={filters.status} onValueChange={(value) => handleSelectChange('status', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Duruma Göre Filtrele" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Durumlar</SelectItem>
                        <SelectItem value="Açık">Açık</SelectItem>
                        <SelectItem value="İşlemde">İşlemde</SelectItem>
                        <SelectItem value="Gecikmiş">Gecikmiş</SelectItem>
                        <SelectItem value="Onay Bekliyor">Onay Bekliyor</SelectItem>
                        <SelectItem value="Kapatıldı">Kapatıldı</SelectItem>
                        <SelectItem value="Reddedildi">Reddedildi</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.type} onValueChange={(value) => handleSelectChange('type', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tipe Göre Filtrele" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Tipler</SelectItem>
                        <SelectItem value="DF">DF</SelectItem>
                        <SelectItem value="8D">8D</SelectItem>
                        <SelectItem value="MDI">MDI</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.department} onValueChange={(value) => handleSelectChange('department', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Departmana Göre Filtrele" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map(dept => (
                            <SelectItem key={dept} value={dept}>
                                {dept === 'all' ? 'Tüm Departmanlar' : dept}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filters.supplierId || 'all'} onValueChange={(value) => handleSelectChange('supplierId', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tedarikçiye Göre Filtrele" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
                        {suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* İkinci Satır: Tarih Filtreleri */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Tarih:</span>
                </div>
                
                {/* Hızlı Seçim Butonları */}
                <div className="flex flex-wrap gap-2">
                    <Button 
                        variant={!hasDateFilter ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => handleQuickDateSelect('all')}
                    >
                        Tümü
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickDateSelect('thisMonth')}
                    >
                        Bu Ay
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickDateSelect('lastMonth')}
                    >
                        Geçen Ay
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickDateSelect('last3Months')}
                    >
                        Son 3 Ay
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickDateSelect('thisYear')}
                    >
                        Bu Yıl
                    </Button>
                </div>

                {/* Manuel Tarih Girişi */}
                <div className="flex items-center gap-2 ml-auto">
                    <Input
                        type="date"
                        value={filters.dateFrom || ''}
                        onChange={(e) => handleSelectChange('dateFrom', e.target.value)}
                        className="w-36 h-9"
                        placeholder="Başlangıç"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                        type="date"
                        value={filters.dateTo || ''}
                        onChange={(e) => handleSelectChange('dateTo', e.target.value)}
                        className="w-36 h-9"
                        placeholder="Bitiş"
                    />
                    {hasDateFilter && (
                        <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-9 px-2">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NCFilters;