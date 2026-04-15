/**
 * FMEA 5T alanları: önceden tanımlı seçenek + detay metni.
 * Eski kayıtlar: düz string (sadece detay olarak kabul edilir).
 */

export const FIVE_T_KEYS = ['intent', 'timing', 'team', 'tasks', 'tools'];

export const FIVE_T_LABELS = {
  intent: 'Amaç — Bu FMEA neden yapılıyor?',
  timing: 'Zamanlama — Ne zaman, hangi kilometre taşları?',
  team: 'Ekip — Roller ve katılım',
  tasks: 'Kapsam — Dahil / hariç sınırlar',
  tools: 'Araçlar — Referans doküman ve standartlar',
};

/** PDF tablosu ilk sütun (kısa) */
export const FIVE_T_PDF_LABELS = {
  intent: 'Amaç',
  timing: 'Zamanlama',
  team: 'Ekip',
  tasks: 'Kapsam',
  tools: 'Araçlar',
};

export const FIVE_T_OPTIONS = {
  intent: [
    { value: '', label: 'Seçiniz…' },
    { value: 'validation', label: 'Yeni ürün veya proses validasyonu' },
    { value: 'customer', label: 'Müşteri / OEM talebi veya şartnamesi' },
    { value: 'risk', label: 'Risk azaltma veya öncelikli iyileştirme' },
    { value: 'line', label: 'Yeni hat, transfer veya hat değişikliği' },
    { value: 'audit', label: 'İç / dış tetkik veya denetim bulgusu' },
    { value: 'complaint', label: 'Şikâyet veya saha geri bildirimi' },
    { value: 'other', label: 'Diğer (detayı aşağıya yazın)' },
  ],
  timing: [
    { value: '', label: 'Seçiniz…' },
    { value: 'pre_proto', label: 'Prototip / off-tool öncesi' },
    { value: 'pre_sop', label: 'Seri üretim (SOP) öncesi — PAPP' },
    { value: 'annual', label: 'Periyodik revizyon (ör. yıllık)' },
    { value: 'ecr', label: 'Mühendislik değişikliği (ECR / değişiklik yönetimi)' },
    { value: '4m', label: '4M değişikliği sonrası' },
    { value: 'other', label: 'Diğer (detayı aşağıya yazın)' },
  ],
  team: [
    { value: '', label: 'Seçiniz…' },
    { value: 'core', label: 'Çekirdek FMEA ekibi atandı' },
    { value: 'cross', label: 'Çok disiplinli ekip (üretim, kalite, bakım…)' },
    { value: 'mgmt', label: 'Yönetim temsilcisi / proses sahibi dahil' },
    { value: 'supplier', label: 'Tedarikçi veya uzman dahil' },
    { value: 'customer_rep', label: 'Müşteri temsilcisi / birlikte çalışma' },
    { value: 'other', label: 'Diğer (detayı aşağıya yazın)' },
  ],
  tasks: [
    { value: '', label: 'Seçiniz…' },
    { value: 'internal_only', label: 'Yalnızca dahili prosesler' },
    { value: 'subassy', label: 'Alt montaj ve seçilen tedarikçi prosesleri' },
    { value: 'full_value', label: 'Tüm değer akışı (mümkün olan kapsam)' },
    { value: 'exclude_supplier', label: 'Tedarikçi prosesleri bu analizde hariç' },
    { value: 'customer_scope', label: 'Müşteri tarafından tanımlı sınır' },
    { value: 'other', label: 'Diğer (detayı aşağıya yazın)' },
  ],
  tools: [
    { value: '', label: 'Seçiniz…' },
    { value: 'aiag_vda', label: 'AIAG-VDA FMEA El Kitabı' },
    { value: 'customer_spec', label: 'Müşteri özel şartnamesi / güvenlik notları' },
    { value: 'cp_ref', label: 'Kontrol planı veya ölçüm sistemi referansı' },
    { value: 'past_fmea', label: 'Önceki FMEA / lessons learned' },
    { value: 'spc_msa', label: 'SPC / MSA veya kapabilite verisi' },
    { value: 'other', label: 'Diğer (detayı aşağıya yazın)' },
  ],
};

/** Eski string veya { preset, detail } → normalize */
export function normalizeFiveTopicField(raw) {
  if (raw == null || raw === '') return { preset: '', detail: '' };
  if (typeof raw === 'string') {
    return { preset: raw.trim() ? 'other' : '', detail: raw };
  }
  if (typeof raw === 'object') {
    return {
      preset: raw.preset != null ? String(raw.preset) : '',
      detail: raw.detail != null ? String(raw.detail) : '',
    };
  }
  return { preset: '', detail: '' };
}

export function normalizeFiveTopicsObject(raw) {
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  const out = {};
  FIVE_T_KEYS.forEach((k) => {
    out[k] = normalizeFiveTopicField(base[k]);
  });
  return out;
}

/** PDF / özet metin */
export function formatFiveTopicForPdf(ft, key) {
  const { preset, detail } = normalizeFiveTopicField(ft?.[key]);
  const opts = FIVE_T_OPTIONS[key] || [];
  const optLabel = opts.find((o) => o.value === preset)?.label;
  const head = preset && optLabel && preset !== '' ? optLabel : preset && !optLabel ? preset : '';
  const parts = [];
  if (head) parts.push(head);
  if (detail && detail.trim()) parts.push(detail.trim());
  return parts.join('\n\n');
}
