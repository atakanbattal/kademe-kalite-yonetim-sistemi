#!/usr/bin/env node
/**
 * Parses public/docs/Kademe_Birim_Surec_Akis_Semalari.html into process-flow-seed.json
 * Usage: node scripts/parse-process-flow-html.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'public/docs/Kademe_Birim_Surec_Akis_Semalari.html');
const outPath = path.join(__dirname, 'process-flow-seed.json');

function norm(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function chipTexts($, $scope) {
  const codes = [];
  $scope.find('.chips .chip, > .chips .chip').each((_, el) => {
    const t = norm($(el).text());
    if (t) codes.push(t);
  });
  if (codes.length === 0) {
    $scope.find('.chip').each((_, el) => {
      const t = norm($(el).text());
      if (t) codes.push(t);
    });
  }
  return codes;
}

function metaCardText($, $dept, labelRe) {
  let value = '';
  $dept.find('.meta-grid .meta-card').each((_, card) => {
    const heading = norm($(card).find('h4').first().text());
    if (labelRe.test(heading)) {
      value = norm($(card).find('p').first().text());
    }
  });
  return value;
}

function branchText($, $branch) {
  const clone = $branch.clone();
  clone.find('.bl').remove();
  return norm(clone.text());
}

function nodeStepType(classAttr) {
  const classes = new Set((classAttr || '').split(/\s+/).filter(Boolean));
  if (classes.has('n-start')) return 'start';
  if (classes.has('n-sub')) return 'subprocess';
  if (classes.has('n-io')) return 'io';
  if (classes.has('n-end')) return 'end';
  if (classes.has('n-proc')) return 'process';
  return 'process';
}

function parseStep($, el, sortOrder) {
  const $el = $(el);
  const classAttr = $el.attr('class') || '';

  if (classAttr.split(/\s+/).includes('fl-arrow')) {
    return null;
  }

  if ($el.hasClass('fl-note')) {
    return {
      step_type: 'note',
      text: norm($el.text()),
      role: '',
      document_codes: [],
      decision_question: '',
      decision_yes_text: '',
      decision_no_text: '',
      sort_order: sortOrder,
    };
  }

  if ($el.hasClass('fl-decision')) {
    const question = norm($el.find('.dq').first().text());
    return {
      step_type: 'decision',
      text: question,
      role: norm($el.find('.diamond-in .role').first().text()),
      document_codes: [],
      decision_question: question,
      decision_yes_text: branchText($, $el.find('.branch.yes').first()),
      decision_no_text: branchText($, $el.find('.branch.no').first()),
      sort_order: sortOrder,
    };
  }

  if ($el.hasClass('fl-node')) {
    const $body = $el.find('.n-body').first();
    return {
      step_type: nodeStepType(classAttr),
      text: norm($body.find('.n-text').first().text()),
      role: norm($body.find('.role').first().text()),
      document_codes: chipTexts($, $body),
      decision_question: '',
      decision_yes_text: '',
      decision_no_text: '',
      sort_order: sortOrder,
    };
  }

  return null;
}

function parseFlow($, flowEl, sortOrder) {
  const $flow = $(flowEl);
  const $head = $flow.find('.flow-head').first();
  const title = norm($head.find('h3').first().text());
  const intro = norm($flow.find('.flow-intro').first().text());
  const header_document_codes = chipTexts($, $head);

  const steps = [];
  let stepOrder = 0;
  $flow.find('.fl-chart').first().children().each((_, child) => {
    const step = parseStep($, child, stepOrder);
    if (step) {
      steps.push(step);
      stepOrder += 1;
    }
  });

  return {
    title,
    intro,
    header_document_codes,
    sort_order: sortOrder,
    steps,
  };
}

function main() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: true });

  const units = [];
  let unitOrder = 0;

  $('section.dept').each((_, deptEl) => {
    const $dept = $(deptEl);
    const slug = norm($dept.attr('id'));
    const code = norm($dept.find('.dept-code').first().text());
    const name = norm($dept.find('.dept-banner h2').first().text());
    const subtitle = norm($dept.find('.dept-sub').first().text());

    const owner_role = metaCardText($, $dept, /^(Süreç|Sürec|Surec)\s+Sahibi$/i);
    const roles = metaCardText($, $dept, /^Temel Roller$/i);
    const purpose =
      norm($dept.find('.meta-card.amac p').first().text()) ||
      metaCardText($, $dept, /^Amaç$/i);

    const is_ideal_process = $dept.find('.ideal-flag').length > 0;
    const key_document_codes = chipTexts($, $dept.find('.keydocs').first());

    const flows = [];
    let flowOrder = 0;
    $dept.children('.flow').each((_, flowEl) => {
      flows.push(parseFlow($, flowEl, flowOrder));
      flowOrder += 1;
    });

    units.push({
      code,
      slug,
      name,
      subtitle,
      owner_role,
      roles,
      purpose,
      is_ideal_process,
      sort_order: unitOrder,
      key_document_codes,
      flows,
    });
    unitOrder += 1;
  });

  const output = { units };
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const flowCount = units.reduce((n, u) => n + u.flows.length, 0);
  const stepCount = units.reduce(
    (n, u) => n + u.flows.reduce((m, f) => m + f.steps.length, 0),
    0,
  );
  const idealCount = units.filter((u) => u.is_ideal_process).length;

  console.log(`Wrote ${outPath}`);
  console.log(`Units: ${units.length}`);
  console.log(`Flows: ${flowCount}`);
  console.log(`Steps: ${stepCount}`);
  console.log(`Ideal-process units: ${idealCount}`);
}

main();
