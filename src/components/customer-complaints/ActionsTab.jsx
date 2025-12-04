import React, { useState } from 'react';
import { Plus, Edit, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import ActionFormModal from './ActionFormModal';

const STATUS_COLORS = {
    'Planlandı': 'secondary',
    'Devam Ediyor': 'default',
    'Tamamlandı': 'success',
    'İptal': 'destructive',
    'Ertelendi': 'warning'
};

const ACTION_TYPE_COLORS = {
    'Anlık Aksiyon': 'orange',
    'Düzeltici Aksiyon': 'blue',
    'Önleyici Aksiyon': 'green',
    'İyileştirme': 'purple'
};

const ActionsTab = ({ complaintId, actions, onRefresh }) => {
    const { toast } = useToast();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingAction, setEditingAction] = useState(null);

    const openForm = (action = null) => {
        setEditingAction(action);
        setFormOpen(true);
    };

    const closeForm = () => {
        setEditingAction(null);
        setFormOpen(false);
    };

    const handleSuccess = () => {
        onRefresh();
        closeForm();
    };

    const deleteAction = async (id) => {
        const { error } = await supabase
            .from('complaint_actions')
            .delete()
            .eq('id', id);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Aksiyon silinemedi.'
            });
        } else {
            toast({
                title: 'Başarılı',
                description: 'Aksiyon silindi.'
            });
            onRefresh();
        }
    };

    const getDaysRemaining = (endDate) => {
        if (!endDate) return null;
        const today = new Date();
        const end = new Date(endDate);
        const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        return diff;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Aksiyonlar</h3>
                    <p className="text-sm text-muted-foreground">
                        Şikayet için alınan tüm aksiyonları yönetin
                    </p>
                </div>
                <Button onClick={() => openForm()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Aksiyon
                </Button>
            </div>

            {actions.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Henüz aksiyon eklenmemiş.</p>
                            <p className="text-sm mt-1">
                                Yeni bir aksiyon eklemek için yukarıdaki butonu kullanın.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {actions.map(action => {
                        const daysRemaining = getDaysRemaining(action.planned_end_date);
                        const isOverdue = daysRemaining !== null && daysRemaining < 0 && action.status !== 'Tamamlandı';
                        const isNearDeadline = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3 && action.status !== 'Tamamlandı';

                        return (
                            <Card key={action.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant={STATUS_COLORS[action.status] || 'default'}>
                                                    {action.status}
                                                </Badge>
                                                <Badge 
                                                    variant="outline"
                                                    className={`border-${ACTION_TYPE_COLORS[action.action_type]}-500`}
                                                >
                                                    {action.action_type}
                                                </Badge>
                                                {isOverdue && (
                                                    <Badge variant="destructive">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        {Math.abs(daysRemaining)} gün gecikmiş
                                                    </Badge>
                                                )}
                                                {isNearDeadline && (
                                                    <Badge variant="warning">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {daysRemaining} gün kaldı
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-base">{action.action_title}</CardTitle>
                                            {action.responsible_person && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Sorumlu: {action.responsible_person.full_name}
                                                    {action.responsible_department && ` • ${action.responsible_department.unit_name}`}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => openForm(action)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Bu aksiyon kalıcı olarak silinecektir.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => deleteAction(action.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Sil
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="whitespace-pre-wrap text-sm">
                                        {action.action_description}
                                    </div>

                                    {/* İlerleme */}
                                    <div>
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">İlerleme</span>
                                            <span className="font-medium">{action.completion_percentage || 0}%</span>
                                        </div>
                                        <Progress value={action.completion_percentage || 0} />
                                    </div>

                                    {/* Tarihler */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        {action.planned_start_date && (
                                            <div>
                                                <div className="text-muted-foreground">Planlanan Başlangıç</div>
                                                <div>{new Date(action.planned_start_date).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                        )}
                                        {action.planned_end_date && (
                                            <div>
                                                <div className="text-muted-foreground">Planlanan Bitiş</div>
                                                <div>{new Date(action.planned_end_date).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                        )}
                                        {action.actual_start_date && (
                                            <div>
                                                <div className="text-muted-foreground">Gerçekleşen Başlangıç</div>
                                                <div>{new Date(action.actual_start_date).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                        )}
                                        {action.actual_completion_date && (
                                            <div>
                                                <div className="text-muted-foreground">Gerçekleşen Bitiş</div>
                                                <div>{new Date(action.actual_completion_date).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Maliyet */}
                                    {(action.estimated_cost || action.actual_cost) && (
                                        <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
                                            {action.estimated_cost && (
                                                <div>
                                                    <div className="text-muted-foreground">Tahmini Maliyet</div>
                                                    <div className="font-medium">
                                                        {Number(action.estimated_cost).toLocaleString('tr-TR', {
                                                            style: 'currency',
                                                            currency: 'TRY'
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {action.actual_cost && (
                                                <div>
                                                    <div className="text-muted-foreground">Gerçekleşen Maliyet</div>
                                                    <div className="font-medium text-red-600">
                                                        {Number(action.actual_cost).toLocaleString('tr-TR', {
                                                            style: 'currency',
                                                            currency: 'TRY'
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Etkinlik Doğrulaması */}
                                    {action.effectiveness_verified && (
                                        <div className="pt-4 border-t">
                                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-2">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="font-medium">Etkinlik Doğrulandı</span>
                                                {action.effectiveness_verification_date && (
                                                    <span className="text-muted-foreground">
                                                        • {new Date(action.effectiveness_verification_date).toLocaleDateString('tr-TR')}
                                                    </span>
                                                )}
                                            </div>
                                            {action.effectiveness_notes && (
                                                <div className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                                                    {action.effectiveness_notes}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {isFormOpen && (
                <ActionFormModal
                    open={isFormOpen}
                    setOpen={setFormOpen}
                    complaintId={complaintId}
                    existingAction={editingAction}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default ActionsTab;

