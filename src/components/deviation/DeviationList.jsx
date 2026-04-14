import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Eye, Trash2, CheckSquare, AlertOctagon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

const DeviationList = ({ deviations, onEdit, onView, onDelete, onApprove, onCreateNC }) => {
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
        <>
            <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sapma kaydını silmek istiyor musunuz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. Sapma kaydı ve ilişkili veriler (onaylar, ekler) kalıcı olarak kaldırılır.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteId != null) onDelete(pendingDeleteId);
                                setPendingDeleteId(null);
                            }}
                        >
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <TooltipProvider delayDuration={250}>
                <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="data-table document-module-table">
                            <thead>
                                <tr>
                                    <th>Talep No</th>
                                    <th>Açıklama</th>
                                    <th>Kaynak</th>
                                    <th>Tarih</th>
                                    <th>Durum</th>
                                    <th className="text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deviations.map((d, index) => (
                                    <motion.tr
                                        key={d.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                                        onClick={(e) => {
                                            if (e.target.closest('[role="menuitem"]') || e.target.closest('button')) {
                                                return;
                                            }
                                            onView(d);
                                        }}
                                        title="Detayları görüntülemek için tıklayın"
                                    >
                                        <td className="font-mono text-primary">{d.request_no}</td>
                                        <td className="font-medium text-foreground max-w-sm truncate">{d.description}</td>
                                        <td className="text-muted-foreground">{d.source}</td>
                                        <td className="text-muted-foreground">
                                            {d.record_date
                                                ? format(new Date(String(d.record_date).includes('T') ? d.record_date : `${d.record_date}T12:00:00`), 'dd.MM.yyyy')
                                                : format(new Date(d.created_at), 'dd.MM.yyyy')}
                                        </td>
                                        <td>
                                            <Badge variant={getStatusVariant(d.status)}>{d.status}</Badge>
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()} className="align-middle">
                                            <div className="inline-flex items-center justify-end gap-0.5">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            aria-label="Detayları gör"
                                                            onClick={() => onView(d)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom">Detayları gör</TooltipContent>
                                                </Tooltip>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            aria-label="Diğer işlemler"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56">
                                                        <DropdownMenuItem onClick={() => onApprove(d)}>
                                                            <CheckSquare className="mr-2 h-4 w-4" />
                                                            Onay süreci
                                                        </DropdownMenuItem>
                                                        {onCreateNC && (
                                                            <DropdownMenuItem onClick={() => onCreateNC(d)}>
                                                                <AlertOctagon className="mr-2 h-4 w-4" />
                                                                Uygunsuzluk oluştur
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => onEdit(d)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                            onClick={() => setPendingDeleteId(d.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </TooltipProvider>
        </>
    );
};

export default DeviationList;
