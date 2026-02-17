import React, { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Plus, LayoutGrid, List, FolderPlus, FolderKanban, Search, ChevronRight, ChevronLeft,
    MoreHorizontal, Edit, Trash2, CheckCircle2, Clock, AlertTriangle, Filter,
    Users, CalendarDays, Target, Inbox, Star, Hash, X, ListChecks, CircleDot
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import TaskBoard from '@/components/tasks/TaskBoard';
import TaskList from '@/components/tasks/TaskList';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import TaskFormModal from '@/components/tasks/TaskFormModal';
import TaskViewModal from '@/components/tasks/TaskViewModal';
import ProjectModal from '@/components/tasks/ProjectModal';
import { MultiSelectPopover } from '@/components/ui/multi-select-popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

// Sidebar quick views
const QUICK_VIEWS = [
    { id: 'all', label: 'Tüm Görevler', icon: Inbox, color: 'text-slate-500' },
    { id: 'my', label: 'Bana Atananlar', icon: Star, color: 'text-amber-500' },
    { id: 'overdue', label: 'Geciken Görevler', icon: AlertTriangle, color: 'text-red-500' },
    { id: 'unassigned', label: 'Projesi Yok', icon: Hash, color: 'text-gray-400' },
];

const TaskModule = () => {
    const { tasks, personnel, taskTags, taskProjects, loading, refreshData } = useData();
    const { toast } = useToast();
    const { user } = useAuth();

    // UI state
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isViewModalOpen, setViewModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [viewMode, setViewMode] = useState('board');
    const [isProjectModalOpen, setProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Optimistik güncelleme - sürükle bırak anında UI güncellemesi için
    const [optimisticUpdates, setOptimisticUpdates] = useState({});

    // Navigation state
    const [activeView, setActiveView] = useState('all'); // 'all', 'my', 'overdue', 'unassigned' or project ID
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAssignees, setFilterAssignees] = useState([]);
    const [filterPriorities, setFilterPriorities] = useState([]);
    const [showFilters, setShowFilters] = useState(false);

    // Get current user's personnel ID
    const currentPersonnelId = useMemo(() => {
        if (!user || !personnel?.length) return null;
        return personnel.find(p => p.email === user.email)?.id || null;
    }, [user, personnel]);

    // Get the active project object
    const activeProject = useMemo(() => {
        if (!taskProjects?.length) return null;
        return taskProjects.find(p => p.id === activeView) || null;
    }, [activeView, taskProjects]);

    // Optimistik güncellemeleri uygula (sürükle bırak performansı)
    const tasksWithOptimistic = useMemo(() => {
        if (!tasks || Object.keys(optimisticUpdates).length === 0) return tasks;
        return tasks.map(t => {
            const upd = optimisticUpdates[t.id];
            return upd ? { ...t, ...upd } : t;
        });
    }, [tasks, optimisticUpdates]);

    // Compute project stats (optimistik veri ile)
    const projectStats = useMemo(() => {
        const src = tasksWithOptimistic ?? tasks;
        if (!src?.length) return {};
        const stats = {};
        
        // Compute stats for each project
        (taskProjects || []).forEach(project => {
            const projectTasks = src.filter(t => t.project_id === project.id);
            const completed = projectTasks.filter(t => t.status === 'Tamamlandı').length;
            const total = projectTasks.length;
            const overdue = projectTasks.filter(t => {
                if (t.status === 'Tamamlandı') return false;
                if (!t.due_date) return false;
                const d = new Date(t.due_date);
                const today = new Date(); today.setHours(0,0,0,0);
                return d < today;
            }).length;
            stats[project.id] = { total, completed, overdue, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
        });
        return stats;
    }, [tasksWithOptimistic, tasks, taskProjects]);

    // Quick view counts (optimistik veri ile)
    const quickViewCounts = useMemo(() => {
        const src = tasksWithOptimistic ?? tasks;
        if (!src?.length) return { all: 0, my: 0, overdue: 0, unassigned: 0 };
        const today = new Date(); today.setHours(0,0,0,0);
        return {
            all: src.length,
            my: src.filter(t => t.assignees?.some(a => a.personnel?.id === currentPersonnelId)).length,
            overdue: src.filter(t => {
                if (t.status === 'Tamamlandı') return false;
                if (!t.due_date) return false;
                return new Date(t.due_date) < today;
            }).length,
            unassigned: src.filter(t => !t.project_id).length,
        };
    }, [tasksWithOptimistic, tasks, currentPersonnelId]);

    // Filter tasks based on active view + search + filters
    const filteredTasks = useMemo(() => {
        if (loading || !tasksWithOptimistic) return [];
        const today = new Date(); today.setHours(0,0,0,0);

        return tasksWithOptimistic.filter(task => {
            // View filter
            let viewMatch = true;
            if (activeView === 'my') {
                viewMatch = task.assignees?.some(a => a.personnel?.id === currentPersonnelId);
            } else if (activeView === 'overdue') {
                viewMatch = task.status !== 'Tamamlandı' && task.due_date && new Date(task.due_date) < today;
            } else if (activeView === 'unassigned') {
                viewMatch = !task.project_id;
            } else if (activeView !== 'all') {
                // Project ID
                viewMatch = task.project_id === activeView;
            }

            // Search filter
            const searchMatch = !searchTerm || 
                task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.task_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchTerm.toLowerCase());

            // Assignee filter
            const assigneeMatch = filterAssignees.length === 0 || 
                task.assignees?.some(a => filterAssignees.includes(a.personnel?.id));

            // Priority filter
            const priorityMatch = filterPriorities.length === 0 || filterPriorities.includes(task.priority);

            return viewMatch && searchMatch && assigneeMatch && priorityMatch;
        });
    }, [tasksWithOptimistic, activeView, searchTerm, filterAssignees, filterPriorities, currentPersonnelId, loading]);

    // Status counts for current view
    const statusCounts = useMemo(() => {
        const counts = { 'Bekliyor': 0, 'Devam Ediyor': 0, 'Tamamlandı': 0, 'Engellendi': 0 };
        filteredTasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
        return counts;
    }, [filteredTasks]);

    // Handlers - optimistik güncelleme ile anında UI tepkisi
    const handleUpdateStatus = async (taskId, newStatus) => {
        const updateData = { status: newStatus };
        if (newStatus === 'Tamamlandı') updateData.completed_at = new Date().toISOString();
        else updateData.completed_at = null;

        // Anında UI güncellemesi (sürükle bırak performansı)
        setOptimisticUpdates(prev => ({ ...prev, [taskId]: { status: newStatus, completed_at: updateData.completed_at } }));

        const { error } = await supabase.from('tasks').update(updateData).eq('id', taskId);
        if (error) {
            setOptimisticUpdates(prev => { const n = { ...prev }; delete n[taskId]; return n; });
            toast({ variant: 'destructive', title: 'Hata!', description: `Durum güncellenemedi: ${error.message}` });
        } else {
            setOptimisticUpdates(prev => { const n = { ...prev }; delete n[taskId]; return n; });
            refreshData();
        }
    };

    const handleOpenNewTask = () => {
        setSelectedTask(null);
        setFormModalOpen(true);
    };

    const handleEditTask = useCallback(task => {
        setSelectedTask(task);
        setFormModalOpen(true);
    }, []);

    const handleViewTask = useCallback(task => {
        setSelectedTask(task);
        setViewModalOpen(true);
    }, []);

    const handleSaveSuccess = () => {
        refreshData();
        setFormModalOpen(false);
        if (isViewModalOpen) setViewModalOpen(false);
        setSelectedTask(null);
    };

    const confirmDeleteTask = task => {
        setTaskToDelete(task);
        setDeleteDialogOpen(true);
        setViewModalOpen(false);
    };

    const deleteTask = async () => {
        if (!taskToDelete) return;
        await supabase.from('task_checklists').delete().eq('task_id', taskToDelete.id);
        await supabase.from('task_assignees').delete().eq('task_id', taskToDelete.id);
        await supabase.from('task_tag_relations').delete().eq('task_id', taskToDelete.id);
        await supabase.from('task_comments').delete().eq('task_id', taskToDelete.id);
        await supabase.from('task_attachments').delete().eq('task_id', taskToDelete.id);
        const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Görev silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Silindi', description: 'Görev başarıyla silindi.' });
            refreshData();
        }
        setTaskToDelete(null);
        setDeleteDialogOpen(false);
    };

    const handleOpenProjectModal = (project = null) => {
        setEditingProject(project);
        setProjectModalOpen(true);
    };

    // Get active view label
    const getViewTitle = () => {
        const quick = QUICK_VIEWS.find(v => v.id === activeView);
        if (quick) return quick.label;
        if (activeProject) return activeProject.name;
        return 'Görevler';
    };

    const personnelOptions = personnel?.map(p => ({ value: p.id, label: p.full_name })) || [];

    return (
        <div className="h-[calc(100vh-5rem)] flex overflow-hidden -mt-2">
            <Helmet>
                <title>Görev Yönetimi | Kademe A.Ş.</title>
            </Helmet>

            {/* ===== SIDEBAR ===== */}
            <aside className={cn(
                "bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out shrink-0",
                sidebarOpen ? "w-72" : "w-0 overflow-hidden"
            )}>
                {/* Sidebar Header */}
                <div className="p-4 border-b border-border">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-primary" />
                        Görev Yönetimi
                    </h2>
                </div>

                <ScrollArea className="flex-1">
                    {/* Quick Views */}
                    <div className="p-2">
                        <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Hızlı Görünümler</p>
                        {QUICK_VIEWS.map(view => {
                            const Icon = view.icon;
                            const count = quickViewCounts[view.id] || 0;
                            const isActive = activeView === view.id;
                            return (
                                <button
                                    key={view.id}
                                    onClick={() => setActiveView(view.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group",
                                        isActive 
                                            ? "bg-primary/10 text-primary font-semibold" 
                                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : view.color)} />
                                    <span className="flex-1 text-left truncate">{view.label}</span>
                                    <span className={cn(
                                        "text-xs tabular-nums min-w-[20px] text-center rounded-full px-1.5 py-0.5",
                                        isActive ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground",
                                        view.id === 'overdue' && count > 0 ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 font-bold" : ""
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <Separator className="mx-4" />

                    {/* Projects */}
                    <div className="p-2">
                        <div className="flex items-center justify-between px-3 py-1.5">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Projeler</p>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleOpenProjectModal(null)}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right"><p>Yeni Proje</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {loading ? (
                            <div className="space-y-2 px-3">
                                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                            </div>
                        ) : (taskProjects || []).length === 0 ? (
                            <div className="px-3 py-6 text-center">
                                <FolderPlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">Henüz proje yok</p>
                                <Button variant="link" size="sm" className="text-xs mt-1 h-auto p-0" onClick={() => handleOpenProjectModal(null)}>
                                    İlk projeyi oluştur
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {(taskProjects || []).map(project => {
                                    const stats = projectStats[project.id] || { total: 0, completed: 0, overdue: 0, progress: 0 };
                                    const isActive = activeView === project.id;
                                    return (
                                        <button
                                            key={project.id}
                                            onClick={() => setActiveView(project.id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group",
                                                isActive 
                                                    ? "bg-primary/10 ring-1 ring-primary/20" 
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 mb-1.5">
                                                <div 
                                                    className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                                                    style={{ backgroundColor: project.color || '#6366f1' }}
                                                />
                                                <span className={cn(
                                                    "text-sm truncate flex-1",
                                                    isActive ? "font-semibold text-primary" : "text-foreground/80"
                                                )}>
                                                    {project.name}
                                                </span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <div
                                                            role="button"
                                                            className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted-foreground/10"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </div>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenProjectModal(project); }}>
                                                            <Edit className="h-3.5 w-3.5 mr-2" /> Düzenle
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Progress value={stats.progress} className="h-1.5 flex-1" />
                                                <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                                                    {stats.completed}/{stats.total}
                                                </span>
                                            </div>
                                            {stats.overdue > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                                    <span className="text-[10px] text-red-500 font-medium">{stats.overdue} gecikmiş</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Bar */}
                <div className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Sidebar toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>

                        {/* View title + project badge */}
                        <div className="flex items-center gap-2 min-w-0">
                            {activeProject && (
                                <div 
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: activeProject.color || '#6366f1' }}
                                />
                            )}
                            <h1 className="text-lg font-bold text-foreground truncate">
                                {getViewTitle()}
                            </h1>
                            {activeProject?.description && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Badge variant="outline" className="text-[10px] font-normal shrink-0 hidden md:inline-flex">
                                                {activeProject.description.substring(0, 40)}{activeProject.description.length > 40 ? '...' : ''}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-xs"><p>{activeProject.description}</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>

                        <div className="flex-1" />

                        {/* Status Mini Stats */}
                        <div className="hidden lg:flex items-center gap-1.5">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs">
                                            <Clock className="h-3 w-3 text-slate-500" />
                                            <span className="font-semibold tabular-nums">{statusCounts['Bekliyor']}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Bekliyor</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-xs">
                                            <CircleDot className="h-3 w-3 text-blue-500" />
                                            <span className="font-semibold tabular-nums">{statusCounts['Devam Ediyor']}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Devam Ediyor</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-xs">
                                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            <span className="font-semibold tabular-nums">{statusCounts['Tamamlandı']}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Tamamlandı</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            {statusCounts['Engellendi'] > 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-xs">
                                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                                <span className="font-semibold tabular-nums">{statusCounts['Engellendi']}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Engellendi</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>

                        <Separator orientation="vertical" className="h-6 hidden lg:block" />

                        {/* Search */}
                        <div className="flex items-center gap-2 h-8 w-48 md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                placeholder="Görev ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 min-w-0 bg-transparent border-0 outline-none placeholder:text-muted-foreground text-sm"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="shrink-0 p-0.5 rounded hover:bg-muted"
                                >
                                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </button>
                            )}
                        </div>

                        {/* Filter toggle */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={showFilters || filterAssignees.length > 0 || filterPriorities.length > 0 ? "default" : "outline"}
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        onClick={() => setShowFilters(!showFilters)}
                                    >
                                        <Filter className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Filtreler</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <Separator orientation="vertical" className="h-6" />

                        {/* View mode toggle */}
                        <div className="flex items-center bg-muted rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('board')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                    viewMode === 'board' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Pano</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                    viewMode === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <List className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Liste</span>
                            </button>
                        </div>

                        {/* Yeni Görev - tek buton */}
                        <Button onClick={handleOpenNewTask} size="sm" className="h-8 gap-1.5 shrink-0">
                            <Plus className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Yeni Görev</span>
                        </Button>
                    </div>

                    {/* Expanded Filters Row */}
                    {showFilters && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                            <span className="text-xs text-muted-foreground font-medium shrink-0">Filtreler:</span>
                            <MultiSelectPopover
                                options={personnelOptions}
                                value={filterAssignees}
                                onChange={setFilterAssignees}
                                placeholder="Personel..."
                                className="w-auto min-w-[140px]"
                            />
                            <MultiSelectPopover
                                options={[
                                    { value: 'Kritik', label: 'Kritik' },
                                    { value: 'Yüksek', label: 'Yüksek' },
                                    { value: 'Orta', label: 'Orta' },
                                    { value: 'Düşük', label: 'Düşük' },
                                ]}
                                value={filterPriorities}
                                onChange={setFilterPriorities}
                                placeholder="Öncelik..."
                                className="w-auto min-w-[120px]"
                            />
                            {(filterAssignees.length > 0 || filterPriorities.length > 0) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground"
                                    onClick={() => { setFilterAssignees([]); setFilterPriorities([]); }}
                                >
                                    <X className="h-3 w-3 mr-1" /> Temizle
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Project Header - shown when a project is selected */}
                {activeProject && (
                    <div className="px-4 py-2.5 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">İlerleme</span>
                                <Progress value={projectStats[activeProject.id]?.progress || 0} className="h-2 w-24" />
                                <span className="text-xs font-bold tabular-nums">
                                    %{projectStats[activeProject.id]?.progress || 0}
                                </span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ListChecks className="h-3.5 w-3.5" />
                                <span>{projectStats[activeProject.id]?.completed || 0} / {projectStats[activeProject.id]?.total || 0} tamamlandı</span>
                            </div>
                            {(projectStats[activeProject.id]?.overdue || 0) > 0 && (
                                <>
                                    <Separator orientation="vertical" className="h-4" />
                                    <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span>{projectStats[activeProject.id]?.overdue} gecikmiş</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0" onClick={() => handleOpenProjectModal(activeProject)}>
                            <Edit className="h-3 w-3" /> Proje Ayarları
                        </Button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-3">
                                    <Skeleton className="h-10 w-full rounded-lg" />
                                    {Array.from({ length: 3 }).map((_, j) => (
                                        <Skeleton key={j} className="h-28 w-full rounded-lg" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-16">
                            <div className="bg-muted/50 rounded-full p-6 mb-4">
                                {activeProject ? (
                                    <FolderKanban className="h-10 w-10 text-muted-foreground/50" />
                                ) : (
                                    <Inbox className="h-10 w-10 text-muted-foreground/50" />
                                )}
                            </div>
                            <h3 className="text-lg font-semibold text-foreground/70 mb-1">
                                {searchTerm || filterAssignees.length > 0 || filterPriorities.length > 0 
                                    ? 'Filtre sonucu bulunamadı' 
                                    : activeProject 
                                        ? 'Bu projede henüz görev yok'
                                        : 'Henüz görev yok'
                                }
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {searchTerm || filterAssignees.length > 0 || filterPriorities.length > 0
                                    ? 'Farklı filtreler deneyebilirsiniz'
                                    : 'İlk görevinizi oluşturarak başlayın'
                                }
                            </p>
                            {!searchTerm && filterAssignees.length === 0 && filterPriorities.length === 0 && (
                                <Button onClick={handleOpenNewTask} size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> Görev Oluştur
                                </Button>
                            )}
                        </div>
                    ) : viewMode === 'board' ? (
                        <TaskBoard
                            tasks={filteredTasks}
                            onEditTask={handleEditTask}
                            onViewTask={handleViewTask}
                            onUpdateStatus={handleUpdateStatus}
                        />
                    ) : (
                        <TaskList
                            tasks={filteredTasks}
                            onEditTask={handleEditTask}
                            onViewTask={handleViewTask}
                            onDeleteTask={confirmDeleteTask}
                        />
                    )}
                </div>
            </main>

            {/* Modals */}
            <TaskFormModal
                isOpen={isFormModalOpen}
                setIsOpen={setFormModalOpen}
                task={selectedTask}
                onSaveSuccess={handleSaveSuccess}
                defaultProjectId={activeProject?.id || null}
            />

            <TaskViewModal
                isOpen={isViewModalOpen}
                setIsOpen={setViewModalOpen}
                task={selectedTask}
                onEdit={handleEditTask}
                onDelete={confirmDeleteTask}
            />

            <ProjectModal
                isOpen={isProjectModalOpen}
                setIsOpen={setProjectModalOpen}
                project={editingProject}
                onSaveSuccess={() => {
                    refreshData();
                    setEditingProject(null);
                }}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. "{taskToDelete?.title}" başlıklı görevi kalıcı olarak sileceksiniz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteTask} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default TaskModule;
