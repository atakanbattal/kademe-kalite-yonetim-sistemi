import React, { useMemo, useState } from 'react';
    import { useData } from '@/contexts/DataContext';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { formatDistanceToNow } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { motion } from 'framer-motion';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Input } from '@/components/ui/input';
    import { Search } from 'lucide-react';
    import { ScrollArea } from '@/components/ui/scroll-area';

    const AuditLogModule = () => {
      const { auditLogs, loading } = useData();
      const [searchTerm, setSearchTerm] = useState('');

      const filteredLogs = useMemo(() => {
        if (!searchTerm) return auditLogs;
        const lowercasedTerm = searchTerm.toLowerCase();
        return auditLogs.filter(log =>
          log.action.toLowerCase().includes(lowercasedTerm) ||
          log.user_full_name?.toLowerCase().includes(lowercasedTerm) ||
          log.table_name?.toLowerCase().includes(lowercasedTerm) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(lowercasedTerm))
        );
      }, [auditLogs, searchTerm]);

      const renderDetails = (details) => {
        if (!details) return 'N/A';
        try {
            const formattedJson = JSON.stringify(details, null, 2);
            return <pre className="whitespace-pre-wrap max-w-md text-xs bg-muted/50 p-2 rounded-md">{formattedJson}</pre>;
        } catch (e) {
            return <span className="break-all">{String(details)}</span>;
        }
      };

      const getActionBadge = (action) => {
        if (action.startsWith('EKLEME')) return <Badge variant="success">EKLEME</Badge>;
        if (action.startsWith('GÜNCELLEME')) return <Badge variant="warning">GÜNCELLEME</Badge>;
        if (action.startsWith('SİLME')) return <Badge variant="destructive">SİLME</Badge>;
        return <Badge variant="secondary">{action}</Badge>;
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Sistem Denetim Kayıtları</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sistemde gerçekleştirilen son 200 kritik işlem (Ekleme, Güncelleme, Silme) aşağıda listelenmiştir.
              </p>
               <div className="relative w-full max-w-sm pt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                      placeholder="İşlem, kullanıcı, tablo veya detay ara..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[70vh]">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>İşlem</TableHead>
                        <TableHead>Tablo</TableHead>
                        <TableHead>Yapan Kişi</TableHead>
                        <TableHead>Detaylar</TableHead>
                        <TableHead className="text-right">Zaman</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredLogs.length > 0 ? (
                        filteredLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{getActionBadge(log.action)}</TableCell>
                              <TableCell><Badge variant="outline">{log.table_name || 'Bilinmiyor'}</Badge></TableCell>
                              <TableCell>{log.user_full_name || 'Sistem'}</TableCell>
                              <TableCell>{renderDetails(log.details)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                              </TableCell>
                            </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">
                            Henüz denetim kaydı bulunmamaktadır.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default AuditLogModule;