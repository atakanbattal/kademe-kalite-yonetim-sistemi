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