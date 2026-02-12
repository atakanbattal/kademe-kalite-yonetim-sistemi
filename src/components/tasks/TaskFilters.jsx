import React from 'react';
    import { Input } from '@/components/ui/input';
    import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

    const TaskFilters = ({ filters, setFilters, personnel, tags, projects = [] }) => {
        const handleSearchChange = (e) => {
            setFilters(prev => ({ ...prev, searchTerm: e.target.value }));
        };

        const handleMultiSelect = (filterName, selected) => {
            setFilters(prev => ({ ...prev, [filterName]: selected }));
        };

        const handleProjectChange = (projectId) => {
            setFilters(prev => ({ ...prev, projectId: projectId === 'all' ? null : projectId }));
        };
        
        const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
        const tagOptions = tags.map(t => ({ value: t.id, label: t.name }));

        return (
            <div className="flex flex-col md:flex-row gap-2 w-full">
                <Input
                    autoFormat={false}
                    placeholder="Görev ara..."
                    value={filters.searchTerm}
                    onChange={handleSearchChange}
                    className="md:max-w-xs"
                />
                <Select value={filters.projectId || 'all'} onValueChange={handleProjectChange}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Proje filtrele..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Projeler</SelectItem>
                        <SelectItem value="none">Projesi Yok</SelectItem>
                        {(projects || []).map(project => (
                            <SelectItem key={project.id} value={project.id}>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                                    {project.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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