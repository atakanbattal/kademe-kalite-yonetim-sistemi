import React from 'react';
import { useDrop } from 'react-dnd';
import TaskCard from './TaskCard';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
    'Bekliyor': {
        header: 'bg-slate-500 dark:bg-slate-600',
        bg: 'bg-slate-50 dark:bg-slate-900/20',
    },
    'Devam Ediyor': {
        header: 'bg-blue-500 dark:bg-blue-600',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    'Tamamlandı': {
        header: 'bg-green-500 dark:bg-green-600',
        bg: 'bg-green-50 dark:bg-green-900/20',
    },
    'Engellendi': {
        header: 'bg-red-500 dark:bg-red-600',
        bg: 'bg-red-50 dark:bg-red-900/20',
    },
};

const TaskColumn = ({ status, title, tasks, onDrop, onEditTask, onViewTask }) => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'task',
        drop: (item) => onDrop(item.id, status),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
            canDrop: !!monitor.canDrop(),
        }),
    }));

    const colors = STATUS_COLORS[title] || STATUS_COLORS['Bekliyor'];

    return (
        <div
            ref={drop}
            className={cn(
                'flex flex-col rounded-lg overflow-hidden transition-all duration-200 border border-slate-200 dark:border-slate-700',
                isOver && canDrop ? 'ring-2 ring-primary scale-105' : '',
            )}
        >
            {/* Header */}
            <div className={`${colors.header} p-4 text-white`}>
                <h3 className="font-bold text-lg">
                    {title}
                    <span className="ml-2 inline-block bg-white/30 px-2.5 py-0.5 rounded-full text-sm font-semibold">
                        {tasks.length}
                    </span>
                </h3>
            </div>

            {/* İçerik */}
            <div className={`${colors.bg} p-4 space-y-3 flex-1 min-h-[200px] overflow-y-auto`}>
                {tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <p className="text-sm">Görev yok</p>
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