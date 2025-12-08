import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DocumentAdvancedSearch = ({ onSearchChange, onFilterChange }) => {
    const { productionDepartments, suppliers, personnel } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        department_id: null,
        document_type: null,
        document_subcategory: null,
        approval_status: null,
        classification: null,
        owner_id: null,
        tags: [],
        keywords: []
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [keywordInput, setKeywordInput] = useState('');

    const handleSearchChange = (value) => {
        setSearchTerm(value);
        if (onSearchChange) {
            onSearchChange(value);
        }
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    };

    const addTag = () => {
        if (tagInput.trim() && !filters.tags.includes(tagInput.trim())) {
            const newTags = [...filters.tags, tagInput.trim()];
            handleFilterChange('tags', newTags);
            setTagInput('');
        }
    };

    const removeTag = (tag) => {
        const newTags = filters.tags.filter(t => t !== tag);
        handleFilterChange('tags', newTags);
    };

    const addKeyword = () => {
        if (keywordInput.trim() && !filters.keywords.includes(keywordInput.trim())) {
            const newKeywords = [...filters.keywords, keywordInput.trim()];
            handleFilterChange('keywords', newKeywords);
            setKeywordInput('');
        }
    };

    const removeKeyword = (keyword) => {
        const newKeywords = filters.keywords.filter(k => k !== keyword);
        handleFilterChange('keywords', newKeywords);
    };

    const clearFilters = () => {
        const emptyFilters = {
            department_id: null,
            document_type: null,
            document_subcategory: null,
            approval_status: null,
            classification: null,
            owner_id: null,
            tags: [],
            keywords: []
        };
        setFilters(emptyFilters);
        setSearchTerm('');
        if (onFilterChange) {
            onFilterChange(emptyFilters);
        }
        if (onSearchChange) {
            onSearchChange('');
        }
    };

    const hasActiveFilters = Object.values(filters).some(v => 
        v !== null && (Array.isArray(v) ? v.length > 0 : true)
    ) || searchTerm.trim().length > 0;

    return (
        <div className="space-y-4">
            {/* Temel Arama */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Doküman adı, numara, içerik veya personel adı ile ara..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-10"
                />
                {searchTerm && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => handleSearchChange('')}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Gelişmiş Filtreler */}
            <div className="flex items-center gap-2 flex-wrap">
                <Popover open={showAdvanced} onOpenChange={setShowAdvanced}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4 mr-2" />
                            Gelişmiş Filtreler
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="ml-2">
                                    {Object.values(filters).filter(v => v !== null && (Array.isArray(v) ? v.length > 0 : true)).length}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                        <div className="space-y-4">
                            <div>
                                <Label>Birim</Label>
                                <Select
                                    value={filters.department_id || ''}
                                    onValueChange={(value) => handleFilterChange('department_id', value || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm birimler" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tüm birimler</SelectItem>
                                        {productionDepartments.map(dept => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                                {dept.unit_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Doküman Tipi</Label>
                                <Select
                                    value={filters.document_type || ''}
                                    onValueChange={(value) => handleFilterChange('document_type', value || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm tipler" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tüm tipler</SelectItem>
                                        <SelectItem value="Prosedürler">Prosedürler</SelectItem>
                                        <SelectItem value="Talimatlar">Talimatlar</SelectItem>
                                        <SelectItem value="Formlar">Formlar</SelectItem>
                                        <SelectItem value="Kalite Sertifikaları">Kalite Sertifikaları</SelectItem>
                                        <SelectItem value="Personel Sertifikaları">Personel Sertifikaları</SelectItem>
                                        <SelectItem value="Diğer">Diğer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Alt Kategori</Label>
                                <Input
                                    value={filters.document_subcategory || ''}
                                    onChange={(e) => handleFilterChange('document_subcategory', e.target.value || null)}
                                    placeholder="Alt kategori"
                                />
                            </div>

                            <div>
                                <Label>Onay Durumu</Label>
                                <Select
                                    value={filters.approval_status || ''}
                                    onValueChange={(value) => handleFilterChange('approval_status', value || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm durumlar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tüm durumlar</SelectItem>
                                        <SelectItem value="Taslak">Taslak</SelectItem>
                                        <SelectItem value="Onay Bekliyor">Onay Bekliyor</SelectItem>
                                        <SelectItem value="Onaylandı">Onaylandı</SelectItem>
                                        <SelectItem value="Reddedildi">Reddedildi</SelectItem>
                                        <SelectItem value="Yayınlandı">Yayınlandı</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Sınıflandırma</Label>
                                <Select
                                    value={filters.classification || ''}
                                    onValueChange={(value) => handleFilterChange('classification', value || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm sınıflandırmalar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tüm sınıflandırmalar</SelectItem>
                                        <SelectItem value="Genel">Genel</SelectItem>
                                        <SelectItem value="İç Kullanım">İç Kullanım</SelectItem>
                                        <SelectItem value="Gizli">Gizli</SelectItem>
                                        <SelectItem value="Çok Gizli">Çok Gizli</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Doküman Sahibi</Label>
                                <Select
                                    value={filters.owner_id || ''}
                                    onValueChange={(value) => handleFilterChange('owner_id', value || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm personel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Tüm personel</SelectItem>
                                        {personnel.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Etiketler</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                        placeholder="Etiket ekle..."
                                    />
                                    <Button type="button" size="sm" onClick={addTag}>
                                        Ekle
                                    </Button>
                                </div>
                                {filters.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {filters.tags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                                {tag}
                                                <X 
                                                    className="h-3 w-3 cursor-pointer" 
                                                    onClick={() => removeTag(tag)}
                                                />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label>Anahtar Kelimeler</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={keywordInput}
                                        onChange={(e) => setKeywordInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                                        placeholder="Anahtar kelime ekle..."
                                    />
                                    <Button type="button" size="sm" onClick={addKeyword}>
                                        Ekle
                                    </Button>
                                </div>
                                {filters.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {filters.keywords.map(keyword => (
                                            <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                                                {keyword}
                                                <X 
                                                    className="h-3 w-3 cursor-pointer" 
                                                    onClick={() => removeKeyword(keyword)}
                                                />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {hasActiveFilters && (
                                <Button 
                                    variant="outline" 
                                    className="w-full" 
                                    onClick={clearFilters}
                                >
                                    Filtreleri Temizle
                                </Button>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Aktif Filtreler */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap gap-2">
                        {filters.department_id && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                Birim: {productionDepartments.find(d => d.id === filters.department_id)?.unit_name}
                                <X 
                                    className="h-3 w-3 cursor-pointer" 
                                    onClick={() => handleFilterChange('department_id', null)}
                                />
                            </Badge>
                        )}
                        {filters.document_type && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                Tip: {filters.document_type}
                                <X 
                                    className="h-3 w-3 cursor-pointer" 
                                    onClick={() => handleFilterChange('document_type', null)}
                                />
                            </Badge>
                        )}
                        {filters.approval_status && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                Durum: {filters.approval_status}
                                <X 
                                    className="h-3 w-3 cursor-pointer" 
                                    onClick={() => handleFilterChange('approval_status', null)}
                                />
                            </Badge>
                        )}
                        {filters.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                {tag}
                                <X 
                                    className="h-3 w-3 cursor-pointer" 
                                    onClick={() => removeTag(tag)}
                                />
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentAdvancedSearch;

