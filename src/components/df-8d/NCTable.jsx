import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, FileDown, CheckCircle, RotateCcw, Trash2, Eye, XCircle, Share2, PlayCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStatusBadge } from '@/lib/statusUtils';

const NCTable = ({ records, onView, onEdit, onToggleStatus, onDownloadPDF, onDelete, onReject, onForward, onInProgress }) => {
    const { profile } = useAuth();
    const userRole = profile?.role;
    const [deleteAlert, setDeleteAlert] = useState({ isOpen: false, recordId: null });

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = parseISO(dateString);
        if (!isValid(date)) return '-';
        return format(date, 'dd.MM.yyyy', { locale: tr });
    };
    
    const getTypeBadge = (type) => {
        switch(type) {
            case 'DF': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">DF</Badge>;
            case '8D': return <Badge className="bg-purple-600 hover:bg-purple-700 text-white">8D</Badge>;
            case 'MDI': return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">MDI</Badge>;
            default: return <Badge variant='outline'>{type}</Badge>;
        }
    }

    const ActionItem = ({ onClick, label, icon, disabled = false, isDestructive = false, condition = true }) => {
        if (!condition) return null;
        
        const isDisabled = userRole !== 'admin' && disabled;

        const item = (
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); if(onClick) onClick(); }}
              disabled={isDisabled} 
              className={`${isDestructive ? 'text-destructive focus:text-destructive' : ''} cursor-pointer`}
            >
                {icon} {label}
            </DropdownMenuItem>
        );

        if (isDisabled && userRole !== 'admin') {
           return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm opacity-50 outline-none">
                                {icon} {label}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent><p>Bu işlem için yetkiniz yok.</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        return item;
    };
    
    const handleDeleteClick = (recordId) => {
        setDeleteAlert({ isOpen: true, recordId: recordId });
    };

    const confirmDelete = () => {
        if (deleteAlert.recordId) {
            onDelete(deleteAlert.recordId);
        }
        setDeleteAlert({ isOpen: false, recordId: null });
    };

    return (
        <>
            <div className="overflow-x-auto bg-card p-4 rounded-lg border">
                <table className="data-table w-full">
                    <thead>
                        <tr>
                            <th className="px-4 py-2 text-left">No</th>
                            <th className="px-4 py-2 text-left">Tip</th>
                            <th className="px-4 py-2 text-left">Problem</th>
                            <th className="px-4 py-2 text-left">Departman</th>
                            <th className="px-4 py-2 text-left">Termin Tarihi</th>
                            <th className="px-4 py-2 text-left">Durum</th>
                            <th className="px-4 py-2 text-center">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((record) => {
                            const isOpen = record.status !== 'Kapatıldı' && record.status !== 'Reddedildi';

                            return (
                                <motion.tr 
                                    key={record.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: records.indexOf(record) * 0.05 }}
                                    className="hover:bg-accent cursor-pointer"
                                    onClick={() => onView(record)}
                                >
                                    <td className="border-t border-border px-4 py-2 text-sm">{record.nc_number || record.mdi_no}</td>
                                    <td className="border-t border-border px-4 py-2 text-sm">{getTypeBadge(record.type)}</td>
                                    <td className="border-t border-border px-4 py-2 text-sm max-w-xs truncate">{record.title}</td>
                                    <td className="border-t border-border px-4 py-2 text-sm">{record.department}</td>
                                    <td className="border-t border-border px-4 py-2 text-sm">{formatDate(record.due_at)}</td>
                                    <td className="border-t border-border px-4 py-2 text-sm">{getStatusBadge(record)}</td>
                                    <td className="border-t border-border px-4 py-2 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Menüyü aç</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <ActionItem onClick={() => onView(record)} label="Görüntüle" icon={<Eye className="mr-2 h-4 w-4" />} />
                                                <ActionItem onClick={() => onEdit(record)} label="Düzenle" icon={<Edit className="mr-2 h-4 w-4" />} />
                                                <ActionItem onClick={() => onDownloadPDF(record)} label="PDF İndir" icon={<FileDown className="mr-2 h-4 w-4" />} disabled={record.type === 'MDI'} />
                                                <DropdownMenuSeparator />
                                                
                                                <ActionItem onClick={() => onInProgress(record)} label="İşleme Al" icon={<PlayCircle className="mr-2 h-4 w-4" />} condition={record.status === 'Açık'} />
                                                <ActionItem onClick={() => onToggleStatus(record)} label="Kapat" icon={<CheckCircle className="mr-2 h-4 w-4" />} condition={isOpen} />
                                                <ActionItem onClick={() => onReject(record)} label="Reddet" icon={<XCircle className="mr-2 h-4 w-4" />} isDestructive condition={isOpen} />
                                                <ActionItem onClick={() => onForward(record)} label="Yönlendir" icon={<Share2 className="mr-2 h-4 w-4" />} condition={isOpen} />
                                                
                                                <DropdownMenuSeparator />
                                                <ActionItem onClick={() => onToggleStatus(record)} label="Tekrar Aç" icon={<RotateCcw className="mr-2 h-4 w-4" />} condition={!isOpen} />
                                                
                                                <DropdownMenuSeparator />
                                                <ActionItem onClick={() => handleDeleteClick(record.id)} label="Kaydı Sil" icon={<Trash2 className="mr-2 h-4 w-4" />} isDestructive />
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <AlertDialog open={deleteAlert.isOpen} onOpenChange={(isOpen) => setDeleteAlert({ isOpen, recordId: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>Bu işlem geri alınamaz. Bu kaydı kalıcı olarak silecektir.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default NCTable;