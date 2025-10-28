import React from 'react';
    import { useDrag } from 'react-dnd';
    import { Card } from '@/components/ui/card';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
    import { MoreHorizontal, Calendar, User, AlertCircle, Sparkles, Flag } from 'lucide-react';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { Button } from '@/components/ui/button';

    const ItemTypes = {
        TASK: 'task',
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

        return (
            <Card
                ref={drag}
                onClick={() => onViewTask(task)}
                className={`mb-4 bg-card/80 backdrop-blur-sm hover:shadow-lg transition-shadow duration-200 group cursor-pointer ${isDragging ? 'opacity-50' : 'opacity-100'}`}
            >
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-muted-foreground pr-2 break-all">{task.task_no}</span>
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleActionClick(e, onEditTask)}>
                            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>

                    <p className="font-semibold text-card-foreground">{task.title}</p>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger className="flex items-center gap-1">
                                        {priorityIcons[task.priority] || priorityIcons['Düşük']}
                                        <span>{task.priority}</span>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Öncelik</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                             {task.due_date && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            <span>{format(new Date(task.due_date), 'dd MMM', { locale: tr })}</span>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Bitiş Tarihi</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                        
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1">
                                    {assignee ? (
                                        <>
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={assignee.avatar_url} />
                                                <AvatarFallback>{assignee.full_name?.charAt(0) || '?'}</AvatarFallback>
                                            </Avatar>
                                            <span className="hidden sm:inline">{assignee.full_name.split(' ')[0]}</span>
                                        </>
                                    ) : (
                                        <>
                                            <User className="h-4 w-4" />
                                            <span>Atanmamış</span>
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