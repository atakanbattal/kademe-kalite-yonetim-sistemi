import React from 'react';
    import { DndProvider } from 'react-dnd';
    import { HTML5Backend } from 'react-dnd-html5-backend';
    import TaskColumn from './TaskColumn';

    const STATUS_COLUMNS = [
        { id: 'Bekliyor', title: 'Bekliyor' },
        { id: 'Devam Ediyor', title: 'Devam Ediyor' },
        { id: 'Tamamlandı', title: 'Tamamlandı' },
        { id: 'Engellendi', title: 'Engellendi' },
    ];

    const TaskBoard = ({ tasks, onEditTask, onViewTask, onUpdateStatus }) => {
        return (
            <DndProvider backend={HTML5Backend}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {STATUS_COLUMNS.map(column => (
                        <TaskColumn
                            key={column.id}
                            status={column.id}
                            title={column.title}
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