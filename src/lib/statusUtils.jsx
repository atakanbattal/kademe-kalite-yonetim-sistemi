import React from 'react';
import { Badge } from '@/components/ui/badge';
import { isAfter, parseISO, isValid } from 'date-fns';

const CLOSED_STATUSES = new Set(['Kapatıldı', 'Reddedildi']);
const NON_OVERDUE_STATUSES = new Set(['Kapatıldı', 'Reddedildi', 'İşlemde']);

export const isNCWorkflowClosed = (recordOrStatus) => {
    const status = typeof recordOrStatus === 'string' ? recordOrStatus : recordOrStatus?.status;
    return CLOSED_STATUSES.has(status);
};

export const isNCOverdue = (record, now = new Date()) => {
    if (!record?.due_at || NON_OVERDUE_STATUSES.has(record.status)) {
        return false;
    }

    const dueDate = parseISO(record.due_at);
    return isValid(dueDate) && isAfter(now, dueDate);
};

export const getNCDisplayStatus = (record, now = new Date()) => {
    if (!record?.status) {
        return 'Bilinmiyor';
    }

    return isNCOverdue(record, now) ? 'Gecikmiş' : record.status;
};

export const getStatusBadge = (record) => {
    const displayStatus = getNCDisplayStatus(record);

    if (displayStatus === 'Bilinmiyor') {
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }

    if (displayStatus === 'Gecikmiş') {
        return <Badge className="bg-red-600 text-white animate-pulse">Gecikmiş</Badge>;
    }
    
    switch (displayStatus) {
      case 'Açık': return <Badge variant="secondary">{displayStatus}</Badge>;
      case 'Kapatıldı': return <Badge className="bg-green-600 text-white hover:bg-green-700">{displayStatus}</Badge>;
      case 'Reddedildi': return <Badge variant="destructive">{displayStatus}</Badge>;
      case 'İşlemde': return <Badge className="bg-yellow-500 text-white">{displayStatus}</Badge>;
      case 'Onay Bekliyor': return <Badge className="bg-purple-500 text-white">{displayStatus}</Badge>;
      default: return <Badge variant="outline">{displayStatus}</Badge>;
    }
};
