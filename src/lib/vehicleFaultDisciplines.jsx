import React from 'react';
import { Badge } from '@/components/ui/badge';

// Üretilen Araçlar modülündeki hata kategorilerinin ait olduğu ana
// disiplinler. Proses Kontrol modülündeki `defectCategories` yaklaşımına
// benzer biçimde, kategori seçim ekranında rozet gösterimi ve mantıksal
// gruplama için kullanılır.
export const VEHICLE_FAULT_DISCIPLINES = [
    {
        key: 'Elektrik',
        label: 'Elektrik',
        badgeClassName:
            'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200',
        description: 'Kablaj, sensör, aydınlatma ve kontrol elektroniği',
    },
    {
        key: 'Mekanik Montaj',
        label: 'Mekanik Montaj',
        badgeClassName:
            'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200',
        description: 'Cıvata, tork, bağlantı elemanı ve komponent montajı',
    },
    {
        key: 'Hidrolik',
        label: 'Hidrolik',
        badgeClassName:
            'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200',
        description: 'Hidrolik devre, silindir, valf, hortum ve kaçaklar',
    },
    {
        key: 'Pnömatik',
        label: 'Pnömatik',
        badgeClassName:
            'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-200',
        description: 'Hava hatları, valfler, regülatör ve basınç',
    },
    {
        key: 'Boya',
        label: 'Boya',
        badgeClassName:
            'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200',
        description: 'Boya uygulaması, ton, akıntı ve yüzey hazırlık',
    },
    {
        key: 'Kaynak',
        label: 'Kaynak',
        badgeClassName:
            'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200',
        description: 'Kaynak dikişi, nüfuziyet, gözenek ve çatlak',
    },
    {
        key: 'Ölçü ve Geometri',
        label: 'Ölçü ve Geometri',
        badgeClassName:
            'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200',
        description: 'Boyut toleransı, hizalama, açı ve deformasyon',
    },
    {
        key: 'Yüzey',
        label: 'Yüzey',
        badgeClassName:
            'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200',
        description: 'Çizik, ezik, çapak, toz ve yüzey kalitesi',
    },
    {
        key: 'Dokümantasyon',
        label: 'Dokümantasyon',
        badgeClassName:
            'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200',
        description: 'Evrak, etiket, iş emri ve raporlama',
    },
    {
        key: 'Lojistik',
        label: 'Lojistik',
        badgeClassName:
            'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200',
        description: 'Malzeme, stok, sevkiyat ve paketleme',
    },
    {
        key: 'Kalite Kontrol',
        label: 'Kalite Kontrol',
        badgeClassName:
            'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200',
        description: 'Muayene, prosedür ve ölçüm cihazı uyumu',
    },
    {
        key: 'Tasarım ve AR-GE',
        label: 'Tasarım ve AR-GE',
        badgeClassName:
            'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-200',
        description: 'Tasarım, prototip ve malzeme seçim hataları',
    },
    {
        key: 'Fonksiyonel Test',
        label: 'Fonksiyonel Test',
        badgeClassName:
            'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/30 dark:text-lime-200',
        description: 'Fonksiyonel bozukluk ve test senaryoları',
    },
    {
        key: 'Genel',
        label: 'Genel',
        badgeClassName:
            'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200',
        description: 'Yukarıdaki sınıflara girmeyen genel hatalar',
    },
];

export const VEHICLE_FAULT_DISCIPLINE_MAP = Object.fromEntries(
    VEHICLE_FAULT_DISCIPLINES.map((discipline) => [discipline.key, discipline])
);

export const getDisciplineMeta = (key) => {
    if (!key) return VEHICLE_FAULT_DISCIPLINE_MAP['Genel'];
    return VEHICLE_FAULT_DISCIPLINE_MAP[key] || VEHICLE_FAULT_DISCIPLINE_MAP['Genel'];
};

export const DisciplineBadge = ({ discipline, className = '' }) => {
    const meta = getDisciplineMeta(discipline);
    if (!meta) return null;

    return (
        <Badge
            variant="outline"
            className={`shrink-0 font-medium ${meta.badgeClassName} ${className}`}
        >
            {meta.label}
        </Badge>
    );
};

// Kategori listesinden (opsiyonel olarak departmana göre filtrelenmiş) disiplin
// bazlı gruplanmış seçenekler üretir. SearchableSelectDialog için uygun
// { value, label, searchText, description } formatında dönüş yapar.
export const buildVehicleFaultCategoryOptions = (categories = [], { existingValue = '' } = {}) => {
    const orderedGroups = VEHICLE_FAULT_DISCIPLINES.map((discipline) => ({
        discipline,
        items: [],
    }));

    const disciplineIndex = Object.fromEntries(
        orderedGroups.map((group, index) => [group.discipline.key, index])
    );

    const fallbackGroup = orderedGroups[disciplineIndex['Genel']];

    (categories || []).forEach((category) => {
        if (!category || !category.id) return;
        const index = disciplineIndex[category.discipline] ?? disciplineIndex['Genel'];
        const target = orderedGroups[index] || fallbackGroup;
        target.items.push(category);
    });

    const options = [];

    orderedGroups.forEach(({ discipline, items }) => {
        if (!items.length) return;
        const sortedItems = [...items].sort((left, right) =>
            (left.name || '').localeCompare(right.name || '', 'tr', { sensitivity: 'base' })
        );

        sortedItems.forEach((category) => {
            options.push({
                value: String(category.id),
                triggerLabel: category.name,
                searchText: [category.name, discipline.label].filter(Boolean).join(' '),
                description: discipline.description,
                label: (
                    <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate">{category.name}</span>
                        <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] font-medium ${discipline.badgeClassName}`}
                        >
                            {discipline.label}
                        </Badge>
                    </div>
                ),
            });
        });
    });

    if (existingValue && !options.some((option) => option.value === String(existingValue))) {
        options.unshift({
            value: String(existingValue),
            triggerLabel: 'Mevcut Kategori',
            searchText: 'mevcut kategori',
            description: 'Kayıtlı ancak listede bulunmayan kategori',
            label: (
                <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">Mevcut Kategori</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                        Mevcut
                    </Badge>
                </div>
            ),
        });
    }

    return options;
};
