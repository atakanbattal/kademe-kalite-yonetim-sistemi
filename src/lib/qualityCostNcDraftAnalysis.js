/**
 * Kalite maliyeti kaynağından DF / 8D / MDI açılırken 5N1K, 5 Neden, Ishikawa ve 8D adım taslakları.
 * Detaylı Analiz (VehiclePerformancePanel) öneri eşiklerine uygun kayıtlar için kullanılır.
 */

import { getGroupMetaForCategory, ALL_CATEGORY_VALUES } from './defectCategoriesCore.js';

const inferDefectFromText = (blob) => {
    if (!blob || typeof blob !== 'string') return null;
    const low = blob.toLocaleLowerCase('tr-TR');
    const sorted = [...ALL_CATEGORY_VALUES].sort((a, b) => (b?.length || 0) - (a?.length || 0));
    for (const cat of sorted) {
        if (!cat) continue;
        if (low.includes(cat.toLocaleLowerCase('tr-TR'))) return cat;
    }
    return null;
};

const fmtCurrency = (amount) =>
    typeof amount === 'number' && Number.isFinite(amount)
        ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
        : '';

const fmtDate = (value) => {
    if (!value) return '';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('tr-TR');
    } catch {
        return '';
    }
};

const firstLine = (text, max = 320) => {
    if (!text || typeof text !== 'string') return '';
    const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
    return (line || text).slice(0, max);
};

