import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

/**
 * Postgres `date` veya `YYYY-MM-DD` string için UTC kayması olmadan takvim günü.
 * Tam ISO zaman damgaları için yerel saat diliminde formatlar.
 */
export function formatDateOnlyLocal(value, pattern = 'dd.MM.yyyy') {
	if (value == null || value === '') return null;
	const s = typeof value === 'string' ? value.trim() : '';
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		const [y, mo, d] = s.split('-').map(Number);
		const dt = new Date(y, mo - 1, d);
		return isValid(dt) ? format(dt, pattern, { locale: tr }) : null;
	}
	const dt = value instanceof Date ? value : new Date(value);
	return isValid(dt) ? format(dt, pattern, { locale: tr }) : null;
}

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₺0,00';
    return new Intl.NumberFormat('tr-TR', { 
        style: 'currency', 
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

export function sanitizeFileName(fileName) {
    if (!fileName) return '';
    
    const sanitized = fileName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'U')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 'S')
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'I')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'O')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'C')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');

    return sanitized.replace(/__+/g, '_');
}

/**
 * Ek kayıtlarında file_name bazen yanlışlıkla tam imzalı URL olarak saklanır.
 * Arayüz ve raporlarda okunaklı dosya adı döndürür (öncelik: path son segmenti, URL path'i).
 */
export function getAttachmentDisplayName(fileName, filePath) {
    const basenameFromPath = () => {
        if (!filePath || typeof filePath !== 'string') return '';
        const parts = filePath.split('/').filter(Boolean);
        const last = parts[parts.length - 1] || '';
        try {
            return decodeURIComponent(last);
        } catch {
            return last;
        }
    };

    const pathBase = basenameFromPath();
    const raw = String(fileName ?? '').trim();
    if (!raw) return pathBase || 'Dosya';

    if (/^https?:\/\//i.test(raw)) {
        try {
            const u = new URL(raw);
            const segments = u.pathname.split('/').filter(Boolean);
            let leaf = segments[segments.length - 1] || '';
            try {
                leaf = decodeURIComponent(leaf);
            } catch {
                /* ignore */
            }
            if (leaf && /\.[a-z0-9]{2,5}$/i.test(leaf)) {
                return leaf;
            }
            return pathBase || leaf || 'Dosya';
        } catch {
            return pathBase || 'Dosya';
        }
    }

    return raw;
}

/**
 * Türkçe karakterleri normalize eder (arama için)
 * Örnek: "İzin" -> "izin", "Öğrenci" -> "ogrenci"
 * Tüm Türkçe karakter varyasyonlarını destekler (farklı Unicode kodlamaları dahil)
 */
export function normalizeTurkishForSearch(text) {
    if (!text) return '';
    
    // NFKC: önceden birleşmiş Türkçe karakterleri; ardından birleşik nokta vb. (i+U+0307) için
    let normalized = String(text).normalize('NFKC').normalize('NFC');
    
    // Türkçe karakter dönüşümleri (büyük ve küçük harf)
    const turkishCharMap = {
        'ı': 'i', 'İ': 'i', 'I': 'i', // Türkçe I ve ı -> i
        'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u',
        'ş': 's', 'Ş': 's',
        'ö': 'o', 'Ö': 'o',
        'ç': 'c', 'Ç': 'c',
        // Aksan işaretli karakterler için ek dönüşümler
        'â': 'a', 'Â': 'a',
        'î': 'i', 'Î': 'i',
        'û': 'u', 'Û': 'u',
    };
    
    // Her karakteri kontrol et ve dönüştür
    let result = '';
    for (const char of normalized) {
        const mapped = turkishCharMap[char];
        if (mapped) {
            result += mapped;
        } else {
            result += char.toLowerCase();
        }
    }
    
    // Birleşik Unicode işaretleri (ör. i + U+0307); Postgres ILIKE düz "civata" ile eşleşmez
    result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');

    // Boşlukları normalize et ve birden fazla boşluğu tek boşluğa indir
    result = result.replace(/\s+/g, ' ').trim();

    return result;
}

/**
 * PostgREST `.or()` içinde kullanılacak ilike terimini güvenli hale getirir
 * (%, _, virgül joker / ayırıcı olarak kırılmasın).
 */
export function sanitizeTermForIlikeOrFilter(raw) {
    return String(raw ?? '')
        .replace(/%/g, '')
        .replace(/_/g, '')
        .replace(/,/g, '')
        .trim();
}

/**
 * Metni camelCase formatına normalize eder (Türkçe karakterler için optimize edilmiş)
 * Her kelimenin ilk harfi büyük, geri kalanı küçük (Title Case)
 * Örnek: "BOYAHANE" -> "Boyahane", "AR-GE DİREKTÖRLÜĞÜ" -> "Ar-Ge Direktörlüğü"
 */
