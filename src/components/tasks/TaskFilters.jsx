import React from 'react';
    import { Input } from '@/components/ui/input';
    import { MultiSelectPopover } from '@/components/ui/multi-select-popover';

    const TaskFilters = ({ filters, setFilters, personnel, tags }) => {
        const handleSearchChange = (e) => {
            setFilters(prev => ({ ...prev, searchTerm: e.target.value }));
        };

        const handleMultiSelect = (filterName, selected) => {
            setFilters(prev => ({ ...prev, [filterName]: selected }));
        };
        
        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
        const tagOptions = tags.map(t => ({ value: t.id, label: t.name }));

        return (
            <div className="flex flex-col md:flex-row gap-2 w-full">
                <Input
                    placeholder="Görev ara..."
                    value={filters.searchTerm}
                    onChange={handleSearchChange}
                    className="md:max-w-xs"
                />
                 <MultiSelectPopover
                    options={personnelOptions}
                    value={filters.assignees}
                    onChange={(selected) => handleMultiSelect('assignees', selected)}
                    placeholder="Personel filtrele..."
                    className="w-full md:w-auto"
                />
                <MultiSelectPopover
                    options={tagOptions}
                    value={filters.tags}
                    onChange={(selected) => handleMultiSelect('tags', selected)}
                    placeholder="Etiket filtrele..."
                    className="w-full md:w-auto"
                />
            </div>
        );
    };

    export default TaskFilters;