import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, FileDown, CheckCircle, RotateCcw, Trash2, Eye, XCircle, Share2, PlayCircle, Calendar } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStatusBadge } from '@/lib/statusUtils';
import { normalizeUnitNameForSettings } from '@/lib/utils';
import { getNonConformityListTitle } from '@/lib/df8dTextUtils';

function displayNcUnitName(v) {
    if (v == null || String(v).trim() === '') return '—';
    return normalizeUnitNameForSettings(String(v));
}

const DF8D_LIST_TYPE_ORDER = ['DF', '8D', 'MDI'];

const TYPE_SECTION_LABEL = {
    DF: 'DF — Düzeltici faaliyet',
    '8D': '8D — Sekiz disiplin',
    MDI: 'MDI — Modül içi kayıt',
};

function buildGroupedDf8dTableRows(records) {
    const byType = new Map();
    for (const r of records) {
        const t = r.type || 'Diğer';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(r);
    }
    const rows = [];
    let dataAnimIndex = 0;
    const pushType = (t, list) => {
        rows.push({ kind: 'header', key: `h-${t}`, type: t, count: list.length });
        for (const record of list) {
            rows.push({ kind: 'row', key: record.id, record, animIndex: dataAnimIndex });
            dataAnimIndex += 1;
        }
    };
    for (const t of DF8D_LIST_TYPE_ORDER) {
        const list = byType.get(t);
        if (!list?.length) continue;
        pushType(t, list);
        byType.delete(t);
    }
    for (const [t, list] of [...byType.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'tr'))) {
        if (!list.length) continue;
        pushType(t, list);
    }
    return rows;
}

