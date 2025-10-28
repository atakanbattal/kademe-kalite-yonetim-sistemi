import React from 'react';
import { Badge } from '@/components/ui/badge';
import { isAfter, parseISO, isValid } from 'date-fns';

export const getStatusBadge = (record) => {
    if (!record || !record.status) {
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }

    const { status, due_at } = record;

    if (status !== 'Kapatıldı' && status !== 'Reddedildi' && due_at && isValid(parseISO(due_at)) && isAfter(new Date(), parseISO(due_at))) {
        return <Badge className="bg-red-600 text-white animate-pulse">Gecikmiş</Badge>;
    }
    
    switch (status) {
      case 'Açık': return <Badge variant="secondary">{status}</Badge>;
      case 'Kapatıldı': return <Badge className="bg-green-600 text-white hover:bg-green-700">{status}</Badge>;
      case 'Reddedildi': return <Badge variant="destructive">{status}</Badge>;
      case 'İşlemde': return <Badge className="bg-yellow-500 text-white">{status}</Badge>;
      case 'Onay Bekliyor': return <Badge className="bg-purple-500 text-white">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
};