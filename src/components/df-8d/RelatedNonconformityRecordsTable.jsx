import React, { useMemo } from 'react';
import { parseRelatedNonconformityRecordsBlob } from '@/lib/df8dTextUtils';

/**
 * «İlgili uygunsuzluk kayıtları» gövdesi: çoklu satır / tek satırda bitişik UYG-… kayıtları.
 */
export function RelatedNonconformityRecordsTable({ bodyText, className = '' }) {
  const { rows, tailNotes } = useMemo(() => parseRelatedNonconformityRecordsBlob(bodyText), [bodyText]);
  const hasDescriptionCol = useMemo(() => rows.some((r) => r.description && String(r.description).trim()), [rows]);

  if (!rows.length && !tailNotes.length) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Bu bölümde ayrıştırılabilir kayıt satırı yok.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40">
                <th className="px-2.5 py-2 font-semibold text-foreground whitespace-nowrap">Kayıt no</th>
                <th className="px-2.5 py-2 font-semibold text-foreground whitespace-nowrap">Tarih</th>
                <th className="px-2.5 py-2 font-semibold text-foreground">Araç / parça</th>
                <th className="px-2.5 py-2 font-semibold text-foreground whitespace-nowrap">Adet</th>
                <th className="px-2.5 py-2 font-semibold text-foreground whitespace-nowrap">Ciddiyet</th>
                {hasDescriptionCol ? (
                  <th className="px-2.5 py-2 font-semibold text-foreground min-w-[140px]">Tespit / açıklama</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.refNo}-${i}`} className="border-b border-border/40 last:border-0 align-top">
                  <td className="px-2.5 py-1.5 font-mono tabular-nums text-foreground">{r.refNo}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground/90">{r.detectionDate}</td>
                  <td className="px-2.5 py-1.5 break-words text-foreground/90">{r.vehicleOrPart}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground/90">{r.quantity}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground/90">{r.severity}</td>
                  {hasDescriptionCol ? (
                    <td className="px-2.5 py-1.5 break-words text-foreground/90 text-[11px]">{r.description || '—'}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tailNotes.length > 0 ? (
        <ul className="m-0 list-none space-y-1 p-0 text-xs leading-relaxed text-muted-foreground">
          {tailNotes.map((note, i) => (
            <li key={i} className="break-words">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default RelatedNonconformityRecordsTable;
