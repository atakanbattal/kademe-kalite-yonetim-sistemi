import React from 'react';
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import TaskColumn from './TaskColumn';

const DEFAULT_STATUS_COLUMNS = [
    { id: 'Bekliyor', title: 'Bekliyor', color: 'slate' },
    { id: 'Devam Ediyor', title: 'Devam Ediyor', color: 'blue' },
    { id: 'Tamamlandı', title: 'Tamamlandı', color: 'green' },
    { id: 'Engellendi', title: 'Engellendi', color: 'red' },
];

const TaskBoard = ({ tasks, onEditTask, onViewTask, onUpdateStatus }) => {
    const statusColumns = DEFAULT_STATUS_COLUMNS;

    // Hareket sonrası sürüklemeyi başlat - yanlışlıkla tıklamaları önler, performansı artırır
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;
        const taskId = active.data?.current?.taskId;
        const status = active.data?.current?.status;
        // over.id: kolon (Bekliyor, Devam Ediyor...) veya başka kart (task-xxx)
        let newStatus = over.id;
        if (typeof newStatus === 'string' && newStatus.startsWith('task-')) {
            const targetTask = tasks.find(t => `task-${t.id}` === newStatus);
            newStatus = targetTask?.status ?? status;
        }
        if (taskId && newStatus && newStatus !== status) {
            onUpdateStatus(taskId, newStatus);
        }
    };

    const getGridColsClass = () => {
        const count = statusColumns.length;
        if (count <= 2) return 'md:grid-cols-2';
        if (count === 3) return 'lg:grid-cols-3';
        return 'lg:grid-cols-4';
    };

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className={`grid grid-cols-1 ${getGridColsClass()} gap-4 h-full`}>
                {statusColumns.map(column => (
                    <TaskColumn
                        key={column.id}
                        status={column.id}
                        title={column.title}
                        colorScheme={column.color}
                        tasks={tasks.filter(task => task.status === column.id)}
                        onEditTask={onEditTask}
                        onViewTask={onViewTask}
                    />
                ))}
            </div>
        </DndContext>
    );
};

export default TaskBoard;
