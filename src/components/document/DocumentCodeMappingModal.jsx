import React, { useEffect, useMemo, useState } from 'react';
import { Search, Copy, FileSpreadsheet, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { normalizeTurkishForSearch } from '@/lib/utils';
import { openPrintableReport } from '@/lib/reportUtils';

const DocumentCodeMappingModal = ({ isOpen, setIsOpen, documents = [], onFindDocument }) => {
    const { toast } = useToast();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('document_code_mappings')
                .select('old_code, new_code, folder, old_source_file, new_pdf, notes')
                .eq('is_active', true)
                .order('old_code', { ascending: true });
            if (!cancelled) {
                if (error) {
                    console.error('Kod eşleme yüklenemedi:', error);
                    setRows([]);
                } else {
                    setRows(data || []);
                }
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen]);

    const documentByNumber = useMemo(() => {
        const map = new Map();
        for (const doc of documents || []) {
            const num = (doc.document_number || '').trim();
            if (num) map.set(num.toUpperCase(), doc);
        }
        return map;
    }, [documents]);

    const normalizedSearch = useMemo(
        () => normalizeTurkishForSearch(searchTerm.trim()),
        [searchTerm]
    );

    const enrichedRows = useMemo(() => rows.map((row) => {
        const newCode = (row.new_code || '').trim();
        const matchedDoc = newCode ? documentByNumber.get(newCode.toUpperCase()) : null;
        return {
            ...row,
            matchedDoc,
            ekys_status: matchedDoc ? 'Var' : 'Yok',
        };
    }), [rows, documentByNumber]);

    const filtered = useMemo(() => {
        if (!normalizedSearch) return enrichedRows;
        return enrichedRows.filter((row) => {
            const index = normalizeTurkishForSearch([
                row.old_code,
                row.new_code,
                row.folder,
                row.old_source_file,
                row.new_pdf,
                row.notes,
                row.ekys_status,
            ].filter(Boolean).join(' '));
            return index.includes(normalizedSearch);
        });
    }, [enrichedRows, normalizedSearch]);

    const copyText = async (text, label) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            toast({ title: 'Kopyalandı', description: `${label} panoya alındı.` });
        } catch {
            toast({ variant: 'destructive', title: 'Hata', description: 'Kopyalama başarısız.' });
        }
    };

    const handleFindDocument = (row) => {
        const code = row.new_code?.trim();
        if (!code) return;
        if (row.matchedDoc && onFindDocument) {
            onFindDocument(row.matchedDoc, code);
            setIsOpen(false);
            return;
        }
        if (onFindDocument) {
            onFindDocument(null, code);
            setIsOpen(false);
            toast({
                title: 'Arama uygulandı',
                description: `"${code}" için doküman listesinde arama yapıldı.`,
            });
        }
    };

    const handlePrintList = () => {
        openPrintableReport({
            id: `code-mapping-list-${Date.now()}`,
            title: 'Kod Eşleme Tablosu',
            items: filtered.map((row) => ({
                old_code: row.old_code,
                new_code: row.new_code,
                folder: row.folder || '-',
                ekys_status: row.ekys_status,
                old_source_file: row.old_source_file || '-',
                new_pdf: row.new_pdf || '-',
                notes: row.notes || '-',
            })),
        }, 'code_mapping_list', true);
    };

    const matchedCount = filtered.filter((r) => r.matchedDoc).length;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent
                className="
                    fixed inset-1 sm:inset-2
                    left-0 top-0 translate-x-0 translate-y-0 sm:left-2 sm:top-2
                    w-auto h-auto !max-w-none !max-h-none sm:!max-w-none sm:!w-auto
                    overflow-hidden flex flex-col gap-2 p-3 sm:p-4 rounded-xl
                "
                style={{
                    transform: 'none',
                    width: 'calc(100vw - 8px)',
                    height: 'calc(100vh - 8px)',
                    maxWidth: 'none',
                    maxHeight: 'none',
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="shrink-0 space-y-0.5 pr-10">
                    <DialogTitle className="text-base sm:text-lg">Kod Eşleme Tablosu</DialogTitle>
                    <DialogDescription className="text-xs leading-snug">
                        Eski KDM kodlarından yeni kodlara çapraz referans. Satırdan kopyalayabilir veya EKYS doküman listesinde arayabilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
                    <div className="search-box w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            className="search-input h-9"
                            placeholder="Eski kod, yeni kod veya klasör ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <span>{filtered.length} / {rows.length} kayıt</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                            EKYS: {matchedCount} eşleşti
                        </Badge>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
                        <table className="data-table code-mapping-table w-full table-fixed text-xs [&_th]:!text-[11px] [&_th]:!normal-case [&_th]:!tracking-normal [&_th]:!font-semibold [&_td]:!text-xs [&_td]:!px-2 [&_td]:!py-2 [&_th]:!px-2 [&_th]:!py-2">
                            <colgroup>
                                <col className="w-[9%]" />
                                <col className="w-[13%]" />
                                <col className="w-[6%]" />
                                <col className="w-[16%]" />
                                <col className="w-[16%]" />
                                <col className="w-[16%]" />
                                <col className="w-[12%]" />
                                <col className="w-[12%]" />
                            </colgroup>
                            <thead className="sticky top-0 bg-card z-[1] shadow-sm">
                                <tr>
                                    <th className="whitespace-nowrap">Eski Kod</th>
                                    <th className="whitespace-nowrap">Yeni Kod</th>
                                    <th className="whitespace-nowrap">EKYS</th>
                                    <th>Klasör</th>
                                    <th>Eski Kaynak</th>
                                    <th>Yeni PDF</th>
                                    <th>Not</th>
                                    <th>Aksiyon</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="!whitespace-normal text-center py-8 text-muted-foreground">Yükleniyor...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={8} className="!whitespace-normal text-center py-8 text-muted-foreground">Kayıt bulunamadı.</td></tr>
                                ) : (
                                    filtered.map((row) => (
                                        <tr key={row.old_code} className="group align-top">
                                            <td className="font-mono !whitespace-normal break-all leading-tight">{row.old_code}</td>
                                            <td className="font-mono !whitespace-normal break-all leading-tight text-primary font-medium">{row.new_code}</td>
                                            <td>
                                                {row.matchedDoc ? (
                                                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-green-700 border-green-300 bg-green-50">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Var
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-amber-700 border-amber-300 bg-amber-50">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Yok
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="!whitespace-normal leading-tight break-words" title={row.folder || ''}>{row.folder || '-'}</td>
                                            <td className="!whitespace-normal text-muted-foreground leading-tight break-words" title={row.old_source_file || ''}>{row.old_source_file || '-'}</td>
                                            <td className="!whitespace-normal leading-tight break-words" title={row.new_pdf || ''}>{row.new_pdf || '-'}</td>
                                            <td className="!whitespace-normal text-muted-foreground leading-tight break-words" title={row.notes || ''}>{row.notes || '-'}</td>
                                            <td className="!whitespace-normal">
                                                <div className="flex flex-col gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={row.matchedDoc ? 'default' : 'secondary'}
                                                        className="h-7 w-full justify-start gap-1 px-2 text-[11px] font-medium"
                                                        onClick={() => handleFindDocument(row)}
                                                    >
                                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                                        {row.matchedDoc ? 'Dokümanı Aç' : 'EKYS\'de Ara'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 w-full justify-start gap-1 px-2 text-[10px]"
                                                        onClick={() => copyText(row.new_code, 'Yeni kod')}
                                                    >
                                                        <Copy className="h-3 w-3 shrink-0" />
                                                        Kopyala
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                </div>

                <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2 sm:justify-between pt-1">
                    <p className="text-xs text-muted-foreground text-left">
                        Her satırda aksiyon butonu: EKYS kaydı varsa doğrudan açar, yoksa listede arar.
                    </p>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrintList} disabled={filtered.length === 0}>
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                        Listeyi Yazdır
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DocumentCodeMappingModal;
