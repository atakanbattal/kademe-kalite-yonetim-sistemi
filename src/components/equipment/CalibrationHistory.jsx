import React from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Edit, Download, Trash2, Eye } from 'lucide-react';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

    const CalibrationHistory = ({ calibrations, onEdit, onDelete, onOpenPdfViewer, equipmentId }) => {
        if (!calibrations || calibrations.length === 0) {
            return <p className="text-muted-foreground text-center py-4">Kalibrasyon geçmişi bulunmuyor.</p>;
        }

        const handleDownload = async (path, equipmentId) => {
            try {
                if (!path) {
                    console.error('Download error: Path is empty');
                    return;
                }

                // Path formatını normalize et
                let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
                
                // Eğer path 'public/' ile başlıyorsa kaldır (Supabase Storage'da bucket adı kullanılır, public/ prefix'i gerekmez)
                if (normalizedPath.startsWith('public/')) {
                    normalizedPath = normalizedPath.replace('public/', '');
                }
                
                // Olası path formatlarını dene
                const pathAttempts = [
                    normalizedPath, // Doğrudan path
                ];
                
                if (equipmentId) {
                    // Eğer path zaten equipment_id içeriyorsa, sadece o path'i dene
                    if (normalizedPath.startsWith(`${equipmentId}/`)) {
                        pathAttempts.unshift(normalizedPath);
                    } else {
                        // equipment_id ile kombinasyonları dene
                        pathAttempts.push(`${equipmentId}/${normalizedPath}`);
                        if (!normalizedPath.includes('/')) {
                            pathAttempts.push(`${equipmentId}/${normalizedPath}`);
                        }
                    }
                }
                
                let data = null;
                let error = null;
                
                // Her path formatını dene
                for (const attemptPath of pathAttempts) {
                    const result = await supabase.storage.from('calibration_certificates').download(attemptPath);
                    if (!result.error) {
                        data = result.data;
                        error = null;
                        normalizedPath = attemptPath;
                        break;
                    } else {
                        error = result.error;
                    }
                }
                
                if (error || !data) {
                    console.error('Download error - denenen pathler:', pathAttempts);
                    console.error('Son hata:', error);
                    return;
                }
                
                const blob = new Blob([data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = normalizedPath.split('/').pop();
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (err) {
                console.error('File download error:', err);
            }
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
                                    <Button variant="outline" size="sm" onClick={() => handleDownload(c.certificate_path, equipmentId)}>
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