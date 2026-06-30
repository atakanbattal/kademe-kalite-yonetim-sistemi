import { STEP_TYPE_CLASS, STEP_TYPE_ICON, formatDocumentChip } from './processFlowConstants';

const IDEAL_FLAG_TEXT =
    'Bu birim için süreç prosedürü ayrıca dokümante edilmemiştir; aşağıdaki akış, mevcut görev tanımı/talimat/formlar ile ISO 9001 esas alınarak olması gereken (ideal) süreç olarak tasarlanmıştır.';

const PRINT_STYLES = `
:root {
  --pfd-brand: #0b4f8a;
  --pfd-brand2: #1577c2;
  --pfd-accent: #e8821e;
  --pfd-start: #1f9d6b;
  --pfd-end: #334155;
  --pfd-proc: #1577c2;
  --pfd-sub: #0f8f9e;
  --pfd-io: #7a52c7;
  --pfd-dec: #e8821e;
  --pfd-yes: #1f9d6b;
  --pfd-no: #d24b54;
  --pfd-chipbg: #eef4fb;
  --pfd-chipbd: #cfe0f3;
  --pfd-line: #dfe6ef;
  --pfd-muted: #5b6b82;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  color: #1e293b;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.print-doc { max-width: 900px; margin: 0 auto; padding: 24px 28px 40px; }
.print-header {
  border-bottom: 2px solid var(--pfd-brand2);
  padding-bottom: 14px;
  margin-bottom: 20px;
}
.print-header h1 { margin: 0 0 4px; font-size: 18px; color: var(--pfd-brand); }
.print-header p { margin: 0; font-size: 12px; color: var(--pfd-muted); line-height: 1.45; }
.print-meta { font-size: 11px; color: var(--pfd-muted); margin-top: 8px; }
.pfd-dept-banner {
  border-left: 6px solid var(--pfd-brand2);
  background: linear-gradient(90deg, #f3f8fd, #fff);
  padding: 14px 18px;
  border-radius: 0 12px 12px 0;
  margin-bottom: 16px;
}
.pfd-dept-code { font-size: 11px; font-weight: 800; color: var(--pfd-brand2); letter-spacing: 1px; }
.pfd-dept-banner h2 { margin: 2px 0 4px; font-size: 20px; color: var(--pfd-brand); }
.pfd-dept-sub { margin: 0; color: var(--pfd-muted); font-size: 13px; line-height: 1.5; }
.pfd-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.pfd-meta-card {
  background: #fff;
  border: 1px solid var(--pfd-line);
  border-radius: 10px;
  padding: 12px 14px;
}
.pfd-meta-card h4 {
  margin: 0 0 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--pfd-brand2);
}
.pfd-meta-card p { margin: 0; font-size: 13px; line-height: 1.45; }
.pfd-meta-card.amac { background: #fbf6ee; border-color: #f0e0c6; }
.pfd-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pfd-chip {
  font-size: 10.5px;
  font-weight: 700;
  background: var(--pfd-chipbg);
  color: var(--pfd-brand);
  border: 1px solid var(--pfd-chipbd);
  border-radius: 6px;
  padding: 3px 7px;
}
.pfd-ideal-flag {
  background: #fff7ed;
  border: 1px solid #f3d9b5;
  color: #8a5a16;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 12.5px;
  line-height: 1.5;
  margin-bottom: 12px;
}
.pfd-flow {
  background: #fff;
  border: 1px solid var(--pfd-line);
  border-radius: 14px;
  padding: 18px 20px 22px;
  margin: 16px 0;
  break-inside: avoid;
  page-break-inside: avoid;
}
.pfd-flow-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: 1px dashed var(--pfd-line);
  padding-bottom: 10px;
  margin-bottom: 8px;
}
.pfd-flow-head h3 { margin: 0; font-size: 16px; color: var(--pfd-brand); }
.pfd-flow-intro { font-size: 12.5px; color: var(--pfd-muted); line-height: 1.55; margin: 0 0 8px; }
.pfd-chart { display: flex; flex-direction: column; align-items: center; }
.pfd-node {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: min(640px, 100%);
  background: #f8fbfe;
  border: 1.5px solid var(--pfd-proc);
  border-left-width: 6px;
  border-radius: 11px;
  padding: 11px 14px;
}
.pfd-node.n-start { border-color: var(--pfd-start); background: #eefaf4; }
.pfd-node.n-end { border-color: var(--pfd-end); background: #eef1f6; }
.pfd-node.n-sub { border-color: var(--pfd-sub); background: #ecfbfc; border-style: double; border-left-style: solid; }
.pfd-node.n-io { border-color: var(--pfd-io); background: #f4effc; }
.pfd-node-text { font-size: 13px; font-weight: 600; line-height: 1.5; }
.pfd-role {
  display: inline-block;
  margin-top: 6px;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  background: var(--pfd-muted);
  padding: 2px 8px;
  border-radius: 20px;
}
.pfd-arrow {
  width: 2px;
  height: 20px;
  background: #9db6d0;
  position: relative;
  margin: 2px 0;
}
.pfd-arrow:after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #7f97b3;
}
.pfd-decision { width: min(640px, 100%); }
.pfd-diamond {
  background: linear-gradient(90deg, #fff3e2, #fff9f3);
  border: 2px solid var(--pfd-dec);
  border-radius: 12px;
  padding: 12px 14px;
}
.pfd-dq { font-size: 13px; font-weight: 700; color: #8a5a16; line-height: 1.45; }
.pfd-branches { display: flex; gap: 10px; margin-top: 8px; }
.pfd-branch {
  flex: 1;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 12px;
  line-height: 1.45;
  border: 1.5px solid;
}
.pfd-branch.yes { background: #eefaf4; border-color: var(--pfd-yes); color: #16623f; }
.pfd-branch.no { background: #fdeef0; border-color: var(--pfd-no); color: #8a2a30; }
.pfd-note {
  width: min(640px, 100%);
  background: #eef4fb;
  border: 1px dashed var(--pfd-brand2);
  color: #33536f;
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 12px;
  line-height: 1.5;
}
@media print {
  body { background: #fff; }
  .print-doc { padding: 0; max-width: 100%; }
  .pfd-flow { box-shadow: none; }
}
`;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderDocumentsHtml(documents) {
    if (!documents?.length) return '';
    const chips = documents
        .map((doc) => `<span class="pfd-chip">${escapeHtml(formatDocumentChip(doc))}</span>`)
        .join('');
    return `<div class="pfd-chips">${chips}</div>`;
}