const collectCostTextBlob = (cost) => {
    const lines = Array.isArray(cost?.cost_line_items) ? cost.cost_line_items : [];
    return [
        cost?.description,
        cost?.primary_defect_type,
        cost?.part_name,
        cost?.part_code,
        cost?.material_type,
        ...lines.map((li) => [li?.description, li?.defect_type, li?.part_name].filter(Boolean).join(' ')),
    ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
};

/** Maliyet açıklamasından senaryo — generic şablondan önce eşleşir */
const SCENARIO_RULES = [
    {
        key: 'engineering_change',
        test: (b) =>
            /proje\s*değişikli|projeden kaldır|ürün projeden|komisyon kararı|mühendislik değişikli|obsolet|eco\b|revizyon değişikli/i.test(
                b
            ),
    },
    { key: 'trial_part', test: (b) => /deneme parçası|deneme parça|prototip|numune üretim/i.test(b) },
    { key: 'operator_error', test: (b) => /operatör kaynaklı|operatör hatası|operatör/i.test(b) && /hata|hurda|uygunsuz/i.test(b) },
    { key: 'mounting_error', test: (b) => /montaj hatası|yanlış montaj|kamera montaj/i.test(b) },
    { key: 'wrong_process', test: (b) => /yanlış kesim|yanlış dosya|yanlış büküm|ters bükü|büküm yön|zıt yön/i.test(b) },
    { key: 'material_spec', test: (b) => /sertlik derecesi|malzeme uygun değil|spekt/i.test(b) },
    { key: 'leak_test', test: (b) => /sızdırmazlık|kaçak tespit|kaçak tamiri|kaçak oldu/i.test(b) },
    { key: 'welding', test: (b) => /kaynak|kaynat|çapak|kaynaksız|punta|wps/i.test(b) },
    { key: 'bending', test: (b) => /büküm hatası|büküm|çatla|bombe/i.test(b) },
];

const resolveScenarioFromCost = (cost) => {
    const blob = collectCostTextBlob(cost);
    if (!blob) return null;
    for (const rule of SCENARIO_RULES) {
        if (rule.test(blob)) return rule.key;
    }
    return cost?.description?.trim() ? 'from_description' : null;
};

const buildProblemStatement = (ctx, template) => {
    const desc = firstLine(ctx.cost?.description, 600);
    if (desc) {
        const prefix = ctx.partLabel && ctx.partLabel !== 'Parça' ? `${ctx.partLabel} — ` : '';
        const suffix = ctx.costType === 'Yeniden İşlem Maliyeti' && ctx.reworkMinutes !== '-'
            ? ` (${ctx.costType}, ${ctx.amountText}, ${ctx.reworkMinutes})`
            : ` (${ctx.costType}, ${ctx.amountText})`;
        return `${prefix}${desc}${suffix}.`;
    }
    return typeof template.problem === 'function' ? template.problem(ctx) : template.problem || '';
};

const resolveDefectGroup = (cost) => {
    const primary = cost?.primary_defect_type?.trim();
    if (primary) return getGroupMetaForCategory(primary).key || 'general';

    const lines = Array.isArray(cost?.cost_line_items) ? cost.cost_line_items : [];
    for (const li of lines) {
        const dt = li?.defect_type?.trim();
        if (dt) return getGroupMetaForCategory(dt).key || 'general';
    }

    const blob = [
        cost?.description,
        cost?.part_name,
        cost?.part_code,
        cost?.material_type,
    ]
        .filter(Boolean)
        .join(' ');
    const inferred = inferDefectFromText(blob);
    if (inferred) return getGroupMetaForCategory(inferred).key || 'general';
    return 'general';
};

const isSupplierCost = (cost) =>
    Boolean(cost?.is_supplier_nc || cost?.supplier_id || cost?.supplier?.name);

const resolveUnitLabel = (cost) => {
    if (isSupplierCost(cost)) return cost?.supplier?.name || 'Tedarikçi';
    return cost?.unit || 'Üretim';
};

/** Maliyet türü + hata grubu + tedarikçi/iç kaynak kombinasyonuna göre 5 Neden zinciri */
const ANALYSIS_TEMPLATES = {
    'Hurda Maliyeti|supplier|*': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında tedarikçi kaynaklı uygunsuzluk nedeniyle hurda maliyeti oluştu (${ctx.amountText}).`,
        why1: (ctx) =>
            `Tedarikçiden gelen ${ctx.partLabel} partisi kalite şartını karşılamadığı için hurdaya ayrıldı.`,
        why2: () =>
            'Tedarikçi çıkış kontrolünde uygunsuzluk tespit edilemedi veya sevkiyat öncesi elenemedi.',
        why3: () =>
            'Kontrol planında kritik karakteristikler tanımlı değil ya da periyodik doğrulama yapılmıyor.',
        why4: () =>
            'Tedarikçi kalite planı (PPAP/kontrol planı) kritik özellikleri yeterince kapsamıyor.',
        why5: () =>
            'Tedarikçi yeterlilik/onay sürecinde kalite performansı ve düzeltici faaliyet mekanizması yeterince bağlayıcı değil.',
        rootCause: () =>
            'Tedarikçi süreç doğrulaması ve çıkış kalite kontrolünde kritik karakteristik takibi yetersiz; uygunsuz partinin akışa girmesi hurda maliyetine yol açmıştır.',
        immediateAction: (ctx) =>
            `Uygunsuz ${ctx.partLabel} partisi izole edildi/karantinaya alındı; tedarikçiye bildirim yapıldı.`,
        preventiveAction: (ctx) =>
            `1. Tedarikçi kontrol planı gözden geçirilmeli; kritik boyutlar ve kabul kriterleri yeniden belirlenmelidir.\n2. ${ctx.partLabel} için GKK muayene planına ek kontrol adımları eklenmelidir.\n3. Tedarikçi performans puanı güncellenmeli; tekrarlayan uygunsuzlukta alternatif tedarikçi değerlendirilmelidir.\n4. Hurda maliyeti KPI olarak tedarikçi değerlendirmesine bağlanmalıdır.`,
    },
    'Yeniden İşlem Maliyeti|supplier|*': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında tedarikçi kaynaklı uygunsuzluk nedeniyle yeniden işlem maliyeti oluştu (${ctx.amountText}).`,
        why1: (ctx) =>
            `Tedarikçiden gelen ${ctx.partLabel} yeniden işlem gerektirecek düzeyde uygunsuz teslim edilmiştir.`,
        why2: () =>
            'Tedarikçi çıkış kontrolü uygunsuzluğu yakalayamamış; parça montaj hattına ulaşmıştır.',
        why3: () =>
            'Girdi kalite kontrol planında bu parça için yeterli muayene kapsamı tanımlı değildir.',
        why4: () =>
            'Tedarikçi ile teknik şartname/kritik karakteristik mutabakatı periyodik güncellenmemiştir.',
        why5: () =>
            'Tedarikçi kalite güvence sisteminde proses kapasitesi (Cpk) ve kontrol planı denetimi yeterli değildir.',
        rootCause: () =>
            'Tedarikçi kalite güvence sistemindeki yapısal eksiklik; kontrol planında kritik karakteristik tanımı ve periyodik denetim yetersiz.',
        immediateAction: (ctx) =>
            `Uygunsuz partiler %100 muayeneye alındı; yeniden işlem/tamir prosedürü uygulandı; tedarikçiye DF/8D iletildi.`,
        preventiveAction: (ctx) =>
            `1. ${ctx.partLabel} için tedarikçi kontrol planı revize edilmeli; kritik CTQ'lar eklenmelidir.\n2. GKK muayene sıklığı artırılmalı; şartlı kabul kriterleri netleştirilmelidir.\n3. Tedarikçi denetimi planlanmalı; ret oranı KPI olarak izlenmelidir.\n4. Alternatif tedarikçi yeterlilik süreci değerlendirilmelidir.`,
    },
    'Hurda Maliyeti|internal|welding': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında kaynak kaynaklı uygunsuzluk nedeniyle hurda maliyeti oluştu (${ctx.amountText}).`,
        why1: () => 'Kaynak dikişi/kritik birleşim kalite şartını karşılamıyor; parça hurdaya ayrıldı.',
        why2: () => 'Kaynak parametreleri (amper, voltaj, hız) veya operatör uygulaması standart dışı.',
        why3: () => 'Kaynak sonrası görsel/NDT kontrolü yeterince uygulanmıyor veya atlanabiliyor.',
        why4: () => 'WPS/PQR ve kaynakçı yeterlilik matrisi güncel değil ya da sahada izlenmiyor.',
        why5: () =>
            'Kaynak CTQ için süreç doğrulama, periyodik denetim ve hat içi kontrol formu sistematik yürütülmüyor.',
        rootCause: () =>
            'Kaynak proses kalifikasyonu (WPS/PQR) ve kaynakçı sertifikasyon sistemi yetersiz; kaynak sonrası kontrol prosedürü tanımlı değil veya uygulanmıyor.',
        immediateAction: (ctx) =>
            `Uygunsuz ${ctx.partLabel} partileri izole edildi; ilgili kaynak istasyonu durduruldu; WPS ve parametreler kontrol edildi.`,
        preventiveAction: () =>
            '1. WPS requalification ve kaynakçı beceri doğrulama yapılmalıdır.\n2. Kaynak sonrası görsel/NDT kontrol adımı zorunlu hale getirilmeli; imzalı teyit alınmalıdır.\n3. Kaynak parametreleri günlük kayıt altına alınmalıdır.\n4. Tekrarlayan hatalarda 8D beslemesi yapılmalıdır.',
    },
    'Hurda Maliyeti|internal|dimension': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında boyutsal uygunsuzluk nedeniyle hurda maliyeti oluştu (${ctx.amountText}).`,
        why1: () => 'Parça kritik ölçülerde tolerans dışı; montaj/kullanım şartını karşılamıyor.',
        why2: () => 'İmalat/kesim/büküm prosesinde ölçü sapması oluşmuş; son kontrol yakalayamamış.',
        why3: () => 'İş talimatında kritik ölçü doğrulama adımı eksik veya uygulanmıyor.',
        why4: () => 'Ölçüm aleti kalibrasyonu ve MSA (ölçüm sistemi analizi) yeterli değil.',
        why5: () =>
            'Parça bazlı kontrol planı ve first-off/on-going ölçüm protokolü tanımlanmamış veya izlenmiyor.',
        rootCause: () =>
            'Boyutsal CTQ için proses kontrol kartı ve son kontrol prosedürü yetersiz; ölçü doğrulama sistematik yapılmıyor.',
        immediateAction: (ctx) =>
            `Uygunsuz ${ctx.partLabel} partileri ayıklandı; ilgili tezgah/istasyon ayarları kontrol edildi.`,
        preventiveAction: () =>
            '1. Kontrol planına kritik boyut ölçüm adımları eklenmelidir.\n2. First-off onay prosedürü uygulanmalıdır.\n3. Ölçüm aletleri kalibrasyon takvimi güncellenmelidir.\n4. Operatör ölçü okuma eğitimi verilmelidir.',
    },
    'Hurda Maliyeti|internal|assembly': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında montaj/fonksiyon uygunsuzluğu nedeniyle hurda maliyeti oluştu (${ctx.amountText}).`,
        why1: () => 'Montaj sonrası fonksiyon veya birleşim uygunsuzluğu tespit edildi; parça hurdaya ayrıldı.',
        why2: () => 'Montaj talimatındaki kritik adımlar (tork, sıra, referans) uygulanmamış veya eksik.',
        why3: () => 'Hat içi kontrol noktasında fonksiyon/sızdırmazlık testi yapılmamış.',
        why4: () => 'Operatör eğitimi ve yetkinlik matrisi montaj CTQ’larını kapsamıyor.',
        why5: () =>
            'Montaj süreci FMEA/kontrol planı ile kritik adımlar tanımlanmamış; periyodik proses denetimi yok.',
        rootCause: () =>
            'Montaj CTQ’ları için iş talimatı, hat içi kontrol ve operatör yetkinlik sistemi yetersiz.',
        immediateAction: (ctx) =>
            `Etkilenen ${ctx.partLabel} üniteleri izole edildi; montaj talimatı ve tork değerleri gözden geçirildi.`,
        preventiveAction: () =>
            '1. Montaj talimatına kritik adım kontrol listesi eklenmelidir.\n2. Hat başı fonksiyon/sızdırmazlık testi zorunlu yapılmalıdır.\n3. Operatör eğitim kayıtları güncellenmelidir.\n4. Tekrarlayan hatalarda istasyon durdurma prosedürü uygulanmalıdır.',
    },
    'Yeniden İşlem Maliyeti|internal|*': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında proses uygunsuzluğu nedeniyle yeniden işlem maliyeti oluştu (${ctx.amountText}${ctx.reworkMinutes !== '-' ? `, ${ctx.reworkMinutes}` : ''}).`,
        why1: () => 'Ürün ilk seferde kalite şartını karşılamadı; yeniden işlem/tamir gerekti.',
        why2: () => 'Hat içi veya proses kontrol noktasında sapma zamanında tespit edilemedi.',
        why3: () => 'Proses kontrol kartında kritik parametreler izlenmiyor veya limit dışı müdahale gecikti.',
        why4: () => 'İş talimatları ve operatör eğitimleri güncel değil; first-off onay atlanabiliyor.',
        why5: () =>
            'Proses doğrulama (PV) ve periyodik proses denetimi kurumsal olarak yeterince bağlayıcı değil.',
        rootCause: () =>
            'Proses kontrol ve hat içi doğrulama mekanizması yetersiz; uygunsuzluk sonradan yeniden işlem maliyetine dönüşmektedir.',
        immediateAction: (ctx) =>
            `Etkilenen ${ctx.partLabel} partileri yeniden işlendi; proses parametreleri kontrol edildi; ek muayene yapıldı.`,
        preventiveAction: () =>
            '1. Proses kontrol kartına kritik parametre izleme eklenmelidir.\n2. First-off onay prosedürü zorunlu hale getirilmelidir.\n3. Yeniden işlem kayıtları analiz edilerek tekrarlayan istasyonlar belirlenmelidir.\n4. Operatör eğitimi ve yetkinlik matrisi güncellenmelidir.',
    },
    'Fire Maliyeti|internal|*': {
        problem: (ctx) =>
            `${ctx.partLabel} kaynaklı fire maliyeti oluştu (${ctx.amountText}).`,
        why1: () => 'Üretim prosesinde planlanmamış fire/atık miktarı oluştu.',
        why2: () => 'Kesim/nesting optimizasyonu veya malzeme kullanım verimliliği yetersiz.',
        why3: () => 'Fire oranı hedeflenmemiş veya hat bazında izlenmiyor.',
        why4: () => 'Malzeme ihtiyaç planlaması (MRP) fire payını yeterince dikkate almıyor.',
        why5: () =>
            'Fire azaltma hedefleri, proses iyileştirme ve malzeme verimliliği KPI olarak tanımlanmamış.',
        rootCause: () =>
            'Malzeme verimliliği ve fire yönetimi için proses kontrol, hedef ve izleme sistemi yetersiz.',
        immediateAction: (ctx) =>
            `Fire kaynağı tespit edildi; etkilenen ${ctx.partLabel} partisi için proses gözden geçirildi.`,
        preventiveAction: () =>
            '1. Fire oranı hedefi tanımlanmalı ve aylık izlenmelidir.\n2. Nesting/kesim optimizasyonu gözden geçirilmelidir.\n3. Operatör fire kayıt formu uygulanmalıdır.\n4. Kaizen önerisi ile fire azaltma projesi başlatılmalıdır.',
    },
    'Hurda Maliyeti|internal|*': {
        problem: (ctx) =>
            `${ctx.partLabel} parçasında kalite uygunsuzluğu nedeniyle hurda maliyeti oluştu (${ctx.amountText}).`,
        why1: () => 'Parça kalite şartını karşılamadığı için hurdaya ayrıldı.',
        why2: () => 'Proses kontrol veya son kontrol noktasında uygunsuzluk zamanında yakalanamadı.',
        why3: () => 'İş talimatı/kontrol planında kritik adımlar tanımlı değil veya uygulanmıyor.',
        why4: () => 'Operatör eğitimi ve yetkinlik doğrulaması yetersiz.',
        why5: () =>
            'Kalite planlama sürecinde risk analizi (FMEA) ve proses doğrulama adımları eksik.',
        rootCause: () =>
            'Proses kontrol, iş talimatı ve hat içi doğrulama mekanizması yetersiz; uygunsuz ürün hurda maliyetine dönüşmüştür.',
        immediateAction: (ctx) =>
            `Uygunsuz ${ctx.partLabel} partileri izole edildi; ilgili proses durdurularak kontrol edildi.`,
        preventiveAction: (ctx) =>
            `1. ${ctx.partLabel} için kontrol planı gözden geçirilmeli; kritik adımlar eklenmelidir.\n2. Hat içi kontrol noktaları güçlendirilmelidir.\n3. Operatör eğitimi verilmeli; eğitim kayıt altına alınmalıdır.\n4. Hurda maliyeti birim KPI olarak izlenmelidir.`,
    },
};

