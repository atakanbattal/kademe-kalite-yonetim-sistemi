import React, { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { getReadableTableName } from '@/components/audit/auditLogHelpers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Yaygın kolon adları → Türkçe etiket */
const FIELD_LABELS_TR = {
  id: 'Kayıt ID',
  part_code: 'Parça kodu',
  revision_number: 'Revizyon numarası',
  vehicle_type: 'Araç / ürün tipi',
  equipment_id: 'Proses ekipmanı (ID)',
  characteristic_id: 'Karakteristik (ID)',
  standard_id: 'Standart (ID)',
  standard_class: 'Standart sınıfı',
  tolerance_class: 'Tolerans sınıfı',
  tolerance_direction: 'Tolerans yönü',
  nominal_value: 'Nominal değer',
  min_value: 'Minimum',
  max_value: 'Maksimum',
  characteristic_type: 'Karakteristik tipi',
  measurement_unit: 'Ölçü birimi',
  notes: 'Notlar',
  description: 'Açıklama',
  title: 'Başlık',
  name: 'Ad',
  is_active: 'Aktif',
  status: 'Durum',
  file_path: 'Dosya yolu',
  revision_notes: 'Revizyon notları',
  created_at: 'Oluşturulma',
  updated_at: 'Güncellenme',
  user_id: 'Kullanıcı ID',
  items: 'Kontrol planı satırları',
  changed_fields: 'Değişen alanlar',
  inspection_id: 'Muayene / kalite kaydı ID',
  event_type: 'Olay tipi',
  event_timestamp: 'Olay zamanı',
  chassis_no: 'Şasi no',
  serial_no: 'Seri no',
  customer_name: 'Müşteri',
  priority: 'Öncelik',
  source_audit_id: 'Kaynak tetkik ID',
  related_nc_id: 'İlişkili uygunsuzluk ID',
  document_id: 'Doküman ID',
  supplier_id: 'Tedarikçi ID',
  task_id: 'Görev ID',
  responsible_person_id: 'Sorumlu (ID)',
  equipment_code: 'Ekipman kodu',
  equipment_name: 'Ekipman adı',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function labelForKey(key) {
  if (!key || typeof key !== 'string') return 'Alan';
  return FIELD_LABELS_TR[key] || key.replace(/_/g, ' ');
}

function isUuidString(v) {
  return typeof v === 'string' && UUID_RE.test(v.trim());
}

function formatUuidDisplay(v) {
  const s = String(v).trim();
  if (s.length <= 13) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function tryFormatDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) && !/T\d{2}:\d{2}/.test(s)) return null;
  const d = parseISO(s);
  if (!isValid(d)) return null;
  return format(d, 'dd.MM.yyyy HH:mm:ss', { locale: tr });
}

function formatScalar(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const asDate = tryFormatDate(value);
    if (asDate) return asDate;
    if (isUuidString(value)) {
      return (
        <span className="font-mono text-[11px]" title={value}>
          {formatUuidDisplay(value)}
        </span>
      );
    }
    if (value.length > 200) return `${value.slice(0, 200)}…`;
    return value;
  }
  return null;
}

function looksLikeControlPlanLine(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return (
    'characteristic_id' in obj ||
    'nominal_value' in obj ||
    'standard_class' in obj ||
    'tolerance_class' in obj ||
    ('min_value' in obj && 'max_value' in obj)
  );
}

function sortRecordKeys(keys) {
  const priority = [
    'part_code',
    'revision_number',
    'vehicle_type',
    'equipment_id',
    'title',
    'name',
    'description',
    'status',
    'is_active',
    'revision_notes',
    'file_path',
    'items',
    'created_at',
    'updated_at',
    'id',
  ];
  const set = new Set(keys);
  const ordered = [];
  for (const p of priority) {
    if (set.has(p)) ordered.push(p);
  }
  const rest = keys.filter((k) => !ordered.includes(k)).sort((a, b) => a.localeCompare(b, 'tr'));
  return [...ordered, ...rest];
}

