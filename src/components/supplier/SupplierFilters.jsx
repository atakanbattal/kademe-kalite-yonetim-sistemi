import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

const SupplierFilters = ({ filters, setFilters }) => {

    const handleInputChange = (e) => {
        setFilters(prev => ({ ...prev, searchTerm: e.target.value }));
    };

    const handleSelectChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Tedarikçi adı veya ürün grubu ara..."
                    value={filters.searchTerm}
                    onChange={handleInputChange}
                    className="pl-10"
                />
            </div>
            <Select value={filters.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger>
                    <SelectValue placeholder="Duruma Göre Filtrele" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="Onaylı">Onaylı</SelectItem>
                    <SelectItem value="Askıya Alınmış">Askıya Alınmış</SelectItem>
                    <SelectItem value="Red">Red</SelectItem>
                    <SelectItem value="Alternatif">Alternatif</SelectItem>
                </SelectContent>
            </Select>
             <Select value={filters.riskClass} onValueChange={(value) => handleSelectChange('riskClass', value)}>
                <SelectTrigger>
                    <SelectValue placeholder="Risk Sınıfına Göre Filtrele" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tüm Risk Sınıfları</SelectItem>
                    <SelectItem value="Yüksek">Yüksek</SelectItem>
                    <SelectItem value="Orta">Orta</SelectItem>
                    <SelectItem value="Düşük">Düşük</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};

export default SupplierFilters;