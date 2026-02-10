import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Separator } from '@/components/ui/separator';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Clock, Calendar, User, Flag, Edit, Trash2 } from 'lucide-react';
    import { format, formatDistanceToNow } from 'date-fns';
    import { tr } from 'date-fns/locale';

    const TaskViewModal = ({ isOpen, setIsOpen, task, onEdit, onDelete }) => {
        if (!task) return null;

        const handleEditClick = () => {
            setIsOpen(false);
            onEdit(task);
        };

        const handleDeleteClick = () => {
            onDelete(task);
        };

        const checklistProgress = task.checklist && task.checklist.length > 0
            ? (task.checklist.filter(item => item.is_completed).length / task.checklist.length) * 100
            : 0;

        const getPriorityInfo = (priority) => {
            switch (priority) {
                case 'Kritik': return { text: 'Kritik', color: 'bg-red-500' };
                case 'Yüksek': return { text: 'Yüksek', color: 'bg-orange-500' };
                case 'Orta': return { text: 'Orta', color: 'bg-yellow-500' };
                default: return { text: 'Düşük', color: 'bg-gray-400' };
            }
        };
        const priorityInfo = getPriorityInfo(task.priority);

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{task.title}</DialogTitle>
                        <DialogDescription>
                            Görev No: {task.task_no}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] p-1">
                        <div className="space-y-6 p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Badge className="p-2"><Flag className="h-4 w-4" /></Badge>
                                    <div>
                                        <p className="text-muted-foreground">Öncelik</p>
                                        <p className="font-semibold flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${priorityInfo.color}`}></span>
                                            {priorityInfo.text}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="p-2"><User className="h-4 w-4" /></Badge>
                                    <div>
                                        <p className="text-muted-foreground">Oluşturan</p>
                                        <p className="font-semibold">{task.owner?.full_name || 'Bilinmiyor'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={task.status === 'Tamamlandı' ? 'success' : 'secondary'} className="p-2">
                                        <Clock className="h-4 w-4" />
                                    </Badge>
                                    <div>
                                        <p className="text-muted-foreground">Durum</p>
                                        <p className="font-semibold">{task.status}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="p-2"><Calendar className="h-4 w-4" /></Badge>
                                    <div>
                                        <p className="text-muted-foreground">Oluşturulma</p>
                                        <p className="font-semibold">{format(new Date(task.created_at), 'dd MMMM yyyy', { locale: tr })}</p>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-semibold mb-2">Atanan Personeller</h4>
                                    <div className="space-y-2">
                                        {task.assignees?.map(assignee => (
                                            <div key={assignee.personnel.id} className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={assignee.personnel.avatar_url} />
                                                    <AvatarFallback>{assignee.personnel.full_name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{assignee.personnel.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{assignee.personnel.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Etiketler</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {task.tags?.map(tag => (
                                            <Badge key={tag.task_tags.id} style={{ backgroundColor: tag.task_tags.color, color: '#fff' }}>
                                                {tag.task_tags.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="font-semibold mb-2">Açıklama</h4>
                                <p className="text-muted-foreground whitespace-pre-wrap">{task.description || 'Açıklama eklenmemiş.'}</p>
                            </div>

                            {task.checklist && task.checklist.length > 0 && (
                                <div>
                                    <Separator className="my-4" />
                                    <h4 className="font-semibold mb-2">Alt Görevler ({Math.round(checklistProgress)}%)</h4>
                                    <div className="space-y-2">
                                        {task.checklist.map(item => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <Checkbox checked={item.is_completed} disabled />
                                                <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>
                                                    {item.item_text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-4 border-t sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Son Güncelleme: {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true, locale: tr })}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                            <Button variant="destructive" onClick={handleDeleteClick}>
                                <Trash2 className="h-4 w-4 mr-2" /> Sil
                            </Button>
                            <Button onClick={handleEditClick}>
                                <Edit className="h-4 w-4 mr-2" /> Düzenle
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default TaskViewModal;