function ControlPlanItemsTable({ items, caption }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-muted-foreground">Satır yok.</p>;
  }
  const sample = items.find((x) => x && typeof x === 'object') || {};
  const displayKeys = sortRecordKeys(
    Object.keys(sample).filter((k) => k !== 'changed_fields')
  );

  return (
    <div className="space-y-2">
      {caption && <p className="text-xs font-medium text-muted-foreground">{caption}</p>}
      <ScrollArea className="max-h-[min(50vh,420px)] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/80 hover:bg-muted/80">
              <TableHead className="w-10 text-center text-muted-foreground">#</TableHead>
              {displayKeys.map((k) => (
                <TableHead key={k} className="whitespace-nowrap text-xs font-semibold">
                  {labelForKey(k)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row, idx) => (
              <TableRow key={row?.id || idx}>
                <TableCell className="text-center text-muted-foreground text-xs">{idx + 1}</TableCell>
                {displayKeys.map((k) => (
                  <TableCell key={k} className="text-xs align-top max-w-[220px] break-words">
                    {renderCellValue(row?.[k], k)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function renderCellValue(value, keyHint) {
  const scalar = formatScalar(value);
  if (scalar !== null) return scalar;
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v))) {
      return value.map(String).join(', ');
    }
    return `${value.length} alt öğe`;
  }
  if (value && typeof value === 'object') {
    return (
      <NestedKeyValueList obj={value} maxDepth={2} depth={0} compact />
    );
  }
  return String(value);
}

function NestedKeyValueList({ obj, maxDepth, depth, compact }) {
  if (!obj || typeof obj !== 'object' || depth > maxDepth) {
    return <span className="text-muted-foreground">—</span>;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return <span className="text-muted-foreground">Boş</span>;
  return (
    <ul className={compact ? 'space-y-0.5 text-[11px]' : 'space-y-1 text-xs'}>
      {keys.map((k) => {
        const v = obj[k];
        const scalar = formatScalar(v);
        return (
          <li key={k} className="break-words">
            <span className="text-muted-foreground font-medium">{labelForKey(k)}:</span>{' '}
            {scalar !== null ? (
              scalar
            ) : Array.isArray(v) || (v && typeof v === 'object') ? (
              <NestedKeyValueList obj={v} maxDepth={maxDepth} depth={depth + 1} compact />
            ) : (
              String(v)
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AuditScalarFieldsCard({ record, excludeKeys = [] }) {
  const excludeSerialized = JSON.stringify(excludeKeys);
  const keys = useMemo(() => {
    const ex = new Set(excludeKeys);
    const k = Object.keys(record).filter((key) => !ex.has(key) && key !== 'changed_fields');
    return sortRecordKeys(k);
  }, [record, excludeSerialized]);

  if (keys.length === 0) return null;

  return (
    <Card className="border-muted shadow-none">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold">Kayıt özeti</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {keys.map((key) => {
            const raw = record[key];
            if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
              return (
                <div key={key} className="sm:col-span-2 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{labelForKey(key)}</div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <NestedKeyValueList obj={raw} maxDepth={3} depth={0} compact={false} />
                  </div>
                </div>
              );
            }
            if (Array.isArray(raw) && looksLikeControlPlanLine(raw[0])) {
              return null;
            }
            if (Array.isArray(raw)) {
              return (
                <div key={key} className="sm:col-span-2 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{labelForKey(key)}</div>
                  <div className="text-xs rounded-md border bg-muted/30 p-2">
                    {raw.length === 0 ? '—' : renderCellValue(raw, key)}
                  </div>
                </div>
              );
            }
            const disp = formatScalar(raw);
            return (
              <div key={key} className="space-y-0.5 min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{labelForKey(key)}</div>
                <div className="text-sm font-medium break-words">{disp !== null ? disp : String(raw)}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditSingleRecordView({ record, subtitle, tableLabel }) {
  if (!record || typeof record !== 'object') {
    return <p className="text-sm text-muted-foreground">Gösterilecek veri yok.</p>;
  }

  const items = record.items;
  const showItemsTable = Array.isArray(items) && items.some((x) => looksLikeControlPlanLine(x));
  const excludeKeys = showItemsTable ? ['items'] : [];

  return (
    <div className="space-y-4">
      {tableLabel && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{tableLabel}</p>
      )}
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <AuditScalarFieldsCard record={record} excludeKeys={excludeKeys} />
      {showItemsTable && (
        <Card className="border-muted shadow-none">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Kontrol planı satırları</CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              {items.length} ölçüm / karakteristik satırı
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <ControlPlanItemsTable items={items} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AuditDiffView({ oldRow, newRow }) {
  const keys = useMemo(() => {
    const set = new Set([
      ...Object.keys(oldRow || {}),
      ...Object.keys(newRow || {}),
    ]);
    return Array.from(set).filter((k) => k !== 'changed_fields');
  }, [oldRow, newRow]);

  const sortedKeys = useMemo(() => sortRecordKeys(keys), [keys]);

  return (
    <ScrollArea className="h-[min(60vh,520px)] border rounded-md">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted z-10">
          <tr>
            <th className="text-left p-2 font-semibold w-[28%]">Alan</th>
            <th className="text-left p-2 font-semibold w-[36%]">Önce</th>
            <th className="text-left p-2 font-semibold w-[36%]">Sonra</th>
          </tr>
        </thead>
        <tbody>
          {sortedKeys.map((key) => {
            const before = oldRow?.[key];
            const after = newRow?.[key];
            const changed = JSON.stringify(before) !== JSON.stringify(after);
            const isItems =
              key === 'items' &&
              Array.isArray(before) &&
              Array.isArray(after) &&
              (before.some((x) => looksLikeControlPlanLine(x)) ||
                after.some((x) => looksLikeControlPlanLine(x)));

            if (isItems) {
              return (
                <tr key={key} className={changed ? 'bg-amber-500/10' : ''}>
                  <td colSpan={3} className="p-3 align-top border-t">
                    <div className="font-semibold text-foreground mb-2">{labelForKey(key)}</div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <ControlPlanItemsTable items={before} caption="Önceki sürüm" />
                      <ControlPlanItemsTable items={after} caption="Yeni sürüm" />
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={key} className={changed ? 'bg-amber-500/10' : ''}>
                <td className="p-2 font-medium text-muted-foreground align-top border-t">{labelForKey(key)}</td>
                <td className="p-2 align-top border-t break-words max-w-[min(40vw,320px)]">
                  {renderCellValue(before, key)}
                </td>
                <td className="p-2 align-top border-t break-words max-w-[min(40vw,320px)]">
                  {renderCellValue(after, key)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function RawJsonDetails({ details }) {
  return (
    <details className="rounded-md border bg-muted/20 text-xs group">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground hover:bg-muted/40 rounded-md">
        Ham veri (JSON)
      </summary>
      <pre className="px-3 pb-3 pt-1 whitespace-pre-wrap break-all font-mono text-[11px] max-h-[240px] overflow-auto border-t">
        {JSON.stringify(details, null, 2)}
      </pre>
    </details>
  );
}

/**
 * Denetim modalında kayıt detayını okunaklı gösterir.
 * @param {object} details — audit_log_entries.details
 * @param {string} [tableName] — log.table_name
 */
export function AuditDetailsPane({ details, tableName }) {
  if (!details) {
    return <p className="text-sm text-muted-foreground">Detay yok.</p>;
  }

  const tableLabel = tableName ? getReadableTableName(tableName) : null;
  const d = details;

  if (typeof d !== 'object' || Array.isArray(d)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Beklenmeyen detay biçimi.</p>
        <RawJsonDetails details={details} />
      </div>
    );
  }

  const hasOld = d.old != null && typeof d.old === 'object' && !Array.isArray(d.old);
  const hasNew = d.new != null && typeof d.new === 'object' && !Array.isArray(d.new);

  if (hasOld && hasNew) {
    return (
      <div className="space-y-3">
        <Separator />
        <AuditDiffView oldRow={d.old} newRow={d.new} />
        <RawJsonDetails details={details} />
      </div>
    );
  }

  if (hasNew && !hasOld) {
    return (
      <div className="space-y-3">
        <AuditSingleRecordView record={d.new} subtitle="Yeni kayıt içeriği" tableLabel={tableLabel} />
        <RawJsonDetails details={details} />
      </div>
    );
  }

  if (hasOld && !hasNew) {
    return (
      <div className="space-y-3">
        <AuditSingleRecordView record={d.old} subtitle="Silinen kayıt özeti" tableLabel={tableLabel} />
        <RawJsonDetails details={details} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AuditSingleRecordView record={d} tableLabel={tableLabel} />
      <RawJsonDetails details={details} />
    </div>
  );
}
