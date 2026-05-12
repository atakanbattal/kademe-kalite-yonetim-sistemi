import React, { useEffect, useState, useMemo } from 'react';
import { History, FileText, Plus, Minus, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

/* ────────────────────────────────────────────────────────
   Diff hesaplama: iki revizyon snapshot'ı karşılaştırır
──────────────────────────────────────────────────────── */
function buildDiff(prevSnapshot, currSnapshot) {
    const prevSections = prevSnapshot?.sections || [];
    const currSections = currSnapshot?.sections || [];

    const changes = [];

    // Mevcut bölümler + maddeler
    const prevSectionMap = new Map(prevSections.map((s) => [s.name, s]));
    const currSectionMap = new Map(currSections.map((s) => [s.name, s]));

    // Yeni eklenen bölümler
    for (const [name, sec] of currSectionMap.entries()) {
        if (!prevSectionMap.has(name)) {
            changes.push({
                type: 'section_added',
                sectionName: name,
                items: sec.items || [],
            });
        }
    }

    // Silinen bölümler
    for (const [name, sec] of prevSectionMap.entries()) {
        if (!currSectionMap.has(name)) {
            changes.push({
                type: 'section_removed',
                sectionName: name,
                items: sec.items || [],
            });
        }
    }

    // Her iki snapshot'ta da var olan bölümlerde madde farkı
    for (const [name, currSec] of currSectionMap.entries()) {
        const prevSec = prevSectionMap.get(name);
        if (!prevSec) continue;

        const prevItems = new Set((prevSec.items || []).map((i) => i.text));
        const currItems = new Set((currSec.items || []).map((i) => i.text));

        const addedItems = [...currItems].filter((t) => !prevItems.has(t));
        const removedItems = [...prevItems].filter((t) => !currItems.has(t));

        if (addedItems.length > 0 || removedItems.length > 0) {
            changes.push({
                type: 'items_changed',
                sectionName: name,
                addedItems,
                removedItems,
            });
        }
    }

    return changes;
}

/* ────────────────────────────────────────────────────────
   Tek revizyon kartı
──────────────────────────────────────────────────────── */
const RevisionCard = ({ revision, prevSnapshot, isFirst }) => {
    const [expanded, setExpanded] = useState(false);

    const diff = useMemo(
        () => (isFirst ? [] : buildDiff(prevSnapshot, revision.snapshot)),
        [isFirst, prevSnapshot, revision.snapshot]
    );

    const totalSections = revision.snapshot?.sections?.length || 0;
    const totalItems = (revision.snapshot?.sections || []).reduce(
        (acc, s) => acc + (s.items?.length || 0),
        0
    );

    const hasChanges = diff.length > 0;

    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            {/* Başlık satırı */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 select-none"
                onClick={() => setExpanded((v) => !v)}
            >
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" tabIndex={-1}>
                    {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                    )}
                </Button>

                <Badge variant="default" className="shrink-0">
                    Rev {String(revision.revision_no).padStart(2, '0')}
                </Badge>

                <span className="text-sm text-muted-foreground shrink-0">
                    {format(new Date(revision.revision_date || revision.created_at), 'dd.MM.yyyy', { locale: tr })}
                </span>

                {revision.changes_summary && (
                    <span className="text-sm text-foreground flex-1 truncate">
                        {revision.changes_summary}
                    </span>
                )}

                <div className="flex items-center gap-2 ml-auto shrink-0">
                    {!isFirst && hasChanges && (
                        <>
                            {diff.reduce((a, c) => a + (c.addedItems?.length || 0) + (c.type === 'section_added' ? (c.items?.length || 0) : 0), 0) > 0 && (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                                    +{diff.reduce((a, c) => a + (c.addedItems?.length || 0) + (c.type === 'section_added' ? (c.items?.length || 0) : 0), 0)} madde
                                </Badge>
                            )}
                            {diff.reduce((a, c) => a + (c.removedItems?.length || 0) + (c.type === 'section_removed' ? (c.items?.length || 0) : 0), 0) > 0 && (
                                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">
                                    -{diff.reduce((a, c) => a + (c.removedItems?.length || 0) + (c.type === 'section_removed' ? (c.items?.length || 0) : 0), 0)} madde
                                </Badge>
                            )}
                        </>
                    )}
                    <span className="text-xs text-muted-foreground">
                        {totalSections} bölüm · {totalItems} madde
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {format(new Date(revision.created_at), 'HH:mm', { locale: tr })}
                    </span>
                </div>
            </div>

            {/* Detay */}
            {expanded && (
                <div className="border-t">
                    {isFirst || !hasChanges ? (
                        /* İlk revizyon veya değişiklik yok → tam liste */
                        <SnapshotView snapshot={revision.snapshot} isInitial={isFirst} noChanges={!isFirst && !hasChanges} />
                    ) : (
                        /* Diff görünümü */
                        <DiffView diff={diff} />
                    )}
                </div>
            )}
        </div>
    );
};

