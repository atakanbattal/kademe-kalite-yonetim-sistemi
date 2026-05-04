/**
 * Veri tabanı ve içe aktarımlarda görülen OCR / eksik Türkçe harf / şablon kalıntılarını düzeltir.
 * Postgres tarafındaki public.fix_turkish_free_text ile aynı kuralları kullanır (senkron tutun).
 */
export function fixTurkishFreeText(input) {
	if (input == null || typeof input !== 'string') return input;
	let t = String(input).normalize('NFC');

	const pairs = [
		['MALIYET KAYDI DETAYLARI', 'Maliyet Kaydı Özeti'],
		['MALİYET KAYDI DETAYLARI', 'Maliyet Kaydı Özeti'],
		['Maliyet Kaydi Aciklamasi', 'Maliyet Kaydı Açıklaması'],
		['Maliyet Kaydi Açıklaması', 'Maliyet Kaydı Açıklaması'],
		['Maliyet Kaydi', 'Maliyet Kaydı'],
		['kazan igi', 'kazan içi'],
		['Kazan igi', 'Kazan içi'],
		[' içi elegin ', ' içi eleğin '],
		['Analize Giren Arac', 'Analize Giren Araç'],
		['Otomatik Baslatildi', 'Otomatik Başlatıldı'],
		['Otomatik Baslatıldı', 'Otomatik Başlatıldı'],
		['Arac Bazli', 'Araç Bazlı'],
		['Gerceklesen', 'Gerçekleşen'],
		['Toplam Katki', 'Toplam Katkı'],
		['Donem:', 'Dönem:'],
		['Donem :', 'Dönem :'],
		['aciıklaması', 'açıklaması'],
		['aciıklama', 'açıklama'],
		['aciıklik', 'açıklık'],
		['aciık', 'açık'],
		['késelerindeki', 'köşelerindeki'],
		['Késelerindeki', 'Köşelerindeki'],
		['késeler', 'köşeler'],
		['Késeler', 'Köşeler'],
		[' elegin ', ' eleğin '],
		['aracimizdaki', 'aracımızdaki'],
		['Aracimizdaki', 'Aracımızdaki'],
		[' aracimiz ', ' aracımız '],
		['Tum Zamanlar', 'Tüm Zamanlar'],
		['Arac Tipi', 'Araç Tipi'],
		[' poşet vb', ' poşet vb'],
		[' poset vb', ' poşet vb'],
		[' poset ', ' poşet '],
		[' poset.', ' poşet.'],
		[' poset,', ' poşet,'],
		[' sebebi ile ', ' sebebiyle '],
		['\nsebebi ile ', '\nsebebiyle '],
		['\tsebebi ile ', '\tsebebiyle '],
		['(sebebi ile)', '(sebebiyle)'],
	];

	for (const [from, to] of pairs) {
		if (t.includes(from)) t = t.split(from).join(to);
	}

	t = t.replace(/(^|[\s\n])sebebi ile([,\.;:!?\s]|$)/g, '$1sebebiyle$2');

	return t;
}
