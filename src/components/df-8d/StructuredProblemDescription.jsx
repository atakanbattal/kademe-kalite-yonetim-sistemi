import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { stripSquareBullets } from '@/lib/df8dTextUtils';

/** Bilinen bölüm başlıkları (satır tam eşleşmesi, tr-TR küçük harf) */
const SECTION_HEADERS = [
  'GRUP ÖZETİ',
  'ETKİLENEN BİRİMLER',
  'ETKİLENEN ARAÇ TİPLERİ',
  'İLGİLİ UYGUNSUZLUK KAYITLARI',
  'MALIYET KAYDI DETAYLARI',
  'MALİYET BİLGİLERİ',
  'SÜRE BİLGİLERİ',
  'AÇIKLAMA',
];

const headerKey = (s) => s.replace(/^■\s*/, '').trim().toLocaleLowerCase('tr-TR');

const HEADER_SET = new Set(SECTION_HEADERS.map((h) => h.toLocaleLowerCase('tr-TR')));

function isSectionHeaderLine(line) {
  const k = headerKey(line);
  return HEADER_SET.has(k);
}

/** Metindeki ■ ayraçlarını satır sonlarına çevir; başlık satırlarını ayıkla */
function normalizeBulletSections(text) {
  if (!text) return '';
  return stripSquareBullets(text)
    .replace(/\r\n/g, '\n')
    .replace(/^■\s*/gm, '')
    .replace(/\n\s*■\s*/g, '\n')
    .trim();
}

/**
 * Başlık satırlarına göre bölümlere ayırır (önsöz + { title, bodyLines }[] )
 */
function parseIntoSections(text) {
  const normalized = normalizeBulletSections(text);
  const lines = normalized.split('\n');
  const sections = [];
  let preamble = [];
  let current = null;

  for (const line of lines) {
    if (isSectionHeaderLine(line)) {
      const title = line.replace(/^■\s*/, '').trim();
      if (current) sections.push(current);
      current = { title, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);

  return {
    preamble: preamble.join('\n').trim(),
    sections,
  };
}

export function looksLikeStructuredProblemDescription(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 12) return false;

  // Eski: ■ ile işaretli uzun şablonlar
  if (
    t.includes('■') &&
    (t.includes('Kategori') || t.includes('GRUP') || /\n\s*■/.test(t) || t.length > 160)
  ) {
    return true;
  }

  const { sections } = parseIntoSections(t);
  if (sections.length >= 1) return true;
  return false;
}

const UYGUNLUK_HEADER_TR = 'İLGİLİ UYGUNSUZLUK KAYITLARI'.toLocaleLowerCase('tr-TR');

function SectionBody({ title, bodyText }) {
  const titleKey = title.toLocaleLowerCase('tr-TR');
  const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);

  if (titleKey === UYGUNLUK_HEADER_TR) {
    return (
      <ul className="m-0 list-none space-y-1.5 p-0 pl-0">
        {lines.map((line, i) => (
          <li key={i} className="break-words pl-0 text-sm leading-relaxed">
            {line.trim()}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed [text-wrap:pretty]">
      {bodyText.trim() || '—'}
    </div>
  );
}

/**
 * Problem tanımı: bölüm başlıkları kalın şerit, gövde sans-serif, UYG satırları liste.
 */
export function StructuredProblemDescription({ text }) {
  const { preamble, sections } = useMemo(() => parseIntoSections(text), [text]);

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/25 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground [text-wrap:pretty]">
        {normalizeBulletSections(text)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {preamble ? (
        <div className="rounded-xl border bg-muted/25 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground [text-wrap:pretty]">
          {preamble}
        </div>
      ) : null}

      {sections.map((sec, idx) => (
        <div
          key={`${sec.title}-${idx}`}
          className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-border/60 bg-primary/[0.07] px-4 py-2.5">
            <Layers className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-semibold tracking-tight text-foreground">{sec.title}</span>
          </div>
          <div className="min-w-0 max-w-full px-4 py-3 font-sans text-foreground/95">
            <SectionBody title={sec.title} bodyText={sec.lines.join('\n')} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default StructuredProblemDescription;
