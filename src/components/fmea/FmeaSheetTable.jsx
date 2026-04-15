import React, { useCallback, useMemo } from 'react';
import { MoreHorizontal, Copy, Plus, EyeOff, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { computeRpn, computeApLevel, AP_LABEL_TR, apBadgeClass } from '@/lib/fmeaCalculations';

const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
};

const CELL_TEXTAREA =
  'min-h-[112px] min-w-[168px] sm:min-w-[188px] text-sm leading-relaxed resize-y py-2.5 px-3 border border-input bg-background rounded-md shadow-sm';

const MiniNum = ({ value, onChange, disabled }) => (
  <Input
    type="number"
    min={1}
    max={10}
    className="h-10 w-[3.25rem] text-center px-1 font-medium"
    value={value ?? ''}
    disabled={disabled}
    onChange={(e) => onChange(numOrNull(e.target.value))}
  />
);

export default function FmeaSheetTable({
  lines,
  personnel = [],
  canEdit,
  onUpdateLine,
  onAddLine,
  onDuplicateLine,
  onToggleActive,
  cpReviewIds,
}) {
  const sorted = useMemo(() => [...lines].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [lines]);

  const patchLine = useCallback(
    (id, patch) => {
      const row = lines.find((l) => l.id === id);
      if (!row || !canEdit) return;
      let next = { ...row, ...patch };
      const s = next.severity;
      const o = next.occurrence;
      const d = next.detection;
      next.rpn = computeRpn(s, o, d);
      next.ap_level = computeApLevel(s, o, d);
      const sa = next.s_after;
      const oa = next.o_after;
      const da = next.d_after;
      next.rpn_after = computeRpn(sa, oa, da);
      next.ap_after = computeApLevel(sa, oa, da);
      onUpdateLine(id, next);
    },
    [lines, canEdit, onUpdateLine]
  );

  return (
    <ScrollArea className="w-full rounded-md border border-border">
      <Table className="min-w-[1680px] [&_td]:align-top">
        <TableHeader>
          <TableRow className="bg-[#2c3e50] hover:bg-[#2c3e50]">
            <TableHead className="text-white font-semibold w-10 sticky left-0 z-20 bg-[#2c3e50]">#</TableHead>
            <TableHead className="text-white font-semibold min-w-[140px]">Proses öğesi</TableHead>
            <TableHead className="text-white font-semibold min-w-[120px]">Fonksiyon</TableHead>
            <TableHead className="text-white font-semibold min-w-[120px]">Hata modu</TableHead>
            <TableHead className="text-white font-semibold min-w-[100px]">Etki</TableHead>
            <TableHead className="text-white font-semibold w-14">S</TableHead>
            <TableHead className="text-white font-semibold min-w-[100px]">Neden</TableHead>
            <TableHead className="text-white font-semibold w-14">O</TableHead>
            <TableHead className="text-white font-semibold min-w-[100px]">Önleme</TableHead>
            <TableHead className="text-white font-semibold min-w-[100px]">Tespit</TableHead>
            <TableHead className="text-white font-semibold w-14">D</TableHead>
            <TableHead className="text-white font-semibold w-16">RPN</TableHead>
            <TableHead className="text-white font-semibold w-24">Öncelik</TableHead>
            <TableHead className="text-white font-semibold min-w-[140px] max-w-[220px]">
              KP / ölçü notu
            </TableHead>
            <TableHead className="text-white font-semibold min-w-[120px]">Önerilen tedbir</TableHead>
            <TableHead className="text-white font-semibold min-w-[90px]">Sorumlu</TableHead>
            <TableHead className="text-white font-semibold w-28">Hedef tarih</TableHead>
            <TableHead className="text-white font-semibold min-w-[100px]">Alınan tedbirler</TableHead>
            <TableHead className="text-white font-semibold w-12">S&apos;</TableHead>
            <TableHead className="text-white font-semibold w-12">O&apos;</TableHead>
            <TableHead className="text-white font-semibold w-12">D&apos;</TableHead>
            <TableHead className="text-white font-semibold w-16">RPN&apos;</TableHead>
            <TableHead className="text-white font-semibold w-24">Öncelik&apos;</TableHead>
            <TableHead className="text-white font-semibold w-12 sticky right-0 bg-[#2c3e50]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((line, idx) => (
            <TableRow
              key={line.id}
              className={cn(!line.is_active && 'opacity-45 bg-muted/40')}
            >
              <TableCell className="sticky left-0 z-10 bg-card font-mono text-xs align-top">{idx + 1}</TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.process_step ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { process_step: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.function_text ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { function_text: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.failure_mode ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { failure_mode: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.effect ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { effect: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <MiniNum
                  value={line.severity}
                  disabled={!canEdit}
                  onChange={(v) => patchLine(line.id, { severity: v })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.cause ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { cause: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <MiniNum
                  value={line.occurrence}
                  disabled={!canEdit}
                  onChange={(v) => patchLine(line.id, { occurrence: v })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.current_prevention ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { current_prevention: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.current_detection ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { current_detection: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <MiniNum
                  value={line.detection}
                  disabled={!canEdit}
                  onChange={(v) => patchLine(line.id, { detection: v })}
                />
              </TableCell>
              <TableCell className="font-mono text-sm align-top p-2 pt-4">{line.rpn ?? '—'}</TableCell>
              <TableCell className="align-top p-2 pt-3">
                {line.ap_level ? (
                  <Badge className={cn('shrink-0', apBadgeClass(line.ap_level))}>
                    {AP_LABEL_TR[line.ap_level] ?? line.ap_level}
                  </Badge>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell
                className={cn(
                  'align-top p-2',
                  cpReviewIds?.has?.(line.id) && 'bg-amber-500/10 ring-1 ring-amber-500/30 rounded-md'
                )}
              >
                <Textarea
                  className="min-h-[88px] min-w-[130px] max-w-[220px] text-sm leading-relaxed resize-y py-2 px-2 border border-input bg-background rounded-md shadow-sm"
                  placeholder="Karakteristik, kritik ölçü, KP etkisi…"
                  value={line.cp_integration_note ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { cp_integration_note: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.recommended_action ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { recommended_action: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top p-2 min-w-[172px]">
                {(() => {
                  const resp = (line.responsible ?? '').trim();
                  const inList = personnel.some((p) => p.full_name === resp);
                  const selectVal = !resp ? '__none__' : inList ? resp : '__custom__';
                  const showManual = selectVal === '__custom__';
                  return (
                    <>
                      <Select
                        value={selectVal}
                        onValueChange={(v) => {
                          if (v === '__none__') patchLine(line.id, { responsible: '' });
                          else if (v === '__custom__') patchLine(line.id, { responsible: resp || '' });
                          else patchLine(line.id, { responsible: v });
                        }}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Personel seçin" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[280px]">
                          <SelectItem value="__none__">— Seçilmedi —</SelectItem>
                          {personnel.map((p) => (
                            <SelectItem key={p.id} value={p.full_name}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">Diğer (elle yazın)</SelectItem>
                        </SelectContent>
                      </Select>
                      {showManual ? (
                        <Input
                          className="mt-2 h-9 text-sm"
                          placeholder="Sorumlu adı"
                          value={resp}
                          disabled={!canEdit}
                          onChange={(e) => patchLine(line.id, { responsible: e.target.value })}
                        />
                      ) : null}
                    </>
                  );
                })()}
              </TableCell>
              <TableCell className="align-top p-2">
                <Input
                  type="date"
                  className="h-10 text-sm min-w-[148px]"
                  value={line.target_date ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { target_date: e.target.value || null })}
                />
              </TableCell>
              <TableCell className="align-top p-2">
                <Textarea
                  className={CELL_TEXTAREA}
                  value={line.actions_taken ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchLine(line.id, { actions_taken: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <MiniNum
                  value={line.s_after}
                  disabled={!canEdit}
                  onChange={(v) => patchLine(line.id, { s_after: v })}
                />
              </TableCell>
              <TableCell>
                <MiniNum
                  value={line.o_after}
                  disabled={!canEdit}
                  onChange={(v) => patchLine(line.id, { o_after: v })}
                />
              </TableCell>
              <TableCell>
                <MiniNum
                  value={line.d_after}
                  disabled={!canEdit}
                  onChange={(v) => patchLine(line.id, { d_after: v })}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">{line.rpn_after ?? '—'}</TableCell>
              <TableCell>
                {line.ap_after ? (
                  <Badge className={cn('shrink-0', apBadgeClass(line.ap_after))}>
                    {AP_LABEL_TR[line.ap_after] ?? line.ap_after}
                  </Badge>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="sticky right-0 z-10 bg-card p-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!canEdit}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDuplicateLine(line)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Satırı kopyala
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAddLine(line.sort_order)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Altına satır ekle
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleActive(line)}>
                      {line.is_active ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" />
                          Pasifleştir
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Aktifleştir
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
