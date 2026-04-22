import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, AlertTriangle, Flag, AlertCircle, Sparkles, CheckSquare } from 'lucide-react';
import { isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const monthNames = {
    '01': 'Oca', '02': 'Şub', '03': 'Mar', '04': 'Nis',
    '05': 'May', '06': 'Haz', '07': 'Tem', '08': 'Ağu',
    '09': 'Eyl', '10': 'Eki', '11': 'Kas', '12': 'Ara',
};

const formatShortDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day} ${monthNames[month]}`;
};

const isOverdue = (dateString) => {
    if (!dateString) return false;
    try {
        const date = parseISO(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return isPast(date) && date.toDateString() !== today.toDateString();
    } catch { return false; }
};

const PRIORITY_CONFIG = {
    'Düşük': { icon: Sparkles, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
    'Orta': { icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    'Yüksek': { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    'Kritik': { icon: Flag, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
};

const TaskCard = React.memo(({ task, onEditTask, onViewTask }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `task-${task.id}`,
        data: { taskId: task.id, status: task.status },
    });

    const overdue = (task.status === 'Tamamlandı') ? false : isOverdue(task.due_date);
    const project = task.project || null;
    const assignees = task.assignees || [];
    const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['Düşük'];
    const PriorityIcon = priorityConf.icon;

    // Checklist progress
    const checklistTotal = task.checklist?.length || 0;
    const checklistDone = task.checklist?.filter(c => c.is_completed).length || 0;

    return (
        <Card
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={() => onViewTask(task)}
            className={cn(
                'bg-card hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing border group',
                isDragging ? 'opacity-40 scale-95 shadow-lg ring-2 ring-primary/30' : 'opacity-100',
                overdue ? 'border-l-[3px] border-l-red-400' : 'hover:border-primary/30'
            )}
        >
            <div className="p-3 space-y-2">
                {/* Top Row: Project badge + Priority */}
                <div className="flex items-center justify-between gap-2">
                    {project ? (
                        <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white truncate max-w-[140px]"
                            style={{ backgroundColor: project.color || '#6366f1' }}
                        >
                            {project.name}
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 font-mono">{task.task_no}</span>
                    )}
                    <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md', priorityConf.bg)}>
                        <PriorityIcon className={cn('h-3 w-3', priorityConf.color)} />
                        <span className={cn('text-[10px] font-medium', priorityConf.color)}>{task.priority}</span>
                    </div>
                </div>

                {/* Title */}
                <p className="text-sm font-semibold text-card-foreground line-clamp-2 leading-snug">{task.title}</p>

                {/* Overdue warning */}
                {overdue && (
                    <div className="flex items-center gap-1.5 text-red-500 bg-red-50 dark:bg-red-950/50 px-2 py-1 rounded-md">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="text-[10px] font-semibold">Gecikmiş!</span>
                    </div>
                )}

                {/* Checklist progress */}
                {checklistTotal > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckSquare className="h-3 w-3" />
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary/60 rounded-full transition-all" 
                                style={{ width: `${(checklistDone / checklistTotal) * 100}%` }} 
                            />
                        </div>
                        <span className="text-[10px] tabular-nums">{checklistDone}/{checklistTotal}</span>
                    </div>
                )}

                {/* Bottom: Date + Assignees */}
                <div className="flex items-center justify-between pt-1">
                    {task.due_date ? (
                        <span className={cn(
                            'flex items-center gap-1 text-[11px]',
                            overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'
                        )}>
                            <Calendar className="h-3 w-3" />
                            {formatShortDate(task.due_date)}
                        </span>
                    ) : (
                        <span />
                    )}

                    {/* Assignee avatars */}
                    <div className="flex items-center -space-x-1.5">
                        <TooltipProvider>
                            {assignees.slice(0, 3).map(a => (
                                <Tooltip key={a.personnel?.id}>
                                    <TooltipTrigger asChild>
                                        <Avatar className="h-5 w-5 ring-2 ring-card">
                                            <AvatarImage src={a.personnel?.avatar_url} />
                                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">
                                                {a.personnel?.full_name?.charAt(0) || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom"><p className="text-xs">{a.personnel?.full_name}</p></TooltipContent>
                                </Tooltip>
                            ))}
                            {assignees.length > 3 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="h-5 w-5 rounded-full bg-muted ring-2 ring-card flex items-center justify-center">
                                            <span className="text-[8px] font-bold text-muted-foreground">+{assignees.length - 3}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <div className="space-y-0.5">
                                            {assignees.slice(3).map(a => (
                                                <p key={a.personnel?.id} className="text-xs">{a.personnel?.full_name}</p>
                                            ))}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </TooltipProvider>
                    </div>
                </div>
            </div>
        </Card>
    );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;