/** Açıklama tabanlı senaryo şablonları — generic kalite şablonundan önce uygulanır */
const SCENARIO_TEMPLATES = {
    engineering_change: {
        why1: (ctx) =>
            firstLine(ctx.cost?.description) ||
            'Mühendislik/proje değişikliği sonrası mevcut revizyon partileri yeni tasarıma uygun değildir.',
        why2: () =>
            'ECO/değişiklik sonrası eski revizyon stok veya üretim partilerinin kullanımına son verilmedi veya geç uygulandı.',
        why3: () =>
            'Değişiklik yönetimi ile stok/üretim planlama arasında obsolet parça listesi paylaşımı eksik kaldı.',
        why4: () =>
            'Hurda/komisyon kararı süreci değişiklik yayınlandıktan sonra zamanında tetiklenmedi.',
        why5: () =>
            'Mühendislik değişikliği sonrası obsolet malzeme yönetimi prosedürü yeterince tanımlı ve bağlayıcı değil.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Mühendislik/proje değişikliği sonrası obsolet parça yönetimi, stok izolasyonu ve hurda onay süreci yetersiz kalmış; değişiklik kaynaklı hurda maliyeti oluşmuştur.`
                : 'Mühendislik/proje değişikliği sonrası obsolet parça yönetimi ve stok ayırma mekanizması yetersiz; değişiklik kaynaklı hurda maliyeti oluşmuştur.';
        },
        immediateAction: (ctx) =>
            `Eski revizyon ${ctx.partLabel} partileri izole edildi; komisyon/onay ile hurda işlemi kayda alındı.`,
        preventiveAction: () =>
            '1. ECO yayınında etkilenen parça/stok listesi otomatik oluşturulmalıdır.\n2. Obsolet stok ayırma ve etiketleme prosedürü tanımlanmalıdır.\n3. Üretim planlama eski revizyon partilerini kullanım dışı bırakmalıdır.\n4. Değişiklik kaynaklı hurda maliyetleri ayrı KPI olarak izlenmelidir.',
        ishikawa: {
            man: 'Değişiklik bilgisi üretim ve stok ekiplerine zamanında iletilmemiş.',
            material: 'Eski revizyon partiler stokta ayrıştırılmadan kullanıma devam etmiş.',
            machine: 'Üretim hattı eski revizyon partileri işlemiş olabilir.',
            environment: 'Stok alanında revizyon ayırma/etiketleme uygulanmamış.',
            measurement: 'Revizyon kontrolü GKK veya hat girişinde yapılmamış.',
            management: 'ECO sonrası obsolet malzeme yönetimi prosedürü eksik veya uygulanmıyor.',
        },
    },
    trial_part: {
        why1: (ctx) =>
            firstLine(ctx.cost?.description) ||
            'Deneme/prototip parça üretimi sonucu uygunsuz veya kullanılamaz parça oluşmuştur.',
        why2: () => 'Deneme parçası için proses parametreleri veya tasarım henüz doğrulanmamıştır.',
        why3: () => 'Pilot/deneme üretim planı ile seri üretim kontrol planı ayrıştırılmamıştır.',
        why4: () => 'Deneme parçası hurda kararı için net prosedür ve onay mekanizması tanımlı değildir.',
        why5: () => 'Ar-Ge deneme üretim maliyetleri ayrı izlenmediği için tekrarlayan hurda riski yönetilememektedir.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Deneme/prototip üretim sürecinde proses doğrulama ve hurda yönetimi yetersiz kalmıştır.`
                : 'Deneme parçası üretiminde proses doğrulama ve hurda yönetimi yetersizdir.';
        },
        immediateAction: (ctx) =>
            `Deneme ${ctx.partLabel} partileri ayrıştırıldı; Ar-Ge ve kalite birimlerine bildirim yapıldı.`,
        preventiveAction: () =>
            '1. Deneme üretimleri için ayrı iş emri ve kontrol planı tanımlanmalıdır.\n2. Pilot parça hurda kararı prosedürü netleştirilmelidir.\n3. Deneme maliyetleri Ar-Ge bütçesinde ayrı izlenmelidir.\n4. Seri üretime geçiş öncesi proses doğrulama tamamlanmalıdır.',
        ishikawa: {
            man: 'Deneme üretim operatörü için ayrı talimat/yeterlilik tanımlı değil.',
            material: 'Prototip malzeme spesifikasyonu henüz kesinleşmemiş.',
            machine: 'Deneme prosesi için ekipman ayarı doğrulanmamış.',
            environment: 'Pilot üretim alanı seri üretimden ayrıştırılmamış.',
            measurement: 'Deneme parçası için ölçüm/kabul kriterleri tanımlı değil.',
            management: 'Ar-Ge deneme üretim hurda yönetimi prosedürü eksik.',
        },
    },
    operator_error: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Operatör kaynaklı uygunsuzluk tespit edilmiştir.',
        why2: () => 'Operatör iş talimatı/prosedür adımlarını eksik veya hatalı uygulamıştır.',
        why3: () => 'Hat içi kontrol noktasında operatör uygulaması doğrulanmamıştır.',
        why4: () => 'Operatör eğitimi ve yetkinlik matrisi bu operasyon için güncel değildir.',
        why5: () => 'Tekrarlayan operatör hataları için kök neden analizi ve eğitim döngüsü sistematik uygulanmıyor.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Operatör eğitimi, iş talimatı uygulaması ve hat içi doğrulama yetersiz kalmıştır.`
                : 'Operatör eğitimi ve iş talimatı uygulama denetimi yetersiz; operatör kaynaklı uygunsuzluk maliyete dönüşmüştür.';
        },
        immediateAction: (ctx) =>
            `Etkilenen ${ctx.partLabel} partileri izole edildi; operatör bilgilendirildi; istasyon kontrol edildi.`,
        preventiveAction: () =>
            '1. İlgili operasyon için iş talimatı gözden geçirilmeli ve operatör eğitimi verilmelidir.\n2. Hat içi kontrol listesine kritik adımlar eklenmelidir.\n3. Yetkinlik matrisi güncellenmelidir.\n4. Tekrarlayan hatalarda istasyon durdurma prosedürü uygulanmalıdır.',
    },
    mounting_error: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Montaj hatası tespit edilmiştir.',
        why2: () => 'Montaj talimatındaki kritik adımlar (sıra, tork, referans) uygulanmamış.',
        why3: () => 'Hat içi montaj kontrol noktasında fonksiyon/doğrulama testi yapılmamış.',
        why4: () => 'Montaj operatörü eğitimi ve yetkinlik doğrulaması yetersiz.',
        why5: () => 'Montaj CTQ için FMEA/kontrol planı tanımlı değil veya periyodik denetim yapılmıyor.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Montaj talimatı, hat içi kontrol ve operatör yetkinlik sistemi yetersiz kalmıştır.`
                : 'Montaj CTQ için iş talimatı ve hat içi doğrulama mekanizması yetersizdir.';
        },
        immediateAction: (ctx) =>
            `Etkilenen ${ctx.partLabel} montajları kontrol edildi; montaj talimatı ve tork değerleri gözden geçirildi.`,
        preventiveAction: () =>
            '1. Montaj talimatına kritik adım kontrol listesi eklenmelidir.\n2. Hat başı fonksiyon testi zorunlu yapılmalıdır.\n3. Operatör eğitim kayıtları güncellenmelidir.\n4. Montaj CTQ kontrol planı revize edilmelidir.',
    },
    wrong_process: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Yanlış proses/dosya uygulaması tespit edilmiştir.',
        why2: () => 'Doğru kesim/büküm dosyası veya iş talimatı kullanılmamış.',
        why3: () => 'Proses başlangıcında first-off/onay kontrolü yapılmamış.',
        why4: () => 'Dosya revizyon yönetimi ve sahada güncel versiyon erişimi sağlanmamış.',
        why5: () => 'Yanlış dosya kullanımını önleyecek sistematik doğrulama (barkod/ERP) uygulanmıyor.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Proses dosyası revizyon yönetimi ve first-off doğrulama mekanizması yetersiz kalmıştır.`
                : 'Proses dosyası yönetimi ve first-off onay prosedürü yetersiz; yanlış proses uygulaması maliyete dönüşmüştür.';
        },
        immediateAction: (ctx) =>
            `Yanlış prosesle üretilen ${ctx.partLabel} partileri izole edildi; doğru dosya/talimat teyit edildi.`,
        preventiveAction: () =>
            '1. First-off onay prosedürü zorunlu hale getirilmelidir.\n2. Kesim/büküm dosyası revizyon kontrolü sistematik yapılmalıdır.\n3. Operatör ekranında güncel dosya versiyonu gösterilmelidir.\n4. Yanlış dosya kullanımı için hat durdurma kuralı tanımlanmalıdır.',
    },
    material_spec: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Malzeme spesifikasyonu uyumsuzluğu tespit edilmiştir.',
        why2: () => 'Girdi malzeme sertlik/kalite şartı spesifikasyonu karşılamıyor.',
        why3: () => 'GKK muayenesinde malzeme sertlik/spekt kontrolü yapılmamış veya atlanmış.',
        why4: () => 'Tedarikçi/malzeme onay sürecinde kritik karakteristik doğrulaması eksik.',
        why5: () => 'Malzeme CTQ için kontrol planı ve periyodik doğrulama tanımlı değil.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Malzeme spesifikasyon doğrulama ve GKK kontrol planı yetersiz kalmıştır.`
                : 'Malzeme spesifikasyon doğrulama ve girdi kalite kontrolü yetersizdir.';
        },
        immediateAction: (ctx) =>
            `Spesifikasyon dışı ${ctx.partLabel} malzemeleri izole edildi; lot/parti numarası kayda alındı.`,
        preventiveAction: () =>
            '1. GKK muayene planına malzeme sertlik/spekt kontrolü eklenmelidir.\n2. Tedarikçi PPAP/kontrol planı gözden geçirilmelidir.\n3. Malzeme CTQ kabul kriterleri netleştirilmelidir.\n4. Uygunsuz lot için geri izlenebilirlik sağlanmalıdır.',
    },
    leak_test: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Sızdırmazlık testinde kaçak tespit edilmiştir.',
        why2: () => 'Kaynak/birleşim/kontrol noktasında sızdırmazlık şartı sağlanmadan teste gelinmiş.',
        why3: () => 'Hat içi sızdırmazlık ön kontrolü veya ara muayene yapılmamış.',
        why4: () => 'Sızdırmazlık CTQ için montaj/kaynak kontrol planı yeterince tanımlı değil.',
        why5: () => 'Kaçak tamiri sonrası etkinlik doğrulama ve tekrar test prosedürü sistematik uygulanmıyor.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Sızdırmazlık CTQ için montaj/kaynak kontrol ve test öncesi doğrulama yetersiz kalmıştır.`
                : 'Sızdırmazlık kontrol planı ve test öncesi doğrulama mekanizması yetersizdir.';
        },
        immediateAction: (ctx) =>
            `Kaçak tespit edilen ${ctx.partLabel} birimlerinde tamir/yeniden işlem uygulandı; tekrar sızdırmazlık testi yapıldı.`,
        preventiveAction: () =>
            '1. Montaj/kaynak sonrası ara sızdırmazlık kontrolü eklenmelidir.\n2. Test öncesi görsel/kritik birleşim kontrol listesi uygulanmalıdır.\n3. Kaçak kök neden analizi tekrarlayan istasyonlarda yapılmalıdır.\n4. Tamir sonrası %100 test prosedürü zorunlu hale getirilmelidir.',
    },
    welding: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Kaynak kaynaklı uygunsuzluk tespit edilmiştir.',
        why2: () => 'Kaynak parametreleri (amper, voltaj, hız) veya operatör uygulaması standart dışı.',
        why3: () => 'Kaynak sonrası görsel/NDT kontrolü yeterince uygulanmıyor veya atlanabiliyor.',
        why4: () => 'WPS/PQR ve kaynakçı yeterlilik matrisi güncel değil ya da sahada izlenmiyor.',
        why5: () => 'Kaynak CTQ için süreç doğrulama, periyodik denetim ve hat içi kontrol formu sistematik yürütülmüyor.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Kaynak proses kalifikasyonu (WPS/PQR) ve kaynak sonrası kontrol prosedürü yetersiz kalmıştır.`
                : 'Kaynak proses kalifikasyonu ve kaynak sonrası kontrol prosedürü yetersizdir.';
        },
        immediateAction: (ctx) =>
            `Uygunsuz ${ctx.partLabel} kaynakları izole edildi; WPS ve parametreler kontrol edildi.`,
        preventiveAction: () =>
            '1. WPS requalification ve kaynakçı beceri doğrulama yapılmalıdır.\n2. Kaynak sonrası görsel/NDT kontrol adımı zorunlu hale getirilmelidir.\n3. Kaynak parametreleri günlük kayıt altına alınmalıdır.\n4. Tekrarlayan hatalarda 8D beslemesi yapılmalıdır.',
    },
    bending: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Büküm/şekillendirme uygunsuzluğu tespit edilmiştir.',
        why2: () => 'Büküm parametreleri, açı veya yön hatalı uygulanmış.',
        why3: () => 'First-off ölçü/büküm kontrolü yapılmadan seri üretime geçilmiş.',
        why4: () => 'Büküm presi kalibrasyonu veya takım ayarı doğrulanmamış.',
        why5: () => 'Büküm CTQ için kontrol planı ve proses doğrulama adımları tanımlı değil.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Büküm proses kontrolü ve first-off doğrulama mekanizması yetersiz kalmıştır.`
                : 'Büküm proses kontrolü ve first-off doğrulama mekanizması yetersizdir.';
        },
        immediateAction: (ctx) =>
            `Uygunsuz ${ctx.partLabel} bükümleri ayıklandı; pres ayarları ve büküm dosyası kontrol edildi.`,
        preventiveAction: () =>
            '1. First-off büküm/ölçü onay prosedürü zorunlu hale getirilmelidir.\n2. Büküm presi kalibrasyon takvimi güncellenmelidir.\n3. Büküm CTQ kontrol planına ek adımlar eklenmelidir.\n4. Operatör büküm yönü eğitimi verilmelidir.',
    },
    from_description: {
        why1: (ctx) => firstLine(ctx.cost?.description) || 'Maliyet kaydı açıklamasına göre uygunsuzluk tespit edilmiştir.',
        why2: () => 'Uygunsuzluk hat içi veya son kontrolde erken aşamada yakalanamamıştır.',
        why3: () => 'İlgili proses için kontrol planı/iş talimatı bu riski yeterince adreslemiyor.',
        why4: () => 'Operatör eğitimi veya proses parametresi doğrulaması eksik kalmış olabilir.',
        why5: () => 'Tekrarlayan hatalar için kök neden analizi ve proses iyileştirme döngüsü yeterince uygulanmıyor.',
        rootCause: (ctx) => {
            const desc = firstLine(ctx.cost?.description, 200);
            return desc
                ? `${desc} Bu olayın tekrarlanmaması için proses kontrol, iş talimatı ve doğrulama adımları güçlendirilmelidir.`
                : 'Proses kontrol ve doğrulama mekanizması yetersiz; uygunsuzluk maliyete dönüşmüştür.';
        },
        immediateAction: (ctx) =>
            `Etkilenen ${ctx.partLabel} partileri izole edildi; ilgili proses kontrol edildi.`,
        preventiveAction: (ctx) =>
            `1. ${ctx.partLabel} için kontrol planı gözden geçirilmeli; kritik adımlar eklenmelidir.\n2. Hat içi kontrol noktaları güçlendirilmelidir.\n3. İş talimatı ve operatör eğitimi güncellenmelidir.\n4. Tekrarlayan maliyetler KPI olarak izlenmelidir.`,
    },
};

