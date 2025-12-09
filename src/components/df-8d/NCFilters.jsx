import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const NCFilters = ({ filters, setFilters }) => {
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

    return (
        <div className="space-y-4 mb-6 p-4 bg-card border rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="relative col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Ara (No, Başlık, Açıklama, Sorumlu, Birim, Tedarikçi, Parça...)"
                        value={localSearchTerm}
                        onChange={handleInputChange}
                        className="pl-10 w-full"
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Açılış Tarihi Aralığı</Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {filters.openingDateFrom ? format(new Date(filters.openingDateFrom), 'dd.MM.yyyy', { locale: tr }) : 'Başlangıç'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={filters.openingDateFrom ? new Date(filters.openingDateFrom) : undefined}
                                    onSelect={(date) => handleSelectChange('openingDateFrom', date ? date.toISOString().split('T')[0] : null)}
                                />
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {filters.openingDateTo ? format(new Date(filters.openingDateTo), 'dd.MM.yyyy', { locale: tr }) : 'Bitiş'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={filters.openingDateTo ? new Date(filters.openingDateTo) : undefined}
                                    onSelect={(date) => handleSelectChange('openingDateTo', date ? date.toISOString().split('T')[0] : null)}
                                />
                            </PopoverContent>
                        </Popover>
                        {(filters.openingDateFrom || filters.openingDateTo) && (
                            <Button variant="ghost" size="icon" onClick={() => {
                                setFilters(prev => ({ ...prev, openingDateFrom: null, openingDateTo: null }));
                            }}>
                                <X className="h-4 w-4" />
                                <span className="sr-only">Temizle</span>
                            </Button>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Kapanış Tarihi Aralığı</Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {filters.closingDateFrom ? format(new Date(filters.closingDateFrom), 'dd.MM.yyyy', { locale: tr }) : 'Başlangıç'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={filters.closingDateFrom ? new Date(filters.closingDateFrom) : undefined}
                                    onSelect={(date) => handleSelectChange('closingDateFrom', date ? date.toISOString().split('T')[0] : null)}
                                />
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {filters.closingDateTo ? format(new Date(filters.closingDateTo), 'dd.MM.yyyy', { locale: tr }) : 'Bitiş'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={filters.closingDateTo ? new Date(filters.closingDateTo) : undefined}
                                    onSelect={(date) => handleSelectChange('closingDateTo', date ? date.toISOString().split('T')[0] : null)}
                                />
                            </PopoverContent>
                        </Popover>
                        {(filters.closingDateFrom || filters.closingDateTo) && (
                            <Button variant="ghost" size="icon" onClick={() => {
                                setFilters(prev => ({ ...prev, closingDateFrom: null, closingDateTo: null }));
                            }}>
                                <X className="h-4 w-4" />
                                <span className="sr-only">Temizle</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NCFilters;