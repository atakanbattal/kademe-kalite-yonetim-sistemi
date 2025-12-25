import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
 * Türkçe karakterleri normalize eder (arama için)
 * Örnek: "İzin" -> "izin", "Öğrenci" -> "ogrenci"
 */
export function normalizeTurkishForSearch(text) {
    if (!text) return '';
    
    return String(text)
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c');
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