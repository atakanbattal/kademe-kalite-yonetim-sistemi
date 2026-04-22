/**
 * useTableFilters - Tablo filtreleme, arama ve sıralama hook'u
 * Tüm modüllerde tekrar eden filtreleme mantığını birleştirir.
 * Mevcut kodları BOZMAZ - yeni modüllerde ve refactor'larda kullanılabilir.
 */
import { useState, useMemo, useCallback } from 'react';
import { normalizeTurkishForSearch } from '@/lib/utils';

/**
 * @param {Object} options
 * @param {Array} options.data - Filtrelenecek veri dizisi
 * @param {string[]} options.searchFields - Aranacak alan adları
 * @param {Object} options.defaultFilters - Varsayılan filtre değerleri
 * @param {string} options.defaultSortField - Varsayılan sıralama alanı
 * @param {string} options.defaultSortOrder - Varsayılan sıralama yönü ('asc' | 'desc')
 * @param {number} options.pageSize - Sayfa başı kayıt sayısı (0 = pagination kapalı)
 */
export function useTableFilters({
    data = [],
    searchFields = ['title', 'description', 'name'],
    defaultFilters = {},
    defaultSortField = 'created_at',
    defaultSortOrder = 'desc',
    pageSize = 0,
} = {}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState(defaultFilters);
    const [sortField, setSortField] = useState(defaultSortField);
    const [sortOrder, setSortOrder] = useState(defaultSortOrder);
    const [currentPage, setCurrentPage] = useState(1);

    // Arama filtresi
    const searchFiltered = useMemo(() => {
        if (!searchTerm.trim()) return data;
        
        const normalizedSearch = normalizeTurkishForSearch(searchTerm);
        
        return data.filter(item => {
            return searchFields.some(field => {
                const value = getNestedValue(item, field);
                if (value === null || value === undefined) return false;
                const normalizedValue = normalizeTurkishForSearch(String(value));
                return normalizedValue.includes(normalizedSearch);
            });
        });
    }, [data, searchTerm, searchFields]);

    // Custom filtreler
    const customFiltered = useMemo(() => {
        if (!filters || Object.keys(filters).length === 0) return searchFiltered;
        
        return searchFiltered.filter(item => {
            return Object.entries(filters).every(([key, filterValue]) => {
                // 'all' veya boş değer = filtre devre dışı
                if (!filterValue || filterValue === 'all' || filterValue === '') return true;
                
                const itemValue = getNestedValue(item, key);
                
                // Array filtre (çoklu seçim)
                if (Array.isArray(filterValue)) {
                    return filterValue.includes(itemValue);
                }
                
                // Tarih aralığı filtresi
                if (typeof filterValue === 'object' && filterValue.from) {
                    const itemDate = new Date(itemValue);
                    if (filterValue.from && itemDate < new Date(filterValue.from)) return false;
                    if (filterValue.to && itemDate > new Date(filterValue.to)) return false;
                    return true;
                }
                
                // String karşılaştırma
                return String(itemValue) === String(filterValue);
            });
        });
    }, [searchFiltered, filters]);

    // Sıralama
    const sorted = useMemo(() => {
        if (!sortField) return customFiltered;
        
        return [...customFiltered].sort((a, b) => {
            const aVal = getNestedValue(a, sortField);
            const bVal = getNestedValue(b, sortField);
            
            // null/undefined kontrolleri
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
            if (bVal == null) return sortOrder === 'asc' ? 1 : -1;
            
            // Tarih karşılaştırma
            if (isDateString(aVal) && isDateString(bVal)) {
                const diff = new Date(aVal) - new Date(bVal);
                return sortOrder === 'asc' ? diff : -diff;
            }
            
            // Sayı karşılaştırma
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
            }
            
            // String karşılaştırma (Türkçe locale)
            const comparison = String(aVal).localeCompare(String(bVal), 'tr');
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [customFiltered, sortField, sortOrder]);

    // Pagination
    const paginated = useMemo(() => {
        if (!pageSize || pageSize <= 0) return sorted;
        
        const start = (currentPage - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, currentPage, pageSize]);

    // Toplam sayfa sayısı
    const totalPages = useMemo(() => {
        if (!pageSize || pageSize <= 0) return 1;
        return Math.ceil(sorted.length / pageSize);
    }, [sorted.length, pageSize]);

    // Filtre güncelle
    const updateFilter = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1); // Filtre değiştiğinde ilk sayfaya dön
    }, []);

    // Tüm filtreleri sıfırla
    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setFilters(defaultFilters);
        setSortField(defaultSortField);
        setSortOrder(defaultSortOrder);
        setCurrentPage(1);
    }, [defaultFilters, defaultSortField, defaultSortOrder]);

    // Sıralama değiştir
    const toggleSort = useCallback((field) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    }, [sortField]);

    // İstatistikler
    const stats = useMemo(() => ({
        total: data.length,
        filtered: sorted.length,
        showing: paginated.length,
        currentPage,
        totalPages,
        hasFilters: searchTerm.trim() !== '' || Object.values(filters).some(v => v && v !== 'all' && v !== ''),
    }), [data.length, sorted.length, paginated.length, currentPage, totalPages, searchTerm, filters]);

    return {
        // Filtrelenmiş veri
        filteredData: paginated,
        allFilteredData: sorted, // Pagination olmadan tüm filtrelenmiş veri
        // State
        searchTerm,
        filters,
        sortField,
        sortOrder,
        currentPage,
        stats,
        // Actions
        setSearchTerm,
        setFilters,
        updateFilter,
        resetFilters,
        toggleSort,
        setSortField,
        setSortOrder,
        setCurrentPage,
    };
}

// --- Helper Functions ---

/**
 * Nested obje değerine erişim
 * Örnek: getNestedValue(item, 'supplier.name') => item.supplier.name
 */
function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    
    return current;
}

/**
 * Değerin tarih string'i olup olmadığını kontrol et
 */
function isDateString(value) {
    if (typeof value !== 'string') return false;
    // ISO 8601 formatı veya yyyy-MM-dd kontrolü
    return /^\d{4}-\d{2}-\d{2}/.test(value);
}