const mergeScenarioTemplate = (baseTemplate, scenarioKey) => {
    const scenario = SCENARIO_TEMPLATES[scenarioKey];
    if (!scenario) return baseTemplate;
    return { ...baseTemplate, ...scenario };
};

const pickTemplate = (cost) => {
    const scenario = resolveScenarioFromCost(cost);
    const costType = cost?.cost_type || 'Hurda Maliyeti';
    const source = isSupplierCost(cost) ? 'supplier' : 'internal';
    const group = resolveDefectGroup(cost);

    let base = null;
    const keys = [
        `${costType}|${source}|${group}`,
        `${costType}|${source}|*`,
        `${costType}|internal|*`,
    ];
    for (const key of keys) {
        if (ANALYSIS_TEMPLATES[key]) {
            base = ANALYSIS_TEMPLATES[key];
            break;
        }
    }
    if (!base) base = ANALYSIS_TEMPLATES['Hurda Maliyeti|internal|*'];

    if (scenario) return mergeScenarioTemplate(base, scenario);
    return base;
};

const buildContext = (cost, analysisContext = {}) => {
    const partLabel =
        cost?.part_name ||
        cost?.part_code ||
        (Array.isArray(cost?.cost_line_items) && cost.cost_line_items[0]?.part_name) ||
        'Parça';
    const amountText = fmtCurrency(parseFloat(cost?.amount) || 0);
    const reworkMinutes = cost?.rework_duration ? `${cost.rework_duration} dk` : '-';
    return {
        cost,
        partLabel,
        amountText,
        reworkMinutes,
        unitLabel: resolveUnitLabel(cost),
        vehicleType: cost?.vehicle_type || analysisContext?.vehicleType || '',
        costType: cost?.cost_type || '',
        metricLabel: analysisContext?.metricLabel || cost?.cost_type || '',
        costDate: fmtDate(cost?.cost_date),
        analysisContext,
    };
};

