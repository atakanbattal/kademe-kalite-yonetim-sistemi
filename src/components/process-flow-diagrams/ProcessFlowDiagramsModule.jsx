import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Pencil, Eye, Loader2, RefreshCw, Search, Menu, Printer, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeTurkishForSearch } from '@/lib/utils';
import { openDocumentPreview, downloadDocumentAttachment } from '@/lib/documentPdfPreview';
import SourceDocumentViewerModal from '@/components/document/SourceDocumentViewerModal';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import ProcessFlowStepEditor, { stepToForm } from './ProcessFlowStepEditor';
import ProcessFlowPrintDialog from './ProcessFlowPrintDialog';
import ProcessFlowUnitDialog from './ProcessFlowUnitDialog';
import ProcessFlowFlowDialog from './ProcessFlowFlowDialog';
import { useProcessFlowData } from './useProcessFlowData';
import {
    cloneUnits,
    findFlowInUnits,
    findStepInUnits,
    reorderStepInUnits,
    markStepDeletedInUnits,
    insertStepAfterInUnits,
    insertFirstStepInUnits,
} from './processFlowDraftUtils';
import { STEP_TYPE_CLASS, STEP_TYPE_ICON, formatDocumentChip } from './processFlowConstants';
import './processFlowDiagrams.css';

const IDEAL_FLAG_TEXT =
    'Bu birim için süreç prosedürü ayrıca dokümante edilmemiştir; aşağıdaki akış, mevcut görev tanımı/talimat/formlar ile ISO 9001 esas alınarak olması gereken (ideal) süreç olarak tasarlanmıştır.';

function mergeStepWithForm(step, form) {
    if (!form) return step;
    return {
        ...step,
        step_type: form.step_type,
        text: form.text,
        role: form.role,
        decision_question: form.decision_question,
        decision_yes_text: form.decision_yes_text,
        decision_no_text: form.decision_no_text,
        documents: (form.documents || []).map((d, idx) => ({
            id: d.id || `draft-doc-${idx}`,
            document_id: d.document_id,
            document_code: d.document_code,
            section_ref: d.section_ref,
        })),
    };
}

