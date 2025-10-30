import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TaskColumn from './TaskColumn';
import { ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_STATUS_COLUMNS = [
    { id: 'Bekliyor', title: 'Bekliyor', color: 'bg-slate-100 dark:bg-slate-800' },
    { id: 'Devam Ediyor', title: 'Devam Ediyor', color: 'bg-blue-100 dark:bg-blue-900' },
    { id: 'Tamamlandı', title: 'Tamamlandı', color: 'bg-green-100 dark:bg-green-900' },
    { id: 'Engellendi', title: 'Engellendi', color: 'bg-red-100 dark:bg-red-900' },
];

const TaskBoard = ({ tasks, onEditTask, onViewTask, onUpdateStatus }) => {
    const [showSettings, setShowSettings] = useState(false);
    
    // localStorage key for persisting status columns
    const STATUS_COLUMNS_KEY = 'task-status-columns';
    
    // Initialize from localStorage or use defaults
    const [statusColumns, setStatusColumns] = useState(() => {
        try {
            const saved = localStorage.getItem(STATUS_COLUMNS_KEY);
            return saved ? JSON.parse(saved) : DEFAULT_STATUS_COLUMNS;
        } catch {
            return DEFAULT_STATUS_COLUMNS;
        }
    });
    
    const [editingStatus, setEditingStatus] = useState(null);
    const [newStatusName, setNewStatusName] = useState('');

    // Save to localStorage whenever statusColumns changes
    const updateStatusColumns = (newColumns) => {
        setStatusColumns(newColumns);
        try {
            localStorage.setItem(STATUS_COLUMNS_KEY, JSON.stringify(newColumns));
        } catch {
            console.warn('Failed to save status columns to localStorage');
        }
    };

    // Dinamik grid sütun sayısı
    const getGridColsClass = () => {
        const count = statusColumns.length;
        if (count === 1) return 'grid-cols-1';
        if (count === 2) return 'md:grid-cols-2';
        if (count === 3) return 'lg:grid-cols-3';
        if (count === 4) return 'lg:grid-cols-4';
        return 'lg:grid-cols-5';
    };

    const handleAddStatus = () => {
        if (newStatusName.trim()) {
            const newStatus = {
                id: newStatusName,
                title: newStatusName,
                color: 'bg-slate-100 dark:bg-slate-800'
            };
            updateStatusColumns([...statusColumns, newStatus]);
            setNewStatusName('');
        }
    };

    const handleRemoveStatus = (id) => {
        const statusToRemove = statusColumns.find(s => s.id === id);
        if (confirm(`"${statusToRemove?.title || id}" durumunu silmek istediğinizden emin misiniz? Bu ayar kalıcı olarak kaydedilecektir.`)) {
            updateStatusColumns(statusColumns.filter(s => s.id !== id));
        }
    };

    const handleEditStatus = (id, newName) => {
        updateStatusColumns(statusColumns.map(s =>
            s.id === id ? { ...s, id: newName, title: newName } : s
        ));
        setEditingStatus(null);
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="space-y-4">
                {/* Ayarlar Butonu */}
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                        className="gap-2"
                    >
                        <Settings className="h-4 w-4" />
                        Ayarlar
                        <ChevronDown className={`h-4 w-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                    </Button>
                </div>

                {/* Ayarlar Paneli */}
                {showSettings && (
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                        <h3 className="font-semibold text-lg">Durum Alanlarını Yönet</h3>
                        
                        {/* Mevcut Alanlar */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Aktif Alanlar</p>
                            <div className="flex flex-wrap gap-2">
                                {statusColumns.map(status => (
                                    <div
                                        key={status.id}
                                        className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                                    >
                                        {editingStatus === status.id ? (
                                            <input
                                                type="text"
                                                value={newStatusName || status.title}
                                                onChange={(e) => setNewStatusName(e.target.value)}
                                                onBlur={() => handleEditStatus(status.id, newStatusName || status.title)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleEditStatus(status.id, newStatusName || status.title);
                                                    }
                                                }}
                                                className="text-sm px-2 py-1 border rounded"
                                                autoFocus
                                            />
                                        ) : (
                                            <>
                                                <span className="text-sm cursor-pointer" onClick={() => {
                                                    setEditingStatus(status.id);
                                                    setNewStatusName(status.title);
                                                }}>
                                                    {status.title}
                                                </span>
                                                {statusColumns.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveStatus(status.id)}
                                                        className="text-red-500 hover:text-red-700 text-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Yeni Alan Ekle */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Yeni durum alanı adı"
                                value={newStatusName}
                                onChange={(e) => setNewStatusName(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddStatus();
                                    }
                                }}
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm flex-1 bg-white dark:bg-slate-800"
                            />
                            <Button
                                onClick={handleAddStatus}
                                size="sm"
                                className="whitespace-nowrap"
                            >
                                Ekle
                            </Button>
                        </div>

                        {/* Bilgi ve Sıfırlama */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-muted-foreground">
                                💡 İpucu: Alan adına tıklayarak düzenleyebilirsiniz. Alanlara sürükle-bırak ile görevleri taşıyabilirsiniz.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    updateStatusColumns(DEFAULT_STATUS_COLUMNS);
                                    setShowSettings(false);
                                }}
                                className="text-xs"
                            >
                                Varsayılana Sıfırla
                            </Button>
                        </div>
                    </div>
                )}

                {/* Görev Tahtası */}
                <div className={`grid grid-cols-1 ${getGridColsClass()} gap-6`}>
                    {statusColumns.map(column => (
                        <TaskColumn
                            key={column.id}
                            status={column.id}
                            title={column.title}
                            tasks={tasks.filter(task => task.status === column.id)}
                            onDrop={onUpdateStatus}
                            onEditTask={onEditTask}
                            onViewTask={onViewTask}
                        />
                    ))}
                </div>
            </div>
        </DndProvider>
    );
};

export default TaskBoard;