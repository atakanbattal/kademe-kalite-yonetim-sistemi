import React from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { useLinkableDocuments } from './useLinkableDocuments';
import { STEP_TYPE_OPTIONS } from './processFlowConstants';

function stepToForm(step) {
    return {
        step_type: step.step_type,
        text: step.text || '',
        role: step.role || '',
        decision_question: step.decision_question || '',
        decision_yes_text: step.decision_yes_text || '',
        decision_no_text: step.decision_no_text || '',
        documents: (step.documents || []).map((d) => ({
            document_id: d.document_id,
            document_code: d.document_code,
            section_ref: d.section_ref,
            code: d.section_ref ? `${d.document_code} ${d.section_ref}` : d.document_code,
        })),
    };
}

const DocumentCodePicker = ({ value = [], onChange, unitCode }) => {
    const { options, loadingDocs } = useLinkableDocuments(unitCode);
    const [sectionDraft, setSectionDraft] = React.useState('');
    const [selectedDocId, setSelectedDocId] = React.useState('');

    const addDocument = () => {
        const opt = options.find((o) => o.value === selectedDocId);
        if (!opt) return;
        const exists = value.some((v) => v.document_id === opt.value && (v.section_ref || '') === (sectionDraft.trim() || ''));
        if (exists) return;
        onChange([
            ...value,
            {
                document_id: opt.value,
                document_code: opt.document_number,
                section_ref: sectionDraft.trim() || null,
                code: sectionDraft.trim() ? `${opt.document_number} ${sectionDraft.trim()}` : opt.document_number,
            },
        ]);
        setSelectedDocId('');
        setSectionDraft('');
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1 min-h-[24px]">
                {value.length ? value.map((doc, idx) => (
                    <Badge key={`${doc.document_code}-${doc.section_ref || idx}`} variant="secondary" className="gap-1">
                        {doc.section_ref ? `${doc.document_code} ${doc.section_ref}` : doc.document_code}
                        <button type="button" onClick={() => onChange(value.filter((_, i) => i !== idx))} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                )) : (
                    <span className="text-xs text-muted-foreground">Henüz doküman bağlanmadı</span>
                )}
            </div>
            {loadingDocs ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Dokümanlar yükleniyor...
                </div>
            ) : (
                <>
                    <Combobox
                        options={options}
                        value={selectedDocId}
                        onChange={setSelectedDocId}
                        placeholder={`Prosedür / talimat / form seç... (${options.length})`}
                        searchPlaceholder="Kod veya başlık ara..."
                        notFoundText="Kayıt bulunamadı"
                        modal
                        contentClassName="z-[300]"
                    />
                    <Input
                        value={sectionDraft}
                        onChange={(e) => setSectionDraft(e.target.value)}
                        placeholder="Bölüm referansı (opsiyonel, örn. §3.1)"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addDocument} disabled={!selectedDocId}>
                        <Plus className="h-4 w-4 mr-1" /> Bağla
                    </Button>
                </>
            )}
        </div>
    );
};

const ProcessFlowStepEditor = ({
    form,
    onFormChange,
    unitCode,
    onSave,
    onDiscard,
    onDelete,
    onInsertAfter,
    onMoveUp,
    onMoveDown,
    onClose,
    saving,
    isDirty,
    hasFlowDraft,
}) => {
    const setForm = (updater) => {
        onFormChange(typeof updater === 'function' ? updater(form) : updater);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="font-semibold text-sm">Adım Düzenle</h3>
                    {(isDirty || hasFlowDraft) ? (
                        <p className="text-[11px] text-amber-600 mt-0.5">Kaydedilmemiş değişiklikler var</p>
                    ) : null}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-2">
                <Label>Adım tipi</Label>
                <Select value={form.step_type} onValueChange={(v) => setForm((f) => ({ ...f, step_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {STEP_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Adım metni</Label>
                <Textarea rows={4} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
            </div>

            {form.step_type !== 'decision' && (
                <div className="space-y-2">
                    <Label>Sorumlu rol</Label>
                    <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
                </div>
            )}

            {form.step_type === 'decision' && (
                <>
                    <div className="space-y-2">
                        <Label>Karar sorusu</Label>
                        <Textarea rows={2} value={form.decision_question} onChange={(e) => setForm((f) => ({ ...f, decision_question: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Evet dalı</Label>
                        <Textarea rows={2} value={form.decision_yes_text} onChange={(e) => setForm((f) => ({ ...f, decision_yes_text: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Hayır dalı</Label>
                        <Textarea rows={2} value={form.decision_no_text} onChange={(e) => setForm((f) => ({ ...f, decision_no_text: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Karar sorumlusu</Label>
                        <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
                    </div>
                </>
            )}

            {form.step_type !== 'decision' && (
                <div className="space-y-2">
                    <Label>Bağlı dokümanlar (PR / TL / FR / SM)</Label>
                    <DocumentCodePicker
                        value={form.documents}
                        unitCode={unitCode}
                        onChange={(documents) => setForm((f) => ({ ...f, documents }))}
                    />
                </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button type="button" onClick={onSave} disabled={saving || (!isDirty && !hasFlowDraft)}>
                    Kaydet
                </Button>
                <Button type="button" variant="outline" onClick={onDiscard} disabled={saving || (!isDirty && !hasFlowDraft)}>
                    Geri al
                </Button>
                <Button type="button" variant="outline" onClick={onInsertAfter} disabled={saving}>Sonrasına ekle</Button>
                <Button type="button" variant="outline" onClick={onMoveUp} disabled={saving}>Yukarı</Button>
                <Button type="button" variant="outline" onClick={onMoveDown} disabled={saving}>Aşağı</Button>
                <Button type="button" variant="destructive" onClick={onDelete} disabled={saving}>Sil</Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                Hiçbir değişiklik <strong>Kaydet</strong> demeden veritabanına yazılmaz.
            </p>
        </div>
    );
};

export default ProcessFlowStepEditor;
export { stepToForm };
