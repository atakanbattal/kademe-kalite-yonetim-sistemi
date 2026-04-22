const NONCONFORMITY_RECORD_NUMBER_REGEX = /UYG-(\d{2})-(\d+)/i;

export const formatNonconformityRecordNumber = (yearPart, sequence) => (
  `UYG-${yearPart}-${String(sequence).padStart(4, '0')}`
);

export const extractNonconformityRecordYear = (recordOrNumber, fallbackDate = null) => {
  const recordNumber = typeof recordOrNumber === 'string'
    ? recordOrNumber
    : recordOrNumber?.record_number;

  const match = String(recordNumber || '').match(NONCONFORMITY_RECORD_NUMBER_REGEX);
  if (match?.[1]) {
    return match[1];
  }

  const candidateDate = fallbackDate
    || (typeof recordOrNumber === 'object'
      ? recordOrNumber?.created_at || recordOrNumber?.detection_date
      : null);

  const parsedDate = candidateDate ? new Date(candidateDate) : new Date();
  if (!Number.isNaN(parsedDate.getTime())) {
    return String(parsedDate.getFullYear()).slice(-2);
  }

  return String(new Date().getFullYear()).slice(-2);
};

export const buildNonconformityDisplayNumberMap = (records = []) => {
  const countersByYear = new Map();
  const displayNumberMap = new Map();

  const orderedRecords = [...records].sort((left, right) => {
    const leftYear = extractNonconformityRecordYear(left);
    const rightYear = extractNonconformityRecordYear(right);
    if (leftYear !== rightYear) {
      return leftYear.localeCompare(rightYear, 'tr');
    }

    const leftTime = new Date(left?.created_at || left?.detection_date || 0).getTime();
    const rightTime = new Date(right?.created_at || right?.detection_date || 0).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left?.id || '').localeCompare(String(right?.id || ''), 'tr');
  });

  orderedRecords.forEach((record) => {
    if (!record?.id) return;

    const yearPart = extractNonconformityRecordYear(record);
    const nextSequence = (countersByYear.get(yearPart) || 0) + 1;
    countersByYear.set(yearPart, nextSequence);
    displayNumberMap.set(record.id, formatNonconformityRecordNumber(yearPart, nextSequence));
  });

  return displayNumberMap;
};

export const getNonconformityDisplayRecordNumber = (record, displayNumberMap) => (
  (record?.id && displayNumberMap?.get(record.id))
  || record?.display_record_number
  || record?.record_number
  || '-'
);