const NCTable = ({ records, onView, onEdit, onToggleStatus, onDownloadPDF, onDelete, onReject, onForward, onInProgress, onUpdateDueDate }) => {
    const { profile } = useAuth();
    const userRole = profile?.role;
    const [deleteAlert, setDeleteAlert] = useState({ isOpen: false, recordId: null });

    const groupedRows = useMemo(() => buildGroupedDf8dTableRows(records || []), [records]);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = parseISO(dateString);
        if (!isValid(date)) return '-';
        return format(date, 'dd.MM.yyyy', { locale: tr });
    };

    const getTypeBadge = (type) => {
        switch (type) {
            case 'DF': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">DF</Badge>;
            case '8D': return <Badge className="bg-purple-600 hover:bg-purple-700 text-white">8D</Badge>;
            case 'MDI': return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">MDI</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    };

    const ActionItem = ({ onClick, label, icon, disabled = false, isDestructive = false, condition = true }) => {
        if (!condition) return null;

        const isDisabled = userRole !== 'admin' && disabled;

        const item = (
            <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
                disabled={isDisabled}
                className={`${isDestructive ? 'text-destructive focus:text-destructive focus:bg-destructive/10' : ''} cursor-pointer text-sm`}
            >
                <span className="flex items-center gap-2">
                    {icon}
                    {label}
                </span>
            </DropdownMenuItem>
        );

        if (isDisabled && userRole !== 'admin') {
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative flex cursor-not-allowed select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm opacity-50 outline-none">
                                {icon}
                                {label}
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
        setDeleteAlert({ isOpen: true, recordId });
    };

    const confirmDelete = () => {
        if (deleteAlert.recordId) {
            onDelete(deleteAlert.recordId);
        }
        setDeleteAlert({ isOpen: false, recordId: null });
    };

    return (
        <>
            <TooltipProvider delayDuration={250}>
                <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="data-table data-table-wide data-table-wide-actions" style={{ minWidth: '1600px' }}>
                            <thead>
                                <tr>
                                    <th className="text-left">No</th>
                                    <th className="text-left">Tip</th>
                                    <th className="text-left min-w-[280px] md:min-w-[350px]">Problem</th>
                                    <th className="text-left">Departman</th>
                                    <th className="text-left whitespace-nowrap">Açılış Tarihi</th>
                                    <th className="text-left whitespace-nowrap">Kapanış Tarihi</th>
                                    <th className="text-left whitespace-nowrap">Termin Tarihi</th>
                                    <th className="text-left">Durum</th>
                                    <th className="text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedRows.map((item) => {
                                    if (item.kind === 'header') {
                                        const label = TYPE_SECTION_LABEL[item.type] || `${item.type}`;
                                        return (
                                            <tr
                                                key={item.key}
                                                className="bg-muted/50 border-y border-border"
                                            >
                                                <td colSpan={9} className="py-2 px-3 text-xs font-semibold text-foreground/90 tracking-wide">
                                                    {label}
                                                    <span className="text-muted-foreground font-normal"> ({item.count})</span>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    const record = item.record;
                                    const isOpen = record.status !== 'Kapatıldı' && record.status !== 'Reddedildi';
                                    const pdfDisabled = record.type === 'MDI';

                                    return (
                                        <motion.tr
                                            key={record.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: item.animIndex * 0.05 }}
                                            className="hover:bg-accent cursor-pointer"
                                            onClick={() => onView(record)}
                                        >
                                            <td className="text-sm whitespace-nowrap tabular-nums">{record.nc_number || record.mdi_no}</td>
                                            <td className="text-sm">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {getTypeBadge(record.type)}
                                                    {record.is_major && (
                                                        <Badge variant="destructive" className="text-xs">MAJOR</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-sm max-w-[min(100vw,24rem)] md:max-w-none">
                                                <span className="line-clamp-2 md:line-clamp-none">
                                                    {getNonConformityListTitle(record)}
                                                </span>
                                            </td>
                                            <td className="text-sm whitespace-nowrap">{displayNcUnitName(record.department)}</td>
                                            <td className="text-sm whitespace-nowrap text-muted-foreground">
                                                {formatDate(record.df_opened_at || record.opening_date || record.created_at)}
                                            </td>
                                            <td className="text-sm whitespace-nowrap text-muted-foreground">
                                                {record.closed_at ? formatDate(record.closed_at) : '-'}
                                            </td>
                                            <td className="text-sm whitespace-nowrap text-muted-foreground">
                                                {record.status === 'Reddedildi' ? '-' : formatDate(record.due_at)}
                                            </td>
                                            <td className="text-sm">
                                                <div className="flex flex-col gap-1">
                                                    {getStatusBadge(record)}
                                                    {record.is_major && (
                                                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Tekrarlayan</span>
                                                    )}
                                                </div>
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
                                                                onClick={() => onView(record)}
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
                                                                disabled={pdfDisabled}
                                                                aria-label="PDF indir"
                                                                onClick={() => onDownloadPDF(record)}
                                                            >
                                                                <FileDown className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom">
                                                            {pdfDisabled ? 'MDI için PDF üretilmez' : 'PDF indir'}
                                                        </TooltipContent>
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
                                                            <ActionItem onClick={() => onEdit(record)} label="Düzenle" icon={<Edit className="h-4 w-4 shrink-0" />} />
                                                            <DropdownMenuSeparator />
                                                            <ActionItem onClick={() => onInProgress(record)} label="İşleme al" icon={<PlayCircle className="h-4 w-4 shrink-0" />} condition={record.status === 'Açık'} />
                                                            <ActionItem onClick={() => onUpdateDueDate(record)} label="Termin tarihi güncelle" icon={<Calendar className="h-4 w-4 shrink-0" />} condition={isOpen} />
                                                            <ActionItem onClick={() => onToggleStatus(record)} label="Kapat" icon={<CheckCircle className="h-4 w-4 shrink-0" />} condition={isOpen} />
                                                            <ActionItem onClick={() => onReject(record)} label="Reddet" icon={<XCircle className="h-4 w-4 shrink-0" />} isDestructive condition={isOpen} />
                                                            <ActionItem onClick={() => onForward(record)} label="Yönlendir" icon={<Share2 className="h-4 w-4 shrink-0" />} condition={isOpen} />
                                                            <DropdownMenuSeparator />
                                                            <ActionItem onClick={() => onToggleStatus(record)} label="Tekrar aç" icon={<RotateCcw className="h-4 w-4 shrink-0" />} condition={!isOpen} />
                                                            <DropdownMenuSeparator />
                                                            <ActionItem onClick={() => handleDeleteClick(record.id)} label="Sil" icon={<Trash2 className="h-4 w-4 shrink-0" />} isDestructive />
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </TooltipProvider>

            <AlertDialog open={deleteAlert.isOpen} onOpenChange={(isOpen) => !isOpen && setDeleteAlert({ isOpen: false, recordId: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı silmek istiyor musunuz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. DF/8D kaydı kalıcı olarak kaldırılır.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={confirmDelete}
                        >
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default NCTable;
