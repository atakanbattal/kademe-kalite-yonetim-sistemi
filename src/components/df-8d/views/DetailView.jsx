import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, XCircle, CheckSquare as CheckSquareIcon, ShieldOff, Edit, FileUp, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const InfoItem = ({ label, value, children, className }) => (
    <div className={`bg-secondary/50 p-3 rounded-lg ${className}`}>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="text-md font-semibold text-foreground mt-1">{value || children || '-'}</div>
    </div>
);

const EightDStepView = ({ stepKey, step }) => (
    <div className="p-4 border-l-2 border-primary/50 bg-secondary/30 rounded-r-lg">
        <h4 className="font-bold text-primary">{stepKey}: {step.title}</h4>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <p><strong className="text-muted-foreground">Sorumlu:</strong> {step.responsible || '-'}</p>
            <p><strong className="text-muted-foreground">Tarih:</strong> {step.completionDate ? new Date(step.completionDate).toLocaleDateString('tr-TR') : '-'}</p>
        </div>
        {step.description && <p className="mt-2 text-sm bg-background/50 p-2 rounded-md"><strong className="text-muted-foreground">Açıklama:</strong> {step.description}</p>}
    </div>
);


const DetailView = ({ record, onClose, onEdit, onReject, onConvertTo8D, onToggleStatus, onDelete }) => {
    const [attachmentUrls, setAttachmentUrls] = useState({});
    
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    
    const calculateDuration = (start, end) => {
        if (!start || !end) return '-';
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = endDate - startDate;
        return `${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} gün`;
    };

    const calculateDelay = (dueDate, closeDate) => {
        if (!dueDate || !closeDate) return '-';
        const dDate = new Date(dueDate);
        const cDate = new Date(closeDate);
        if (cDate <= dDate) return 'Yok';
        const diffTime = cDate - dDate;
        return `+${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} gün`;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Açık': return <Badge variant="secondary">Açık</Badge>;
            case 'Kapatıldı': return <Badge className="bg-green-600 hover:bg-green-700 text-white">Kapalı</Badge>;
            case 'Reddedildi': return <Badge variant="destructive">Reddedildi</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    useEffect(() => {
        const fetchAttachmentUrls = async () => {
            if (!record.attachments || record.attachments.length === 0) return;
            
            const urls = {};
            for (let i = 0; i < record.attachments.length; i++) {
                const path = record.attachments[i];
                try {
                    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
                    if (!error && data?.signedUrl) {
                        urls[i] = data.signedUrl;
                    }
                } catch (err) {
                    console.error(`Error fetching URL for attachment ${i}:`, err);
                }
            }
            setAttachmentUrls(urls);
        };
        
        fetchAttachmentUrls();
    }, [record.attachments]);
    
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-primary">{record.nc_number}</h2>
                        {getStatusBadge(record.status)}
                    </div>
                    <p className="text-muted-foreground mt-1">{record.problem_definition}</p>
                </div>
                <div className="flex items-center gap-2">
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">İşlemler <MoreHorizontal className="ml-2 h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => onEdit(record)}><Edit className="mr-2 h-4 w-4" /> Düzenle</DropdownMenuItem>
                                 {record.status === 'Açık' && <DropdownMenuItem onClick={() => onToggleStatus(record)}><CheckSquareIcon className="mr-2 h-4 w-4" /> Kapat</DropdownMenuItem>}
                                {record.type === 'DF' && <DropdownMenuItem onClick={() => onConvertTo8D(record)}><FileUp className="mr-2 h-4 w-4" /> 8D'ye Çevir</DropdownMenuItem>}
                                <DropdownMenuItem onClick={() => onReject(record)}><ShieldOff className="mr-2 h-4 w-4" /> Reddet</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4"/>
                                        Sil
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Bu işlem geri alınamaz. Bu kaydı kalıcı olarak silecektir.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(record.id)}>Sil</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="ghost" size="icon" onClick={onClose}><XCircle className="h-5 w-5" /></Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoItem label="Açılış Tarihi" value={formatDate(record.opening_date)} />
                <InfoItem label="Termin Tarihi" value={formatDate(record.due_date)} />
                <InfoItem label="Kapanış Tarihi" value={formatDate(record.closed_at)} />
                <InfoItem label="Sorumlu Birim" value={record.department} />
                <InfoItem label="Kapatma Süresi" value={calculateDuration(record.opening_date, record.closed_at)} />
                <InfoItem label="Gecikme Süresi" value={calculateDelay(record.due_date, record.closed_at)} />
            </div>
            
            <Separator />
            
            {record.attachments && record.attachments.length > 0 && (
                <div className="space-y-2">
                     <h3 className="font-semibold text-foreground">Ekli Dosyalar</h3>
                     <div className="flex flex-wrap gap-2">
                        {record.attachments.map((path, i) => (
                            attachmentUrls[i] && (
                                <a key={i} href={attachmentUrls[i]} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-lg overflow-hidden group">
                                    <img src={attachmentUrls[i]} alt={`Ek ${i + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                </a>
                            )
                        ))}
                    </div>
                </div>
            )}
            
            {record.status === 'Reddedildi' && record.rejection_notes && (
                <InfoItem label="Red Gerekçesi" value={record.rejection_notes} />
            )}

            {record.type === '8D' && record.eight_d_steps && (
                <>
                    <Separator />
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">8D Adımları</h3>
                        {Object.entries(record.eight_d_steps).map(([key, step]) => (
                            <EightDStepView key={key} stepKey={key} step={step} />
                        ))}
                    </div>
                </>
            )}

        </motion.div>
    );
};

export default DetailView;