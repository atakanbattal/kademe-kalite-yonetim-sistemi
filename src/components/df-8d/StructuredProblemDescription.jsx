import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { stripSquareBullets } from '@/lib/df8dTextUtils';
import RelatedNonconformityRecordsTable from '@/components/df-8d/RelatedNonconformityRecordsTable';

/** Bilinen bölüm başlıkları (satır tam eşleşmesi, tr-TR küçük harf) */
const SECTION_HEADERS = [
  // Grup DF/8D dönüşümü
  'GRUP ÖZETİ',
  'ETKİLENEN BİRİMLER',
  'ETKİLENEN ARAÇ TİPLERİ',
  'İLGİLİ UYGUNSUZLUK KAYITLARI',
  'EN SIK TEKRARLAYAN HATALAR',
  'ALINAN ACİL AKSİYONLAR',
  'KAYIT DETAYLARI',
  // Maliyet / süre
  'MALIYET KAYDI DETAYLARI',
  'MALİYET BİLGİLERİ',
  'SÜRE BİLGİLERİ',
  'AÇIKLAMA',
  // Tekil UYG → DF/8D
  'KAYNAK BİLGİSİ',
  'ÜRÜN / PARÇA BİLGİSİ',
  'UYGUNSUZLUK DETAYI',
  'TEKRAR ANALİZİ',
  'ALINAN ACİL AKSİYON',
  'EK NOTLAR',
  // Girdi kalite kontrolü (GKK)
  'MUAYENE BİLGİLERİ',
  'ÖLÇÜM SONUÇLARI VE TESPİTLER',
  'UYGUNSUZ BULUNAN ÖLÇÜMLER',
  'UYGUN BULUNAN ÖLÇÜMLER',
  'ÖZET BİLGİLER',
  'KARAR',
  // Genel
  'TEKRAR ANALİZİ',
  'KAYIT BİLGİLERİ',
];

const headerKey = (s) => s.replace(/^■\s*/, '').trim().toLocaleLowerCase('tr-TR');

const HEADER_SET = new Set(SECTION_HEADERS.map((h) => h.toLocaleLowerCase('tr-TR')));

function isSectionHeaderLine(line) {
  const k = headerKey(line);
  return HEADER_SET.has(k);
}

/** «İLGİLİ UYGUNSUZLUK KAYITLARI UYG-26-…» tek satırda yapışık ise başlık + ilk veri satırına böler */
function expandGluedUyHeaderLine(line) {
  const trimmed = line.trim();
  const m = trimmed.match(/^(■\s*)?(İLGİLİ\s+UYGUNSUZLUK\s+KAYITLARI)\s+(.+)$/i);
  if (m && /\bUYG-\d{2}-\d+/i.test(m[3])) {
    const prefix = m[1] || '';
    return [`${prefix}${m[2]}`, m[3]];
  }
  return [line];
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
  const lines = normalized.split('\n').flatMap((line) => expandGluedUyHeaderLine(line));
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

  if (
    t.includes('■') &&
    (t.includes('Kategori') || t.includes('GRUP') || /\n\s*■/.test(t) || t.length > 160)
  ) {
    return true;
  }

  // Tekil UYG → DF/8D formatı (KAYNAK BİLGİSİ gibi başlıklar varsa)
  if (
    /^KAYNAK\s+BİLGİSİ|^ÜRÜN\s*\/\s*PARÇA\s+BİLGİSİ|^MUAYENE\s+BİLGİLERİ/m.test(t) &&
    t.includes('\n')
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
    return <RelatedNonconformityRecordsTable bodyText={lines.join('\n')} />;
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
