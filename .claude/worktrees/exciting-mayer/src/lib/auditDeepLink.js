/**
 * Denetim kaydından ilgili iş kaydına gitmek için hedef üretir.
 */

const pickRow = (details) => {
  if (!details || typeof details !== 'object') return null;
  if (details.new && typeof details.new === 'object') return details.new;
  if (details.old && typeof details.old === 'object') return details.old;
  if (details.id) return details;
  return null;
};

/**
 * @returns {{ kind: 'navigate', module: string, query: Record<string,string> } | { kind: 'openNcView', recordId: string } | { kind: 'none', reason?: string }}
 */
export function getAuditNavigationAction(log) {
  if (!log?.table_name) return { kind: 'none', reason: 'no_table' };

  const table = String(log.table_name).toLowerCase();
  const details = log.details;
  const row = pickRow(details);

  if (table === 'vehicle_timeline_events') {
    const inspectionId =
      row?.inspection_id ||
      details?.new?.inspection_id ||
      details?.old?.inspection_id;
    if (inspectionId) {
      return {
        kind: 'navigate',
        module: 'produced-vehicles',
        query: { openInspection: String(inspectionId), detailTab: 'history' },
      };
    }
    return { kind: 'none', reason: 'missing_inspection_id' };
  }

  if (table === 'quality_inspections') {
    const id = row?.id || details?.new?.id || details?.old?.id;
    if (id) {
      return {
        kind: 'navigate',
        module: 'produced-vehicles',
        query: { openInspection: String(id), detailTab: 'details' },
      };
    }
    return { kind: 'none', reason: 'missing_id' };
  }

  if (table === 'quality_inspection_history') {
    const inspectionId = row?.inspection_id || details?.new?.inspection_id || details?.old?.inspection_id;
    if (inspectionId) {
      return {
        kind: 'navigate',
        module: 'produced-vehicles',
        query: { openInspection: String(inspectionId), detailTab: 'details' },
      };
    }
    return { kind: 'none', reason: 'missing_inspection_id' };
  }

  if (table === 'quality_inspection_faults') {
    const inspectionId = row?.inspection_id || details?.new?.inspection_id || details?.old?.inspection_id;
    if (inspectionId) {
      return {
        kind: 'navigate',
        module: 'produced-vehicles',
        query: { openInspection: String(inspectionId), detailTab: 'details' },
      };
    }
    return { kind: 'none', reason: 'missing_inspection_id' };
  }

  if (table === 'non_conformities') {
    const id = row?.id || details?.new?.id || details?.old?.id;
    if (id) return { kind: 'openNcView', recordId: String(id) };
    return { kind: 'none', reason: 'missing_id' };
  }

  return { kind: 'none', reason: 'unsupported_table' };
}

export function hasAuditDeepLink(log) {
  return getAuditNavigationAction(log).kind !== 'none';
}
