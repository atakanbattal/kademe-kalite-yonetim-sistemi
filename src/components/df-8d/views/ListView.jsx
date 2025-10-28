import React from 'react';
import { Button } from '@/components/ui/button';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { Clock, CheckSquare, XCircle, AlertTriangle } from 'lucide-react';

const ListView = ({ setView, setFilter, filter, filteredRecords, handleExport, handleRecordClick, onEdit }) => {

    const getStatusInfo = (record) => {
        const isOverdue = record.status === 'Açık' && record.due_date && new Date() > new Date(record.due_date);
        if(record.status === 'Kapatıldı') return { icon: CheckSquare, color: 'text-green-500', tooltip: 'Kapalı'};
        if(record.status === 'Reddedildi') return { icon: XCircle, color: 'text-red-500', tooltip: 'Reddedildi'};
        if(isOverdue) return { icon: Clock, color: 'text-red-500', tooltip: 'Gecikmiş'};
        return { icon: AlertTriangle, color: 'text-yellow-500', tooltip: 'Açık'};
    };
    
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <Button variant="outline" onClick={() => setView('dashboard')}>Kontrol Paneline Dön</Button>
                 <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">Filtre:</p>
                    {['Açık', 'Kapalı', 'Reddedildi', 'Gecikmiş', 'Tümü'].map(f => (
                         <Button key={f} variant={filter === f ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(f)}>{f}</Button>
                    ))}
                 </div>
            </div>
            <div className="bg-card p-4 rounded-lg border">
               <ul className="space-y-2">
                {filteredRecords.length > 0 ? filteredRecords.map(record => {
                    const statusInfo = getStatusInfo(record);
                    return (
                        <li key={record.id} onClick={() => handleRecordClick(record)} className="p-3 rounded-md hover:bg-secondary transition-colors cursor-pointer flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-primary">{record.nc_number}</p>
                                    <Badge variant={record.type === '8D' ? 'default' : 'secondary'}>{record.type}</Badge>
                                </div>
                                <p className="text-sm text-foreground max-w-lg truncate">{record.problem_definition}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <span>Birim: {record.department || '-'}</span>
                                    <span>|</span>
                                    <span>Termin: {record.due_date ? new Date(record.due_date).toLocaleDateString('tr-TR') : '-'}</span>
                                </div>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <statusInfo.icon className={statusInfo.color} />
                                    </TooltipTrigger>
                                    <TooltipContent><p>{statusInfo.tooltip}</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </li>
                    )
                }) : <p className="text-muted-foreground text-center p-4">Bu filtreye uygun kayıt bulunamadı.</p>}
               </ul>
            </div>
        </div>
    );
};

export default ListView;