/* ────────────────────────────────────────────────────────
   İlk revizyon için tam snapshot listesi
──────────────────────────────────────────────────────── */
const SnapshotView = ({ snapshot, isInitial, noChanges }) => {
    const sections = snapshot?.sections || [];

    if (noChanges) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                Bu revizyonda madde/bölüm değişikliği tespit edilmedi.
            </p>
        );
    }

    if (sections.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-4">
                Bu revizyonda bölüm bilgisi bulunmuyor.
            </p>
        );
    }

    return (
        <div className="p-3 space-y-2">
            {isInitial && (
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                    İlk revizyon — şablonun tüm içeriği:
                </p>
            )}
            {sections.map((sec, idx) => (
                <div key={idx} className="rounded-md border overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b">
                        <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold">{sec.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{sec.items?.length || 0} madde</span>
                    </div>
                    {(sec.items || []).length > 0 && (
                        <ul className="divide-y">
                            {sec.items.map((item, iIdx) => (
                                <li key={iIdx} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                                    <span className="text-muted-foreground w-4 text-right shrink-0 pt-0.5">{iIdx + 1}.</span>
                                    <span className="flex-1">{item.text}</span>
                                    {item.item_type === 'measurement' && (
                                        <Badge variant="outline" className="text-[9px] shrink-0">Ölçüm</Badge>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ))}
        </div>
    );
};

/* ────────────────────────────────────────────────────────
   Diff görünümü
──────────────────────────────────────────────────────── */
const DiffView = ({ diff }) => {
    if (!diff || diff.length === 0) return null;

    return (
        <div className="p-3 space-y-2">
            {diff.map((change, idx) => {
                if (change.type === 'section_added') {
                    return (
                        <div key={idx} className="rounded-md border border-emerald-200 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border-b border-emerald-200">
                                <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="text-xs font-semibold text-emerald-800">Yeni bölüm: {change.sectionName}</span>
                                <span className="text-[10px] text-emerald-600 ml-auto">{change.items.length} madde eklendi</span>
                            </div>
                            {change.items.length > 0 && (
                                <ul className="divide-y divide-emerald-100">
                                    {change.items.map((item, iIdx) => (
                                        <li key={iIdx} className="flex items-start gap-2 px-3 py-1.5 text-xs bg-emerald-50/50">
                                            <Plus className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                            <span className="text-emerald-900">{item.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                }

                if (change.type === 'section_removed') {
                    return (
                        <div key={idx} className="rounded-md border border-red-200 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border-b border-red-200">
                                <Minus className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span className="text-xs font-semibold text-red-800">Silinen bölüm: {change.sectionName}</span>
                                <span className="text-[10px] text-red-600 ml-auto">{change.items.length} madde kaldırıldı</span>
                            </div>
                            {change.items.length > 0 && (
                                <ul className="divide-y divide-red-100">
                                    {change.items.map((item, iIdx) => (
                                        <li key={iIdx} className="flex items-start gap-2 px-3 py-1.5 text-xs bg-red-50/50">
                                            <Minus className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                                            <span className="text-red-700 line-through">{item.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                }

                if (change.type === 'items_changed') {
                    return (
                        <div key={idx} className="rounded-md border overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b">
                                <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-semibold">{change.sectionName}</span>
                                <div className="flex gap-1 ml-auto">
                                    {change.addedItems.length > 0 && (
                                        <span className="text-[10px] text-emerald-700">+{change.addedItems.length}</span>
                                    )}
                                    {change.removedItems.length > 0 && (
                                        <span className="text-[10px] text-red-600">-{change.removedItems.length}</span>
                                    )}
                                </div>
                            </div>
                            <ul className="divide-y">
                                {change.addedItems.map((text, iIdx) => (
                                    <li key={`add-${iIdx}`} className="flex items-start gap-2 px-3 py-1.5 text-xs bg-emerald-50/60">
                                        <Plus className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-emerald-900">{text}</span>
                                    </li>
                                ))}
                                {change.removedItems.map((text, iIdx) => (
                                    <li key={`rem-${iIdx}`} className="flex items-start gap-2 px-3 py-1.5 text-xs bg-red-50/60">
                                        <Minus className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                                        <span className="text-red-700 line-through">{text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
};

/* ────────────────────────────────────────────────────────
   Ana modal
──────────────────────────────────────────────────────── */
const RevisionHistoryModal = ({ open, setOpen, templateId }) => {
    const { toast } = useToast();
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !templateId) return;
        (async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('control_form_template_revisions')
                    .select('*')
                    .eq('template_id', templateId)
                    .order('revision_no', { ascending: false });
                if (error) throw error;
                setRevisions(data || []);
            } catch (err) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Revizyon geçmişi yüklenemedi: ' + err.message,
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [open, templateId, toast]);

    // En eski → en yeni sırayla (diff için önceki snapshot lazım)
    const sortedAsc = useMemo(
        () => [...revisions].sort((a, b) => a.revision_no - b.revision_no),
        [revisions]
    );

    // Ekranı en yeni → en eski göster ama diff için önceki revizyon snapshot'ını bul
    const revisionsWithPrev = useMemo(
        () =>
            revisions.map((rev) => {
                const idx = sortedAsc.findIndex((r) => r.id === rev.id);
                const prev = idx > 0 ? sortedAsc[idx - 1].snapshot : null;
                return { ...rev, _prevSnapshot: prev, _isFirst: idx === 0 };
            }),
        [revisions, sortedAsc]
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        Revizyon Geçmişi
                    </DialogTitle>
                    <DialogDescription>
                        Her revizyonda eklenen veya kaldırılan bölüm ve maddeler gösterilir.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1">
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground">Yükleniyor...</p>
                    ) : revisionsWithPrev.length === 0 ? (
                        <div className="text-center py-12 border border-dashed rounded-md">
                            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Henüz revizyon oluşmadı. İlk düzenleme ile Rev 01 oluşacaktır.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-2">
                            {revisionsWithPrev.map((rev) => (
                                <RevisionCard
                                    key={rev.id}
                                    revision={rev}
                                    prevSnapshot={rev._prevSnapshot}
                                    isFirst={rev._isFirst}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RevisionHistoryModal;
