import React, { useState, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Badge } from '@/components/ui/badge';
    import { Input } from '@/components/ui/input';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { format, parseISO, isValid } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { Button } from '@/components/ui/button';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { MoreVertical, Eye, Edit, Trash2, Printer } from 'lucide-react';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';

    const AuditList = ({ audits, loading, onViewAudit, onEditAudit, refreshData, onPrintReport }) => {
        const [searchTerm, setSearchTerm] = useState('');
        const [statusFilter, setStatusFilter] = useState('all');
        const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
        const [auditToDelete, setAuditToDelete] = useState(null);
        const { toast } = useToast();

        // Rapor numarasına göre sıralama fonksiyonu
        const sortByReportNumber = (a, b) => {
            const reportA = a.report_number || '';
            const reportB = b.report_number || '';
            
            // Rapor numarası formatı: IT-YYYY-NNN (örn: IT-2025-017)
            const parseReportNumber = (reportNum) => {
                const match = reportNum.match(/^IT-(\d{4})-(\d+)$/);
                if (match) {
                    return {
                        year: parseInt(match[1], 10),
                        number: parseInt(match[2], 10),
                        full: reportNum
                    };
                }
                // Eğer format uyumsuzsa, string olarak karşılaştır
                return { year: 0, number: 0, full: reportNum };
            };
            
            const parsedA = parseReportNumber(reportA);
            const parsedB = parseReportNumber(reportB);
            
            // Önce yıla göre sırala (büyükten küçüğe)
            if (parsedA.year !== parsedB.year) {
                return parsedB.year - parsedA.year;
            }
            
            // Aynı yıldaysa numaraya göre sırala (büyükten küçüğe)
            if (parsedA.number !== parsedB.number) {
                return parsedB.number - parsedA.number;
            }
            
            // Eğer parse edilemediyse string karşılaştırması
            return parsedB.full.localeCompare(parsedA.full);
        };

        const filteredAudits = useMemo(() => {
            return (audits || []).filter(audit => {
                const matchesSearch = searchTerm === '' ||
                    audit.report_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    audit.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    audit.department?.unit_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    audit.auditor_name?.toLowerCase().includes(searchTerm.toLowerCase());

                const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;

                return matchesSearch && matchesStatus;
            }).sort(sortByReportNumber); // Rapor numarasına göre sırala
        }, [audits, searchTerm, statusFilter]);

        const formatDate = (dateString) => {
            if (!dateString) return '-';
            const date = parseISO(dateString);
            return isValid(date) ? format(date, 'dd MMMM yyyy', { locale: tr }) : '-';
        };

        const getStatusVariant = (status) => {
            switch (status) {
                case 'Planlandı': return 'secondary';
                case 'Devam Ediyor': return 'default';
                case 'Tamamlandı': return 'success';
                case 'Kapatıldı': return 'outline';
                default: return 'secondary';
            }
        };

        const handleDeleteClick = (audit) => {
            setAuditToDelete(audit);
            setIsDeleteDialogOpen(true);
        };

        const confirmDelete = async () => {
            if (!auditToDelete) return;
            const { error } = await supabase.from('audits').delete().eq('id', auditToDelete.id);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Tetkik silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı', description: 'Tetkik başarıyla silindi.' });
                refreshData();
            }
            setIsDeleteDialogOpen(false);
            setAuditToDelete(null);
        };

        const handlePrintClick = (e, audit) => {
            e.stopPropagation();
            onPrintReport(audit);
        };

        return (
            <>
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>
                                "{auditToDelete?.report_number}" numaralı tetkik planını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <div className="dashboard-widget p-0">
                    <div className="p-4 flex flex-col sm:flex-row gap-4">
                        <Input
                            placeholder="Tetkik ara (No, Başlık, Birim, Denetçi...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Duruma göre filtrele" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Durumlar</SelectItem>
                                <SelectItem value="Planlandı">Planlandı</SelectItem>
                                <SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem>
                                <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                                <SelectItem value="Kapatıldı">Kapatıldı</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <TooltipProvider delayDuration={250}>
                    <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="data-table document-module-table w-full">
                            <thead>
                                <tr>
                                    <th>Rapor No</th>
                                    <th>Başlık</th>
                                    <th>Denetlenen Birim</th>
                                    <th>Denetçi</th>
                                    <th>Tarih</th>
                                    <th>Durum</th>
                                    <th className="text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                                ) : filteredAudits.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-muted-foreground">Filtreye uygun tetkik bulunamadı.</td></tr>
                                ) : (
                                    filteredAudits.map((audit, index) => (
                                        <motion.tr
                                            key={audit.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="hover:bg-accent cursor-pointer"
                                            onClick={() => onViewAudit(audit.id)}
                                        >
                                            <td className="font-medium text-foreground">{audit.report_number}</td>
                                            <td className="text-muted-foreground">{audit.title}</td>
                                            <td className="text-muted-foreground">{audit.department?.unit_name || 'N/A'}</td>
                                            <td className="text-muted-foreground">{audit.auditor_name?.trim() || '—'}</td>
                                            <td className="text-muted-foreground">{formatDate(audit.audit_date)}</td>
                                            <td><Badge variant={getStatusVariant(audit.status)}>{audit.status}</Badge></td>
                                            <td className="align-middle" onClick={(e) => e.stopPropagation()}>
                                                <div className="inline-flex items-center justify-end gap-0.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Görüntüle" onClick={() => onViewAudit(audit.id)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom">Görüntüle</TooltipContent>
                                                    </Tooltip>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Diğer işlemler">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-52">
                                                         <DropdownMenuItem className="text-sm" onClick={(e) => handlePrintClick(e, audit)}>
                                                            <Printer className="mr-2 h-4 w-4 shrink-0" /> Raporu yazdır
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-sm" onClick={() => onEditAudit(audit)}>
                                                            <Edit className="mr-2 h-4 w-4 shrink-0" /> Düzenle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDeleteClick(audit)}>
                                                            <Trash2 className="mr-2 h-4 w-4 shrink-0" /> Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    </div>
                    </TooltipProvider>
                </div>
            </>
        );
    };

    export default AuditList;