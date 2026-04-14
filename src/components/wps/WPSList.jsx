import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Eye, FileDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
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

const WPSList = ({ wpsList, loading, onEdit, onView, onDownloadPDF, refreshData }) => {
    const { toast } = useToast();
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    const handleDelete = async (wpsId) => {
        const { error } = await supabase.from('wps_procedures').delete().eq('id', wpsId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `WPS silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: 'WPS başarıyla silindi.' });
            refreshData();
        }
    };

    return (
        <>
            <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>WPS kaydını silmek istiyor musunuz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. WPS kaydı kalıcı olarak kaldırılır.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteId) handleDelete(pendingDeleteId);
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
                                    <th>WPS No</th>
                                    <th>Revizyon</th>
                                    <th>Tarih</th>
                                    <th>Ana Malzeme</th>
                                    <th>Malzeme Kalınlığı</th>
                                    <th>Kaynak Prosesi</th>
                                    <th>Durum</th>
                                    <th className="text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Yükleniyor...</td></tr>
                                ) : wpsList.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Kayıtlı WPS bulunamadı.</td></tr>
                                ) : (
                                    wpsList.map((wps) => {
                                        const formatThickness = () => {
                                            if (wps.thickness_1 && wps.thickness_2) {
                                                return `${wps.thickness_1} - ${wps.thickness_2} mm`;
                                            }
                                            if (wps.thickness_1) return `${wps.thickness_1} mm`;
                                            if (wps.thickness_2) return `${wps.thickness_2} mm`;
                                            return '-';
                                        };

                                        return (
                                            <tr
                                                key={wps.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={(e) => {
                                                    if (e.target.closest('[role="menuitem"]') || e.target.closest('button')) {
                                                        return;
                                                    }
                                                    onView(wps);
                                                }}
                                                title="Detayları görüntülemek için tıklayın"
                                            >
                                                <td className="font-medium">{wps.wps_no}</td>
                                                <td>{wps.revision}</td>
                                                <td>{format(new Date(wps.wps_date), 'dd.MM.yyyy')}</td>
                                                <td>{wps.base_material_1?.name || '-'}</td>
                                                <td>{formatThickness()}</td>
                                                <td>{wps.welding_process_code || '-'}</td>
                                                <td>{wps.status}</td>
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
                                                                    onClick={() => onView(wps)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom">Detayları gör</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                    aria-label="PDF indir"
                                                                    onClick={() => onDownloadPDF(wps)}
                                                                >
                                                                    <FileDown className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom">PDF indir</TooltipContent>
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
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem onClick={() => onEdit(wps)}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Düzenle
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                    onClick={() => setPendingDeleteId(wps.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Sil
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </TooltipProvider>
        </>
    );
};

export default WPSList;