const applyTemplate = (template, ctx) => {
    const field = (fn) => (typeof fn === 'function' ? fn(ctx) : fn || '');
    return {
        problem: field(template.problem),
        why1: field(template.why1),
        why2: field(template.why2),
        why3: field(template.why3),
        why4: field(template.why4),
        why5: field(template.why5),
        rootCause: field(template.rootCause),
        immediateAction: field(template.immediateAction),
        preventiveAction: field(template.preventiveAction),
    };
};

export function buildQualityCostFiveWhyAnalysis(cost, analysisContext = {}) {
    const ctx = buildContext(cost, analysisContext);
    const template = pickTemplate(cost);
    const t = applyTemplate(template, ctx);

    return {
        problem: buildProblemStatement(ctx, template),
        why1: t.why1,
        why2: t.why2,
        why3: t.why3,
        why4: t.why4,
        why5: t.why5,
        rootCause: t.rootCause,
        immediateAction: t.immediateAction,
        preventiveAction: t.preventiveAction,
    };
}

export function buildQualityCostFiveN1kAnalysis(cost, analysisContext = {}, fiveWhy = null) {
    const ctx = buildContext(cost, analysisContext);
    const fw = fiveWhy || buildQualityCostFiveWhyAnalysis(cost, analysisContext);
    const scenario = resolveScenarioFromCost(cost);
    const desc = firstLine(cost?.description, 200);

    let detection =
        isSupplierCost(cost)
            ? 'GKK (Girdi Kalite Kontrol) muayenesinde veya saha geri bildirimi ile tespit edilmiştir.'
            : 'Kalite kontrol muayenesi, proses kontrol veya saha bildirimi sırasında tespit edilmiştir.';

    if (scenario === 'engineering_change') {
        detection = 'Proje/mühendislik değişikliği sonrası stok/üretim değerlendirmesinde tespit edilmiştir.';
    } else if (scenario === 'leak_test') {
        detection = 'Sızdırmazlık testi sırasında kaçak tespit edilmiştir.';
    } else if (scenario === 'trial_part') {
        detection = 'Deneme/prototip üretim değerlendirmesinde tespit edilmiştir.';
    } else if (desc) {
        detection = `Maliyet kaydı açıklamasına göre: ${desc}`;
    }

    return {
        ne: firstLine(fw.problem || ctx.partLabel, 400),
        nerede: ctx.unitLabel,
        neZaman: ctx.costDate,
        kim: isSupplierCost(cost) ? 'Tedarikçi' : ctx.unitLabel,
        neden: firstLine(fw.rootCause || fw.why5, 300),
        nasil: detection,
    };
}

