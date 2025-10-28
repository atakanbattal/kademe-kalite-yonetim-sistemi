import React, { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import TaskBoard from '@/components/tasks/TaskBoard';
import TaskList from '@/components/tasks/TaskList';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import TaskFormModal from '@/components/tasks/TaskFormModal';
import TaskViewModal from '@/components/tasks/TaskViewModal';
import TaskFilters from '@/components/tasks/TaskFilters';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
const TaskModule = () => {
  const {
    tasks,
    personnel,
    taskTags,
    loading,
    refreshData
  } = useData();
  const {
    toast
  } = useToast();
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [viewMode, setViewMode] = useState('board');
  const [filters, setFilters] = useState({
    searchTerm: '',
    assignees: [],
    priorities: [],
    statuses: [],
    tags: []
  });
  const filteredTasks = useMemo(() => {
    if (loading) return [];
    return tasks.filter(task => {
      const searchTermMatch = filters.searchTerm === '' || task.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) || task.task_no?.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const assigneeMatch = filters.assignees.length === 0 || task.assignees.some(a => filters.assignees.includes(a.personnel.id));
      const priorityMatch = filters.priorities.length === 0 || filters.priorities.includes(task.priority);
      const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(task.status);
      const tagMatch = filters.tags.length === 0 || task.tags.some(t => filters.tags.includes(t.task_tags.id));
      return searchTermMatch && assigneeMatch && priorityMatch && statusMatch && tagMatch;
    });
  }, [tasks, filters, loading]);
  const handleUpdateStatus = async (taskId, newStatus) => {
    const {
      error
    } = await supabase.from('tasks').update({
      status: newStatus
    }).eq('id', taskId);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Hata!',
        description: `Durum güncellenemedi: ${error.message}`
      });
    } else {
      toast({
        title: 'Başarılı!',
        description: 'Görev durumu güncellendi.'
      });
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
    if (isViewModalOpen) {
      setViewModalOpen(false);
    }
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
    const {
      error
    } = await supabase.from('tasks').delete().eq('id', taskToDelete.id);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Hata!',
        description: `Görev silinemedi: ${error.message}`
      });
    } else {
      toast({
        title: 'Başarılı!',
        description: 'Görev başarıyla silindi.'
      });
      refreshData();
    }
    setTaskToDelete(null);
    setDeleteDialogOpen(false);
  };
  return <div className="space-y-6">
                <Helmet>
                    <title>Görev Yönetimi</title>
                    <meta name="description" content="Görevlerinizi yönetin, atayın ve takip edin." />
                </Helmet>

                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <h1 className="text-3xl font-bold text-foreground"></h1>
                     <TaskFilters filters={filters} setFilters={setFilters} personnel={personnel} tags={taskTags} />
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setViewMode('board')} className={viewMode === 'board' ? 'bg-accent' : ''}>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'bg-accent' : ''}>
                            <List className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleOpenNewTask}>
                            <Plus className="h-4 w-4 mr-2" /> Yeni Görev
                        </Button>
                    </div>
                </div>

                {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({
        length: 4
      }).map((_, i) => <div key={i} className="space-y-4">
                            <Skeleton className="h-8 w-1/2" />
                            {Array.from({
          length: 3
        }).map((_, j) => <Skeleton key={j} className="h-32 w-full" />)}
                          </div>)}
                    </div> : <>
                        {viewMode === 'board' ? <TaskBoard tasks={filteredTasks} onEditTask={handleEditTask} onViewTask={handleViewTask} onUpdateStatus={handleUpdateStatus} /> : <TaskList tasks={filteredTasks} onEditTask={handleEditTask} onViewTask={handleViewTask} />}
                    </>}

                <TaskFormModal isOpen={isFormModalOpen} setIsOpen={setFormModalOpen} task={selectedTask} onSaveSuccess={handleSaveSuccess} />

                <TaskViewModal isOpen={isViewModalOpen} setIsOpen={setViewModalOpen} task={selectedTask} onEdit={handleEditTask} onDelete={confirmDeleteTask} />

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
                            <AlertDialogAction onClick={deleteTask} className="bg-destructive hover:bg-destructive/90">
                                Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>;
};
export default TaskModule;