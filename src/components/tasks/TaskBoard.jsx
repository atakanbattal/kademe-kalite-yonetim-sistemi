import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TaskColumn from './TaskColumn';

const DEFAULT_STATUS_COLUMNS = [
    { id: 'Bekliyor', title: 'Bekliyor', color: 'slate' },
    { id: 'Devam Ediyor', title: 'Devam Ediyor', color: 'blue' },
    { id: 'Tamamlandı', title: 'Tamamlandı', color: 'green' },
    { id: 'Engellendi', title: 'Engellendi', color: 'red' },
];

const TaskBoard = ({ tasks, onEditTask, onViewTask, onUpdateStatus }) => {
    const statusColumns = DEFAULT_STATUS_COLUMNS;

    const getGridColsClass = () => {
        const count = statusColumns.length;
        if (count <= 2) return 'md:grid-cols-2';
        if (count === 3) return 'lg:grid-cols-3';
        return 'lg:grid-cols-4';
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className={`grid grid-cols-1 ${getGridColsClass()} gap-4 h-full`}>
                {statusColumns.map(column => (
                    <TaskColumn
                        key={column.id}
                        status={column.id}
                        title={column.title}
                        colorScheme={column.color}
                        tasks={tasks.filter(task => task.status === column.id)}
                        onDrop={onUpdateStatus}
                        onEditTask={onEditTask}
                        onViewTask={onViewTask}
                    />
                ))}
            </div>
        </DndProvider>
    );
};

export default TaskBoard;
