import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { MoreHorizontal, Edit, BarChart3, AlertTriangle, Users, FileText, CalendarCheck, Trash2, Star, Shield, Eye as EyeIcon, AlertOctagon, Link, PlusCircle, TrendingUp, TrendingDown, Printer } from 'lucide-react';
    import { openPrintableReport } from '@/lib/reportUtils';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
    import SupplierAuditPlanModal from '@/components/supplier/SupplierAuditPlanModal';
    import SupplierScoreModal from '@/components/supplier/SupplierScoreModal';
    import SupplierAlternativesModal from '@/components/supplier/SupplierAlternativesModal';
    import SupplierNCFormModal from '@/components/supplier/SupplierNCFormModal';
    import SupplierFormModal from '@/components/supplier/SupplierFormModal';

    const getGradeInfo = (score) => {
        if (score === null || score === undefined) return { grade: 'N/A', description: 'Puanlanmamış', color: 'bg-gray-500', icon: <Star className="w-4 h-4" /> };
        if (score >= 90) return { grade: 'A', description: 'Stratejik İş Ortağı', color: 'bg-green-500', icon: <Star className="w-4 h-4" /> };
        if (score >= 75) return { grade: 'B', description: 'Güvenilir Tedarikçi', color: 'bg-blue-500', icon: <Shield className="w-4 h-4" /> };
        if (score >= 60) return { grade: 'C', description: 'İzlemeye Alınacak', color: 'bg-yellow-500', icon: <EyeIcon className="w-4 h-4" /> };
        return { grade: 'D', description: 'İş Birliği Sonlandırılacak', color: 'bg-red-500', icon: <AlertOctagon className="w-4 h-4" /> };
    };

    const SupplierList = ({ suppliers, allSuppliers, onEdit, refreshSuppliers, onOpenNCForm }) => {
        const { toast } = useToast();
        const [isAuditModalOpen, setAuditModalOpen] = useState(false);
        const [isScoreModalOpen, setScoreModalOpen] = useState(false);
        const [isAlternativesModalOpen, setAlternativesModalOpen] = useState(false);
        const [isNCModalOpen, setNCModalOpen] = useState(false);
        const [selectedPlan, setSelectedPlan] = useState(null);
        
        const [selectedSupplier, setSelectedSupplier] = useState(null);
        const [supplierMetrics, setSupplierMetrics] = useState({});
        const currentYear = new Date().getFullYear();

        const handleAction = (action, supplier, plan = null) => {
            setSelectedSupplier(supplier);
            setSelectedPlan(plan);
            switch(action) {
                case 'audit':
                    setAuditModalOpen(true);
                    break;
                case 'score':
                    setScoreModalOpen(true);
                    break;
                case 'alternatives':
                    setAlternativesModalOpen(true);
                    break;
                case 'nc':
                    setNCModalOpen(true);
                    break;
                default:
                    break;
            }
        };

        const handleDeleteSupplier = async (supplierId) => {
            const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Tedarikçi silinemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: 'Tedarikçi başarıyla silindi.' });
                refreshSuppliers();
            }
        };

        const getStatusBadge = (status) => {
            switch (status) {
                case 'Onaylı': return <Badge className="bg-green-600 hover:bg-green-700 text-white">Onaylı</Badge>;
                case 'Askıya Alınmış': return <Badge variant="destructive">Askıya Alınmış</Badge>;
                case 'Red': return <Badge variant="secondary">Reddedildi</Badge>;
                case 'Alternatif': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Alternatif</Badge>;
                default: return <Badge variant="outline">{status}</Badge>;
            }
        };

        const handleRowClick = (supplier) => {
            handleAction('alternatives', supplier);
        };
        
        const handleCreateAlternative = (supplier) => {
            const alternativeData = {
                status: 'Alternatif',
                alternative_to_supplier_id: supplier.id
            }
            onEdit(alternativeData, true); // Pass a flag to indicate it's a new alternative
        };

        // PPM ve OTD verilerini yükle
        useEffect(() => {
            const loadSupplierMetrics = async () => {
                const metrics = {};
                for (const supplier of suppliers) {
                    try {
                        // PPM verisi
                        const { data: ppmData } = await supabase
                            .from('supplier_ppm_data')
                            .select('ppm_value')
                            .eq('supplier_id', supplier.id)
                            .eq('year', currentYear)
                            .is('month', null)
                            .single();
                        
                        // OTD verisi
                        const { data: otdData } = await supabase.rpc('calculate_supplier_otd', {
                            p_supplier_id: supplier.id,
                            p_year: currentYear,
                            p_month: null
                        });

                        metrics[supplier.id] = {
                            ppm: ppmData?.ppm_value || null,
                            otd: otdData || null
                        };
                    } catch (error) {
                        console.error(`Metrics load error for supplier ${supplier.id}:`, error);
                        metrics[supplier.id] = { ppm: null, otd: null };
                    }
                }
                setSupplierMetrics(metrics);
            };

            if (suppliers.length > 0) {
                loadSupplierMetrics();
            }
        }, [suppliers, currentYear]);

        if (suppliers.length === 0) {
            return <div className="text-center py-10 text-muted-foreground">Filtre kriterlerine uygun tedarikçi bulunamadı.</div>;
        }

        return (
            <TooltipProvider>
                <SupplierAuditPlanModal 
                    isOpen={isAuditModalOpen}
                    setIsOpen={setAuditModalOpen}
                    supplier={selectedSupplier}
                    refreshData={refreshSuppliers}
                    existingPlan={selectedPlan}
                />
                <SupplierScoreModal
                    isOpen={isScoreModalOpen}
                    setIsOpen={setScoreModalOpen}
                    supplier={selectedSupplier}
                />
                <SupplierAlternativesModal
                    isOpen={isAlternativesModalOpen}
                    setIsOpen={setAlternativesModalOpen}
                    supplier={selectedSupplier}
                    allSuppliers={allSuppliers}
                    onCreateAlternative={handleCreateAlternative}
                />
                <SupplierNCFormModal
                    isOpen={isNCModalOpen}
                    setIsOpen={setNCModalOpen}
                    supplier={selectedSupplier}
                    refreshData={refreshSuppliers}
                    onOpenNCForm={onOpenNCForm}
                />

                <div className="overflow-x-auto">
                    <table className="data-table w-full">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Tedarikçi</th>
                                <th>Ürün Grubu</th>
                                <th>Puan / Sınıf</th>
                                <th>PPM</th>
                                <th>OTD%</th>
                                <th>İlişki</th>
                                <th>Yaklaşan Denetim</th>
                                <th>Durum</th>
                                <th className="px-4 py-2 text-center whitespace-nowrap z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((supplier, index) => {
                                const completedAudits = (supplier.supplier_audit_plans || [])
                                    .filter(a => a.status === 'Tamamlandı' && a.score !== null)
                                    .sort((a, b) => new Date(b.actual_date || b.planned_date) - new Date(a.actual_date || a.planned_date));
                                
                                const latestAuditScore = completedAudits.length > 0 ? completedAudits[0].score : null;
                                const gradeInfo = getGradeInfo(latestAuditScore);

                                const upcomingAudit = (supplier.supplier_audit_plans || [])
                                    .filter(a => a.status === 'Planlandı' && new Date(a.planned_date) >= new Date())
                                    .sort((a,b) => new Date(a.planned_date) - new Date(b.planned_date))[0];
                                
                                const alternatives = allSuppliers.filter(s => s.alternative_to_supplier_id === supplier.id);
                                const metrics = supplierMetrics[supplier.id] || { ppm: null, otd: null };
                                
                                const getPPMBadge = (ppm) => {
                                    if (ppm === null || ppm === undefined) return <span className="text-xs text-muted-foreground">-</span>;
                                    if (ppm < 100) return <Badge className="bg-green-500 text-white">{ppm.toFixed(0)}</Badge>;
                                    if (ppm < 500) return <Badge className="bg-blue-500 text-white">{ppm.toFixed(0)}</Badge>;
                                    if (ppm < 1000) return <Badge className="bg-yellow-500 text-white">{ppm.toFixed(0)}</Badge>;
                                    return <Badge variant="destructive">{ppm.toFixed(0)}</Badge>;
                                };

                                const getOTDBadge = (otd) => {
                                    if (otd === null || otd === undefined) return <span className="text-xs text-muted-foreground">-</span>;
                                    if (otd >= 95) return <Badge className="bg-green-500 text-white">{otd.toFixed(1)}%</Badge>;
                                    if (otd >= 90) return <Badge className="bg-blue-500 text-white">{otd.toFixed(1)}%</Badge>;
                                    if (otd >= 80) return <Badge className="bg-yellow-500 text-white">{otd.toFixed(1)}%</Badge>;
                                    return <Badge variant="destructive">{otd.toFixed(1)}%</Badge>;
                                };

                                return (
                                <motion.tr 
                                    key={supplier.id} 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    transition={{ delay: index * 0.05 }}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRowClick(supplier)}
                                >
                                    <td>{index + 1}</td>
                                    <td className="font-medium text-white">{supplier.name}</td>
                                    <td className="text-muted-foreground">{supplier.product_group || '-'}</td>
                                    <td>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-2 cursor-pointer">
                                                    <Badge className={`${gradeInfo.color} text-white`}>{gradeInfo.grade}</Badge>
                                                    <span className="font-semibold">{latestAuditScore ?? '-'}</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="flex items-center gap-2">{gradeInfo.icon} {gradeInfo.description}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                    <td>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                {getPPMBadge(metrics.ppm)}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Parts Per Million - {currentYear} Yılı</p>
                                                {metrics.ppm !== null && (
                                                    <p className="text-xs mt-1">
                                                        {metrics.ppm < 100 ? 'Mükemmel' : metrics.ppm < 500 ? 'İyi' : metrics.ppm < 1000 ? 'Orta' : 'Kötü'}
                                                    </p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                    <td>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                {getOTDBadge(metrics.otd)}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>On-Time Delivery - {currentYear} Yılı</p>
                                                {metrics.otd !== null && (
                                                    <p className="text-xs mt-1">
                                                        {metrics.otd >= 95 ? 'Mükemmel' : metrics.otd >= 90 ? 'İyi' : metrics.otd >= 80 ? 'Orta' : 'Kötü'}
                                                    </p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                    <td>
                                        {supplier.alternative_supplier && (
                                             <Tooltip>
                                                <TooltipTrigger>
                                                    <div className="flex items-center gap-1 text-sm text-blue-400">
                                                        <Link className="h-3 w-3" />
                                                        {supplier.alternative_supplier.name}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>Bu tedarikçinin alternatifi olduğu ana firma.</TooltipContent>
                                            </Tooltip>
                                        )}
                                        {alternatives.length > 0 && (
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <div className="flex items-center gap-1 text-sm text-purple-400">
                                                        <Users className="h-3 w-3" />
                                                        {alternatives.length} Alternatif
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Bu tedarikçiye atanmış {alternatives.length} alternatif firma var.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {!supplier.alternative_supplier && alternatives.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                                    </td>
                                    <td className="text-muted-foreground">
                                        {upcomingAudit ? (
                                            <span className='flex items-center gap-2'>
                                                <CalendarCheck className='w-4 h-4 text-primary' />
                                                {new Date(upcomingAudit.planned_date).toLocaleDateString('tr-TR')}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td>{getStatusBadge(supplier.status)}</td>
                                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                        <AlertDialog>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Menü</span><MoreHorizontal className="h-4 w-4 flex-shrink-0 text-foreground" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => onEdit(supplier)}><Edit className="mr-2 h-4 w-4" />Detay / Denetimler</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAction('audit', supplier)}><FileText className="mr-2 h-4 w-4" />Denetim Planla</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAction('score', supplier)}><BarChart3 className="mr-2 h-4 w-4" />Puan Görüntüle</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAction('nc', supplier)}><AlertTriangle className="mr-2 h-4 w-4" />Uygunsuzluk Aç</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAction('alternatives', supplier)}><Users className="mr-2 h-4 w-4" />Alternatifleri Gör</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4"/> Tedarikçiyi Sil
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Bu işlem geri alınamaz. "{supplier.name}" adlı tedarikçiyi ve ilişkili tüm verileri (denetimler, uygunsuzluklar, sertifikalar vb.) kalıcı olarak sileceksiniz.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteSupplier(supplier.id)}>Evet, Sil</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </td>
                                </motion.tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </TooltipProvider>
        );
    };

    export default SupplierList;