import React from 'react';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { Edit, Eye, Flag, AlertCircle, Sparkles } from 'lucide-react';
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { ScrollArea } from '@/components/ui/scroll-area';

    const priorityIcons = {
        'Kritik': { icon: <Flag className="h-3 w-3 mr-1" />, color: 'bg-red-500 hover:bg-red-600' },
        'Yüksek': { icon: <AlertCircle className="h-3 w-3 mr-1" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
        'Orta': { icon: <Sparkles className="h-3 w-3 mr-1" />, color: 'bg-blue-500 hover:bg-blue-600' },
        'Düşük': { icon: <Sparkles className="h-3 w-3 mr-1" />, color: 'bg-gray-400 hover:bg-gray-500' },
    };

    const statusStyles = {
        'Bekliyor': 'bg-gray-500',
        'Devam Ediyor': 'bg-blue-500',
        'Tamamlandı': 'bg-green-500',
        'Engellendi': 'bg-red-500',
    };

    const TaskList = ({ tasks, onEditTask, onViewTask }) => {
        const handleActionClick = (e, action, task) => {
            e.stopPropagation();
            action(task);
        };

        return (
            <div className="border rounded-lg">
                <ScrollArea className="h-[calc(100vh-22rem)]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead className="w-[120px]">Görev No</TableHead>
                                <TableHead>Başlık</TableHead>
                                <TableHead>Atananlar</TableHead>
                                <TableHead>Öncelik</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead>Bitiş Tarihi</TableHead>
                                <TableHead className="text-right w-[120px]">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.map(task => (
                                <TableRow 
                                    key={task.id} 
                                    className="hover:bg-muted/50 cursor-pointer"
                                    onClick={() => onViewTask(task)}
                                >
                                    <TableCell className="font-medium">{task.task_no}</TableCell>
                                    <TableCell>{task.title}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-xs">
                                            {task.assignees?.map(assignee => (
                                                <span key={assignee.personnel.id}>{assignee.personnel.full_name}</span>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`${priorityIcons[task.priority]?.color || ''} text-white`}>
                                            {priorityIcons[task.priority]?.icon}
                                            {task.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge style={{ backgroundColor: statusStyles[task.status] }} className="text-white">
                                            {task.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {task.due_date ? format(new Date(task.due_date), 'dd.MM.yyyy', { locale: tr }) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, onViewTask, task)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, onEditTask, task)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        );
    };

    export default TaskList;