export function buildQualityCostIshikawaAnalysis(cost, analysisContext = {}, fiveWhy = null) {
    const ctx = buildContext(cost, analysisContext);
    const fw = fiveWhy || buildQualityCostFiveWhyAnalysis(cost, analysisContext);
    const scenario = resolveScenarioFromCost(cost);
    const group = resolveDefectGroup(cost);

    const byGroup = {
        welding: {
            man: 'Kaynak operatörü eğitim/yeterlilik eksikliği veya prosedür ihlali.',
            material: 'Kaynak tel/gaz/malzeme spesifikasyonu uyumsuzluğu.',
            machine: 'Kaynak ekipmanı kalibrasyon/ayar hatası.',
            environment: 'Ortam koşulları (rüzgar/nem) kaynak kalitesini etkilemiş olabilir.',
            measurement: 'Kaynak sonrası NDT/görsel kontrol yetersiz.',
            management: 'WPS/PQR ve kaynakçı yeterlilik sistemi eksik.',
        },
        dimension: {
            man: 'Operatör ölçü kontrolü yapmamış veya yanlış iş talimatı kullanmış.',
            material: 'Hammadde lot/boyut sapması.',
            machine: 'Tezgah kalibrasyonu veya takım aşınması.',
            environment: 'Sıcaklık/titreşim ölçüm sonucunu etkilemiş olabilir.',
            measurement: 'Ölçüm aleti kalibrasyonu eksik.',
            management: 'Kontrol planında boyutsal CTQ tanımlı değil.',
        },
        assembly: {
            man: 'Montaj operatörü talimat/tork değerlerini uygulamamış.',
            material: 'Yanlış parça veya eksik bağlantı elemanı.',
            machine: 'Tork anahtarı kalibrasyonu veya ekipman arızası.',
            environment: 'Montaj hattı ergonomisi hatayı artırmış olabilir.',
            measurement: 'Fonksiyon/sızdırmazlık testi yapılmamış.',
            management: 'Montaj CTQ kontrol planı eksik.',
        },
    };

    const defaults = {
        man: 'Operatör eğitim/yeterlilik veya prosedür uygulama eksikliği.',
        material: 'Malzeme spesifikasyonu veya lot uyumsuzluğu.',
        machine: 'Ekipman/tezgah ayar veya bakım eksikliği.',
        environment: 'Çevresel faktörler proses kalitesini olumsuz etkilemiş olabilir.',
        measurement: 'Ölçüm/kontrol sistemi yetersiz veya kalibrasyon eksik.',
        management: 'İş talimatı, kontrol planı veya proses doğrulama eksik.',
    };

    const scenarioIsh = scenario && SCENARIO_TEMPLATES[scenario]?.ishikawa;
    const ish = scenarioIsh || byGroup[group] || defaults;

    return {
        problem: fw.problem,
        man: [ish.man],
        material: [ish.material],
        machine: [ish.machine],
        environment: [ish.environment],
        measurement: [ish.measurement],
        management: [ish.management],
    };
}

