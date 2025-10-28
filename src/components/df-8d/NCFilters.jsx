import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const NCFilters = ({ filters, setFilters }) => {
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        const fetchDepartments = async () => {
            // Fetch departments from personnel table to get unique, active departments
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
        };
        fetchDepartments();
    }, []);

    const handleInputChange = (e) => {
        setFilters(prev => ({ ...prev, searchTerm: e.target.value }));
    };

    const handleSelectChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-card border rounded-lg">
            <div className="relative col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Ara (No, Başlık, Sorumlu...)"
                    value={filters.searchTerm}
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
    );
};

export default NCFilters;