export function renderStepToHtml(step) {
    if (step.step_type === 'decision') {
        return `
<div class="pfd-decision">
  <div class="pfd-diamond">
    <div class="pfd-dq">${escapeHtml(step.decision_question || step.text)}</div>
    ${step.role ? `<span class="pfd-role">${escapeHtml(step.role)}</span>` : ''}
  </div>
  <div class="pfd-branches">
    <div class="pfd-branch yes"><strong>✔ Evet</strong> ${escapeHtml(step.decision_yes_text || '')}</div>
    <div class="pfd-branch no"><strong>✘ Hayır</strong> ${escapeHtml(step.decision_no_text || '')}</div>
  </div>
</div>`;
    }

    if (step.step_type === 'note') {
        return `<div class="pfd-note">${escapeHtml(step.text)}</div>`;
    }

    const cls = STEP_TYPE_CLASS[step.step_type] || 'n-proc';
    const icon = STEP_TYPE_ICON[step.step_type] || '▭';
    return `
<div class="pfd-node ${cls}">
  <span>${icon}</span>
  <div style="flex:1">
    <div class="pfd-node-text">${escapeHtml(step.text)}</div>
    ${step.role ? `<span class="pfd-role">${escapeHtml(step.role)}</span>` : ''}
    ${renderDocumentsHtml(step.documents)}
  </div>
</div>`;
}

