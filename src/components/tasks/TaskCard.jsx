import React from 'react';
import { useDrag } from 'react-dnd';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoreHorizontal, Calendar, User, AlertCircle, Sparkles, Flag, AlertTriangle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

const ItemTypes = {
    TASK: 'task',
};

const monthNames = {
    '01': 'Ocak',
    '02': 'Şubat',
    '03': 'Mart',
    '04': 'Nisan',
    '05': 'Mayıs',
    '06': 'Haziran',
    '07': 'Temmuz',
    '08': 'Ağustos',
    '09': 'Eylül',
    '10': 'Ekim',
    '11': 'Kasım',
    '12': 'Aralık',
};

const formatFullDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const fullMonth = monthNames[month] || month;
    return `${day} ${fullMonth}`;
};

const isOverdue = (dateString) => {
    if (!dateString) return false;
    try {
        const date = parseISO(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return isPast(date) && date.toDateString() !== today.toDateString();
    } catch {
        return false;
    }
};

const priorityIcons = {
    'Düşük': <Sparkles className="h-4 w-4 text-gray-500" />,
    'Orta': <Sparkles className="h-4 w-4 text-blue-500" />,
    'Yüksek': <AlertCircle className="h-4 w-4 text-yellow-500" />,
    'Kritik': <Flag className="h-4 w-4 text-red-500" />,
};

const TaskCard = ({ task, onEditTask, onViewTask }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.TASK,
        item: { id: task.id, status: task.status },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    const handleActionClick = (e, action) => {
        e.stopPropagation();
        action(task);
    };

    const assignee = task.assignees && task.assignees.length > 0 ? task.assignees[0].personnel : null;
    const overdue = isOverdue(task.due_date);
    const formattedDate = formatFullDate(task.due_date);

    return (
        <Card
            ref={drag}
            onClick={() => onViewTask(task)}
            className={`mb-4 bg-card/80 backdrop-blur-sm hover:shadow-lg transition-shadow duration-200 group cursor-pointer ${isDragging ? 'opacity-50' : 'opacity-100'} ${overdue ? 'border-l-4 border-l-red-500' : ''}`}
        >
            <div className="p-4 space-y-3">
                {/* Başlık ve Menu */}
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-muted-foreground break-all">{task.task_no}</span>
                        <p className="font-semibold text-card-foreground line-clamp-2">{task.title}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => handleActionClick(e, onEditTask)}>
                        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </Button>
                </div>

                {/* Gecikmiş Görev Uyarısı */}
                {overdue && (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 px-2 py-1.5 rounded border border-red-200 dark:border-red-800">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-300">Termin geçti!</span>
                    </div>
                )}

                {/* Meta Bilgiler */}
                <div className="flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1">
                                    {priorityIcons[task.priority] || priorityIcons['Düşük']}
                                    <span className="text-xs">{task.priority}</span>
                                </TooltipTrigger>
                                <TooltipContent><p>Öncelik</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {task.due_date && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                                        <Calendar className={`h-4 w-4 ${overdue ? 'text-red-600 dark:text-red-400' : ''}`} />
                                        <span className={`text-xs ${overdue ? 'text-red-600 dark:text-red-400' : ''}`}>{formattedDate}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{overdue ? 'Termin Geçti!' : 'Bitiş Tarihi'}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                                {assignee ? (
                                    <>
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={assignee.avatar_url} />
                                            <AvatarFallback className="text-xs">{assignee.full_name?.charAt(0) || '?'}</AvatarFallback>
                                        </Avatar>
                                        <span className="hidden sm:inline text-xs">{assignee.full_name.split(' ')[0]}</span>
                                    </>
                                ) : (
                                    <>
                                        <User className="h-4 w-4" />
                                        <span className="text-xs">Atanmamış</span>
                                    </>
                                )}
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{assignee ? assignee.full_name : 'Atanmamış'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </Card>
    );
};

export default TaskCard;