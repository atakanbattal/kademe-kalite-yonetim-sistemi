import React from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Edit, Download, Trash2, Eye } from 'lucide-react';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

    const CalibrationHistory = ({ calibrations, onEdit, onDelete, onOpenPdfViewer }) => {
        if (!calibrations || calibrations.length === 0) {
            return <p className="text-muted-foreground text-center py-4">Kalibrasyon geçmişi bulunmuyor.</p>;
        }

        const handleDownload = (path) => {
            const { data } = supabase.storage.from('calibration_certificates').getPublicUrl(path);
            window.open(data.publicUrl, '_blank');
        };
        
        return (
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                {calibrations.map(c => {
                    return (
                    <div key={c.id} className="flex justify-between items-center bg-card p-3 rounded-lg border">
                        <div>
                            <p className="font-semibold text-foreground">Kalibrasyon Tarihi: {new Date(c.calibration_date).toLocaleDateString()}</p>
                            <p className="text-sm text-muted-foreground">
                               Sonraki Kalibrasyon: {new Date(c.next_calibration_date).toLocaleDateString()}
                            </p>
                            {c.certificate_number && <p className="text-xs text-muted-foreground/80 mt-1">Sertifika No: {c.certificate_number}</p>}
                            {c.notes && <p className="text-xs text-muted-foreground/80 mt-1">Not: {c.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            {c.certificate_path && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => onOpenPdfViewer(c.certificate_path, c.certificate_path.split('/').pop())}>
                                        <Eye className="h-4 w-4 mr-2" />Görüntüle
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDownload(c.certificate_path)}>
                                        <Download className="h-4 w-4 mr-2" />İndir
                                    </Button>
                                </>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                        <AlertDialogDescription>Bu kalibrasyon kaydını ve ilişkili sertifika dosyasını kalıcı olarak silmek istediğinizden emin misiniz?</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>İptal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(c)}>Sil</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                )})}
            </div>
        );
    };

    export default CalibrationHistory;