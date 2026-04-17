import React, { useMemo } from 'react';
import { stripSquareBullets } from '@/lib/df8dTextUtils';

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
    const head = lines[0].replace(/\s+/g, ' ').trim();
    const looksLikeTitle =
      /^\d+\.\s/.test(head) ||
      /^5\s*N1K\s+Analizi/i.test(head) ||
      /^5\s*Neden\s+Analizi/i.test(head);
    const title = looksLikeTitle ? head : `Ek metin ${idx}`;
    const bodyRest = looksLikeTitle ? lines.slice(1).join('\n').trim() : chunk;
    return { title, body: stripSquareBullets(bodyRest) };
  });
}

export function Df8dProblemDescriptionSections({ text, className = '' }) {
  const blocks = useMemo(() => splitDf8dProblemDescriptionBlocks(text), [text]);

  if (!blocks.length) {
    return <p className={`text-sm text-muted-foreground ${className}`}>Açıklama girilmemiş.</p>;
  }

  if (blocks.length === 1 && !blocks[0].title) {
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words [text-wrap:pretty]">
            {b.body || '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

export default Df8dProblemDescriptionSections;