export function renderFlowToHtml(flow) {
    const stepsHtml = (flow.steps || [])
        .map((step, idx) => {
            const arrow = idx < flow.steps.length - 1 && step.step_type !== 'note'
                ? '<div class="pfd-arrow"></div>'
                : '';
            return `${renderStepToHtml(step)}${arrow}`;
        })
        .join('');

    const headerDocs = flow.header_document_codes?.length
        ? `<div class="pfd-chips">${flow.header_document_codes.map((code) => `<span class="pfd-chip">${escapeHtml(code)}</span>`).join('')}</div>`
        : '';

    return `
<section class="pfd-flow">
  <div class="pfd-flow-head">
    <h3>${escapeHtml(flow.title)}</h3>
    ${headerDocs}
  </div>
  ${flow.intro ? `<p class="pfd-flow-intro">${escapeHtml(flow.intro)}</p>` : ''}
  <div class="pfd-chart">${stepsHtml}</div>
</section>`;
}

function renderUnitContextHtml(unit, { includeMeta = true } = {}) {
    if (!includeMeta) return '';

    const keyDocs = unit.key_document_codes?.length
        ? `<div class="pfd-meta-card" style="margin-bottom:12px">
            <h4>Bağlı Ana Dokümanlar</h4>
            <div class="pfd-chips">${unit.key_document_codes.map((code) => `<span class="pfd-chip">${escapeHtml(code)}</span>`).join('')}</div>
          </div>`
        : '';

    const ideal = unit.is_ideal_process
        ? `<div class="pfd-ideal-flag">⚙ ${escapeHtml(IDEAL_FLAG_TEXT)}</div>`
        : '';

    return `
<div class="pfd-dept-banner">
  <div class="pfd-dept-code">${escapeHtml(unit.code)}</div>
  <h2>${escapeHtml(unit.name)}</h2>
  ${unit.subtitle ? `<p class="pfd-dept-sub">${escapeHtml(unit.subtitle)}</p>` : ''}
</div>
<div class="pfd-meta-grid">
  <div class="pfd-meta-card"><h4>Süreç Sahibi</h4><p>${escapeHtml(unit.owner_role || '—')}</p></div>
  <div class="pfd-meta-card"><h4>Temel Roller</h4><p>${escapeHtml(unit.roles || '—')}</p></div>
  <div class="pfd-meta-card amac"><h4>Amaç</h4><p>${escapeHtml(unit.purpose || '—')}</p></div>
</div>
${keyDocs}
${ideal}`;
}

export function buildProcessFlowPrintHtml({ unit, flows, includeMeta = true }) {
    const now = new Date().toLocaleString('tr-TR');
    const flowTitles = flows.map((f) => f.title).join(', ');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(unit.name)} — ${escapeHtml(flowTitles)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="print-doc">
    <header class="print-header">
      <h1>Kademe Atık Teknolojileri A.Ş.</h1>
      <p>Entegre Yönetim Sistemi — Birim Süreç Akış Şeması</p>
      <div class="print-meta">${escapeHtml(unit.code)} · ${escapeHtml(unit.name)} · ${escapeHtml(now)}</div>
    </header>
    ${renderUnitContextHtml(unit, { includeMeta })}
    ${flows.map((flow) => renderFlowToHtml(flow)).join('')}
  </div>
</body>
</html>`;
}

export function printProcessFlowDocument({ unit, flowIds, includeMeta = true }) {
    const selected = flowIds?.length
        ? unit.flows.filter((f) => flowIds.includes(f.id))
        : unit.flows;

    if (!selected.length) {
        throw new Error('Yazdırılacak süreç seçilmedi.');
    }

    const html = buildProcessFlowPrintHtml({ unit, flows: selected, includeMeta });

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    Object.assign(iframe.style, {
        position: 'fixed',
        width: '0',
        height: '0',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
    });

    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) {
        iframe.remove();
        throw new Error('Yazdırma alanı oluşturulamadı.');
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => {
        win.onafterprint = null;
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const triggerPrint = () => {
        try {
            win.focus();
            win.print();
        } catch {
            cleanup();
            throw new Error('Yazdırma başlatılamadı.');
        }
    };

    setTimeout(() => {
        triggerPrint();
        win.onafterprint = cleanup;
        setTimeout(cleanup, 60_000);
    }, 250);
}

/** @deprecated use printProcessFlowDocument */
export function openProcessFlowPrintWindow(options) {
    return printProcessFlowDocument(options);
}
