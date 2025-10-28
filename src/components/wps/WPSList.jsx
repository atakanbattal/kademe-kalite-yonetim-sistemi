import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Eye, FileDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const WPSList = ({ wpsList, loading, onEdit, onView, onDownloadPDF, refreshData }) => {
    const { toast } = useToast();

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
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>WPS No</TableHead>
                        <TableHead>Revizyon</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Ana Malzeme</TableHead>
                        <TableHead>Kaynak Prosesi</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan="7" className="text-center">Yükleniyor...</TableCell></TableRow>
                    ) : wpsList.length === 0 ? (
                        <TableRow><TableCell colSpan="7" className="text-center">Kayıtlı WPS bulunamadı.</TableCell></TableRow>
                    ) : (
                        wpsList.map(wps => (
                            <TableRow key={wps.id}>
                                <TableCell className="font-medium">{wps.wps_no}</TableCell>
                                <TableCell>{wps.revision}</TableCell>
                                <TableCell>{format(new Date(wps.wps_date), 'dd.MM.yyyy')}</TableCell>
                                <TableCell>{wps.base_material_1?.name || '-'}</TableCell>
                                <TableCell>{wps.welding_process_code || '-'}</TableCell>
                                <TableCell>{wps.status}</TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onView(wps)}><Eye className="mr-2 h-4 w-4" /> Görüntüle</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onEdit(wps)}><Edit className="mr-2 h-4 w-4" /> Düzenle</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onDownloadPDF(wps)}><FileDown className="mr-2 h-4 w-4" /> PDF İndir</DropdownMenuItem>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Sil</DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                <AlertDialogDescription>Bu işlem geri alınamaz. Bu WPS kaydını kalıcı olarak sileceksiniz.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(wps.id)} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default WPSList;