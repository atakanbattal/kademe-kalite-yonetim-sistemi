import React from 'react';
import { Badge } from '@/components/ui/badge';

export const getStatusBadge = (status) => {
    switch (status) {
      case 'Açık': return <Badge variant="secondary">{status}</Badge>;
      case 'Kapalı': return <Badge className="bg-green-600 text-white">{status}</Badge>;
      case 'Reddedildi': return <Badge variant="destructive">{status}</Badge>;
      case 'İşlemde': return <Badge className="bg-yellow-500 text-white">{status}</Badge>;
      default: return <Badge variant="outline">{status || 'Bilinmiyor'}</Badge>;
    }
};