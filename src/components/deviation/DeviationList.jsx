import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Eye, Trash2, CheckSquare, AlertOctagon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';

const DeviationList = ({ deviations, onEdit, onView, onDelete, onApprove, onCreateNC }) => {
    
    const getStatusVariant = (status) => {
        switch (status) {
            case 'Açık': return 'secondary';
            case 'Onay Bekliyor': return 'warning';
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'destructive';
            case 'Kapatıldı': return 'outline';
            default: return 'secondary';
        }
    };
    
    if (deviations.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">Filtreye uygun sapma kaydı bulunamadı.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Talep No</th>
                        <th>Açıklama</th>
                        <th>Kaynak</th>
                        <th>Tarih</th>
                        <th>Durum</th>
                        <th>İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    {deviations.map((d, index) => (
                        <motion.tr
                            key={d.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                            <td className="font-mono text-primary">{d.request_no}</td>
                            <td className="font-medium text-foreground max-w-sm truncate">{d.description}</td>
                            <td className="text-muted-foreground">{d.source}</td>
                            <td className="text-muted-foreground">{format(new Date(d.created_at), 'dd.MM.yyyy')}</td>
                            <td>
                                <Badge variant={getStatusVariant(d.status)}>{d.status}</Badge>
                            </td>
                            <td>
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Menüyü aç</span>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onView(d)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                <span>Görüntüle</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onApprove(d)}>
                                                <CheckSquare className="mr-2 h-4 w-4" />
                                                <span>Onay Süreci</span>
                                            </DropdownMenuItem>
                                            {onCreateNC && (
                                                <DropdownMenuItem onClick={() => onCreateNC(d)}>
                                                    <AlertOctagon className="mr-2 h-4 w-4" />
                                                    <span>Uygunsuzluk Oluştur</span>
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => onEdit(d)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                <span>Düzenle</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4"/>
                                                    Kaydı Sil
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Bu işlem geri alınamaz. Bu sapma kaydını ve ilişkili tüm verileri (onaylar, ekler) kalıcı olarak silecektir.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDelete(d.id)} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DeviationList;