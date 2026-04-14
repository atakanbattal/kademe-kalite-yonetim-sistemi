import React from 'react';
import { stripSquareBullets } from '@/lib/df8dTextUtils';

/**
 * 8D adımı görünümü — metin taşması ve satır sonları için min-w-0 / break-words.
 */
const EightDStepView = ({ stepKey, step }) => {
  if (!step || typeof step !== 'object') {
    return null;
  }

  const dateVal = step.completionDate;
  const dateStr =
    dateVal == null || dateVal === ''
      ? '-'
      : typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)
        ? new Date(dateVal).toLocaleDateString('tr-TR')
        : String(dateVal);

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-r-lg border-l-2 border-primary/50 bg-secondary/30 p-4">
      <h4 className="break-words font-bold text-primary">
        {stepKey}: {stripSquareBullets(step.title || '') || stepKey}
      </h4>
      <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
        <p className="min-w-0 break-words">
          <strong className="text-muted-foreground">Sorumlu:</strong>{' '}
          <span className="whitespace-pre-wrap break-words">
            {stripSquareBullets(step.responsible || '-') || '-'}
          </span>
        </p>
        <p className="min-w-0 break-words">
          <strong className="text-muted-foreground">Tarih:</strong>{' '}
          <span className="tabular-nums">{dateStr}</span>
        </p>
      </div>
      {step.description && (
        <div className="mt-3 min-w-0 rounded-md bg-background/50 p-3 text-sm font-sans leading-relaxed text-foreground">
          <strong className="text-muted-foreground">Açıklama:</strong>
          <div className="mt-1.5 whitespace-pre-wrap break-words [text-wrap:pretty]">
            {step.description ? stripSquareBullets(step.description) : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default EightDStepView;