const DEFAULT_8D_TITLES = {
    D1: 'Ekip Oluşturma',
    D2: 'Problemi Tanımlama',
    D3: 'Geçici Önlemler Alma',
    D4: 'Kök Neden Analizi',
    D5: 'Kalıcı Düzeltici Faaliyetleri Belirleme',
    D6: 'Kalıcı Düzeltici Faaliyetleri Uygulama',
    D7: 'Tekrarlanmayı Önleme',
    D8: 'Ekibi Takdir Etme',
};

export function buildQualityCostEightDSteps(fiveWhy, { autoComplete = false, responsible = 'Kalite' } = {}) {
    const now = new Date().toISOString().split('T')[0];
    const d4Text =
        `5 Neden (özet)\n\n` +
        `1. ${fiveWhy.why1}\n` +
        `2. ${fiveWhy.why2}\n` +
        `3. ${fiveWhy.why3}\n` +
        `4. ${fiveWhy.why4}\n` +
        `5 (Kök): ${fiveWhy.why5}\n\n` +
        `Kök Neden Özeti: ${fiveWhy.rootCause}`;

    const descriptions = {
        D1: `Kalite maliyeti analizi kapsamında ${responsible} liderliğinde çok disiplinli ekip oluşturuldu.`,
        D2: fiveWhy.problem,
        D3: fiveWhy.immediateAction,
        D4: d4Text,
        D5: `Önerilen düzeltici faaliyetler:\n\n${fiveWhy.preventiveAction}`,
        D6: 'Düzeltici faaliyetler uygulandı; etkinlik doğrulaması yapıldı.',
        D7: 'Kontrol planı, iş talimatları ve eğitim kayıtları güncellendi; tekrar izleme periyodu tanımlandı.',
        D8: 'Ekip çalışması tamamlandı; iyileştirme sonuçları paylaşıldı.',
    };

    const steps = {};
    const progress = {};

    Object.keys(DEFAULT_8D_TITLES).forEach((key) => {
        const completed = autoComplete;
        steps[key] = {
            title: DEFAULT_8D_TITLES[key],
            responsible: autoComplete ? responsible : '',
            completionDate: autoComplete ? now : '',
            description: descriptions[key] || '',
            completed,
            evidenceFiles: [],
        };
        progress[key] = {
            completed,
            responsible: autoComplete ? responsible : null,
            completionDate: autoComplete ? now : null,
            description: descriptions[key] || null,
            evidenceFiles: [],
        };
    });

    return { eight_d_steps: steps, eight_d_progress: progress };
}

