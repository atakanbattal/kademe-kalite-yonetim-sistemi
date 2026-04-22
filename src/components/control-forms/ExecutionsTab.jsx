import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Printer, Download, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { sortControlFormSections } from '@/lib/controlFormSectionSort';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ExecutionFormModal from '@/components/control-forms/ExecutionFormModal';
import { generateControlFormPdf } from '@/lib/controlFormPdfGenerator';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const RESULT_VARIANTS = {
    ONAY: { label: 'Onay', variant: 'default', color: 'bg-green-100 text-green-800 border-green-300' },
    SARTLI_KABUL: { label: 'Şartlı Kabul', variant: 'outline', color: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
    RET: { label: 'Ret', variant: 'destructive', color: 'bg-red-100 text-red-800 border-red-300' },
};

const ExecutionsTab = () => {
    const { toast } = useToast();
    const [executions, setExecutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [formOpen, setFormOpen] = useState(false);
    const [selectedExecutionId, setSelectedExecutionId] = useState(null);

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('control_form_executions')
                .select('*, control_form_templates(id, name, document_no)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setExecutions(data || []);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kayıtlar yüklenemedi: ' + err.message,
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filtered = useMemo(() => {
        const s = searchTerm.trim().toLocaleLowerCase('tr-TR');
        if (!s) return executions;
        return executions.filter(
            (e) =>
                (e.serial_number || '').toLocaleLowerCase('tr-TR').includes(s) ||
                (e.chassis_no || '').toLocaleLowerCase('tr-TR').includes(s) ||
                (e.product_name || '').toLocaleLowerCase('tr-TR').includes(s) ||
                (e.execution_no || '').toLocaleLowerCase('tr-TR').includes(s) ||
                (e.control_form_templates?.name || '').toLocaleLowerCase('tr-TR').includes(s)
        );
    }, [executions, searchTerm]);

    const handleNew = () => {
        setSelectedExecutionId(null);
        setFormOpen(true);
    };

    const handleEdit = (id) => {
        setSelectedExecutionId(id);
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            const { error } = await supabase
                .from('control_form_executions')
                .delete()
                .eq('id', deleteConfirm);
            if (error) throw error;
            toast({ title: 'Silindi' });
            setDeleteConfirm(null);
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const buildPdfPayload = async (execId) => {
        const { data: exec, error: eErr } = await supabase
            .from('control_form_executions')
            .select('*')
            .eq('id', execId)
            .single();
        if (eErr) throw eErr;

        const { data: template, error: tErr } = await supabase
            .from('control_form_templates')
            .select('*, control_form_sections(*, control_form_items(*))')
            .eq('id', exec.template_id)
            .single();
        if (tErr) throw tErr;

        const { data: resultsRows, error: rErr } = await supabase
            .from('control_form_execution_results')
            .select('*')
            .eq('execution_id', execId);
        if (rErr) throw rErr;

        const sections = sortControlFormSections(template.control_form_sections)
            .map((s) => ({
                ...s,
                items: (s.control_form_items || []).sort((a, b) => a.order_index - b.order_index),
            }));
        const fullTemplate = { ...template, sections };

        const resultsMap = {};
        (resultsRows || []).forEach((r) => {
            if (r.item_id) {
                resultsMap[r.item_id] = {
                    result: r.result,
                    measured_value: r.measured_value,
                    notes: r.notes,
                };
            }
        });

        return { template: fullTemplate, execution: exec, results: resultsMap };
    };

    const handlePrint = async (execId) => {
        try {
            const payload = await buildPdfPayload(execId);
            await generateControlFormPdf({ ...payload, mode: 'filled', action: 'print' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleDownload = async (execId) => {
        try {
            const payload = await buildPdfPayload(execId);
            await generateControlFormPdf({ ...payload, mode: 'filled', action: 'download' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none z-10" />
                    <Input autoFormat={false}
                        placeholder="Kayıt no, seri no, şase no, ürün..."
                        style={{ paddingLeft: '2.5rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={handleNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Kontrol Kaydı
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Henüz kontrol kaydı yok.</p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="p-3 text-left">Kayıt No</th>
                                <th className="p-3 text-left">Şablon</th>
                                <th className="p-3 text-left">Ürün / Araç</th>
                                <th className="p-3 text-left">Seri No</th>
                                <th className="p-3 text-left">Şase No</th>
                                <th className="p-3 text-left">Tarih</th>
                                <th className="p-3 text-center">Rev.</th>
                                <th className="p-3 text-center">Sonuç</th>
                                <th className="p-3 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((e) => {
                                const rv = RESULT_VARIANTS[e.result];
                                return (
                                    <tr key={e.id} className="border-t hover:bg-muted/30">
                                        <td className="p-3 font-mono text-xs">{e.execution_no}</td>
                                        <td className="p-3">
                                            <div>
                                                <p className="font-medium">
                                                    {e.control_form_templates?.name || '-'}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {e.control_form_templates?.document_no}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="p-3">{e.product_name || '-'}</td>
                                        <td className="p-3 font-mono text-xs">{e.serial_number || '-'}</td>
                                        <td className="p-3 font-mono text-xs">{e.chassis_no || '-'}</td>
                                        <td className="p-3 text-xs">
                                            {e.inspection_date
                                                ? format(new Date(e.inspection_date), 'dd.MM.yyyy', { locale: tr })
                                                : '-'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <Badge variant="outline">
                                                {String(e.template_revision_no).padStart(2, '0')}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-center">
                                            {rv ? (
                                                <span
                                                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${rv.color}`}
                                                >
                                                    {rv.label}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Düzenle"
                                                    onClick={() => handleEdit(e.id)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="PDF Yazdır"
                                                    onClick={() => handlePrint(e.id)}
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="PDF İndir"
                                                    onClick={() => handleDownload(e.id)}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Sil"
                                                    onClick={() => setDeleteConfirm(e.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {formOpen && (
                <ExecutionFormModal
                    open={formOpen}
                    setOpen={setFormOpen}
                    executionId={selectedExecutionId}
                    onSaved={() => fetchData()}
                />
            )}

            <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Kontrol kaydı ve tüm sonuçları kalıcı olarak silinecek.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ExecutionsTab;
