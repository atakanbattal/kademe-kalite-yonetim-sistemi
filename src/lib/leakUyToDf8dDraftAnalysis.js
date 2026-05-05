/**
 * Sızdırmazlık Kontrol (UYG) → DF/8D dönüşümünde 5N1K / 5 Neden taslağı.
 * Kaçağın kök nedeni olarak conta/O-ring atlama değil; kaynak/birleşim ve kaynak süreç doğrulaması vurgulanır.
 */

const LEAK_DETECTION_AREA = 'Sızdırmazlık Kontrol';
const LEAK_CATEGORY = 'Sızdırmazlık Kaçağı';

export const isLeakUyRecord = (record) =>
    record?.detection_area === LEAK_DETECTION_AREA || record?.category === LEAK_CATEGORY;

export const isLeakUyGroup = (group) =>
    group?.detection_area === LEAK_DETECTION_AREA || group?.category === LEAK_CATEGORY;

const supplierWeldedHint = (record) => {
    const t = `${record?.notes || ''}\n${record?.description || ''}`;
    return /Kaynak\s+tedarikçi:|tedarikçi\s+hatt|GKK|girdi\s+kalite/i.test(t);
};

const firstMeaningfulLine = (text) => {
    if (!text || typeof text !== 'string') return '';
    const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
    return line || '';
};

/** Tekil UYG kaydı için */
export function buildLeakDraftAnalysesForUyRecord(record) {
    const problem =
        firstMeaningfulLine(record?.description) ||
        `${record?.category || LEAK_CATEGORY} (Kaynak: ${LEAK_DETECTION_AREA})`;
    const supplier = supplierWeldedHint(record);

    if (supplier) {
        return {
            five_why_analysis: {
                problem,
                why1:
                    'Tedarik edilen/bağlanan ürün veya alt montaj sızdırmazlık şartını karşılamıyor; kaçak kaynakta üretim/birleşim hatasına işaret ediyor.',
                why2:
                    'Tedarikçi çıkışında sızdırmazlık ve yapı uygunluğu yeterince doğrulanmıyor veya limitler uygun tanımlanmamış.',
                why3:
                    'Kontrol planında sızdırmazlık testi ve kritik birleşimler zorunlu, ölçülebilir adım olarak eksik.',
                why4:
                    'Kalite planı sızdırmazlık CTQ ve kaynak özel özelliklerini eksik kapsıyor.',
                why5:
                    'Tedarikçi yeterlilik onayında sızdırmazlık, kontrol planı ve kaynak süreç denetimi şartları yeterince şart koşulmamış.',
                rootCause:
                    'Kaynakta üretilen hatalı ürünün akışa girmesi; tedarikçi süreç doğrulaması ve çıkış kontrolünde sızdırmazlık CTQ yetersiz.',
                immediateAction:
                    'Uygunsuz partiler izole edildi; GKK/saha ile teyit ve tedarikçiye kontrollü bildirim (düzeltici faaliyet talebi).',
                preventiveAction:
                    'Tedarikçi CTQ ve kontrol planı güncellemesi; sızdırmazlık/kaynak kanıtı; yeniden yeterlilik ve risk temelli GKK sıkılığı.',
            },
            five_n1k_analysis: {
                ne: problem.slice(0, 400),
                nerede: 'Tedarikçi',
                neZaman: record?.detection_date
                    ? new Date(record.detection_date).toLocaleDateString('tr-TR')
                    : '',
                kim: 'Tedarikçi',
                neden:
                    'Kaynakta üretim/birleşim hatası nedeniyle ürün sızdırmazlık şartını karşılamıyor; çıkış doğrulaması zayıf.',
                nasil: 'GKK veya saha geri bildirimi / sızdırmazlık testi ile tespit edilmiştir.',
            },
        };
    }

    return {
        five_why_analysis: {
            problem,
            why1:
                'Sızdırmazlık testinde kaçak ölçülüyor; ünite kaynak veya kritik birleşimde sızdırmazlık şartını karşılamıyor.',
            why2:
                'Kaynak dikişi veya birleşim, parametre/geometri veya önceki proses sapması nedeniyle sızdırmaz değil.',
            why3:
                'Kaynak ve sızdırmazlık kritik adımlarında çıkış kontrolü, ilk parça onayı ve ara muayene yeterince uygulanmıyor.',
            why4:
                'İş talimatları ve proses kontrol kartları sahada tutarlı izlenmiyor; kritik parametreler gerçek sapmayı yakalamıyor.',
            why5:
                'Kaynak ve sızdırmazlık CTQ’ları için süreç doğrulama, kaynakçı yeterliliği ve periyodik süreç denetimi sistematik yürütülmüyor.',
            rootCause:
                'Kaynak ve birleşim süreçlerinden kaynaklanan ürün hatası; sızdırmazlık CTQ için süreç doğrulama ve kaynak disiplini yetersiz.',
            immediateAction:
                'Kaçaklı üniteler ayrıldı; ilgili kaynak istasyonları güvenli şekilde durduruldu/izole edildi; WPS ve parametreler kontrol edildi; tekrar test planlandı.',
            preventiveAction:
                'WPS requalification; kaynakçı beceri doğrulama; hat başı ilk parça sızdırmazlık testi; CTQ izleme; tekrarda üretim mühendisliği ve kök neden köprüsü.',
        },
        five_n1k_analysis: {
            ne: problem.slice(0, 400),
            nerede: record?.department || 'Üretim',
            neZaman: record?.detection_date
                ? new Date(record.detection_date).toLocaleDateString('tr-TR')
                : '',
            kim: record?.detected_by || record?.responsible_person || '',
            neden:
                'Kaynak/birleşim süreçlerinde ürün sızdırmazlık şartını karşılamıyor; süreç doğrulama ve hat içi kontrol yetersiz.',
            nasil: 'Sızdırmazlık Kontrol testi ve hat içi kontrol noktalarında tespit edilmiştir.',
        },
    };
}

