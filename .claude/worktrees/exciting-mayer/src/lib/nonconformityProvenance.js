/**
 * Uygunsuzluk kaydının hangi modülden / nasıl oluştuğunu türetir (otomatik senkron veya manuel).
 */

const VEHICLE_AUTO_MARKER = 'Üretilen Araçlar modülünden otomatik';
const PROCESS_AUTO_MARKER = 'proses muayene kaydındaki uygun olmayan ölçümlerden otomatik';
const VEHICLE_PRESERVED_MARKER = 'Kaynak araç hataları silinmiş olsa da';
const PROCESS_PRESERVED_MARKER = 'Kaynak muayene kaydı artık uygunsuz ölçüm içermiyor';
const LEAK_AUTO_MARKER = 'Sızdırmazlık Kontrol modülündeki kaçaklı test';
const LEAK_PRESERVED_MARKER = 'Kaynak sızdırmazlık test kaydı silinmiş';

const pickMatch = (text, regex) => {
  const m = text.match(regex);
  return m ? m[1].trim() : null;
};

const appendSourceStatusRows = (notes, rows) => {
  if (notes.includes(VEHICLE_PRESERVED_MARKER)) {
    rows.push({
      label: 'Kaynak durumu',
      value: 'Kaynak araç hataları kaldırıldı; açılmış DF/8D süreci nedeniyle bu uygunsuzluk kaydı korundu.',
    });
  }
  if (notes.includes(PROCESS_PRESERVED_MARKER)) {
    rows.push({
      label: 'Kaynak durumu',
      value: 'Muayene kaydında uygun olmayan ölçüm kalmadı; açılmış DF/8D süreci nedeniyle kayıt korundu.',
    });
  }
  if (notes.includes(LEAK_PRESERVED_MARKER)) {
    rows.push({
      label: 'Kaynak durumu',
      value: 'Sızdırmazlık test kaydı kaldırıldı veya kabul edildi; açılmış DF/8D süreci nedeniyle uygunsuzluk korundu.',
    });
  }
};

/**
 * @param {Record<string, unknown>} record - nonconformity_records satırı
 * @returns {{
 *   originType: 'produced_vehicle' | 'process_inspection' | 'leak_test' | 'manual',
 *   moduleLabel: string,
 *   summary: string,
 *   rows: { label: string, value: string }[],
 * }}
 */
export function getNonconformityProvenance(record) {
  const notes = String(record?.notes || '');
  const desc = String(record?.description || '');
  const combined = `${notes}\n${desc}`;
  const area = String(record?.detection_area || '').trim();

  /** @type {{ label: string, value: string }[]} */
  const rows = [];

  const isVehicleAuto = area === 'Üretilen Araçlar' || notes.includes(VEHICLE_AUTO_MARKER);
  const isProcessAuto =
    notes.includes(PROCESS_AUTO_MARKER) ||
    (area === 'Proses İçi Kontrol' && /Muayene Kayıt No:/i.test(combined));

  const isLeakAuto =
    notes.includes(LEAK_AUTO_MARKER) ||
    (area === 'Sızdırmazlık Kontrol' && /Sızdırmazlık Kayıt No:/i.test(combined));

  if (isVehicleAuto) {
    rows.push({ label: 'Kaynak modül', value: 'Üretilen Araçlar' });
    rows.push({
      label: 'Oluşturma',
      value: notes.includes(VEHICLE_AUTO_MARKER)
        ? 'Araç hatalarından otomatik toplama (aynı araç + kategori grubu)'
        : 'Tespit alanı: Üretilen Araçlar',
    });
    if (record?.vehicle_identifier) {
      rows.push({ label: 'Araç tanımı (seri / şasi)', value: String(record.vehicle_identifier) });
    }
    if (record?.vehicle_type) {
      rows.push({ label: 'Araç tipi', value: String(record.vehicle_type) });
    }
    rows.push({
      label: 'İlişki',
      value:
        'Üretilen Araçlar modülündeki hata kayıtlarıyla eşleşen gruplar bu uygunsuzlukta birleştirilir; ayrıntılar açıklama ve kategoride yer alır.',
    });
    appendSourceStatusRows(notes, rows);
    return {
      originType: 'produced_vehicle',
      moduleLabel: 'Üretilen Araçlar',
      summary:
        'Bu uygunsuzluk, Üretilen Araçlar modülünde kayıtlı hataların aynı araç ve hata kategorisi için otomatik olarak birleştirilmesiyle oluşur.',
      rows,
    };
  }

  if (isLeakAuto) {
    rows.push({ label: 'Kaynak modül', value: 'Sızdırmazlık Kontrol' });
    if (record?.part_code) {
      rows.push({ label: 'Parça kodu', value: String(record.part_code) });
    }
    const ref = pickMatch(combined, /Sızdırmazlık Kayıt No:\s*([^\n\r]+)/i);
    if (ref) rows.push({ label: 'Sızdırmazlık test kayıt no', value: ref });
    const leaks = pickMatch(combined, /Kaçak adedi:\s*([^\n\r]+)/i);
    if (leaks) rows.push({ label: 'Kaçak adedi (kayıt anı)', value: leaks });
    if (record?.vehicle_identifier) {
      rows.push({ label: 'Araç seri no', value: String(record.vehicle_identifier) });
    }
    if (record?.vehicle_type) {
      rows.push({ label: 'Araç tipi', value: String(record.vehicle_type) });
    }
    appendSourceStatusRows(notes, rows);
    return {
      originType: 'leak_test',
      moduleLabel: 'Sızdırmazlık Kontrol',
      summary:
        'Bu uygunsuzluk, sızdırmazlık testinde kaçak tespit edildiğinde otomatik olarak oluşturulur veya güncellenir.',
      rows,
    };
  }

  if (isProcessAuto) {
    rows.push({ label: 'Kaynak modül', value: 'Proses İçi Kontrol (muayene / hat kontrolü)' });
    const ref = pickMatch(combined, /Muayene Kayıt No:\s*([^\n\r]+)/i);
    if (ref) rows.push({ label: 'Muayene kayıt no', value: ref });
    const failedCount = pickMatch(combined, /Uygun Olmayan Ölçüm Sayısı:\s*([^\n\r]+)/i);
    if (failedCount) rows.push({ label: 'Uygun olmayan ölçüm sayısı', value: failedCount });
    const operator = pickMatch(combined, /Operatör:\s*([^\n\r]+)/i);
    if (operator) rows.push({ label: 'Muayene operatörü', value: operator });
    appendSourceStatusRows(notes, rows);
    return {
      originType: 'process_inspection',
      moduleLabel: 'Proses İçi Kontrol',
      summary:
        'Bu uygunsuzluk, ilgili proses muayene kaydındaki uygun olmayan ölçümlerden sistem tarafından otomatik oluşturulmuştur.',
      rows,
    };
  }

  rows.push({ label: 'Kaynak', value: 'Manuel giriş — Uygunsuzluk Yönetimi formu' });
  if (area) rows.push({ label: 'Tespit alanı (iş akışı)', value: area });
  if (record?.detected_by) rows.push({ label: 'Tespit eden', value: String(record.detected_by) });
  const partHint = [record?.part_code, record?.part_name].filter(Boolean).join(' — ');
  if (partHint) rows.push({ label: 'Parça referansı', value: partHint });
  appendSourceStatusRows(notes, rows);

  return {
    originType: 'manual',
    moduleLabel: 'Manuel kayıt',
    summary: 'Bu kayıt kullanıcı tarafından uygunsuzluk formu üzerinden doğrudan oluşturulmuştur.',
    rows,
  };
}
