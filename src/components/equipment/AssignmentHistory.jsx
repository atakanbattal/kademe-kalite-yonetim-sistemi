import React from 'react';
import { Button } from '@/components/ui/button';

const AssignmentHistory = ({ assignments, personnelList, onReturn }) => {
    if (!assignments || assignments.length === 0) {
        return <p className="text-muted-foreground text-center py-4">Zimmet geçmişi bulunmuyor.</p>;
    }
    
    const getPersonnelName = (id) => personnelList.find(p => p.id === id)?.full_name || 'Bilinmeyen Personel';

    return (
        <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
            {assignments.map(a => (
                <div key={a.id} className="flex justify-between items-center bg-card p-3 rounded-lg border">
                    <div>
                        <p className="font-semibold text-foreground">{getPersonnelName(a.assigned_personnel_id)}</p>
                        <p className="text-sm text-muted-foreground">
                            {new Date(a.assignment_date).toLocaleDateString()} - {a.return_date ? new Date(a.return_date).toLocaleDateString() : 'Hala Zimmetli'}
                        </p>
                    </div>
                    {a.is_active ? 
                        <Button variant="outline" size="sm" onClick={() => onReturn(a.id)}>İade Al</Button> 
                        : 
                        <span className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground">İade Edildi</span>
                    }
                </div>
            ))}
        </div>
    );
};

export default AssignmentHistory;