/** Saf veri — Node script ve aggregation için (JSX bağımlılığı yok) */

export const CATEGORY_GROUPS = [
  {
    key: 'welding',
    label: 'Kaynakhane',
    badgeClassName:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    keywords: ['kaynak', 'kaynakhane', 'kaynak atölyesi', 'kaynakli', 'kaynaklı'],
    categories: [
      'Kaynak Nüfuziyet Eksikliği',
      'Kaynak Erime Eksikliği',
      'Kaynak Dikişi Konum Hatası',
      'Kaynak Dikişi Boy Hatası',
      'Kaynak Çatlağı',
      'Kaynak Gözenek / Porozite',
      'Cüruf Kalıntısı',
      'Alt Kesme (Undercut)',
      'Bindirme (Overlap)',
      'Delinme / Burn-Through',
      'Eksik Kaynak',
      'Fazla Kaynak',
      'Punta Kaynak Hatası',
      'Sıçrantı / Temizlik Yetersizliği',
      'Distorsiyon / Çarpılma',
      'Gap / Ağız Hazırlık Hatası',
      'Fikstürleme / Referans Kaçıklığı',
      'Kaynak Parametre Uygunsuzluğu',
      'Gaz / Tel Seçim Hatası',
      'Kaynak Hatası - Genel',
    ],
  },
  {
    key: 'dimension',
    label: 'Ölçü ve Kesim',
    badgeClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    keywords: ['ölçü', 'kesim', 'lazer', 'büküm', 'imalat', 'makine'],
    categories: [
      'Ölçü Tolerans Dışı',
      'Geometri / Form Hatası',
      'Delik Konum Hatası',
      'Delik Çap Hatası',
      'Kesim Hatası',
      'Büküm Açısı Hatası',
      'Profil / Boy Hatası',
      'Paralellik / Diklik Hatası',
    ],
  },
  {
    key: 'assembly',
    label: 'Montaj',
    badgeClassName:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    keywords: ['montaj', 'hat', 'final'],
    categories: [
      'Montaj Eksikliği',
      'Yanlış Montaj',
      'Tork / Sıkma Hatası',
      'Bağlantı Elemanı Eksikliği',
      'Sızdırmazlık Hatası',
      'Kablo / Hortum Yerleşim Hatası',
      'Fonksiyon Hatası',
    ],
  },
  {
    key: 'paint',
    label: 'Boya',
    badgeClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    keywords: ['boya', 'boyahane', 'boya hattı'],
    categories: [
      'Boya Akması',
      'Boya Ton Farkı',
      'Eksik Boya',
      'Portakallanma',
      'Kabarcık / Krater',
      'Yetersiz Yapışma',
      'Yüzey Hazırlık Hatası',
    ],
  },
  {
    key: 'surface',
    label: 'Yüzey',
    badgeClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    keywords: ['yüzey', 'kontrol', 'girdi kalite', 'proses içi'],
    categories: [
      'Yüzey Çiziği / Ezik',
      'Çapak / Keskin Kenar',
      'Pas / Oksitlenme',
      'Taşlama İzleri',
      'Görsel Uygunsuzluk',
      'Kirlenme / Yağ Kalıntısı',
    ],
  },
  {
    key: 'general',
    label: 'Genel',
    badgeClassName: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
    keywords: [],
    categories: [
      'Malzeme Uygunsuzluğu',
      'Eksik Parça',
      'Yanlış Parça',
      'Etiketleme Hatası',
      'Ambalaj Hatası',
      'Dokümantasyon Hatası',
      'Diğer',
    ],
  },
];

export const ALL_CATEGORY_VALUES = CATEGORY_GROUPS.flatMap((g) => g.categories);

export function getGroupMetaForCategory(categoryName) {
  if (!categoryName || typeof categoryName !== 'string') {
    return { key: null, groupLabel: null };
  }
  const t = categoryName.trim();
  for (const g of CATEGORY_GROUPS) {
    if (g.categories.includes(t)) return { key: g.key, groupLabel: g.label };
  }
  return { key: 'other', groupLabel: 'Diğer / Eşlenmemiş' };
}

export function getGroupLabelByKey(key) {
  if (!key) return null;
  const g = CATEGORY_GROUPS.find((x) => x.key === key);
  return g?.label ?? null;
}