function renderStepNode(step, { editMode, selectedStepId, onSelect }) {
    if (step.step_type === 'decision') {
        return (
            <div
                key={step.id}
                className={`pfd-decision ${editMode ? 'editable' : ''} ${selectedStepId === step.id ? 'selected' : ''}`}
                onClick={editMode ? () => onSelect(step) : undefined}
                onKeyDown={editMode ? (e) => e.key === 'Enter' && onSelect(step) : undefined}
                role={editMode ? 'button' : undefined}
                tabIndex={editMode ? 0 : undefined}
            >
                <div className="pfd-diamond">
                    <div className="pfd-dq">{step.decision_question || step.text}</div>
                    {step.role ? <span className="pfd-role">{step.role}</span> : null}
                </div>
                <div className="pfd-branches">
                    <div className="pfd-branch yes"><strong>✔ Evet</strong> {step.decision_yes_text}</div>
                    <div className="pfd-branch no"><strong>✘ Hayır</strong> {step.decision_no_text}</div>
                </div>
            </div>
        );
    }

    if (step.step_type === 'note') {
        return <div key={step.id} className="pfd-note">{step.text}</div>;
    }

    const cls = STEP_TYPE_CLASS[step.step_type] || 'n-proc';
    return (
        <div
            key={step.id}
            className={`pfd-node ${cls} ${editMode ? 'editable' : ''} ${selectedStepId === step.id ? 'selected' : ''}`}
            onClick={editMode ? () => onSelect(step) : undefined}
            onKeyDown={editMode ? (e) => e.key === 'Enter' && onSelect(step) : undefined}
            role={editMode ? 'button' : undefined}
            tabIndex={editMode ? 0 : undefined}
        >
            <span>{STEP_TYPE_ICON[step.step_type] || '▭'}</span>
            <div style={{ flex: 1 }}>
                <div className="pfd-node-text">{step.text}</div>
                {step.role ? <span className="pfd-role">{step.role}</span> : null}
                {step.documents?.length ? (
                    <div className="pfd-chips">
                        {step.documents.map((doc) => (
                            <span
                                key={doc.id || `${doc.document_code}-${doc.section_ref}`}
                                className={`pfd-chip${(doc.document_id || doc.document_code) ? ' clickable' : ''}`}
                                data-doc-id={doc.document_id || ''}
                                data-doc-code={doc.document_code || ''}
                            >
                                {formatDocumentChip(doc)}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

const SIDEBAR_STORAGE_KEY = 'kys-flow-sidebar';

function readSidebarPreference() {
    try {
        const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (saved === 'open') return true;
        if (saved === 'closed') return false;
    } catch {
        /* ignore */
    }
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches;
}

const ProcessFlowDiagramsModule = () => {
    const { toast } = useToast();
    const { canWrite } = usePermissions('process-flow-diagrams');
    const {
        units,
        loading,
        refreshing,
        error,
        reload,
        persistFlow,
        createUnit,
        updateUnit,
        deleteUnit,
        createFlow,
        updateFlow,
        deleteFlow,
    } = useProcessFlowData();

    const [activeSlug, setActiveSlug] = useState(null);
    const [search, setSearch] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [draftUnits, setDraftUnits] = useState(null);
    const [deletedStepIds, setDeletedStepIds] = useState([]);
    const [flowStructureDirty, setFlowStructureDirty] = useState(false);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [selectedFlowId, setSelectedFlowId] = useState(null);
    const [editorForm, setEditorForm] = useState(null);
    const [savedStepForm, setSavedStepForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [pdfViewer, setPdfViewer] = useState({ isOpen: false, url: null, title: '' });
    const [sourceViewer, setSourceViewer] = useState({
        isOpen: false,
        blob: null,
        previewUrl: null,
        fallbackPreviewUrl: null,
        previewMode: null,
        title: '',
        attachment: null,
        documentType: null,
        downloadName: '',
    });
    const [unitNavOpen, setUnitNavOpen] = useState(readSidebarPreference);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [unitDialog, setUnitDialog] = useState({ open: false, mode: 'create' });
    const [flowDialog, setFlowDialog] = useState({ open: false, mode: 'create', flow: null });
    const [entitySaving, setEntitySaving] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 901px)');
        const onChange = (e) => {
            if (e.matches) setUnitNavOpen(true);
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const setSidebarOpen = useCallback((open) => {
        setUnitNavOpen(open);
        try {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? 'open' : 'closed');
        } catch {
            /* ignore */
        }
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen(!unitNavOpen);
    }, [setSidebarOpen, unitNavOpen]);

    const displayUnits = editMode && draftUnits ? draftUnits : units;

    useEffect(() => {
        if (editMode && !draftUnits && units.length) {
            setDraftUnits(cloneUnits(units));
        }
    }, [editMode, draftUnits, units]);

    const activeUnit = useMemo(() => {
        if (!displayUnits.length) return null;
        return displayUnits.find((u) => u.slug === activeSlug) || displayUnits[0];
    }, [displayUnits, activeSlug]);

    const printUnit = useMemo(() => {
        if (!units.length) return null;
        const slug = activeSlug || units[0]?.slug;
        return units.find((u) => u.slug === slug) || units[0];
    }, [units, activeSlug]);

    const filteredUnits = useMemo(() => {
        const q = normalizeTurkishForSearch(search);
        if (!q) return displayUnits;
        return displayUnits.filter((u) =>
            normalizeTurkishForSearch(`${u.code} ${u.name}`).includes(q)
        );
    }, [displayUnits, search]);

    const selectedContext = useMemo(() => {
        if (!selectedStepId) return { step: null, flow: null };
        const found = findStepInUnits(displayUnits, selectedStepId);
        return { step: found.step, flow: found.flow };
    }, [displayUnits, selectedStepId]);

    const isFormDirty = useMemo(() => {
        if (!editorForm || !savedStepForm) return false;
        return JSON.stringify(editorForm) !== JSON.stringify(savedStepForm);
    }, [editorForm, savedStepForm]);

    const hasFlowDraft = flowStructureDirty || deletedStepIds.length > 0;
    const hasUnsavedChanges = isFormDirty || hasFlowDraft;

    const handlePrint = useCallback(() => {
        setPrintDialogOpen(true);
    }, []);

    const syncDraftAfterEntityChange = useCallback((slug) => {
        setDraftUnits(null);
        setDeletedStepIds([]);
        setFlowStructureDirty(false);
        setSelectedStepId(null);
        setSelectedFlowId(null);
        setEditorForm(null);
        setSavedStepForm(null);
        if (slug) setActiveSlug(slug);
    }, []);

    const guardUnsaved = useCallback(() => {
        if (!hasUnsavedChanges) return true;
        return window.confirm('Kaydedilmemiş adım değişiklikleri var. Devam edilsin mi?');
    }, [hasUnsavedChanges]);

    const openUnitDialog = useCallback((mode = 'create') => {
        if (!guardUnsaved()) return;
        setUnitDialog({ open: true, mode });
    }, [guardUnsaved]);

    const openFlowDialog = useCallback((mode = 'create', flow = null) => {
        if (!guardUnsaved()) return;
        setFlowDialog({ open: true, mode, flow });
    }, [guardUnsaved]);

    const handleUnitSubmit = async (form) => {
        setEntitySaving(true);
        try {
            if (unitDialog.mode === 'edit' && activeUnit) {
                const updated = await updateUnit(activeUnit.id, form);
                syncDraftAfterEntityChange(updated.slug);
                toast({ title: 'Birim güncellendi' });
            } else {
                const created = await createUnit(form);
                syncDraftAfterEntityChange(created.slug);
                setEditMode(true);
                toast({ title: 'Birim oluşturuldu', description: 'Şimdi süreç akışı ekleyebilirsiniz.' });
            }
            setUnitDialog({ open: false, mode: 'create' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Kaydedilemedi', description: err.message });
        } finally {
            setEntitySaving(false);
        }
    };

    const handleFlowSubmit = async (form) => {
        if (!activeUnit) return;
        setEntitySaving(true);
        try {
            if (flowDialog.mode === 'edit' && flowDialog.flow) {
                await updateFlow(flowDialog.flow.id, form);
                syncDraftAfterEntityChange(activeUnit.slug);
                toast({ title: 'Süreç güncellendi' });
            } else {
                await createFlow(activeUnit.id, form);
                syncDraftAfterEntityChange(activeUnit.slug);
                setEditMode(true);
                toast({
                    title: 'Süreç oluşturuldu',
                    description: form.withDefaultSteps
                        ? 'Adımları düzenleyebilirsiniz.'
                        : 'İlk adımı ekleyerek sıfırdan başlayın.',
                });
            }
            setFlowDialog({ open: false, mode: 'create', flow: null });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Kaydedilemedi', description: err.message });
        } finally {
            setEntitySaving(false);
        }
    };

    const handleDeleteUnit = async () => {
        if (!activeUnit || !guardUnsaved()) return;
        if (!window.confirm(`"${activeUnit.name}" birimi ve tüm süreçleri silinecek. Emin misiniz?`)) return;
        setEntitySaving(true);
        try {
            await deleteUnit(activeUnit.id);
            syncDraftAfterEntityChange(null);
            toast({ title: 'Birim silindi' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Silinemedi', description: err.message });
        } finally {
            setEntitySaving(false);
        }
    };

    const handleDeleteFlow = async (flow) => {
        if (!flow || !guardUnsaved()) return;
        if (!window.confirm(`"${flow.title}" süreci silinecek. Emin misiniz?`)) return;
        setEntitySaving(true);
        try {
            await deleteFlow(flow.id);
            syncDraftAfterEntityChange(activeUnit?.slug);
            toast({ title: 'Süreç silindi' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Silinemedi', description: err.message });
        } finally {
            setEntitySaving(false);
        }
    };

    const handleInsertFirstStep = (flowId) => {
        if (selectedStepId && isFormDirty) {
            if (!window.confirm('Bu adımdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return;
        }
        let newStep = null;
        setDraftUnits((prev) => {
            const base = prev || cloneUnits(units);
            const next = insertFirstStepInUnits(base, flowId);
            const { flow } = findFlowInUnits(next, flowId);
            newStep = flow?.steps?.[0] || null;
            return next;
        });
        setFlowStructureDirty(true);
        if (newStep) {
            setSelectedStepId(newStep.id);
            setSelectedFlowId(flowId);
            const form = stepToForm(newStep);
            setEditorForm(form);
            setSavedStepForm(form);
        }
        toast({ title: 'İlk adım eklendi', description: 'Kaydet ile kalıcı hale getirin.' });
    };

    const resetDraftState = useCallback(() => {
        setDraftUnits(null);
        setDeletedStepIds([]);
        setFlowStructureDirty(false);
        setSelectedStepId(null);
        setSelectedFlowId(null);
        setEditorForm(null);
        setSavedStepForm(null);
    }, []);

    const exitEditMode = useCallback(() => {
        if (isFormDirty || hasFlowDraft) {
            if (!window.confirm('Kaydedilmemiş değişiklikler var. Düzenleme modundan çıkılsın mı?')) return;
        }
        setEditMode(false);
        resetDraftState();
    }, [hasFlowDraft, isFormDirty, resetDraftState]);

    const selectStep = useCallback((step, flowId) => {
        if (selectedStepId && isFormDirty) {
            if (!window.confirm('Bu adımdaki kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return;
        }
        setSelectedStepId(step.id);
        setSelectedFlowId(flowId);
        const form = stepToForm(step);
        setEditorForm(form);
        setSavedStepForm(form);
    }, [isFormDirty, selectedStepId]);

    const closeEditor = useCallback(() => {
        if (isFormDirty && !window.confirm('Kaydedilmemiş değişiklikler kaybolacak. Kapatılsın mı?')) return;
        setSelectedStepId(null);
        setSelectedFlowId(null);
        setEditorForm(null);
        setSavedStepForm(null);
    }, [isFormDirty]);

    const openDocument = useCallback(async (documentId, documentCode, title) => {
        try {
            const preview = await openDocumentPreview({ documentId, documentCode, title });
            if (preview.kind === 'pdf') {
                setPdfViewer({ isOpen: true, url: preview.url, title: preview.title });
                return;
            }
            setSourceViewer({
                isOpen: true,
                blob: preview.blob || null,
                previewUrl: preview.previewUrl || null,
                fallbackPreviewUrl: preview.fallbackPreviewUrl || null,
                previewMode: preview.previewMode,
                title: preview.title,
                attachment: preview.attachment,
                documentType: preview.documentType,
                downloadName: preview.downloadName,
            });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Önizleme açılamadı', description: err.message });
        }
    }, [toast]);

    const handleContentClick = useCallback((e) => {
        const chip = e.target.closest('.pfd-chip.clickable');
        if (!chip || editMode) return;
        const docId = chip.getAttribute('data-doc-id');
        const docCode = chip.getAttribute('data-doc-code');
        if (!docId && !docCode) return;
        openDocument(docId || null, docCode, chip.textContent?.trim());
    }, [editMode, openDocument]);

    const getFlowStepsDraft = useCallback(() => {
        const { flow } = findFlowInUnits(draftUnits || [], selectedFlowId);
        return flow?.steps || [];
    }, [draftUnits, selectedFlowId]);

    const handleSave = async () => {
        if (!selectedFlowId || !selectedStepId || !editorForm || !draftUnits) return;
        setSaving(true);
        try {
            const flowSteps = getFlowStepsDraft();
            const formsMap = {};
            for (const step of flowSteps) {
                formsMap[step.id] = step.id === selectedStepId ? editorForm : stepToForm(step);
            }
            const oldIdx = flowSteps.findIndex((s) => s.id === selectedStepId);
            const savedSteps = await persistFlow(selectedFlowId, flowSteps, formsMap, deletedStepIds);
            setDraftUnits((prev) => prev.map((unit) => ({
                ...unit,
                flows: unit.flows.map((flow) => (flow.id === selectedFlowId ? { ...flow, steps: savedSteps } : flow)),
            })));
            setDeletedStepIds([]);
            setFlowStructureDirty(false);
            const saved = savedSteps[oldIdx] || savedSteps.find((s) => s.text === editorForm.text) || savedSteps[savedSteps.length - 1];
            if (saved) {
                setSelectedStepId(saved.id);
                const form = stepToForm(saved);
                setEditorForm(form);
                setSavedStepForm(form);
            }
            toast({ title: 'Kaydedildi', description: 'Akış değişiklikleri kaydedildi.' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Kaydedilemedi', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        if (!draftUnits || !selectedStepId) return;
        const { step } = findStepInUnits(units, selectedStepId);
        const baseline = step ? stepToForm(step) : savedStepForm;
        setEditorForm(baseline);
        setSavedStepForm(baseline);
        setDraftUnits(cloneUnits(units));
        setDeletedStepIds([]);
        setFlowStructureDirty(false);
        toast({ title: 'Geri alındı', description: 'Taslak değişiklikler iptal edildi.' });
    };

    const handleDeleteLocal = () => {
        if (!selectedStepId || !selectedFlowId) return;
        if (!window.confirm('Bu adım taslaktan silinecek. Kalıcı silme için Kaydet\'e basın.')) return;
        const { step } = findStepInUnits(draftUnits || [], selectedStepId);
        if (step && !step._isNew) {
            setDeletedStepIds((ids) => [...ids, selectedStepId]);
        }
        setDraftUnits((prev) => markStepDeletedInUnits(prev, selectedFlowId, selectedStepId));
        setSelectedStepId(null);
        setSelectedFlowId(null);
        setEditorForm(null);
        setSavedStepForm(null);
        setFlowStructureDirty(true);
    };

    const handleInsertAfter = () => {
        if (!selectedStepId || !selectedFlowId) return;
        setDraftUnits((prev) => insertStepAfterInUnits(prev, selectedFlowId, selectedStepId));
        setFlowStructureDirty(true);
        toast({ title: 'Taslak adım eklendi', description: 'Kaydet ile kalıcı hale getirin.' });
    };

    const handleMove = (direction) => {
        if (!selectedStepId || !selectedFlowId) return;
        setDraftUnits((prev) => reorderStepInUnits(prev, selectedFlowId, selectedStepId, direction));
        setFlowStructureDirty(true);
    };

    let bodyContent;

    if (loading) {
        bodyContent = (
            <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Süreç akışları yükleniyor...
            </div>
        );
    } else if (error) {
        bodyContent = (
            <div className="p-6 text-center space-y-3">
                <p className="text-destructive">{error}</p>
                <Button onClick={reload} variant="outline"><RefreshCw className="h-4 w-4 mr-2" /> Yeniden dene</Button>
            </div>
        );
    } else if (!activeUnit) {
        bodyContent = (
            <div className="p-6 text-center space-y-4">
                <p className="text-muted-foreground">Henüz süreç akış verisi yok.</p>
                {canWrite ? (
                    <Button onClick={() => openUnitDialog('create')}>
                        <Plus className="h-4 w-4 mr-2" /> İlk birimi oluştur
                    </Button>
                ) : null}
            </div>
        );
    } else {
        bodyContent = (
            <div className="-m-3 sm:-m-4 md:-m-6 pfd-root">
                <div className={`pfd-layout${unitNavOpen ? '' : ' pfd-side-closed'}`}>
                    <button
                        type="button"
                        className="pfd-side-overlay"
                        aria-label="Birim menüsünü kapat"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <aside className="pfd-side" aria-hidden={!unitNavOpen}>
                        <div className="pfd-side-brand">
                            <h2>Kademe Atık Teknolojileri A.Ş.</h2>
                            <p>Entegre Yönetim Sistemi — Birim Süreç Akış Şemaları</p>
                        </div>
                        <div className="pfd-side-search">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Birim ara..."
                                    style={{ paddingLeft: '2rem' }}
                                />
                            </div>
                        </div>
                        <nav className="pfd-nav">
                            {filteredUnits.map((unit) => (
                                <button
                                    key={unit.id}
                                    type="button"
                                    className={activeUnit.id === unit.id ? 'active' : ''}
                                    onClick={() => {
                                        if (isFormDirty || hasFlowDraft) {
                                            if (!window.confirm('Kaydedilmemiş değişiklikler var. Birim değiştirilsin mi?')) return;
                                        }
                                        setActiveSlug(unit.slug);
                                        setSelectedStepId(null);
                                        setEditorForm(null);
                                        setSavedStepForm(null);
                                        if (window.innerWidth < 901) setSidebarOpen(false);
                                    }}
                                >
                                    <span className="nc">{unit.code}</span>
                                    <span>{unit.name}</span>
                                </button>
                            ))}
                        </nav>
                        {editMode && canWrite ? (
                            <div className="p-3 border-t border-white/10">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => openUnitDialog('create')}
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Yeni birim
                                </Button>
                            </div>
                        ) : null}
                    </aside>

                    <div className="pfd-main">
                        <div className="pfd-toolbar">
                            <div className="pfd-toolbar-left">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={toggleSidebar}
                                    aria-expanded={unitNavOpen}
                                    title="Birim menüsünü aç/kapat"
                                >
                                    <Menu className="h-4 w-4 mr-1" />
                                    {unitNavOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}
                                </Button>
                                <div className="min-w-0">
                                    <strong>{activeUnit.name}</strong>
                                    <span className="text-muted-foreground text-sm ml-2">{activeUnit.code}</span>
                                    {refreshing ? <Loader2 className="inline h-3.5 w-3.5 ml-2 animate-spin opacity-60" /> : null}
                                </div>
                            </div>
                            <div className="pfd-toolbar-actions">
                                <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                                    <Printer className="h-4 w-4 mr-1" />
                                    Yazdır / PDF
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={reload} disabled={refreshing}>
                                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                </Button>
                                {canWrite ? (
                                    <>
                                        {editMode ? (
                                            <>
                                                <Button type="button" variant="outline" size="sm" onClick={() => openFlowDialog('create')}>
                                                    <Plus className="h-4 w-4 mr-1" /> Yeni süreç
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => openUnitDialog('edit')}>
                                                    Birim
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={handleDeleteUnit} disabled={entitySaving}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : null}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={editMode ? 'default' : 'outline'}
                                            onClick={() => (editMode ? exitEditMode() : setEditMode(true))}
                                        >
                                            {editMode ? <Pencil className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                            {editMode ? 'Düzenlemeyi bitir' : 'Düzenle'}
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-1 min-h-0">
                            <div className="pfd-content flex-1" onClick={handleContentClick}>
                                <div className="pfd-dept-banner">
                                    <div className="pfd-dept-code">{activeUnit.code}</div>
                                    <h2>{activeUnit.name}</h2>
                                    {activeUnit.subtitle ? <p className="pfd-dept-sub">{activeUnit.subtitle}</p> : null}
                                </div>

                                <div className="pfd-meta-grid">
                                    <div className="pfd-meta-card">
                                        <h4>Süreç Sahibi</h4>
                                        <p>{activeUnit.owner_role || '—'}</p>
                                    </div>
                                    <div className="pfd-meta-card">
                                        <h4>Temel Roller</h4>
                                        <p>{activeUnit.roles || '—'}</p>
                                    </div>
                                    <div className="pfd-meta-card amac">
                                        <h4>Amaç</h4>
                                        <p>{activeUnit.purpose || '—'}</p>
                                    </div>
                                </div>

                                {activeUnit.key_document_codes?.length ? (
                                    <div className="pfd-meta-card" style={{ marginBottom: 12 }}>
                                        <h4>Bağlı Ana Dokümanlar</h4>
                                        <div className="pfd-chips">
                                            {activeUnit.key_document_codes.map((code) => (
                                                <span key={code} className="pfd-chip">{code}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {activeUnit.is_ideal_process ? (
                                    <div className="pfd-ideal-flag">⚙ {IDEAL_FLAG_TEXT}</div>
                                ) : null}

                                {activeUnit.flows.length === 0 && editMode ? (
                                    <div className="pfd-flow pfd-empty-flow text-center py-10">
                                        <p className="text-muted-foreground mb-4">Bu birimde henüz süreç yok.</p>
                                        <Button type="button" onClick={() => openFlowDialog('create')}>
                                            <Plus className="h-4 w-4 mr-2" /> İlk süreci oluştur
                                        </Button>
                                    </div>
                                ) : null}

                                {activeUnit.flows.map((flow) => (
                                    <div key={flow.id} className="pfd-flow">
                                        <div className="pfd-flow-head">
                                            <h3>{flow.title}</h3>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {flow.header_document_codes?.length ? (
                                                    <div className="pfd-chips">
                                                        {flow.header_document_codes.map((code) => (
                                                            <span key={code} className="pfd-chip">{code}</span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                {editMode && canWrite ? (
                                                    <>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openFlowDialog('edit', flow)}>
                                                            Düzenle
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteFlow(flow)} disabled={entitySaving}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                        {flow.intro ? <p className="pfd-flow-intro">{flow.intro}</p> : null}
                                        <div className="pfd-chart">
                                            {flow.steps.length === 0 && editMode ? (
                                                <div className="py-8 text-center w-full">
                                                    <p className="text-sm text-muted-foreground mb-3">Boş süreç — sıfırdan adım ekleyin</p>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleInsertFirstStep(flow.id)}>
                                                        <Plus className="h-4 w-4 mr-1" /> İlk adımı ekle
                                                    </Button>
                                                </div>
                                            ) : null}
                                            {flow.steps.map((step, idx) => {
                                                const displayStep = editMode && step.id === selectedStepId && editorForm
                                                    ? mergeStepWithForm(step, editorForm)
                                                    : step;
                                                return (
                                                    <React.Fragment key={step.id}>
                                                        {renderStepNode(displayStep, {
                                                            editMode,
                                                            selectedStepId,
                                                            onSelect: (s) => selectStep(s, flow.id),
                                                        })}
                                                        {idx < flow.steps.length - 1 && step.step_type !== 'note' ? <div className="pfd-arrow" /> : null}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {editMode && selectedStepId && editorForm ? (
                                <aside className="pfd-editor">
                                    <ProcessFlowStepEditor
                                        form={editorForm}
                                        onFormChange={setEditorForm}
                                        unitCode={activeUnit.code}
                                        saving={saving}
                                        isDirty={isFormDirty}
                                        hasFlowDraft={hasFlowDraft}
                                        onSave={handleSave}
                                        onDiscard={handleDiscard}
                                        onDelete={handleDeleteLocal}
                                        onInsertAfter={handleInsertAfter}
                                        onMoveUp={() => handleMove('up')}
                                        onMoveDown={() => handleMove('down')}
                                        onClose={closeEditor}
                                    />
                                </aside>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <PdfViewerModal
                isOpen={pdfViewer.isOpen}
                setIsOpen={(open) => {
                    if (!open && pdfViewer.url?.startsWith('blob:')) {
                        window.URL.revokeObjectURL(pdfViewer.url);
                    }
                    setPdfViewer((s) => ({ ...s, isOpen: open, url: open ? s.url : null }));
                }}
                pdfUrl={pdfViewer.url}
                title={pdfViewer.title}
            />
            <SourceDocumentViewerModal
                isOpen={sourceViewer.isOpen}
                setIsOpen={(open) => setSourceViewer((s) => ({ ...s, isOpen: open }))}
                blob={sourceViewer.blob}
                previewUrl={sourceViewer.previewUrl}
                fallbackPreviewUrl={sourceViewer.fallbackPreviewUrl}
                previewMode={sourceViewer.previewMode}
                title={sourceViewer.title}
                onDownload={sourceViewer.attachment ? async () => {
                    try {
                        await downloadDocumentAttachment(
                            sourceViewer.attachment,
                            sourceViewer.documentType,
                            sourceViewer.downloadName,
                        );
                    } catch (err) {
                        toast({ variant: 'destructive', title: 'İndirilemedi', description: err.message });
                    }
                } : undefined}
            />
            <ProcessFlowPrintDialog
                open={printDialogOpen}
                onOpenChange={setPrintDialogOpen}
                unit={printUnit}
                editMode={editMode}
                hasUnsavedChanges={hasUnsavedChanges}
                onError={(message) => toast({ variant: 'destructive', title: 'Yazdırılamadı', description: message })}
            />
            <ProcessFlowUnitDialog
                open={unitDialog.open}
                onOpenChange={(open) => setUnitDialog((s) => ({ ...s, open }))}
                mode={unitDialog.mode}
                unit={unitDialog.mode === 'edit' ? activeUnit : null}
                saving={entitySaving}
                onSubmit={handleUnitSubmit}
            />
            {activeUnit ? (
                <ProcessFlowFlowDialog
                    open={flowDialog.open}
                    onOpenChange={(open) => setFlowDialog((s) => ({ ...s, open }))}
                    mode={flowDialog.mode}
                    flow={flowDialog.flow}
                    unitName={activeUnit.name}
                    saving={entitySaving}
                    onSubmit={handleFlowSubmit}
                />
            ) : null}
            {bodyContent}
        </>
    );
};

export default ProcessFlowDiagramsModule;
