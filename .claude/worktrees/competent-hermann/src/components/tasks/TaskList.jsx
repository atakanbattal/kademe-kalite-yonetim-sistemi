import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, Eye, Flag, AlertCircle, Sparkles, Trash2, MoreHorizontal, Calendar, CheckSquare, AlertTriangle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const priorityConfig = {
    'Kritik': { icon: <Flag className="h-3 w-3" />, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', order: 0 },
    'Yüksek': { icon: <AlertCircle className="h-3 w-3" />, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', order: 1 },
    'Orta': { icon: <Sparkles className="h-3 w-3" />, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', order: 2 },
    'Düşük': { icon: <Sparkles className="h-3 w-3" />, color: 'bg-gray-400', textColor: 'text-gray-500', order: 3 },
};

const statusConfig = {
    'Bekliyor': { color: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
    'Devam Ediyor': { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
    'Tamamlandı': { color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
    'Engellendi': { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
};

const isOverdue = (dateString, status) => {
    if (status === 'Tamamlandı' || !dateString) return false;
    try {
        const date = parseISO(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return isPast(date) && date.toDateString() !== today.toDateString();
    } catch { return false; }
};

const TaskList = ({ tasks, onEditTask, onViewTask, onDeleteTask }) => {
    const handleActionClick = (e, action, task) => {
        e.stopPropagation();
        action(task);
    };

    return (
        <div className="border rounded-xl overflow-hidden bg-card">
            <div className="overflow-auto max-h-[calc(100vh-16rem)]">
                <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[90px] text-[11px] font-semibold uppercase tracking-wider">No</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider min-w-[200px]">Görev</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[130px]">Proje</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[140px]">Atanan</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[90px]">Öncelik</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[110px]">Durum</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[100px]">Bitiş</TableHead>
                            <TableHead className="w-[60px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                    Görev bulunamadı
                                </TableCell>
                            </TableRow>
                        ) : tasks.map(task => {
                            const overdue = isOverdue(task.due_date, task.status);
                            const priority = priorityConfig[task.priority] || priorityConfig['Düşük'];
                            const statusStyle = statusConfig[task.status] || statusConfig['Bekliyor'];
                            const checklistTotal = task.checklist?.length || 0;
                            const checklistDone = task.checklist?.filter(c => c.is_completed).length || 0;

                            return (
                                <TableRow
                                    key={task.id}
                                    className={cn(
                                        "cursor-pointer transition-colors",
                                        overdue ? "bg-red-50/50 dark:bg-red-950/10" : "hover:bg-muted/50"
                                    )}
                                    onClick={() => onViewTask(task)}
                                >
                                    <TableCell className="font-mono text-xs text-muted-foreground">{task.task_no}</TableCell>
                                    <TableCell>
                                        <div className="space-y-0.5">
                                            <p className="font-medium text-sm line-clamp-1">{task.title}</p>
                                            {checklistTotal > 0 && (
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <CheckSquare className="h-3 w-3" />
                                                    <span className="text-[10px] tabular-nums">{checklistDone}/{checklistTotal}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {task.project ? (
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white max-w-full truncate"
                                                style={{ backgroundColor: task.project.color || '#6366f1' }}
                                            >
                                                {task.project.name}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <TooltipProvider>
                                            <div className="flex -space-x-1">
                                                {task.assignees?.slice(0, 3).map(a => (
                                                    <Tooltip key={a.personnel?.id}>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className="h-6 w-6 ring-2 ring-card">
                                                                <AvatarImage src={a.personnel?.avatar_url} />
                                                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                                                                    {a.personnel?.full_name?.charAt(0) || '?'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p className="text-xs">{a.personnel?.full_name}</p></TooltipContent>
                                                    </Tooltip>
                                                ))}
                                                {(task.assignees?.length || 0) > 3 && (
                                                    <div className="h-6 w-6 rounded-full bg-muted ring-2 ring-card flex items-center justify-center">
                                                        <span className="text-[9px] font-bold text-muted-foreground">+{task.assignees.length - 3}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell>
                                        <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold', priority.textColor)}>
                                            {priority.icon}
                                            {task.priority}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={cn('text-[10px] font-semibold', statusStyle.color)}>
                                            {task.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {task.due_date ? (
                                            <span className={cn(
                                                'flex items-center gap-1 text-xs',
                                                overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'
                                            )}>
                                                {overdue && <AlertTriangle className="h-3 w-3" />}
                                                {format(new Date(task.due_date), 'dd.MM.yy', { locale: tr })}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/40">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36">
                                                <DropdownMenuItem onClick={(e) => handleActionClick(e, onViewTask, task)}>
                                                    <Eye className="mr-2 h-3.5 w-3.5" /> Görüntüle
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => handleActionClick(e, onEditTask, task)}>
                                                    <Edit className="mr-2 h-3.5 w-3.5" /> Düzenle
                                                </DropdownMenuItem>
                                                {onDeleteTask && (
                                                    <DropdownMenuItem
                                                        onClick={(e) => handleActionClick(e, onDeleteTask, task)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Sil
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default TaskList;
