import React from 'react';
    import { useDrop } from 'react-dnd';
    import TaskCard from './TaskCard';
    import { cn } from '@/lib/utils';

    const TaskColumn = ({ status, title, tasks, onDrop, onEditTask, onViewTask }) => {
        const [{ isOver, canDrop }, drop] = useDrop(() => ({
            accept: 'task',
            drop: (item) => onDrop(item.id, status),
            collect: (monitor) => ({
                isOver: !!monitor.isOver(),
                canDrop: !!monitor.canDrop(),
            }),
        }));

        return (
            <div
                ref={drop}
                className={cn(
                    'flex flex-col bg-slate-100/50 dark:bg-slate-800/20 rounded-lg',
                    isOver && canDrop && 'bg-accent',
                )}
            >
                <div className="p-4">
                    <h3 className="font-semibold text-lg text-foreground">{title} <span className="text-sm font-normal text-muted-foreground">({tasks.length})</span></h3>
                </div>
                <div className="p-4 pt-0 space-y-4 min-h-[100px]">
                    {tasks.map(task => (
                        <TaskCard 
                            key={task.id} 
                            task={task} 
                            onEditTask={onEditTask}
                            onViewTask={onViewTask}
                        />
                    ))}
                </div>
            </div>
        );
    };

    export default TaskColumn;