/** Grup dönüşümü: çoğunlukla hat içi sızdırmazlık kontrolü */
export function buildLeakDraftAnalysesForUyGroup(group) {
    const problem = `Grup: ${group?.category || LEAK_CATEGORY} — ${group?.detection_area || LEAK_DETECTION_AREA} (${group?.records?.length || 0} kayıt, ${group?.totalQuantity ?? '-'} adet)`;
    return {
        five_why_analysis: {
            problem,
            why1:
                'Sızdırmazlık testinde kaçaklar ölçülüyor; üniteler kaynak veya kritik birleşimlerde sızdırmazlık şartını karşılamıyor.',
            why2:
                'Kaynak/birleşim ve önceki proseslerde oluşan sapmalar hat içinde yeterince giderilmiyor.',
            why3:
                'Kaynak ve sızdırmazlık kritik adımlarında çıkış kontrolü ve ara muayene zayıf veya atlanabiliyor.',
            why4:
                'Proses dokümanları ve PCC’ler sahada tutarlı izlenmiyor; kritik parametreler ölçülmüyor.',
            why5:
                'Sızdırmazlık CTQ’ları için süreç doğrulama, kaynakçı yeterliliği ve periyodik denetim kurumsal olarak yeterince bağlayıcı değil.',
            rootCause:
                'Kaynak ve birleşim süreçlerinden kaynaklanan ürün hatası; sızdırmazlık CTQ için süreç doğrulama ve kaynak disiplini yetersiz.',
            immediateAction:
                'Kaçaklı seriler izole edildi; ilgili istasyonlar güvenli şekilde durduruldu; WPS ve test planı ile teyit başlatıldı.',
            preventiveAction:
                'Hat başı sızdırmazlık testi zorunluluğu; WPS/kaynakçı matrisi; CTQ izleme; tekrarlayan hatalarda 8D beslemesi.',
        },
        five_n1k_analysis: {
            ne: problem.slice(0, 400),
            nerede: 'Üretim / İlgili birim',
            neZaman: '',
            kim: '',
            neden:
                'Kaynak ve birleşim süreçlerinde üretilen ünite sızdırmazlık şartını karşılamıyor; süreç doğrulama yetersiz.',
            nasil: 'Sızdırmazlık Kontrol ve üretim hattı kontrollerinde toplu tespit.',
        },
    };
}