export function buildQualityCostClosingNotes(fiveWhy, { metricLabel, vehicleType, ncType } = {}) {
    const parts = [
        `${vehicleType ? `${vehicleType} — ` : ''}${metricLabel || 'Kalite maliyeti'} analizi kapsamında açılan ${ncType || 'DF'} kaydı.`,
        '',
        'Kök neden:',
        fiveWhy.rootCause,
        '',
        'Uygulanan düzeltici faaliyetler:',
        fiveWhy.preventiveAction,
        '',
        'Anlık aksiyon:',
        fiveWhy.immediateAction,
        '',
        'Düzeltici faaliyetler tamamlanmış; etkinlik doğrulaması yapılmıştır. Kaydın kapatılması uygundur.',
    ];
    return parts.join('\n');
}

/** Tek çağrıda tüm analiz alanlarını döndürür */
export function buildQualityCostDraftAnalyses(cost, analysisContext = {}, options = {}) {
    const five_why_analysis = buildQualityCostFiveWhyAnalysis(cost, analysisContext);
    const five_n1k_analysis = buildQualityCostFiveN1kAnalysis(cost, analysisContext, five_why_analysis);
    const ishikawa_analysis = buildQualityCostIshikawaAnalysis(cost, analysisContext, five_why_analysis);

    const result = {
        five_why_analysis,
        five_n1k_analysis,
        ishikawa_analysis,
        problem_definition: five_why_analysis.problem,
        root_cause: five_why_analysis.rootCause,
    };

    if (options.ncType === '8D') {
        const eightD = buildQualityCostEightDSteps(five_why_analysis, {
            autoComplete: Boolean(options.autoComplete),
            responsible: options.responsible || resolveUnitLabel(cost),
        });
        result.eight_d_steps = eightD.eight_d_steps;
        result.eight_d_progress = eightD.eight_d_progress;
    }

    if (options.autoComplete) {
        result.closing_notes = buildQualityCostClosingNotes(five_why_analysis, {
            metricLabel: analysisContext?.metricLabel,
            vehicleType: analysisContext?.vehicleType || cost?.vehicle_type,
            ncType: options.ncType,
        });
        result.status = 'Kapatıldı';
        result.closed_at = new Date().toISOString();
    }

    return result;
}