export function normalizeToTitleCase(text) {
    if (!text) return '';
    
    // Önce trim yap
    let normalized = String(text).trim();
    
    // Tab ve fazla boşlukları temizle
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.replace(/\t/g, '');
    
    // Özel durumlar için önce kontrol et
    const specialCases = {
        'AR-GE DİREKTÖRLÜĞÜ': 'Ar-Ge Direktörlüğü',
        'ELEKTRİKHANE': 'Elektrikhane',
        'KALİTE KONTROL MÜDÜRLÜĞÜ': 'Kalite Kontrol Müdürlüğü',
        'LOJİSTİK OPERASYON YÖNETİCİLİĞİ': 'Lojistik Operasyon Yöneticiliği',
        'SATIŞ SONRASI HİZMETLER ŞEFLİĞİ': 'Satış Sonrası Hizmetler Şefliği',
        'ÜRETİM MÜDÜRLÜĞÜ': 'Üretim Müdürlüğü',
        'ASIMETO': 'Asimeto',
        'BOSCH': 'Bosch',
        'CETA-FORM': 'Ceta Form',
        'INSIZE': 'İnsize',
        'YAMER': 'Yamer',
        'STARLINE': 'Starline',
        'UNI-T': 'Uni-T',
        'Mitutuyo': 'Mitutoyo'
    };
    
    if (specialCases[normalized]) {
        return specialCases[normalized];
    }
    
    // Genel durum için: Her kelimenin ilk harfini büyük, geri kalanını küçük yap
    return normalized
        .split(' ')
        .map(word => {
            if (!word) return '';
            // Özel durumlar: Ar-Ge, Ceta Form gibi
            if (word.includes('-')) {
                return word.split('-').map(part => {
                    if (!part) return '';
                    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
                }).join('-');
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

/**
 * Özel isimler listesi (büyük harfle korunmalı)
 */
const PROPER_NOUNS = new Set([
    'Ar-Ge', 'Asimeto', 'Bosch', 'Ceta Form', 'İnsize', 'Yamer', 'Starline', 'Uni-T', 'Mitutoyo',
    'Kademe', 'KADEME', 'KALİTE', 'KONTROL', 'MÜDÜRLÜĞÜ', 'DİREKTÖRLÜĞÜ',
    'Elektrikhane', 'Kalite Kontrol Müdürlüğü', 'Lojistik Operasyon Yöneticiliği',
    'Satış Sonrası Hizmetler Şefliği', 'Üretim Müdürlüğü'
]);

/**
 * Bir kelimenin özel isim olup olmadığını kontrol eder
 */
function isProperNoun(word) {
    if (!word) return false;
    const normalized = word.trim();
    return PROPER_NOUNS.has(normalized) || PROPER_NOUNS.has(normalized.toUpperCase());
}

/**
 * Metni sentence case formatına çevirir (uzun metinler için)
 * Sadece cümle başlarında ve noktadan sonra büyük harf kullanır
 * Özel isimleri korur
 * Örnek: "bu bir test. başka bir cümle." -> "Bu bir test. Başka bir cümle."
 */
export function normalizeToSentenceCase(text) {
    if (!text) return '';
    
    let normalized = String(text).trim();
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.replace(/\t/g, '');
    
    // Cümleleri ayır (nokta, ünlem, soru işareti)
    const sentences = normalized.split(/([.!?]\s+)/);
    
    return sentences.map((sentence, index) => {
        if (!sentence.trim()) return sentence;
        
        // Noktalama işaretleri için boşluk koru
        if (/^[.!?]\s+$/.test(sentence)) return sentence;
        
        // Cümle başını büyük harfle başlat
        let processed = sentence.trim();
        if (processed.length === 0) return sentence;
        
        // İlk karakteri büyük yap
        processed = processed.charAt(0).toUpperCase() + processed.slice(1).toLowerCase();
        
        // Kelimelere ayır ve özel isimleri kontrol et
        const words = processed.split(/(\s+)/);
        const processedWords = words.map((word, wordIndex) => {
            // Boşlukları koru
            if (/^\s+$/.test(word)) return word;
            
            // Özel isimleri koru
            const cleanWord = word.replace(/[.,!?;:]$/, '');
            const punctuation = word.replace(cleanWord, '');
            
            if (isProperNoun(cleanWord)) {
                // Özel isimleri orijinal haliyle koru (büyük harfle)
                const properNoun = Array.from(PROPER_NOUNS).find(pn => 
                    cleanWord.toLowerCase() === pn.toLowerCase()
                );
                return (properNoun || cleanWord) + punctuation;
            }
            
            return word;
        });
        
        return processedWords.join('');
    }).join('');
}

/**
 * Metni camelCase formatına çevirir (Türkçe karakter desteği ile)
 * Kısa alanlar için kullanılmalı - her kelimenin ilk harfi büyük (Title Case)
 * Örnek: "test metni" -> "Test Metni", "ÜRETİM MÜDÜRLÜĞÜ" -> "Üretim Müdürlüğü"
 */
export function toCamelCase(text) {
    if (!text || typeof text !== 'string') return text;
    return normalizeToTitleCase(text);
}

/**
 * Metin alanlarını otomatik olarak camelCase formatına çevirir
 * Input onChange handler'larında kullanılabilir (kısa alanlar için)
 */
export function formatTextInput(value) {
    if (!value || typeof value !== 'string') return value;
    return toCamelCase(value);
}

/**
 * Uzun metin alanlarını sentence case formatına çevirir
 * Textarea ve uzun açıklama alanları için kullanılmalı
 */
export function formatLongTextInput(value) {
    if (!value || typeof value !== 'string') return value;
    return normalizeToSentenceCase(value);
}

/**
 * ISO 1940-1 standardına göre izin verilen kalan dengesizlik (Uper) değerini hesaplar
 * Formül: Limit_Gram = (9550 * G * Ağırlık) / (Devir * Yarıçap_mm)
 * Çift düzlem için: Tek_Duzlem_Limiti = Limit_Gram / 2
 * 
 * @param {string} balancingGrade - Kalite sınıfı (örn: 'G2.5', 'G6.3')
 * @param {number} fanWeightKg - Fan ağırlığı (kg)
 * @param {number} operatingRpm - Çalışma devri (RPM)
 * @param {number} correctionRadiusMm - Dengeleme yarıçapı (mm) - Balans macunu/ağırlığının eklendiği mesafe
 * @returns {number} Her düzlem için izin verilen kalan dengesizlik (gr)
 */
export function calculateISO1940_1Uper(balancingGrade, fanWeightKg, operatingRpm, correctionRadiusMm = 180.0) {
    if (!balancingGrade || !fanWeightKg || !operatingRpm || operatingRpm === 0 || !correctionRadiusMm || correctionRadiusMm <= 0) {
        return 0;
    }
    
    // Kalite sınıfı değerini çıkar (G2.5 -> 2.5, G6.3 -> 6.3)
    const gradeValue = parseFloat(balancingGrade.replace('G', ''));
    
    if (isNaN(gradeValue) || gradeValue <= 0) {
        return 0;
    }
    
    // ISO 1940-1 formülü: Limit_Gram = (9550 * G * Ağırlık) / (Devir * Yarıçap_mm)
    // Toplam izin verilen gram cinsinden dengesizlik
    const totalLimitGram = (9550.0 * gradeValue * fanWeightKg) / (operatingRpm * correctionRadiusMm);
    
    // Çift düzlem için yatak başına limit
    const perPlaneLimit = totalLimitGram / 2.0;
    
    // 3 ondalık basamağa yuvarla
    return Math.round(perPlaneLimit * 1000) / 1000;
}

/**
 * Kalan ağırlık değerinin tolerans sınırları içinde olup olmadığını kontrol eder
 * 
 * @param {number} residualWeight - Kalan ağırlık (gr)
 * @param {number} uperLimit - İzin verilen limit (gr)
 * @returns {boolean} true ise PASS, false ise FAIL
 */
export function checkBalanceResult(residualWeight, uperLimit) {
    if (residualWeight === null || residualWeight === undefined || uperLimit === null || uperLimit === undefined) {
        return null;
    }
    return residualWeight <= uperLimit;
}

const TR_LOCALE = 'tr-TR';

/**
 * ASCII I ile yazılınca tr-TR toLowerCase ile bozulabilecek isimler (FATIH → fatıh olmaması için en-US title).
 * Küçük harf karşılaştırması en-US ile yapılır.
 */
const PERSONNEL_NAME_ASCII_I_EXCEPTIONS = new Set(['fatih']);

/**
 * Personel modülü metinleri: kelime başı büyük (title case), tr-TR ile I/İ/ı kuralları.
 * "Yilmaz" / "YILMAZ" → "Yılmaz"; "Yigit" / "YIGIT" → "Yiğit". "Fatih" / "FATIH" → "Fatih".
 */
function formatPersonnelBareWord(word) {
    if (!word) return word;
    const core = word.normalize('NFC');
    if (!/[A-Za-zÇçĞğİıÖöŞşÜü]/.test(core)) return word;

    const enLower = core.toLocaleLowerCase('en-US');

    if (enLower === 'yigit') {
        return 'Yiğit';
    }

    if (enLower === 'satinalma') {
        return 'Satınalma';
    }

    if (PERSONNEL_NAME_ASCII_I_EXCEPTIONS.has(enLower)) {
        const first = core.charAt(0).toLocaleUpperCase('en-US');
        const rest = core.slice(1).toLocaleLowerCase('en-US');
        return first + rest;
    }

    const hasTurkishLetter = /[ÇçĞğİıÖöŞşÜü]/.test(core);
    const asciiLettersOnly = /^[A-Za-z]+$/.test(core);

    let s;
    if (asciiLettersOnly && !hasTurkishLetter) {
        s = core.toLocaleLowerCase(TR_LOCALE);
        s = s.replace(/^([yY])([iI])(?=[lL])/g, (_, y) => `${y}\u0131`);
    } else {
        s = core.toLocaleLowerCase(TR_LOCALE);
    }

    const first = s.charAt(0).toLocaleUpperCase(TR_LOCALE);
    const rest = s.slice(1);
    return first + rest;
}

function formatPersonnelHyphenPart(segment) {
    if (!segment) return segment;
    if (segment.includes('-')) {
        return segment.split('-').map((p) => formatPersonnelBareWord(p)).join('-');
    }
    return formatPersonnelBareWord(segment);
}

/**
 * Boşluklarla ayrılmış (ve AR-GE gibi tireli) personel alanları için title case + Türkçe karakter düzeltmesi.
 * Parantez / noktalama içeren parçalar mümkün olduğunca korunur.
 */
export function formatPersonnelModuleField(text) {
    if (text == null || typeof text !== 'string') return text;
    const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    return normalized
        .split(/\s+/)
        .map((token) => {
            let pre = '';
            let post = '';
            let w = token;
            if (w.startsWith('(')) {
                pre = '(';
                w = w.slice(1);
            }
            if (w.endsWith(')')) {
                post = ')';
                w = w.slice(0, -1);
            }
            if (!w) return pre + post;
            const trailing = w.match(/([.,;:]+)$/);
            let mid = w;
            let trail = '';
            if (trailing) {
                trail = trailing[1];
                mid = w.slice(0, -trail.length);
            }
            return pre + formatPersonnelHyphenPart(mid) + trail + post;
        })
        .join(' ');
}

/**
 * Bitişik yazılmış eski camelCase birim adlarını kelimelere böler (ör. arGeDirektörlüğü → ar Ge Direktörlüğü).
 * Zaten boşluk veya tire varsa dokunulmaz.
 */
function expandStuckCamelCaseWords(s) {
    if (!s || /\s/.test(s) || /-/.test(s)) return s;
    let out = s;
    let prev = '';
    while (out !== prev) {
        prev = out;
        out = out.replace(/([a-zğüşıöç])([A-ZĞÜŞİÖÇİ])/g, '$1 $2');
    }
    return out;
}

/**
 * Ayarlardaki birim adları (cost_settings): boşluk ve tire korunur, Türkçe title case.
 * Örnek: "KALİTE MÜDÜRLÜĞÜ" → "Kalite Müdürlüğü", "AR-GE DİREKTÖRLÜĞÜ" → "Ar-Ge Direktörlüğü"
 */
export function normalizeUnitNameForSettings(text) {
    if (text == null || typeof text !== 'string') return '';
    const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const expanded = expandStuckCamelCaseWords(normalized);
    return formatPersonnelModuleField(expanded);
}

export function normalizeCostSettingsRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
        ...row,
        unit_name:
            row.unit_name != null && String(row.unit_name).trim() !== ''
                ? normalizeUnitNameForSettings(String(row.unit_name))
                : row.unit_name,
    }));
}

export function normalizeCostSettingsJoin(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (!Object.prototype.hasOwnProperty.call(obj, 'unit_name')) return obj;
    return {
        ...obj,
        unit_name: normalizeUnitNameForSettings(String(obj.unit_name ?? '')),
    };
}

function normalizeDepartmentishField(v) {
    if (v == null || v === '') return v;
    return normalizeUnitNameForSettings(String(v));
}

/** DF/8D kayıtlarında birim metinleri — boşluklu okunaklı yazıma çeker (DB’de kalan eski biçimler dahil). */
export function normalizeNonConformityUnitFields(row) {
    if (!row || typeof row !== 'object') return row;
    return {
        ...row,
        department: normalizeDepartmentishField(row.department),
        requesting_unit: normalizeDepartmentishField(row.requesting_unit),
        forwarded_unit: normalizeDepartmentishField(row.forwarded_unit),
    };
}