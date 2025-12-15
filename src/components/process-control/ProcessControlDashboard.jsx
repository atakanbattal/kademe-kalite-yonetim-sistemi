import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ClipboardCheck, AlertCircle, Package, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

const ProcessControlDashboard = ({ equipment, documents, plans, notes, loading, onOpenNCForm, refreshNotes, onTabChange }) => {
    
    // Son girilen notlar (en son 10)
    const recentNotes = notes.slice(0, 10);
    
    // İstatistikler
    const stats = {
        totalEquipment: equipment.length,
        totalDocuments: documents.length,
        totalPlans: plans.length,
        totalNotes: notes.length,
        openNotes: notes.filter(n => n.status === 'Açık').length,
        criticalNotes: notes.filter(n => n.priority === 'Kritik').length,
    };

    const handleCreateNCFromNote = (note) => {
        if (!onOpenNCForm) return;
        
        const ncData = {
            title: `Proses Kontrol Notu: ${note.title}`,
            description: `Araç: ${note.process_control_equipment?.equipment_name || note.equipment_id}\n\n${note.description}`,
            type: 'DF',
            department: note.process_control_equipment?.responsible_unit || '',
            part_code: note.part_code,
            part_name: note.part_name,
        };
        
        onOpenNCForm(ncData);
    };

    if (loading) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Yükleniyor...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* İstatistik Kartları */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Toplam Araç</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalEquipment}</div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Dokümanlar</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kontrol Planları</CardTitle>
                            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalPlans}</div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Açık Notlar</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.openNotes}</div>
                            {stats.criticalNotes > 0 && (
                                <p className="text-xs text-destructive mt-1">
                                    {stats.criticalNotes} kritik not
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Son Girilen Notlar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Son Girilen Notlar</CardTitle>
                                <CardDescription>
                                    En son eklenen kalite bulguları ve notlar
                                </CardDescription>
                            </div>
                            {onTabChange && (
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => onTabChange('notes')}
                                >
                                    Tümünü Gör
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {recentNotes.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Henüz not eklenmemiş.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentNotes.map((note) => (
                                    <motion.div
                                        key={note.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-semibold">{note.title}</h4>
                                                <Badge 
                                                    variant={
                                                        note.priority === 'Kritik' ? 'destructive' :
                                                        note.priority === 'Yüksek' ? 'default' : 'secondary'
                                                    }
                                                >
                                                    {note.priority}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {note.note_type === 'Teknik Resim Notu' ? 'Teknik Resim' :
                                                     note.note_type === 'Parça Kodu Notu' ? 'Parça Kodu' : 'Genel'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                                {note.description}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span>
                                                    Araç: {note.process_control_equipment?.equipment_name || '-'}
                                                </span>
                                                {note.part_code && (
                                                    <span>Parça: {note.part_code}</span>
                                                )}
                                                <span>
                                                    {formatDistanceToNow(new Date(note.created_at), { 
                                                        addSuffix: true, 
                                                        locale: tr 
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            {note.status === 'Açık' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCreateNCFromNote(note)}
                                                >
                                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                                    Uygunsuzluk Oluştur
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
};

export default ProcessControlDashboard;

