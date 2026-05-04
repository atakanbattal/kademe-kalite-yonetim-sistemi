import React, { useMemo } from 'react';
import { stripSquareBullets } from '@/lib/df8dTextUtils';
import RelatedNonconformityRecordsTable from '@/components/df-8d/RelatedNonconformityRecordsTable';

const UYG_ROW_REF = /UYG-\d{2}-\d+/i;

function isIlgiliUygunlukTitle(headline) {
  return /^İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI$/i.test(String(headline || '').replace(/\s+/g, ' ').trim());
}

/** Başlık kartta «İlgili…» iken gövdedeki mükerrer başlık satırını at */
function normalizeIlgiliUyBodyForTable(body) {
  const raw = String(body || '').trim();
  if (!raw) return '';
  const lines = raw.split('\n');
  const first = (lines[0] || '').trim();
  if (/^İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI$/i.test(first)) {
    return lines.slice(1).join('\n').trim();
  }
  const glued = first.match(/^İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI\s+(.+)$/i);
  if (glued && /\bUYG-\d{2}-\d+/i.test(glued[1])) {
    return [glued[1].trim(), ...lines.slice(1)].join('\n').trim();
  }
  return raw;
}

/**
 * Tek metin alanına yapışmış "3. KÖK NEDEN", "5N1K Analizi" vb. bölümleri görsel olarak ayırır.
 */
export function splitDf8dProblemDescriptionBlocks(text) {
  const t = String(text || '').trim();
  if (!t) return [];

  const anchor =
    /(?=\s+(?:\d+\.\s*(?:KÖK\s*NEDEN|İLERLEME\s*NOTLARI?|PROBLEM\s*TANIMI?|İLGİLİ)[^\n]{0,160}|5\s*N1K\s+Analizi|5\s*Neden\s+Analizi))/gi;

  const rawParts = t.split(anchor).map((x) => x.trim()).filter(Boolean);
  if (rawParts.length <= 1) {
    return [{ title: null, body: stripSquareBullets(t) }];
  }

  return rawParts.map((chunk, idx) => {
    if (idx === 0) {
      return { title: null, body: stripSquareBullets(chunk) };
    }
    const lines = chunk.split(/\n/);
    let head = lines[0].replace(/\s+/g, ' ').trim();
    let restLines = lines.slice(1);

    const uyGlue = head.match(/^(İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI)\s+(.+)$/i);
    if (uyGlue && /\bUYG-\d{2}-\d+/i.test(uyGlue[2])) {
      head = uyGlue[1];
      restLines = [uyGlue[2].trim(), ...restLines];
    }

    const looksLikeTitle =
      /^\d+\.\s/.test(head) ||
      /^5\s*N1K\s+Analizi/i.test(head) ||
      /^5\s*Neden\s+Analizi/i.test(head) ||
      isIlgiliUygunlukTitle(head);
    const title = looksLikeTitle ? head : `Ek metin ${idx}`;
    const bodyRest = looksLikeTitle ? restLines.join('\n').trim() : chunk;
    return { title, body: stripSquareBullets(bodyRest) };
  });
}

export function Df8dProblemDescriptionSections({ text, className = '' }) {
  const blocks = useMemo(() => splitDf8dProblemDescriptionBlocks(text), [text]);

  if (!blocks.length) {
    return <p className={`text-sm text-muted-foreground ${className}`}>Açıklama girilmemiş.</p>;
  }

  if (blocks.length === 1 && !blocks[0].title) {
    const sole = blocks[0].body;
    if (/İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI/.test(sole) && UYG_ROW_REF.test(sole)) {
      const parts = sole.split(/(?=İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI)/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const preamble = parts[0];
        const uyPart = parts.slice(1).join('\n\n').trim();
        return (
          <div className={`space-y-3 ${className}`}>
            {preamble ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words [text-wrap:pretty]">
                {preamble}
              </p>
            ) : null}
            <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2 border-b border-border/50 pb-1.5">
                İlgili uygunsuzluk kayıtları
              </h4>
              <RelatedNonconformityRecordsTable bodyText={normalizeIlgiliUyBodyForTable(uyPart)} />
            </div>
          </div>
        );
      }
    }
    return (
      <p
        className={`text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words [text-wrap:pretty] ${className}`}
      >
        {blocks[0].body}
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((b, i) => (
        <div
          key={`${b.title || 'p'}-${i}`}
          className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3 shadow-sm"
        >
          {b.title ? (
            <h4 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2 border-b border-border/50 pb-1.5">
              {b.title}
            </h4>
          ) : (
            <p className="text-xs font-medium text-muted-foreground mb-2">Problem tanımı</p>
          )}
          {isIlgiliUygunlukTitle(b.title) ? (
            <RelatedNonconformityRecordsTable bodyText={normalizeIlgiliUyBodyForTable(b.body)} />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words [text-wrap:pretty]">
              {b.body || '—'}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default Df8dProblemDescriptionSections;
