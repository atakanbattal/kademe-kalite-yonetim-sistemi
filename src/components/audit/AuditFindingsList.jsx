import React from 'react';
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { GitBranch, CheckCircle, AlertTriangle } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { motion } from 'framer-motion';
    import { isPast, differenceInDays } from 'date-fns';

    const AuditFindingsList = ({ findings, onOpenNCView, loading }) => {
        const { toast } = useToast();

        const getStatusVariant = (status) => {
            switch (status) {
                case 'Açık': return 'destructive';
                case 'İşlemde': return 'default';
                case 'Onay Bekliyor': return 'warning';
                case 'Kapatıldı': return 'success';
                case 'Reddedildi': return 'secondary';
                default: return 'outline';
            }
        };

        const isOverdue = (nc) => {
            if (!nc || nc.status === 'Kapatıldı' || nc.status === 'Reddedildi') {
                return false;
            }
            const dueDate = nc.due_at || nc.due_date;
            if (!dueDate) {
                return false;
            }
            return isPast(new Date(dueDate));
        };

        const getDaysOverdue = (nc) => {
            if (!isOverdue(nc)) {
                return 0;
            }
            const dueDate = nc.due_at || nc.due_date;
            return differenceInDays(new Date(), new Date(dueDate));
        };

        const handleViewNC = async (nc) => {
            if (!onOpenNCView || !nc || !nc.id) return;
            const { data: fullRecord, error } = await supabase
                .from('non_conformities_with_details')
                .select('*')
                .eq('id', nc.id)
                .single();

            if (error) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Uygunsuzluk detayı alınamadı: ' + error.message,
                });
            } else if (fullRecord) {
                onOpenNCView(fullRecord);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Uygunsuzluk kaydı bulunamadı.',
                });
            }
        };
        
        const sortedFindings = React.useMemo(() => {
            return (findings || []).map(finding => {
                // non_conformities array veya non_conformity (tekil) olabilir
                let relatedNC = null;
                if (finding.non_conformities && Array.isArray(finding.non_conformities) && finding.non_conformities.length > 0) {
                    relatedNC = finding.non_conformities[0];
                } else if (finding.non_conformity) {
                    // Eğer tekil olarak geliyorsa
                    relatedNC = Array.isArray(finding.non_conformity) && finding.non_conformity.length > 0 
                        ? finding.non_conformity[0] 
                        : finding.non_conformity;
                }
                
                // Debug: Gecikme kontrolü için veri yapısını kontrol et
                if (relatedNC && !relatedNC.due_at && !relatedNC.due_date) {
                    console.warn('Uygunsuzluk verisinde due_at/due_date eksik:', relatedNC);
                }
                
                return { ...finding, non_conformity: relatedNC };
            }).sort((a, b) => {
                const aStatus = a.non_conformity?.status;
                const bStatus = b.non_conformity?.status;
                const aIsClosed = !aStatus || aStatus === 'Kapatıldı';
                const bIsClosed = !bStatus || bStatus === 'Kapatıldı';

                if (aIsClosed && !bIsClosed) return 1;
                if (!aIsClosed && bIsClosed) return -1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
        }, [findings]);

        if (loading) {
            return <p className="text-muted-foreground p-4 text-center">Bulgular yükleniyor...</p>;
        }

        if (!sortedFindings || sortedFindings.length === 0) {
            return <p className="text-muted-foreground p-4 text-center">Henüz bulgu kaydedilmedi.</p>;
        }

        return (
            <div className="space-y-3">
                {sortedFindings.map((finding, index) => {
                    const nc = finding.non_conformity;
                    return (
                        <motion.div 
                            key={finding.id} 
                            className="dashboard-widget p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <div className="flex-grow">
                                <p className="font-semibold text-foreground">{finding.description}</p>
                                <span className="text-xs text-muted-foreground">Tetkik: {finding.audits?.report_number || 'N/A'}</span>
                            </div>
                            <div className="flex-shrink-0">
                                {nc ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Button
                                            variant="link"
                                            className="p-0 h-auto text-primary text-sm font-semibold"
                                            onClick={() => handleViewNC(nc)}
                                        >
                                            <GitBranch className="w-4 h-4 mr-2" />
                                            {nc.nc_number}
                                        </Button>
                                        <Badge variant={getStatusVariant(nc.status)}>
                                            {nc.status}
                                        </Badge>
                                        {isOverdue(nc) && (
                                            <Badge variant="destructive" className="flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Gecikti ({getDaysOverdue(nc)} gün)
                                            </Badge>
                                        )}
                                    </div>
                                ) : (
                                    <Badge variant="success">
                                       <CheckCircle className="w-4 h-4 mr-2" /> Kapatıldı (Uygunsuzluk Yok)
                                    </Badge>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    export default AuditFindingsList;