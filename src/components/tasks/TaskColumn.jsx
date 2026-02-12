import React from 'react';
import { useDrop } from 'react-dnd';
import TaskCard from './TaskCard';
import { cn } from '@/lib/utils';

const COLOR_MAP = {
    slate: {
        header: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
        headerText: 'text-slate-700 dark:text-slate-300',
        dot: 'bg-slate-400',
        bg: 'bg-slate-50/50 dark:bg-slate-900/10',
    },
    blue: {
        header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        headerText: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500',
        bg: 'bg-blue-50/30 dark:bg-blue-900/5',
    },
    green: {
        header: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        headerText: 'text-green-700 dark:text-green-300',
        dot: 'bg-green-500',
        bg: 'bg-green-50/30 dark:bg-green-900/5',
    },
    red: {
        header: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        headerText: 'text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
        bg: 'bg-red-50/30 dark:bg-red-900/5',
    },
};

const TaskColumn = ({ status, title, colorScheme = 'slate', tasks, onDrop, onEditTask, onViewTask }) => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'task',
        drop: (item) => onDrop(item.id, status),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
            canDrop: !!monitor.canDrop(),
        }),
    }));

    const colors = COLOR_MAP[colorScheme] || COLOR_MAP.slate;

    return (
        <div
            ref={drop}
            className={cn(
                'flex flex-col rounded-xl overflow-hidden transition-all duration-200',
                isOver && canDrop ? 'ring-2 ring-primary ring-offset-2 scale-[1.01]' : '',
            )}
        >
            {/* Header */}
            <div className={cn('px-3 py-2.5 border-b flex items-center gap-2', colors.header)}>
                <div className={cn('h-2.5 w-2.5 rounded-full', colors.dot)} />
                <h3 className={cn('text-sm font-semibold flex-1', colors.headerText)}>
                    {title}
                </h3>
                <span className={cn(
                    'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
                    colors.headerText, 'bg-white/50 dark:bg-black/10'
                )}>
                    {tasks.length}
                </span>
            </div>

            {/* Content */}
            <div className={cn('p-2 space-y-2 flex-1 min-h-[120px] max-h-[calc(100vh-18rem)] overflow-y-auto', colors.bg)}>
                {tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-muted-foreground/50">
                        <p className="text-xs">Boş</p>
                    </div>
                ) : (
                    tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onEditTask={onEditTask}
                            onViewTask={onViewTask}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default TaskColumn;
