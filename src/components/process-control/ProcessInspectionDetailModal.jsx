import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, CheckCircle2, XCircle, FileImage, Settings, User, Box, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useData } from '@/contexts/DataContext';

const ProcessInspectionDetailModal = ({ isOpen, setIsOpen, inspection }) => {
    const componentRef = useRef();
    const { characteristics, equipment } = useData();

    // Map feature details dynamically using context data
    const enhancedResults = React.useMemo(() => {
        if (!inspection || !inspection.results) return [];
        return inspection.results.map(r => {
            const charItem = characteristics?.find(c => c.value === r.characteristic_id);
            return {
                ...r,
                characteristic_name: charItem ? charItem.label : 'Bilinmiyor'
            };
        });
    }, [inspection, characteristics]);

    const handlePrint = () => {
        // Modern UI relies on print:* tailwind classes for printing correctly
        // when window.print is called.
        window.print();
    };

    if (!inspection) return null;

    const getDecisionBadge = (decision) => {
        switch (decision) {
            case 'Kabul': return <Badge variant="success" className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="w-4 h-4 mr-1"/>Kabul</Badge>;
            case 'Şartlı Kabul': return <Badge className="bg-orange-100 text-orange-800 border-orange-200 ring-orange-500">Şartlı Kabul</Badge>;
            case 'Ret': return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-4 h-4 mr-1"/>Ret</Badge>;
            default: return <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">Beklemede</Badge>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-full p-0 flex flex-col">
                <DialogHeader className="p-6 border-b bg-muted/20 sticky top-0 z-10 backdrop-blur-sm flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <FileText className="h-6 w-6 text-primary" />
                            Proses Muayene Raporu: {inspection.record_no}
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                            {format(new Date(inspection.inspection_date || new Date()), 'dd.MM.yyyy HH:mm')} tarihli muayene kaydının detayları.
                        </DialogDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrint}>
                            <Download className="mr-2 h-4 w-4" /> PDF İndir
                        </Button>
                    </div>
                </DialogHeader>

                <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50" ref={componentRef}>
                    <div className="print-content space-y-8 bg-white p-8 md:p-12 rounded-lg shadow-sm">
                        
                        {/* Print Header */}
                        <div className="text-center border-b-2 border-slate-200 pb-6 mb-8 mt-4 hidden print:block">
                            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">KADEME QMS</h1>
                            <h2 className="text-xl font-semibold text-slate-600 mt-2">Proses Kalite Kontrol Muayene Raporu</h2>
                            <p className="text-sm text-slate-500 mt-1">Belge No: {inspection.record_no}</p>
                        </div>

                        {/* Top Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl border bg-slate-50/50 shadow-sm">
                                <span className="text-sm font-semibold text-slate-500 uppercase flex items-center gap-1.5"><Box className="w-4 h-4"/> Parça Bilgisi</span>
                                <div className="mt-2 font-mono text-lg font-bold text-slate-800">{inspection.part_code}</div>
                                <div className="text-sm text-slate-600 truncate" title={inspection.part_name}>{inspection.part_name || '-'}</div>
                            </div>
                            <div className="p-4 rounded-xl border bg-slate-50/50 shadow-sm">
                                <span className="text-sm font-semibold text-slate-500 uppercase flex items-center gap-1.5"><Settings className="w-4 h-4"/> Üretim</span>
                                <div className="mt-2 text-lg font-bold text-slate-800">{inspection.production_line || '-'}</div>
                                <div className="text-sm text-slate-600">Hat / Tezgah</div>
                            </div>
                            <div className="p-4 rounded-xl border bg-slate-50/50 shadow-sm">
                                <span className="text-sm font-semibold text-slate-500 uppercase flex items-center gap-1.5"><User className="w-4 h-4"/> Operatör</span>
                                <div className="mt-2 text-lg font-bold text-slate-800">{inspection.operator_name || '-'}</div>
                                <div className="text-sm text-slate-600 flex items-center"><Clock className="w-3.5 h-3.5 mr-1"/> Vardiya: {inspection.shift || '-'}</div>
                            </div>
                            <div className="p-4 rounded-xl border bg-slate-50/50 shadow-sm">
                                <span className="text-sm font-semibold text-slate-500 uppercase flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> Karar</span>
                                <div className="mt-2 h-8 flex items-center">{getDecisionBadge(inspection.decision)}</div>
                                <div className="text-xs text-slate-500 mt-1">{format(new Date(inspection.created_at || new Date()), 'dd.MM.yyyy HH:mm')}</div>
                            </div>
                        </div>

                        {/* Quantity Metrics */}
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-slate-50 p-3 border-b font-semibold text-slate-700 flex items-center">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                Miktar Bilgileri
                            </div>
                            <div className="grid grid-cols-3 divide-x">
                                <div className="p-4 text-center">
                                    <div className="text-3xl font-bold text-slate-800">{inspection.quantity_produced || 0}</div>
                                    <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Üretilen (Adet)</div>
                                </div>
                                <div className="p-4 text-center">
                                    <div className="text-3xl font-bold text-green-600">
                                        {(inspection.quantity_produced || 0) - ((inspection.quantity_rejected || 0) + (inspection.quantity_conditional || 0))}
                                    </div>
                                    <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Kabul Edilen</div>
                                </div>
                                <div className="p-4 text-center bg-red-50/30">
                                    <div className="text-3xl font-bold text-red-600">{inspection.quantity_rejected || 0}</div>
                                    <div className="text-xs font-semibold text-red-500/80 uppercase mt-1">Hatalı (Ret)</div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {inspection.notes && (
                            <div className="bg-amber-50/50 border border-amber-200/50 p-4 rounded-xl">
                                <span className="text-sm font-semibold text-amber-800 uppercase mb-2 block">Açıklamalar / Notlar</span>
                                <p className="text-amber-900/80 leading-relaxed text-sm">{inspection.notes}</p>
                            </div>
                        )}

                        {/* Measurement Results Table */}
                        {enhancedResults && enhancedResults.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Ölçüm Sonuçları</h3>
                                <div className="border rounded-lg overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-semibold border-b">
                                                <tr>
                                                    <th className="p-3">Karakteristik</th>
                                                    <th className="p-3 text-center">Nominal</th>
                                                    <th className="p-3 text-center">Tolerans (Min-Max)</th>
                                                    <th className="p-3 font-semibold">Ölçülen Değer</th>
                                                    <th className="p-3 text-center">Sonuç</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {enhancedResults.map((r, idx) => (
                                                    <tr key={r.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-3 font-medium text-slate-800">{r.characteristic_name}</td>
                                                        <td className="p-3 text-center font-mono text-slate-600">{r.nominal_value || '-'}</td>
                                                        <td className="p-3 text-center font-mono text-slate-500 text-xs">
                                                            {r.min_value !== null ? `${r.min_value} / ${r.max_value}` : 'Yok'}
                                                        </td>
                                                        <td className="p-3 font-mono font-bold text-slate-800">{r.measured_value || '-'}</td>
                                                        <td className="p-3 text-center">
                                                            {r.is_ok === true ? (
                                                                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-md">
                                                                    UYGUN
                                                                </span>
                                                            ) : r.is_ok === false ? (
                                                                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-md">
                                                                    RET
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Defects Table */}
                        {inspection.defects && inspection.defects.length > 0 && (
                            <div className="space-y-3 print:break-inside-avoid">
                                <h3 className="text-lg font-bold text-red-600 border-b border-red-100 pb-2">Tespit Edilen Hatalar</h3>
                                <div className="border border-red-200 rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-red-50 text-red-700 uppercase text-xs font-semibold border-b border-red-200">
                                            <tr>
                                                <th className="p-3 w-1/3">Hata Tipi</th>
                                                <th className="p-3 text-center w-24">Adet</th>
                                                <th className="p-3">Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-100">
                                            {inspection.defects.map((d, index) => (
                                                <tr key={index} className="bg-white">
                                                    <td className="p-3 font-medium text-slate-800">{d.defect_type}</td>
                                                    <td className="p-3 text-center font-bold text-red-600">{d.defect_count}</td>
                                                    <td className="p-3 text-slate-600">{d.description || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Attachments (Not printed by default, but visible in modal) */}
                        {inspection.attachments && inspection.attachments.length > 0 && (
                            <div className="space-y-3 print:hidden">
                                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Ekli Dosyalar</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {inspection.attachments.map(att => (
                                        <div key={att.id} className="flex items-center p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <div className="bg-primary/10 p-2 rounded shrink-0 mr-3">
                                                {att.file_type?.startsWith('image/') ? (
                                                    <FileImage className="h-5 w-5 text-primary" />
                                                ) : (
                                                    <FileText className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="text-sm font-medium text-slate-800 truncate" title={att.file_name}>{att.file_name}</div>
                                                <div className="text-xs text-slate-500">{(att.file_size / 1024).toFixed(1)} KB</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer Signatures */}
                        <div className="pt-16 pb-8 grid grid-cols-2 gap-8 text-center hidden print:grid">
                            <div>
                                <div className="border-t border-slate-300 mx-12 pt-2">
                                    <p className="font-semibold text-sm text-slate-800">Kalite Kontrol Sorumlusu</p>
                                    <p className="text-xs text-slate-500 mt-1">İmza</p>
                                </div>
                            </div>
                            <div>
                                <div className="border-t border-slate-300 mx-12 pt-2">
                                    <p className="font-semibold text-sm text-slate-800">Üretim Sorumlusu</p>
                                    <p className="text-xs text-slate-500 mt-1">İmza</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProcessInspectionDetailModal;
