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